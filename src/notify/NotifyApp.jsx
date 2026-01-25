// src/notify/NotifyApp.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useToast } from '@shared/components/Toast';
import Header from '@shared/components/Header';
import LoadingSpinner from '@shared/components/LoadingSpinner';

// Import Notify-specific components
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import Archive from './components/Archive';

// Helper to parse query params
const getQueryParams = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    organizationId: params.get('organization') || params.get('locality'),
    notificationId: params.get('notification')
  };
};

export default function NotifyApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('auth');
  const [availableSubscriptions, setAvailableSubscriptions] = useState([]);
  const [targetSubscription, setTargetSubscription] = useState(null);
  const [targetOrganization, setTargetOrganization] = useState(null);
  const toast = useToast();

  const { organizationId, notificationId } = getQueryParams();
  const isEmbed = !!organizationId;

  // Fetch organizations from NEW path
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // NEW PATH: organizations/ (instead of artifacts/civquest_notifications/configuration/)
        const querySnapshot = await getDocs(collection(db, PATHS.organizations));
        const orgs = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            organizationId: docSnap.id,
            organizationName: data.name,
            items: (data.notifications || []).map(n => {
              let scheduleText = n.type;
              if (n.type === 'monthly') {
                scheduleText = `Monthly on day ${n.runDay}`;
              } else if (n.type === 'weekly') {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                scheduleText = `Weekly on ${days[n.runDay] || 'Scheduled Day'}`;
              } else if (n.type === 'daily') {
                scheduleText = "Daily";
              }

              return {
                id: n.id,
                key: `${docSnap.id}_${n.id}`,
                name: n.name,
                schedule: scheduleText,
                description: n.description,
                access: n.access || 'public'
              };
            })
          };
        });
        setAvailableSubscriptions(orgs);

        // Check for targeted URL params
        if (organizationId) {
          const org = orgs.find(l => l.organizationId === organizationId);
          if (org) {
            setTargetOrganization(org);
            if (notificationId) {
              const item = org.items.find(i => i.id === notificationId);
              if (item) {
                setTargetSubscription({ ...item, organizationName: org.organizationName });
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load configuration", err);
        toast.error("Failed to load configuration");
      }
    };
    fetchConfig();
  }, [organizationId, notificationId]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) setView('dashboard');
      else setView('auth');
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {(!isEmbed || user) && (
        <Header 
          title="CivQuest Notify"
          user={user}
          onSignOut={() => signOut(auth)}
        />
      )}

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
          />
        )}
      </main>
    </div>
  );
}