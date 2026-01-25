// src/notify/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Bell, History, Settings, Building2, Lock } from 'lucide-react';
import { useToast } from '@shared/components/Toast';

export default function Dashboard({ 
  user, 
  targetSubscription, 
  targetOrganization, 
  availableSubscriptions 
}) {
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [userSubscriptions, setUserSubscriptions] = useState({});
  const [userData, setUserData] = useState(null);
  const toast = useToast();

  // Subscribe to user data from NEW path
  useEffect(() => {
    if (!user) return;
    
    // NEW PATH: users/{uid} (instead of artifacts/civquest_notifications/users/{uid})
    const unsubscribe = onSnapshot(
      doc(db, PATHS.user(user.uid)),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setUserSubscriptions(data.subscriptions || {});
        }
      }
    );
    
    return () => unsubscribe();
  }, [user]);

  const toggleSubscription = async (key) => {
    const newValue = !userSubscriptions[key];
    try {
      // NEW PATH: users/{uid}
      await updateDoc(doc(db, PATHS.user(user.uid)), {
        [`subscriptions.${key}`]: newValue
      });
      toast.success(newValue ? 'Subscribed!' : 'Unsubscribed');
    } catch (error) {
      console.error("Toggle subscription error", error);
      toast.error("Failed to update subscription");
    }
  };

  // Filter organizations based on target
  const filteredOrgs = targetOrganization 
    ? availableSubscriptions.filter(org => org.organizationId === targetOrganization.organizationId)
    : availableSubscriptions;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton 
          active={activeTab === 'subscriptions'} 
          onClick={() => setActiveTab('subscriptions')}
          icon={<Bell className="w-4 h-4" />}
          label="Subscriptions"
        />
        <TabButton 
          active={activeTab === 'archive'} 
          onClick={() => setActiveTab('archive')}
          icon={<History className="w-4 h-4" />}
          label="Archive"
        />
        <TabButton 
          active={activeTab === 'account'} 
          onClick={() => setActiveTab('account')}
          icon={<Settings className="w-4 h-4" />}
          label="Account"
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'subscriptions' && (
        <SubscriptionsTab 
          organizations={filteredOrgs}
          userSubscriptions={userSubscriptions}
          toggleSubscription={toggleSubscription}
          targetSubscription={targetSubscription}
        />
      )}
      {activeTab === 'archive' && <ArchiveTab user={user} />}
      {activeTab === 'account' && <AccountTab user={user} userData={userData} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors
        ${active 
          ? 'border-[#004E7C] text-[#004E7C]' 
          : 'border-transparent text-slate-500 hover:text-slate-700'}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function SubscriptionsTab({ organizations, userSubscriptions, toggleSubscription, targetSubscription }) {
  return (
    <div className="space-y-6">
      {organizations.map(org => (
        <div key={org.organizationId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-slate-600" />
              <h3 className="font-bold text-slate-800">{org.organizationName}</h3>
            </div>
            {targetSubscription?.organizationName === org.organizationName && (
              <span className="text-xs bg-[#E6F0F6] text-[#004E7C] px-2 py-1 rounded-full font-bold">
                Selected
              </span>
            )}
          </div>
          
          <div className="divide-y divide-slate-100">
            {org.items.map(sub => {
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
      ))}
    </div>
  );
}

function ArchiveTab({ user }) {
  // Import and use existing Archive component
  return <div>Archive component goes here</div>;
}

function AccountTab({ user, userData }) {
  // Account settings implementation
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-600" />
        Account Settings
      </h3>
      
      <div className="p-4 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Email Address</p>
        <p className="text-slate-900 font-semibold">{user.email}</p>
      </div>
    </div>
  );
}