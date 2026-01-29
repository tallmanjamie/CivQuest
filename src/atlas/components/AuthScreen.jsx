// src/atlas/components/AuthScreen.jsx
// Authentication screen for Atlas - supports email/password and ArcGIS OAuth
// Users sign up from the organization page and are automatically assigned to that org

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
import { sendWelcomeEmail } from '@shared/services/email';
import {
  initiateArcGISLogin,
  getOAuthRedirectUri
} from '@shared/services/arcgis-auth';
import { Mail, Lock, Loader2, Map, Globe } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

export default function AuthScreen({
  orgId,
  orgName,
  themeColor = 'sky',
  oauthError,
  setOauthError
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const colors = getThemeColors(themeColor);

  // Show OAuth error if present
  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
    }
  }, [oauthError]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOauthError?.(null);

    try {
      let userUid;
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        userUid = cred.user.uid;

        // On login, ensure user has access to this org
        const userRef = doc(db, PATHS.user(userUid));
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          // Check if user is suspended
          if (userData.suspended) {
            await auth.signOut();
            setError('Your account has been suspended. Please contact the administrator.');
            setLoading(false);
            return;
          }

          // If user doesn't have access to this org, grant it
          if (orgId && !userData.atlasAccess?.[orgId]?.enabled) {
            await updateDoc(userRef, {
              [`atlasAccess.${orgId}`]: {
                enabled: true,
                grantedAt: serverTimestamp(),
                grantedBy: 'self-signup'
              }
            });
          }
        }
      } else {
        // Sign up
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        userUid = cred.user.uid;

        try {
          await sendEmailVerification(cred.user);
        } catch (emailErr) {
          console.warn("Could not send verification email:", emailErr);
        }

        // Send welcome email via Brevo
        try {
          await sendWelcomeEmail(email);
        } catch (emailErr) {
          console.warn("Could not send welcome email:", emailErr);
        }

        // Create user document with Atlas access to this organization
        const userData = {
          email: email.toLowerCase(),
          createdAt: serverTimestamp(),
          subscriptions: {},
          disabled: false,
          suspended: false
        };

        // Grant access to this organization
        if (orgId) {
          userData.atlasAccess = {
            [orgId]: {
              enabled: true,
              grantedAt: serverTimestamp(),
              grantedBy: 'self-signup'
            }
          };
        }

        await setDoc(doc(db, PATHS.user(userUid)), userData, { merge: true });
      }

    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-disabled') {
        setError('Your account has been suspended. Please contact the administrator.');
      } else {
        setError(err.message.replace('Firebase: ', ''));
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle ArcGIS OAuth login
  const handleArcGISAuth = () => {
    // Store the org ID in session storage so we can use it after OAuth callback
    if (orgId) {
      sessionStorage.setItem('atlas_signup_org', orgId);
    }
    const redirectUri = getOAuthRedirectUri();
    initiateArcGISLogin(redirectUri, isLogin ? 'signin' : 'signup');
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200 mt-12">
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
          style={{ backgroundColor: colors.bg100, color: colors.text700 }}
        >
          <Map className="w-6 h-6" />
        </div>
        {orgName ? (
          <>
            <h2 className="text-2xl font-bold text-slate-800">
              {isLogin ? 'Sign in to' : 'Sign up for'} {orgName}
            </h2>
            <p className="text-slate-500 mt-2">
              {isLogin
                ? 'Sign in to access Atlas maps and data.'
                : 'Create an account to access Atlas maps and data.'}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-800">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-500 mt-2">
              {isLogin ? 'Sign in to access Atlas.' : 'Sign up to start using Atlas.'}
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
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': colors.bg500 }}
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
              placeholder={isLogin ? "Your password" : "Create a password"}
              required
              minLength={6}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': colors.bg500 }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: colors.bg600, ':hover': { backgroundColor: colors.bg700 } }}
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
              className="font-medium hover:underline"
              style={{ color: colors.text600 }}
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
              className="font-medium hover:underline"
              style={{ color: colors.text600 }}
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
