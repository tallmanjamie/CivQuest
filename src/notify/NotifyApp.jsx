// src/notify/NotifyApp.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import {
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { Loader2, LogOut, Settings } from 'lucide-react';
import { ToastProvider } from '@shared/components/Toast';
import { formatNotificationsForDisplay } from '@shared/services/organizations';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';

// Helper to parse query params - only called once on mount
const getQueryParams = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);

  const organizationId = params.get('organization') || params.get('locality');
  const notificationId = params.get('notification');

  console.log('[Notify Signup] Checking URL params:', { organizationId, notificationId });

  return { organizationId, notificationId };
};

export default function NotifyApp() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('auth'); // auth, dashboard
  const [availableSubscriptions, setAvailableSubscriptions] = useState([]);
  const [targetSubscription, setTargetSubscription] = useState(null);
  const [targetOrganization, setTargetOrganization] = useState(null);
  const [activeTab, setActiveTab] = useState('feeds');

  // Store signup link params in state so they persist across re-renders
  const [signupParams] = useState(() => {
    const params = getQueryParams();
    console.log('[Notify Signup] Initial params stored in state:', params);
    return params;
  });

  const { organizationId, notificationId } = signupParams;

  // Check for embed parameters to conditionally hide header and adjust spacing
  const isEmbed = !!organizationId;

  // Get display name - prefer firstName/lastName, then email
  const getDisplayName = () => {
    if (userData?.firstName || userData?.lastName) {
      return [userData.firstName, userData.lastName].filter(Boolean).join(' ');
    }
    return user?.email || 'User';
  };

  // Fetch Configuration from Firestore
  useEffect(() => {
    const fetchConfig = async () => {
      console.log('[Notify Signup] fetchConfig running with params:', { organizationId, notificationId });
      try {
        const querySnapshot = await getDocs(collection(db, PATHS.organizations));
        const orgs = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            organizationId: docSnap.id,
            organizationName: data.name,
            items: formatNotificationsForDisplay(data.notifications || [], docSnap.id)
          };
        });
        setAvailableSubscriptions(orgs);
        console.log('[Notify Signup] Loaded organizations:', orgs.map(o => o.organizationId));

        // Check for targeted URL params against loaded config
        if (organizationId) {
          console.log('[Notify Signup] Looking for organization:', organizationId);
          const org = orgs.find(l => l.organizationId === organizationId);
          if (org) {
            console.log('[Notify Signup] Found target organization:', org.organizationName);
            console.log('[Notify Signup] Available notification IDs in org:', org.items.map(i => i.id));
            setTargetOrganization(org);
            if (notificationId) {
              console.log('[Notify Signup] Looking for notification:', notificationId);
              const item = org.items.find(i => i.id === notificationId);
              if (item) {
                console.log('[Notify Signup] Found target notification:', item.name, 'with key:', item.key);
                setTargetSubscription({ ...item, organizationName: org.organizationName });
              } else {
                console.warn('[Notify Signup] Notification not found in org items:', notificationId);
                console.log('[Notify Signup] Available items are:', org.items.map(i => ({ id: i.id, name: i.name })));
              }
            }
          } else {
            console.warn('[Notify Signup] Organization not found:', organizationId);
          }
        }

      } catch (err) {
        console.error("[Notify Signup] Failed to load configuration", err);
      }
    };
    fetchConfig();
  }, [organizationId, notificationId]);

  // Auth Listener
  useEffect(() => {
    let userDataUnsubscribe = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Clean up previous userData listener
      if (userDataUnsubscribe) {
        userDataUnsubscribe();
        userDataUnsubscribe = null;
      }

      if (currentUser) {
        setView('dashboard');
        // Subscribe to user data changes
        const userRef = doc(db, PATHS.user(currentUser.uid));
        userDataUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            setUserData(null);
          }
        });
      } else {
        setView('auth');
        setUserData(null);
      }
    });

    return () => {
      unsubscribe();
      if (userDataUnsubscribe) userDataUnsubscribe();
    };
  }, []);

  // Auto-subscribe user when they sign in/up via a signup link
  // This effect runs when both user and targetSubscription become available
  useEffect(() => {
    const applyAutoSubscription = async () => {
      console.log('[Notify Signup] Auto-subscribe effect triggered:', {
        hasUser: !!user,
        userId: user?.uid,
        hasTargetSubscription: !!targetSubscription,
        targetKey: targetSubscription?.key
      });

      if (!user || !targetSubscription) {
        console.log('[Notify Signup] Auto-subscribe skipped - missing user or targetSubscription');
        return;
      }

      try {
        console.log('[Notify Signup] Applying auto-subscription for key:', targetSubscription.key);
        const userRef = doc(db, PATHS.user(user.uid));
        const userSnap = await getDoc(userRef);
        const existingSubscriptions = userSnap.exists() ? (userSnap.data().subscriptions || {}) : {};

        console.log('[Notify Signup] User existing subscriptions:', Object.keys(existingSubscriptions));

        // Only subscribe if not already subscribed
        if (!existingSubscriptions[targetSubscription.key]) {
          console.log('[Notify Signup] User not yet subscribed, adding subscription...');
          await setDoc(userRef, {
            subscriptions: {
              ...existingSubscriptions,
              [targetSubscription.key]: true
            }
          }, { merge: true });
          console.log('[Notify Signup] Successfully subscribed user to:', targetSubscription.key);
        } else {
          console.log('[Notify Signup] User already subscribed to:', targetSubscription.key);
        }
      } catch (err) {
        console.error('[Notify Signup] Could not apply auto-subscription:', err);
      }
    };

    applyAutoSubscription();
  }, [user, targetSubscription]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#004E7C] w-8 h-8" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {/* Header - Conditionally rendered: Show if NOT embed OR if user IS logged in */}
        {(!isEmbed || user) && (
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <img 
                src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg" 
                alt="CivQuest Logo"
                className="h-10 w-auto object-contain rounded-sm"
              />
              <h1 className="font-bold text-xl tracking-tight text-[#004E7C]">CivQuest Notify</h1>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500 hidden sm:inline">{getDisplayName()}</span>
                <button
                  onClick={() => setActiveTab('account')}
                  className="text-sm font-medium text-slate-600 hover:text-[#004E7C] flex items-center gap-1"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <button
                  onClick={() => signOut(auth)}
                  className="text-sm font-medium text-slate-600 hover:text-red-600 flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </header>
        )}

        {/* Main Content */}
        <main className={`max-w-4xl mx-auto ${isEmbed && !user ? 'p-2' : 'p-6'}`}>
          {view === 'auth' ? (
            <AuthScreen
              targetSubscription={targetSubscription}
              targetOrganization={targetOrganization}
              isEmbed={isEmbed}
            />
          ) : (
            <Dashboard
              user={user}
              targetSubscription={targetSubscription}
              targetOrganization={targetOrganization}
              availableSubscriptions={availableSubscriptions}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
