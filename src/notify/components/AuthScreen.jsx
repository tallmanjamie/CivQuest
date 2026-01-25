// src/notify/components/AuthScreen.jsx
import React, { useState } from 'react';
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
  serverTimestamp
} from "firebase/firestore";
import { useToast } from '@shared/components/Toast';
import { Mail, Lock, Loader2, Rss } from 'lucide-react';

export default function AuthScreen({ targetSubscription, targetOrganization, isEmbed }) {
  const [isLogin, setIsLogin] = useState(!isEmbed);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userUid;
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        userUid = cred.user.uid;
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        userUid = cred.user.uid;

        try {
          await sendEmailVerification(cred.user);
        } catch (emailErr) {
          console.warn("Could not send verification email:", emailErr);
        }

        // Create user document in NEW path
        await setDoc(doc(db, PATHS.user(userUid)), {
          email: email,
          createdAt: serverTimestamp(),
          subscriptions: {},
          disabled: false
        }, { merge: true });

        // If there's a target subscription, auto-subscribe
        if (targetSubscription) {
          await setDoc(doc(db, PATHS.user(userUid)), {
            subscriptions: {
              [targetSubscription.key]: true
            }
          }, { merge: true });
        }
      }

      toast.success(isLogin ? 'Signed in successfully!' : 'Account created!');

    } catch (err) {
      console.error(err);
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

      <form onSubmit={handleAuth} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent"
              placeholder="you@example.com"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#004E7C] focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#004E7C] text-white font-semibold rounded-lg hover:bg-[#003B5C] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            isLogin ? 'Sign In' : 'Create Account'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-[#004E7C] hover:underline"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}