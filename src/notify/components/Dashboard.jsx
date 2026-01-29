// src/notify/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Rss, History, UserCog, ArrowRight } from 'lucide-react';
import SubscriptionsTab from './SubscriptionsTab';
import AccountTab from './AccountTab';
import Archive from './Archive';

export default function Dashboard({
  user,
  targetSubscription,
  targetOrganization,
  availableSubscriptions,
  activeTab: externalActiveTab,
  setActiveTab: externalSetActiveTab
}) {
  // Use external state if provided, otherwise use local state
  const [internalActiveTab, setInternalActiveTab] = useState('feeds');
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
  const setActiveTab = externalSetActiveTab || setInternalActiveTab;

  const [userSubscriptions, setUserSubscriptions] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, PATHS.user(user.uid));
    
    // Update last login
    setDoc(userRef, { 
      lastLogin: serverTimestamp(), 
      email: user.email 
    }, { merge: true }).catch(err => console.log("Last login update failed", err));

    const unsub = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserSubscriptions(data.subscriptions || {});
        setUserData(data);
      } else {
        setUserSubscriptions({});
        setUserData(null);
      }
    }, (error) => {
      console.error("Error fetching subs:", error);
      setUserSubscriptions({});
    });
    
    return () => unsub();
  }, [user]);

  return (
    <div className="space-y-8 pb-12">
      {targetSubscription && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <div className="bg-green-100 p-1 rounded-full">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium">Welcome!</p>
            <p className="text-sm">We've automatically subscribed you to <strong>{targetSubscription.name}</strong>.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('feeds')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'feeds' 
              ? 'bg-white shadow text-[#004E7C]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Rss className="w-4 h-4" />
          Feeds
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'archive' 
              ? 'bg-white shadow text-[#004E7C]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          Archive
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'account' 
              ? 'bg-white shadow text-[#004E7C]' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Account
        </button>
      </div>

      <div className="animate-in fade-in duration-300 slide-in-from-bottom-2">
        {activeTab === 'feeds' && (
          <SubscriptionsTab 
            user={user} 
            availableSubscriptions={availableSubscriptions} 
            targetOrganization={targetOrganization}
            userSubscriptions={userSubscriptions}
          />
        )}
        {activeTab === 'archive' && (
          <Archive 
            role="user"
            userSubscriptions={userSubscriptions}
            availableSubscriptions={availableSubscriptions}
            accentColor="#004E7C"
          />
        )}
        {activeTab === 'account' && (
          <AccountTab user={user} userData={userData} />
        )}
      </div>
    </div>
  );
}
