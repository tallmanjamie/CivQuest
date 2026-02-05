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
  serverTimestamp,
  deleteField
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

// Helper to parse query params - only called once on mount
const getQueryParams = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);

  // First try URL params
  let organizationId = params.get('organization') || params.get('locality');
  let notificationId = params.get('notification');

  console.log('[Notify Signup] Checking URL params:', { organizationId, notificationId });

  // If not in URL, check sessionStorage (preserved during OAuth flow)
  if (!organizationId && !notificationId) {
    try {
      const savedParams = sessionStorage.getItem('notify_signup_params');
      console.log('[Notify Signup] Checking sessionStorage:', savedParams);
      if (savedParams) {
        const parsed = JSON.parse(savedParams);
        organizationId = parsed.organization;
        notificationId = parsed.notification;
        console.log('[Notify Signup] Retrieved params from sessionStorage:', { organizationId, notificationId });
        // Clear after retrieving to prevent stale params
        sessionStorage.removeItem('notify_signup_params');
      }
    } catch (err) {
      console.warn('[Notify Signup] Could not parse saved signup params:', err);
    }
  }

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
  const [oauthProcessing, setOauthProcessing] = useState(false);
  const [oauthError, setOauthError] = useState(null);
  const [activeTab, setActiveTab] = useState('feeds');

  // Store signup link params in state so they persist across re-renders
  // This is critical for OAuth flow where re-renders happen during processing
  const [signupParams, setSignupParams] = useState(() => {
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

      console.log('[Notify Signup] OAuth callback detected, processing...');
      console.log('[Notify Signup] Current signup params from state:', { organizationId, notificationId });

      // Verify state for CSRF protection
      if (!verifyOAuthState(state)) {
        setOauthError('Invalid OAuth state. Please try again.');
        clearOAuthParams();
        return;
      }

      // Get the mode (signin or signup) that was set before redirecting
      const oauthMode = getOAuthMode() || 'signin';
      console.log('[Notify Signup] OAuth mode:', oauthMode);

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

        console.log('[Notify Signup] OAuth user email:', email);

        // Generate deterministic password based on ArcGIS credentials
        const password = await generateDeterministicPassword(agolUser.username, email);

        if (oauthMode === 'signup') {
          console.log('[Notify Signup] Creating new account via OAuth signup...');
          // SIGN UP MODE: Only create account, error if exists
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const userUid = cred.user.uid;
            console.log('[Notify Signup] Account created with uid:', userUid);

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
            console.log('[Notify Signup] User document created');

            // Send welcome email via Brevo
            try {
              await sendWelcomeEmail(email, agolUser.fullName || '');
            } catch (emailErr) {
              console.warn("[Notify Signup] Could not send welcome email:", emailErr);
            }

            // Check for invitation by email and apply subscriptions
            const inviteRef = doc(db, PATHS.invitation(email.toLowerCase()));
            const inviteSnap = await getDoc(inviteRef);

            let appliedInvitation = false;
            if (inviteSnap.exists()) {
              console.log('[Notify Signup] Found invitation for email');
              const inviteData = inviteSnap.data();
              const subscriptionsToApply = processInvitationSubscriptions(inviteData);

              if (Object.keys(subscriptionsToApply).length > 0) {
                console.log('[Notify Signup] Applying invitation subscriptions:', Object.keys(subscriptionsToApply));
                await updateDoc(doc(db, PATHS.user(userUid)), {
                  subscriptions: subscriptionsToApply
                });

                await updateDoc(inviteRef, {
                  status: 'claimed',
                  claimedAt: serverTimestamp(),
                  claimedBy: userUid
                });
                appliedInvitation = true;
              }
            }

            // Apply signup link subscription if no invitation was applied
            // Note: The auto-subscribe effect will also handle this, but applying here
            // ensures it happens immediately during signup
            if (!appliedInvitation && organizationId && notificationId) {
              const subscriptionKey = `${organizationId}_${notificationId}`;
              console.log('[Notify Signup] Applying signup link subscription:', subscriptionKey);
              await updateDoc(doc(db, PATHS.user(userUid)), {
                subscriptions: {
                  [subscriptionKey]: true
                }
              });
              console.log('[Notify Signup] Signup link subscription applied successfully');
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
            if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
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

  // Auto-subscribe user when they sign in/up via a signup link (handles OAuth flow)
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
