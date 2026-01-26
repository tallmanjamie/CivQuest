// src/atlas/hooks/useArcGISAuth.js
// Hook for ArcGIS authentication in Atlas
// Uses localStorage-based token management compatible with ArcGIS JS API

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'atlas_arcgis_auth';
const TOKEN_URL = 'https://www.arcgis.com/sharing/rest/generateToken';

/**
 * ArcGIS Authentication Hook
 * Manages ArcGIS Online authentication state with localStorage persistence
 */
export function useArcGISAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const esriIdRef = useRef(null);
  const portalRef = useRef(null);

  /**
   * Initialize ArcGIS modules and restore session
   */
  const initialize = useCallback(async () => {
    try {
      // Load ArcGIS modules
      const [Portal, esriId] = await new Promise((resolve, reject) => {
        if (typeof require === 'undefined') {
          reject(new Error('ArcGIS JS API not loaded'));
          return;
        }
        require([
          'esri/portal/Portal',
          'esri/identity/IdentityManager'
        ], (Portal, esriId) => resolve([Portal, esriId]), reject);
      });

      esriIdRef.current = esriId;

      // Restore session from localStorage
      const savedAuth = localStorage.getItem(STORAGE_KEY);
      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          esriId.initialize(parsed);
        } catch (e) {
          console.warn('[ArcGISAuth] Failed to restore session:', e);
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Check if we have valid credentials
      const hasCreds = esriId.credentials.length > 0;
      
      // Initialize Portal
      const portal = new Portal({ url: 'https://www.arcgis.com' });
      portal.authMode = hasCreds ? 'immediate' : 'anonymous';
      portalRef.current = portal;

      await portal.load();

      if (portal.user) {
        setUser({
          username: portal.user.username,
          fullName: portal.user.fullName,
          email: portal.user.email,
          thumbnailUrl: portal.user.thumbnailUrl,
          orgId: portal.user.orgId
        });
        
        // Refresh stored session
        persistSession(esriId);
      } else {
        setUser(null);
      }

      setLoading(false);
    } catch (err) {
      console.error('[ArcGISAuth] Initialization error:', err);
      
      // If we had credentials but they failed, clear them
      if (localStorage.getItem(STORAGE_KEY)) {
        localStorage.removeItem(STORAGE_KEY);
        if (esriIdRef.current) {
          esriIdRef.current.destroyCredentials();
        }
      }
      
      setError(err.message);
      setLoading(false);
    }
  }, []);

  /**
   * Persist session to localStorage
   */
  const persistSession = useCallback((esriId) => {
    try {
      const state = esriId.toJSON();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[ArcGISAuth] Failed to persist session:', e);
    }
  }, []);

  /**
   * Sign in with username/password
   */
  const signInWithCredentials = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams({
        username,
        password,
        referer: window.location.origin,
        expiration: 10080, // 7 days
        f: 'json'
      });

      const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Invalid credentials');
      }

      if (!data.token) {
        throw new Error('Server returned no token');
      }

      // Register token with IdentityManager
      if (esriIdRef.current) {
        const credential = {
          userId: username,
          token: data.token,
          server: 'https://www.arcgis.com/sharing/rest',
          ssl: true,
          expires: data.expires
        };
        esriIdRef.current.registerToken(credential);
        persistSession(esriIdRef.current);
      }

      // Reload to refresh with new credentials
      window.location.reload();
    } catch (err) {
      console.error('[ArcGISAuth] Sign in error:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [persistSession]);

  /**
   * Sign out and clear session
   */
  const signOut = useCallback(() => {
    if (esriIdRef.current) {
      esriIdRef.current.destroyCredentials();
    }
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    
    // Reload to refresh maps list
    window.location.reload();
  }, []);

  /**
   * Show sign in dialog
   * This creates a modal overlay with login form
   */
  const signIn = useCallback(() => {
    // Create and show sign-in modal
    const existingModal = document.getElementById('arcgis-signin-modal');
    if (existingModal) {
      existingModal.classList.remove('hidden');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'arcgis-signin-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="bg-sky-700 text-white p-4">
          <h2 class="text-lg font-semibold">Sign in with ArcGIS Online</h2>
          <p class="text-sm text-sky-100 mt-1">Access protected maps and enhanced features</p>
        </div>
        <form id="arcgis-signin-form" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input 
              type="text" 
              id="arcgis-username" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="Your ArcGIS Online username"
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              id="arcgis-password" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="Your password"
              required
            />
          </div>
          <div id="arcgis-signin-error" class="hidden text-sm text-red-600 bg-red-50 p-3 rounded-lg"></div>
          <div class="flex gap-3 pt-2">
            <button 
              type="button" 
              id="arcgis-signin-cancel"
              class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              id="arcgis-signin-submit"
              class="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
            >
              Sign In
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle form submission
    const form = modal.querySelector('#arcgis-signin-form');
    const errorEl = modal.querySelector('#arcgis-signin-error');
    const submitBtn = modal.querySelector('#arcgis-signin-submit');
    const cancelBtn = modal.querySelector('#arcgis-signin-cancel');

    const closeModal = () => {
      modal.classList.add('hidden');
    };

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = modal.querySelector('#arcgis-username').value;
      const password = modal.querySelector('#arcgis-password').value;
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      errorEl.classList.add('hidden');

      try {
        await signInWithCredentials(username, password);
        closeModal();
      } catch (err) {
        errorEl.textContent = err.message || 'Sign in failed. Please check your credentials.';
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });
  }, [signInWithCredentials]);

  /**
   * Check if user has access to a specific web map
   */
  const checkMapAccess = useCallback(async (itemId) => {
    if (!portalRef.current) return false;

    try {
      const result = await portalRef.current.queryItems({
        query: `id:"${itemId}"`,
        num: 1
      });
      return result.results.length > 0;
    } catch (e) {
      console.warn('[ArcGISAuth] Failed to check map access:', e);
      return false;
    }
  }, []);

  /**
   * Filter maps by accessibility
   */
  const filterAccessibleMaps = useCallback(async (maps) => {
    if (!maps?.length || !portalRef.current) return [];

    const mapIds = maps.map(m => m.webMap?.itemId).filter(Boolean);
    if (mapIds.length === 0) return maps;

    try {
      const queryString = mapIds.map(id => `id:"${id}"`).join(' OR ');
      const result = await portalRef.current.queryItems({
        query: queryString,
        num: 100
      });
      
      const accessibleIds = new Set(result.results.map(item => item.id));
      return maps.filter(m => accessibleIds.has(m.webMap?.itemId));
    } catch (e) {
      console.warn('[ArcGISAuth] Failed to filter maps:', e);
      return [];
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    // Wait for ArcGIS JS API to load
    const checkAndInit = () => {
      if (typeof require !== 'undefined') {
        initialize();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };
    checkAndInit();
  }, [initialize]);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signIn,
    signOut,
    signInWithCredentials,
    checkMapAccess,
    filterAccessibleMaps,
    esriId: esriIdRef.current,
    portal: portalRef.current
  };
}

export default useArcGISAuth;
