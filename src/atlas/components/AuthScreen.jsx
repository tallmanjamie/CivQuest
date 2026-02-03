// src/atlas/components/AuthScreen.jsx
// Authentication screen for Atlas - Esri account authentication only
// Users must have an Esri account to login

import React, { useState, useEffect } from 'react';
import {
  initiateArcGISLogin,
  getOAuthRedirectUri
} from '@shared/services/arcgis-auth';
import { Loader2, Map, Globe } from 'lucide-react';
import { getThemeColors } from '../utils/themeColors';

export default function AuthScreen({
  orgId,
  orgName,
  themeColor = 'sky',
  oauthError,
  setOauthError
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const colors = getThemeColors(themeColor);

  // Show OAuth error if present
  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
    }
  }, [oauthError]);

  // Handle ArcGIS OAuth login
  const handleArcGISAuth = () => {
    setLoading(true);
    setError('');
    setOauthError?.(null);

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
                ? 'Sign in with your Esri account to access Atlas maps and data.'
                : 'Create an account with your Esri credentials to access Atlas maps and data.'}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-800">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-500 mt-2">
              {isLogin ? 'Sign in with your Esri account to access Atlas.' : 'Sign up with your Esri account to start using Atlas.'}
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ArcGIS Sign In/Sign Up Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleArcGISAuth}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-[#0079C1] text-white rounded-lg font-medium hover:bg-[#006699] transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Globe className="w-5 h-5" />
          )}
          {isLogin ? 'Sign in with Esri Account' : 'Sign up with Esri Account'}
        </button>
        <p className="text-xs text-slate-500 text-center mt-3">
          Use your ArcGIS Online or ArcGIS Enterprise account
        </p>
      </div>

      {/* Info box about Esri account requirement */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-600 text-center">
          An Esri account is required to access this application.
          If you don't have one, you can{' '}
          <a
            href="https://www.arcgis.com/home/createaccount.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: colors.text600 }}
          >
            create a free ArcGIS account
          </a>.
        </p>
      </div>

      <div className="text-center text-sm text-slate-600">
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
