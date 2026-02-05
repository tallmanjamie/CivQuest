// src/notify/components/AuthScreen.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { useToast } from '@shared/components/Toast';
import { sendWelcomeEmail } from '@shared/services/email';
import {
  initiateArcGISLogin,
  getOAuthRedirectUri
} from '@shared/services/arcgis-auth';
import { getESRISettings } from '@shared/services/systemConfig';
import { processInvitationSubscriptions } from '@shared/services/invitations';
import { Mail, Lock, Loader2, Rss, Globe } from 'lucide-react';

export default function AuthScreen({ 
  targetSubscription, 
  targetOrganization, 
  isEmbed,
  oauthError,
  setOauthError
}) {
  const [isLogin, setIsLogin] = useState(!isEmbed);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Show OAuth error if present
  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
    }
  }, [oauthError]);

  // Handle ArcGIS OAuth login
  const handleArcGISAuth = async () => {
    console.log('[Notify Signup] Initiating ArcGIS OAuth...');

    // Fetch admin-configured ESRI client ID
    let esriClientId = null;
    try {
      const esriSettings = await getESRISettings();
      esriClientId = esriSettings?.clientId || null;
    } catch (err) {
      console.warn('[Notify Signup] Could not fetch ESRI settings, using default client ID:', err);
    }

    // Preserve URL params before OAuth redirect (they're lost during OAuth flow)
    const urlParams = new URLSearchParams(window.location.search);
    const orgParam = urlParams.get('organization') || urlParams.get('locality');
    const notifParam = urlParams.get('notification');
    console.log('[Notify Signup] Preserving URL params for OAuth redirect:', { orgParam, notifParam });
    if (orgParam || notifParam) {
      sessionStorage.setItem('notify_signup_params', JSON.stringify({
        organization: orgParam,
        notification: notifParam
      }));
      console.log('[Notify Signup] Params saved to sessionStorage');
    }

    const redirectUri = getOAuthRedirectUri();
    console.log('[Notify Signup] Redirecting to ArcGIS OAuth with mode:', isLogin ? 'signin' : 'signup');
    initiateArcGISLogin(redirectUri, isLogin ? 'signin' : 'signup', esriClientId);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOauthError?.(null);

    console.log('[Notify Signup] Email/password auth started:', {
      isLogin,
      email,
      hasTargetSubscription: !!targetSubscription,
      targetKey: targetSubscription?.key
    });

    try {
      let userUid;
      if (isLogin) {
        console.log('[Notify Signup] Signing in existing user...');
        const cred = await signInWithEmailAndPassword(auth, email, password);
        userUid = cred.user.uid;
        console.log('[Notify Signup] Signed in user:', userUid);
      } else {
        console.log('[Notify Signup] Creating new user account...');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        userUid = cred.user.uid;
        console.log('[Notify Signup] Created user:', userUid);

        try {
          await sendEmailVerification(cred.user);
        } catch (emailErr) {
          console.warn("[Notify Signup] Could not send verification email:", emailErr);
        }

        // Send welcome email via Brevo
        try {
          await sendWelcomeEmail(email);
        } catch (emailErr) {
          console.warn("[Notify Signup] Could not send welcome email:", emailErr);
        }

        await setDoc(doc(db, PATHS.user(userUid)), {
          email: email,
          createdAt: serverTimestamp(),
          subscriptions: {},
          disabled: false
        }, { merge: true });
        console.log('[Notify Signup] User document created');
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
          await setDoc(doc(db, PATHS.user(userUid)), {
            subscriptions: subscriptionsToApply,
            email: email,
            disabled: false
          }, { merge: true });

          // Mark invitation as claimed
          await updateDoc(inviteRef, {
            status: 'claimed',
            claimedAt: serverTimestamp(),
            claimedBy: userUid
          });
          appliedInvitation = true;
          console.log('[Notify Signup] Invitation subscriptions applied');
        }
      } else {
        console.log('[Notify Signup] No invitation found for email');
      }

      // Auto-subscribe from signup link (for both sign-up AND sign-in)
      // Only if no invitation was applied
      if (!appliedInvitation && targetSubscription && userUid) {
        console.log('[Notify Signup] Checking signup link subscription:', targetSubscription.key);
        // Check current subscriptions to see if already subscribed
        const userRef = doc(db, PATHS.user(userUid));
        const userSnap = await getDoc(userRef);
        const existingSubscriptions = userSnap.exists() ? (userSnap.data().subscriptions || {}) : {};

        console.log('[Notify Signup] User existing subscriptions:', Object.keys(existingSubscriptions));

        // Only subscribe if not already subscribed
        if (!existingSubscriptions[targetSubscription.key]) {
          console.log('[Notify Signup] Applying signup link subscription:', targetSubscription.key);
          await setDoc(userRef, {
            subscriptions: {
              ...existingSubscriptions,
              [targetSubscription.key]: true
            },
            email: email,
            disabled: false
          }, { merge: true });
          console.log('[Notify Signup] Signup link subscription applied successfully');
        } else {
          console.log('[Notify Signup] User already subscribed to:', targetSubscription.key);
        }
      } else if (!appliedInvitation && !targetSubscription) {
        console.log('[Notify Signup] No targetSubscription available to apply');
      }

      toast.success(isLogin ? 'Signed in successfully!' : 'Account created!');

    } catch (err) {
      console.error('[Notify Signup] Auth error:', err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-md mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200 ${isEmbed ? 'mt-2' : 'mt-12'}`}>
      <div className="text-center mb-8">
        {targetSubscription ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E6F0F6] text-[#004E7C] mb-4">
              <Rss className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Sign up for {targetSubscription.organizationName}</h2>
            <p className="text-slate-500 mt-2">
              Create an account to receive <strong>{targetSubscription.name}</strong> feeds.
            </p>
          </>
        ) : targetOrganization ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#E6F0F6] text-[#004E7C] mb-4">
              <Rss className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Sign up for {targetOrganization.organizationName}</h2>
            <p className="text-slate-500 mt-2">
              Create an account to manage feeds for <strong>{targetOrganization.organizationName}</strong>.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-800">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="text-slate-500 mt-2">
              {isLogin ? 'Sign in to manage your notifications.' : 'Sign up to start receiving notifications.'}
            </p>
          </>
        )}
      </div>

      {/* ArcGIS Sign In/Sign Up Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleArcGISAuth}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#0079C1] text-white rounded-lg font-medium hover:bg-[#006699] transition-colors"
        >
          <Globe className="w-5 h-5" />
          {isLogin ? 'Sign in with ArcGIS' : 'Sign up with ArcGIS'}
        </button>
        <p className="text-xs text-slate-500 text-center mt-2">
          Use your ArcGIS Online or Enterprise account
        </p>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-slate-500">or continue with email</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003d61] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {isLogin ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-600">
        {isLogin ? (
          <>
            Don't have an account?{' '}
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
                setOauthError?.(null);
              }}
              className="text-[#004E7C] font-medium hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
                setOauthError?.(null);
              }}
              className="text-[#004E7C] font-medium hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
