// src/notify/components/SubscriptionsTab.jsx
import React, { useMemo } from 'react';
import { db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Building2, Lock } from 'lucide-react';

export default function SubscriptionsTab({ 
  user, 
  availableSubscriptions, 
  targetOrganization, 
  userSubscriptions 
}) {
  // Sort available subscriptions to put the target organization first if present
  const sortedSubscriptions = useMemo(() => {
    if (!targetOrganization) return availableSubscriptions;
    return [...availableSubscriptions].sort((a, b) => {
      if (a.organizationId === targetOrganization.organizationId) return -1;
      if (b.organizationId === targetOrganization.organizationId) return 1;
      return 0;
    });
  }, [availableSubscriptions, targetOrganization]);

  // Check if user has any subscriptions at all
  const hasAnySubscription = useMemo(() => {
    if (!userSubscriptions) return false;
    return Object.values(userSubscriptions).some(v => v === true);
  }, [userSubscriptions]);

  // Check if there's a target org that should be shown regardless
  const hasVisibleOrgs = useMemo(() => {
    if (targetOrganization) return true;
    return hasAnySubscription;
  }, [targetOrganization, hasAnySubscription]);

  // Extract org ID from a subscription key (format: "orgId_notifId").
  // Org IDs may contain underscores, so we match against known organizations.
  const extractOrgIdFromKey = (subscriptionKey) => {
    for (const org of availableSubscriptions) {
      if (subscriptionKey.startsWith(org.organizationId + '_')) {
        return org.organizationId;
      }
    }
    return null;
  };

  const toggleSubscription = async (subKey) => {
    const userRef = doc(db, PATHS.user(user.uid));
    const currentStatus = userSubscriptions ? userSubscriptions[subKey] : false;
    const newValue = !currentStatus;

    try {
      await setDoc(userRef, {
        subscriptions: { [subKey]: newValue },
        email: user.email,
        disabled: false
      }, { merge: true });

      // Also update org-specific notifySubscribers subcollection for org admin access
      const orgId = extractOrgIdFromKey(subKey);
      if (orgId) {
        try {
          await syncNotifySubscriber(user.uid, user.email, orgId, subKey, newValue, userSubscriptions);
        } catch (syncErr) {
          // Log but don't fail - primary subscription update succeeded
          console.warn('Failed to sync notifySubscribers:', syncErr);
        }
      }
    } catch (err) {
      console.error("Toggle failed", err);
    }
  };

  // Sync user's subscription status to org-specific notifySubscribers subcollection
  const syncNotifySubscriber = async (uid, email, orgId, changedKey, newValue, currentSubscriptions) => {
    const subscriberRef = doc(db, PATHS.notifySubscriber(orgId, uid));
    const subscriberSnap = await getDoc(subscriberRef);

    // Build updated subscriptions for this org
    const updatedOrgSubscriptions = {};
    if (currentSubscriptions) {
      Object.entries(currentSubscriptions).forEach(([key, value]) => {
        if (key.startsWith(`${orgId}_`)) {
          updatedOrgSubscriptions[key] = key === changedKey ? newValue : value;
        }
      });
    }
    updatedOrgSubscriptions[changedKey] = newValue;

    // Check if user has any active subscriptions to this org
    const hasActiveSubscription = Object.values(updatedOrgSubscriptions).some(v => v === true);

    if (subscriberSnap.exists()) {
      if (hasActiveSubscription) {
        await updateDoc(subscriberRef, {
          subscriptions: updatedOrgSubscriptions,
          updatedAt: serverTimestamp()
        });
      } else {
        // No active subscriptions - remove from org's subscriber list
        await deleteDoc(subscriberRef);
      }
    } else if (hasActiveSubscription) {
      // New subscriber - create entry
      await setDoc(subscriberRef, {
        uid,
        email,
        subscriptions: updatedOrgSubscriptions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  };

  // Early return AFTER all hooks have been called
  if (userSubscriptions === null) {
    return <div className="py-12 text-center text-slate-500">Loading your preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#004E7C]" />
            Your Organizations
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Showing organizations where you have active subscriptions.
          </p>
        </div>
      </div>

      {!hasVisibleOrgs ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-slate-600 font-medium mb-2">No organizations yet</p>
          <p className="text-slate-400 text-sm">
            You'll see organizations here once you subscribe to feeds via a direct invitation link.
          </p>
        </div>
      ) : sortedSubscriptions.length === 0 ? (
        <p className="text-slate-400 italic">No feeds are currently active.</p>
      ) : sortedSubscriptions.map((org) => {
        // Check if user has ANY subscription in this organization
        const hasOrgSubscription = org.items.some(item => userSubscriptions[item.key] === true);
        
        // Check if this is the target organization from URL (allow viewing for new subscriptions)
        const isTargetOrg = targetOrganization && targetOrganization.organizationId === org.organizationId;
        
        // If user has no subscriptions in this org AND it's not the target org, hide the entire organization
        if (!hasOrgSubscription && !isTargetOrg) return null;

        // Filter visible notifications for this org
        const visibleItems = org.items.filter(sub => {
          const isSubscribed = userSubscriptions[sub.key] === true;
          // Show public notifications (since user has org access) OR private notifications user is subscribed to
          return sub.access === 'public' || isSubscribed;
        });

        // Safety check: if no items are visible for this org, hide the org block
        if (visibleItems.length === 0) return null;

        return (
          <div key={org.organizationId} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 font-medium text-slate-700 flex justify-between items-center">
              <span>{org.organizationName}</span>
              {targetOrganization && targetOrganization.organizationId === org.organizationId && (
                <span className="text-xs bg-[#E6F0F6] text-[#004E7C] px-2 py-1 rounded-full font-bold">Selected</span>
              )}
            </div>
            
            <div className="divide-y divide-slate-100">
              {visibleItems.map((sub) => {
                const isSubscribed = userSubscriptions[sub.key] === true;
                
                return (
                  <div key={sub.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-slate-900">{sub.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSubscribed ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {sub.schedule}
                        </span>
                        {sub.access === 'private' && (
                          <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            <Lock className="w-3 h-3" /> Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{sub.description}</p>
                    </div>

                    <button
                      onClick={() => toggleSubscription(sub.key)}
                      className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#004E7C] focus:ring-offset-2
                        ${isSubscribed ? 'bg-[#004E7C]' : 'bg-slate-200'}
                      `}
                    >
                      <span className="sr-only">Toggle subscription</span>
                      <span
                        aria-hidden="true"
                        className={`
                          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                          ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
