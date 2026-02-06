/**
 * ArcGIS OAuth Authentication Utilities
 * src/shared/services/arcgis-auth.js
 * 
 * This module provides OAuth 2.0 authentication with ArcGIS Online (AGOL)
 * allowing users to sign in with their Esri accounts.
 * 
 * The OAuth flow:
 * 1. User clicks "Sign in with ArcGIS"
 * 2. User is redirected to ArcGIS OAuth authorize endpoint
 * 3. After login, AGOL redirects back with an authorization code
 * 4. We exchange the code for an access token
 * 5. We fetch user profile info (email, org, fullName, etc.)
 */

// ArcGIS OAuth Configuration
const DEFAULT_ARCGIS_CLIENT_ID = 'SPmTwmqIB2qEz51L';
const ARCGIS_OAUTH_BASE = 'https://www.arcgis.com/sharing/rest/oauth2';

// Storage key for OAuth client ID (to persist across redirect)
const OAUTH_CLIENT_ID_KEY = 'arcgis_oauth_client_id';

/**
 * Gets the OAuth redirect URI based on current location
 * Includes the current pathname so OAuth callbacks route to the correct app
 * (important for local dev where apps are path-routed: /admin, /atlas, etc.)
 * @returns {string} The redirect URI for OAuth callbacks
 */
export function getOAuthRedirectUri() {
  if (typeof window === 'undefined') return '';

  const { protocol, hostname, port, pathname } = window.location;
  const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';

  // Include pathname so callback returns to the correct app in dev
  // In production (subdomain routing), pathname is typically '/'
  return `${protocol}//${hostname}${portSuffix}${pathname}`;
}

/**
 * Generates the OAuth authorization URL for ArcGIS Online
 * @param {string} redirectUri - The URL to redirect back to after auth
 * @param {string} state - Optional state parameter for CSRF protection
 * @param {string} clientId - Optional client ID (uses admin-configured or default if not provided)
 * @returns {string} The full authorization URL
 */
export function getArcGISAuthUrl(redirectUri, state = '', clientId = null) {
  const effectiveClientId = clientId || DEFAULT_ARCGIS_CLIENT_ID;
  const params = new URLSearchParams({
    client_id: effectiveClientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    expiration: 20160, // 14 days in minutes
    state: state || crypto.randomUUID?.() || Math.random().toString(36).substring(7)
  });

  return `${ARCGIS_OAUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchanges an authorization code for an access token
 * @param {string} code - The authorization code from the callback
 * @param {string} redirectUri - Must match the redirect URI used in the auth request
 * @param {string} clientId - Optional client ID (uses stored or default if not provided)
 * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number, username: string}>}
 */
export async function exchangeCodeForToken(code, redirectUri, clientId = null) {
  // Use provided clientId, or try to get stored one from initiateArcGISLogin, or use default
  const effectiveClientId = clientId || getStoredOAuthClientId() || DEFAULT_ARCGIS_CLIENT_ID;
  const params = new URLSearchParams({
    client_id: effectiveClientId,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri
  });

  const response = await fetch(`${ARCGIS_OAUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  
  return data;
}

/**
 * Fetches the user's profile information from ArcGIS Online
 * @param {string} accessToken - The OAuth access token
 * @param {string} username - The username from the token response
 * @returns {Promise<ArcGISUserProfile>}
 */
export async function getArcGISUserProfile(accessToken, username) {
  const params = new URLSearchParams({
    token: accessToken,
    f: 'json'
  });

  const response = await fetch(
    `https://www.arcgis.com/sharing/rest/community/users/${username}?${params.toString()}`
  );

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch user profile');
  }
  
  return data;
}

/**
 * Fetches the user's organization information from ArcGIS Online
 * @param {string} accessToken - The OAuth access token
 * @param {string} orgId - The organization ID from the user profile
 * @returns {Promise<ArcGISOrganization>}
 */
export async function getArcGISOrganization(accessToken, orgId) {
  const params = new URLSearchParams({
    token: accessToken,
    f: 'json'
  });

  const response = await fetch(
    `https://www.arcgis.com/sharing/rest/portals/${orgId}?${params.toString()}`
  );

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch organization');
  }
  
  return data;
}

/**
 * Complete OAuth flow - exchanges code and fetches user info
 * @param {string} code - Authorization code from callback
 * @param {string} redirectUri - The redirect URI
 * @returns {Promise<{token: object, user: object, org: object|null}>}
 */
export async function completeArcGISOAuth(code, redirectUri) {
  // Exchange code for token
  const tokenData = await exchangeCodeForToken(code, redirectUri);
  
  // Fetch user profile
  const userProfile = await getArcGISUserProfile(tokenData.access_token, tokenData.username);
  
  // Fetch organization if user belongs to one
  let orgData = null;
  if (userProfile.orgId) {
    try {
      orgData = await getArcGISOrganization(tokenData.access_token, userProfile.orgId);
    } catch (err) {
      console.warn('Could not fetch organization:', err);
    }
  }
  
  return {
    token: tokenData,
    user: userProfile,
    org: orgData
  };
}

/**
 * Checks if the current URL contains an OAuth callback
 * @returns {{code: string|null, state: string|null, error: string|null}}
 */
export function parseOAuthCallback() {
  if (typeof window === 'undefined') return { code: null, state: null, error: null };
  
  const params = new URLSearchParams(window.location.search);
  
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description')
  };
}

/**
 * Clears OAuth parameters from the URL without reloading
 */
export function clearOAuthParams() {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  
  window.history.replaceState({}, '', url.toString());
}

/**
 * Stores OAuth state for CSRF protection
 * @param {string} state - The state value to store
 */
export function storeOAuthState(state) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('arcgis_oauth_state', state);
  }
}

/**
 * Verifies and clears stored OAuth state
 * @param {string} state - The state from the callback
 * @returns {boolean} Whether the state matches
 */
export function verifyOAuthState(state) {
  if (typeof sessionStorage === 'undefined') return true;
  
  const storedState = sessionStorage.getItem('arcgis_oauth_state');
  sessionStorage.removeItem('arcgis_oauth_state');
  
  return !storedState || storedState === state;
}

/**
 * Stores the OAuth mode (signin or signup) before redirecting
 * @param {string} mode - 'signin' or 'signup'
 */
export function storeOAuthMode(mode) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('arcgis_oauth_mode', mode);
  }
}

/**
 * Gets and clears the stored OAuth mode
 * @returns {string|null} The mode ('signin' or 'signup') or null
 */
export function getOAuthMode() {
  if (typeof sessionStorage === 'undefined') return null;
  
  const mode = sessionStorage.getItem('arcgis_oauth_mode');
  sessionStorage.removeItem('arcgis_oauth_mode');
  return mode;
}

/**
 * Stores the OAuth client ID for use after redirect
 * @param {string} clientId - The client ID to store
 */
export function storeOAuthClientId(clientId) {
  if (typeof sessionStorage !== 'undefined' && clientId) {
    sessionStorage.setItem(OAUTH_CLIENT_ID_KEY, clientId);
  }
}

/**
 * Gets and clears the stored OAuth client ID
 * @returns {string|null} The stored client ID or null
 */
export function getStoredOAuthClientId() {
  if (typeof sessionStorage === 'undefined') return null;

  const clientId = sessionStorage.getItem(OAUTH_CLIENT_ID_KEY);
  sessionStorage.removeItem(OAUTH_CLIENT_ID_KEY);
  return clientId;
}

/**
 * Stores which CivQuest app initiated the OAuth flow (for routing on callback)
 * @param {string} app - The app name ('admin', 'atlas', etc.)
 */
export function storeOAuthApp(app) {
  if (typeof sessionStorage !== 'undefined' && app) {
    sessionStorage.setItem('civquest_oauth_app', app);
  }
}

/**
 * Gets and clears the stored OAuth app origin
 * @returns {string|null} The app name or null
 */
export function getOAuthApp() {
  if (typeof sessionStorage === 'undefined') return null;

  const app = sessionStorage.getItem('civquest_oauth_app');
  // Don't clear here - let the consuming code clear it after successful handling
  return app;
}

/**
 * Clears the stored OAuth app origin
 */
export function clearOAuthApp() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('civquest_oauth_app');
  }
}

/**
 * Initiates the ArcGIS OAuth flow by redirecting the user
 * @param {string} redirectUri - Where to redirect after auth
 * @param {string} mode - 'signin' or 'signup' to track the user's intent
 * @param {string} clientId - Optional client ID (uses admin-configured or default if not provided)
 */
export function initiateArcGISLogin(redirectUri, mode = 'signin', clientId = null) {
  const state = crypto.randomUUID?.() || Math.random().toString(36).substring(7);
  storeOAuthState(state);
  storeOAuthMode(mode);

  // Store client ID so it can be used after OAuth redirect
  if (clientId) {
    storeOAuthClientId(clientId);
  }

  const authUrl = getArcGISAuthUrl(redirectUri, state, clientId);
  window.location.href = authUrl;
}

/**
 * Generates a deterministic password for Firebase auth based on ArcGIS credentials.
 * This allows users to sign in repeatedly with ArcGIS OAuth since the same
 * password will be generated each time for the same user.
 * 
 * @param {string} username - ArcGIS username
 * @param {string} visibleId - A visible identifier (email or orgId) for additional entropy
 */
export async function generateDeterministicPassword(username, visibleId) {
  // Create a deterministic string from ArcGIS credentials
  const dataString = `arcgis_oauth_${username}_${visibleId}_civquest_notify_v1`;
  
  // Use Web Crypto API to create a hash
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert hash to base64-like string for password
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars[hashArray[i] % chars.length];
  }
  
  // Add special chars to meet password requirements
  password += '!Aa1';
  
  return password;
}

/**
 * Generates a secure random password (for non-OAuth use cases)
 */
export function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomValues = new Uint32Array(24);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 24; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

/**
 * Checks if a webmap is publicly accessible (no authentication required)
 * @param {string} itemId - The ArcGIS Portal item ID
 * @param {string} portalUrl - The portal URL (default: https://www.arcgis.com)
 * @returns {Promise<{isPublic: boolean, item: object|null, error: string|null}>}
 */
export async function checkWebmapPublicAccess(itemId, portalUrl = 'https://www.arcgis.com') {
  if (!itemId) {
    return { isPublic: false, item: null, error: 'No item ID provided' };
  }

  try {
    // Query the item without authentication
    const response = await fetch(
      `${portalUrl}/sharing/rest/content/items/${itemId}?f=json`
    );

    const data = await response.json();

    if (data.error) {
      // If we get an error, the item is likely private or doesn't exist
      return {
        isPublic: false,
        item: null,
        error: data.error.message || 'Item not accessible'
      };
    }

    // Check the access level - "public" means anyone can view
    const isPublic = data.access === 'public';

    return {
      isPublic,
      item: data,
      error: null
    };
  } catch (err) {
    console.warn('[ArcGIS Auth] Error checking webmap access:', err);
    return {
      isPublic: false,
      item: null,
      error: err.message
    };
  }
}

/**
 * Checks accessibility of multiple webmaps at once
 * @param {Array<{itemId: string, portalUrl?: string}>} webmaps - Array of webmap configs
 * @returns {Promise<Map<string, {isPublic: boolean, item: object|null, error: string|null}>>}
 */
export async function checkMultipleWebmapsAccess(webmaps) {
  const results = new Map();

  const checks = webmaps.map(async (webmap) => {
    const itemId = webmap.itemId || webmap.webMap?.itemId;
    const portalUrl = webmap.portalUrl || webmap.webMap?.portalUrl || 'https://www.arcgis.com';

    if (!itemId) {
      results.set(itemId, { isPublic: false, item: null, error: 'No item ID' });
      return;
    }

    const result = await checkWebmapPublicAccess(itemId, portalUrl);
    results.set(itemId, result);
  });

  await Promise.all(checks);
  return results;
}

// Token storage key
const ARCGIS_TOKEN_KEY = 'atlas_arcgis_oauth_token';

/**
 * Stores the ArcGIS OAuth token for later use in authenticated API calls
 * @param {object} tokenData - The token data from OAuth flow (access_token, expires_in, refresh_token, username)
 */
export function storeArcGISToken(tokenData) {
  if (typeof localStorage === 'undefined' || !tokenData?.access_token) return;

  const storageData = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    username: tokenData.username,
    // Store expiration as absolute timestamp
    expires_at: Date.now() + (tokenData.expires_in * 1000),
    stored_at: Date.now()
  };

  localStorage.setItem(ARCGIS_TOKEN_KEY, JSON.stringify(storageData));
}

/**
 * Retrieves the stored ArcGIS OAuth token
 * @returns {object|null} The token data or null if not found/expired
 */
export function getStoredArcGISToken() {
  if (typeof localStorage === 'undefined') return null;

  const stored = localStorage.getItem(ARCGIS_TOKEN_KEY);
  if (!stored) return null;

  try {
    const data = JSON.parse(stored);

    // Check if token is expired (with 5 minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (data.expires_at && data.expires_at < Date.now() + bufferMs) {
      // Token is expired or about to expire
      clearStoredArcGISToken();
      return null;
    }

    return data;
  } catch (e) {
    console.warn('[ArcGIS Auth] Error reading stored token:', e);
    clearStoredArcGISToken();
    return null;
  }
}

/**
 * Clears the stored ArcGIS OAuth token
 */
export function clearStoredArcGISToken() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(ARCGIS_TOKEN_KEY);
}

/**
 * Checks if user has access to specific webmaps using their stored OAuth token
 * @param {Array<string>} itemIds - Array of ArcGIS item IDs to check
 * @param {string} portalUrl - The portal URL (default: https://www.arcgis.com)
 * @returns {Promise<Set<string>>} Set of accessible item IDs
 */
export async function checkPrivateWebmapsAccess(itemIds, portalUrl = 'https://www.arcgis.com') {
  const tokenData = getStoredArcGISToken();
  if (!tokenData?.access_token || !itemIds?.length) {
    return new Set();
  }

  try {
    // Query portal for items the user can access
    const queryString = itemIds.map(id => `id:"${id}"`).join(' OR ');
    const params = new URLSearchParams({
      q: queryString,
      num: '100',
      token: tokenData.access_token,
      f: 'json'
    });

    const response = await fetch(
      `${portalUrl}/sharing/rest/search?${params.toString()}`
    );

    const data = await response.json();

    if (data.error) {
      console.warn('[ArcGIS Auth] Error checking private webmaps:', data.error.message);
      return new Set();
    }

    // Return set of accessible item IDs
    const accessibleIds = new Set();
    if (data.results) {
      data.results.forEach(item => accessibleIds.add(item.id));
    }

    return accessibleIds;
  } catch (err) {
    console.warn('[ArcGIS Auth] Error checking private webmaps access:', err);
    return new Set();
  }
}

// Default export for convenience
export default {
  getOAuthRedirectUri,
  getArcGISAuthUrl,
  exchangeCodeForToken,
  getArcGISUserProfile,
  getArcGISOrganization,
  completeArcGISOAuth,
  parseOAuthCallback,
  clearOAuthParams,
  storeOAuthState,
  verifyOAuthState,
  storeOAuthMode,
  getOAuthMode,
  storeOAuthClientId,
  getStoredOAuthClientId,
  storeOAuthApp,
  getOAuthApp,
  clearOAuthApp,
  initiateArcGISLogin,
  generateSecurePassword,
  generateDeterministicPassword,
  checkWebmapPublicAccess,
  checkMultipleWebmapsAccess,
  storeArcGISToken,
  getStoredArcGISToken,
  clearStoredArcGISToken,
  checkPrivateWebmapsAccess
};
