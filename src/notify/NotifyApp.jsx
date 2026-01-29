// src/notify/NotifyApp.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import {
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { Loader2, LogOut, Settings } from 'lucide-react';
import { ToastProvider } from '@shared/components/Toast';
import {
  parseOAuthCallback,
  clearOAuthParams,
  verifyOAuthState,
  completeArcGISOAuth,
  generateDeterministicPassword,
  getOAuthMode,
  getOAuthRedirectUri
} from '@shared/services/arcgis-auth';
import { sendWelcomeEmail } from '@shared/services/email';
import { processInvitationSubscriptions } from '@shared/services/invitations';
import { formatNotificationsForDisplay } from '@shared/services/organizations';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';

// Helper to parse query params
const getQueryParams = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    // Support both new 'organization' and legacy 'locality' params
    organizationId: params.get('organization') || params.get('locality'),
    notificationId: params.get('notification')
  };
};

export default function NotifyApp() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('auth'); // auth, dashboard
  const [availableSubscriptions, setAvailableSubscriptions] = useState([]);
  const [targetSubscription, setTargetSubscription] = useState(null);
  const [targetOrganization, setTargetOrganization] = useState(null);
  const [oauthProcessing, setOauthProcessing] = useState(false);
  const [oauthError, setOauthError] = useState(null);
  const [activeTab, setActiveTab] = useState('feeds');

  // Check for embed parameters to conditionally hide header and adjust spacing
  const { organizationId, notificationId } = getQueryParams();
  const isEmbed = !!organizationId;

  // Get display name - prefer firstName/lastName, then email
  const getDisplayName = () => {
    if (userData?.firstName || userData?.lastName) {
      return [userData.firstName, userData.lastName].filter(Boolean).join(' ');
    }
    return user?.email || 'User';
  };

  // Handle OAuth callback on mount
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { code, state, error, errorDescription } = parseOAuthCallback();
      
      if (error) {
        setOauthError(errorDescription || error);
        clearOAuthParams();
        return;
      }
      
      if (!code) return;
      
      // Verify state for CSRF protection
      if (!verifyOAuthState(state)) {
        setOauthError('Invalid OAuth state. Please try again.');
        clearOAuthParams();
        return;
      }
      
      // Get the mode (signin or signup) that was set before redirecting
      const oauthMode = getOAuthMode() || 'signin';
      
      setOauthProcessing(true);
      
      try {
        const redirectUri = getOAuthRedirectUri();
        const { token, user: agolUser, org: agolOrg } = await completeArcGISOAuth(code, redirectUri);
        
        // Clear OAuth params from URL
        clearOAuthParams();
        
        // Get email from AGOL user profile
        const email = agolUser.email;
        if (!email) {
          throw new Error('No email address found in your ArcGIS account. Please ensure your ArcGIS profile has an email address.');
        }
        
        // Generate deterministic password based on ArcGIS credentials
        const password = await generateDeterministicPassword(agolUser.username, email);
        
        if (oauthMode === 'signup') {
          // SIGN UP MODE: Only create account, error if exists
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const userUid = cred.user.uid;
            
            // Build user document with AGOL data
            const userData = {
              email: email.toLowerCase(),
              createdAt: serverTimestamp(),
              subscriptions: {},
              disabled: false,
              linkedArcGISUsername: agolUser.username,
              arcgisProfile: {
                username: agolUser.username,
                fullName: agolUser.fullName || '',
                email: agolUser.email,
                orgId: agolUser.orgId || null,
                linkedAt: new Date().toISOString()
              }
            };
            
            if (agolOrg) {
              userData.arcgisOrganization = {
                id: agolOrg.id,
                name: agolOrg.name,
                urlKey: agolOrg.urlKey || null
              };
            }
            
            await setDoc(doc(db, PATHS.user(userUid)), userData);
            
            // Send welcome email via Brevo
            try {
              await sendWelcomeEmail(email, agolUser.fullName || '');
            } catch (emailErr) {
              console.warn("Could not send welcome email:", emailErr);
            }
            
            // Check for invitation by email and apply subscriptions
            const inviteRef = doc(db, PATHS.invitation(email.toLowerCase()));
            const inviteSnap = await getDoc(inviteRef);
            
            if (inviteSnap.exists()) {
              const inviteData = inviteSnap.data();
              const subscriptionsToApply = processInvitationSubscriptions(inviteData);

              if (Object.keys(subscriptionsToApply).length > 0) {
                await updateDoc(doc(db, PATHS.user(userUid)), {
                  subscriptions: subscriptionsToApply
                });

                await updateDoc(inviteRef, {
                  status: 'claimed',
                  claimedAt: serverTimestamp(),
                  claimedBy: userUid
                });
              }
            }
            
            // Wait for auth state to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
              setOauthError(`An account with email ${email} already exists. Please use the Sign In option instead.`);
            } else {
              throw authErr;
            }
          }
          
        } else {
          // SIGN IN MODE: Only sign in, error if account doesn't exist
          try {
            await signInWithEmailAndPassword(auth, email, password);
            // Wait for auth state to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (signInErr) {
            if (signInErr.code === 'auth/wrong-password') {
              // Account exists but password doesn't match - wasn't created with ArcGIS
              setOauthError(`An account with email ${email} exists but wasn't created with ArcGIS. Please sign in with your email and password, then link your ArcGIS account in Account Settings.`);
            } else if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
              // Check if it's because account doesn't exist or wrong password
              try {
                // Test if account exists by attempting to create
                const testCred = await createUserWithEmailAndPassword(auth, email, password);
                // Account didn't exist - delete and show error
                await testCred.user.delete();
                setOauthError(`No account found with email ${email}. Please use the Create Account option first.`);
              } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                  // Account exists but wasn't created with ArcGIS
                  setOauthError(`An account with email ${email} exists but wasn't created with ArcGIS. Please sign in with your email and password, then link your ArcGIS account in Account Settings.`);
                } else {
                  setOauthError(`No account found with email ${email}. Please use the Create Account option first.`);
                }
              }
            } else {
              throw signInErr;
            }
          }
        }
        
      } catch (err) {
        console.error('OAuth error:', err);
        setOauthError(err.message || 'Failed to sign in with ArcGIS. Please try again.');
      } finally {
        setOauthProcessing(false);
      }
    };
    
    handleOAuthCallback();
  }, []);

  // Fetch Configuration from Firestore
  useEffect(() => {
    const fetchConfig = async () => {
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

        // Check for targeted URL params against loaded config
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

  if (loading || oauthProcessing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-[#004E7C] w-8 h-8" />
        {oauthProcessing && (
          <p className="text-slate-600 text-sm">Signing in with ArcGIS...</p>
        )}
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
              oauthError={oauthError}
              setOauthError={setOauthError}
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
