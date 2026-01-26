// src/admin/components/NotificationWizard.jsx
// AI-powered Notification Discovery Wizard
// Migrated to CivQuest unified admin app
// Uses unified Firestore paths (organizations/, users/, admins/)
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wand2, 
  Map as MapIcon, 
  Layers, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Check, 
  X, 
  Loader2, 
  AlertCircle, 
  Globe, 
  Server, 
  User, 
  Users,
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  TrendingUp,
  Clock,
  Calendar,
  Database,
  FileText,
  Zap,
  CheckCircle,
  ArrowRight,
  Plus,
  Settings,
  Cpu,
  Target,
  BarChart3,
  Star,
  ExternalLink,
  KeyRound,
  Search
} from 'lucide-react';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';

// Import shared services
import { PATHS } from '../../shared/services/paths';

// Centralized Gemini configuration - update model in one place
import { getGeminiUrl, GEMINI_CREATIVE_CONFIG, GEMINI_STRUCTURED_CONFIG } from '../../config/geminiConfig';

// Configuration for the Proxy Service
const PROXY_BASE_URL = window.ARCGIS_PROXY_URL || 'https://notify.civ.quest';

/**
 * NotificationWizard Component
 * * A wizard that helps users discover and set up notifications
 * from their ArcGIS web maps automatically.
 */
export default function NotificationWizard({ 
  isOpen, 
  onClose, 
  db, 
  orgId, 
  orgData, 
  addToast,
  userEmail,
  onNotificationsCreated,
  accentColor = '#1E5631' 
}) {
  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Authentication State
  const [accountType, setAccountType] = useState('online');
  const [portalUrl, setPortalUrl] = useState('https://www.arcgis.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [portalUser, setPortalUser] = useState(null);
  
  // Loading / Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Discovered Data
  const [topWebMaps, setTopWebMaps] = useState([]);
  const [selectedWebMaps, setSelectedWebMaps] = useState([]);
  const [webMapFilter, setWebMapFilter] = useState(''); // Filter webmaps by name
  const [allEndpoints, setAllEndpoints] = useState([]);
  const [rankedEndpoints, setRankedEndpoints] = useState([]);
  const [selectedEndpoints, setSelectedEndpoints] = useState([]);
  
  // AI Generated Notifications
  const [generatedNotifications, setGeneratedNotifications] = useState([]);
  const [savingNotifications, setSavingNotifications] = useState(false);
  
  // Web map pagination state
  const [webMapSearchStart, setWebMapSearchStart] = useState(1);
  const [hasMoreWebMaps, setHasMoreWebMaps] = useState(false);
  const [totalWebMapsAvailable, setTotalWebMapsAvailable] = useState(0);
  const [isLoadingMoreWebMaps, setIsLoadingMoreWebMaps] = useState(false);
  
  // Auto-authentication state
  const [isAutoAuthenticating, setIsAutoAuthenticating] = useState(false);
  const [hasAttemptedAutoAuth, setHasAttemptedAutoAuth] = useState(false);

  // Load existing ArcGIS credentials on mount and attempt auto-authentication
  useEffect(() => {
    const loadExistingCredentialsAndAutoAuth = async () => {
      if (!db || !orgId || hasAttemptedAutoAuth) return;
      
      try {
        const orgRef = doc(db, PATHS.organizations, orgId);
        const orgSnap = await getDoc(orgRef);
        
        let storedType = 'online';
        let storedPortalUrl = 'https://www.arcgis.com';
        let storedUsername = '';
        let storedPassword = '';
        let storedOAuthToken = null;
        let storedOAuthExpiresAt = null;
        
        if (orgSnap.exists()) {
          const data = orgSnap.data();
          
          // Check for arcgisAccount (may have password or OAuth token)
          if (data.arcgisAccount) {
            storedType = data.arcgisAccount.type || 'online';
            storedPortalUrl = data.arcgisAccount.portalUrl || 'https://www.arcgis.com';
            storedUsername = data.arcgisAccount.username || '';
            storedPassword = data.arcgisAccount.password || '';
            storedOAuthToken = data.arcgisAccount.oauthToken || null;
            storedOAuthExpiresAt = data.arcgisAccount.oauthExpiresAt || null;
          }
        }
        
        // If no credentials found, check for OAuth-linked profile
        if (!storedUsername) {
          const orgAdminsRef = collection(db, PATHS.admins);
          const adminQuery = query(orgAdminsRef, where("organizationId", "==", orgId));
          const adminSnap = await getDocs(adminQuery);
          
          if (!adminSnap.empty) {
            const adminDoc = adminSnap.docs[0];
            const adminData = adminDoc.data();
            
            if (adminData.arcgisProfile && adminData.arcgisProfile.username) {
              storedUsername = adminData.arcgisProfile.username;
              storedType = 'online';
            }
          }
        }
        
        // Set the form values
        setAccountType(storedType);
        setPortalUrl(storedPortalUrl);
        setUsername(storedUsername);
        
        // Check if we have a valid OAuth token (not expired)
        const hasValidOAuthToken = storedOAuthToken && storedOAuthExpiresAt && (Date.now() < storedOAuthExpiresAt);
        
        // If we have valid OAuth token, use it directly
        if (hasValidOAuthToken && storedUsername) {
          setHasAttemptedAutoAuth(true);
          setIsAutoAuthenticating(true);
          await performAutoAuthenticationWithToken(storedType, storedPortalUrl, storedUsername, storedOAuthToken);
        }
        // Otherwise, if we have password, use password authentication
        else if (storedUsername && storedPassword) {
          setPassword(storedPassword);
          setHasAttemptedAutoAuth(true);
          setIsAutoAuthenticating(true);
          await performAutoAuthentication(storedType, storedPortalUrl, storedUsername, storedPassword);
        } else {
          // No valid credentials - user will see pre-populated form
          setHasAttemptedAutoAuth(true);
        }
      } catch (err) {
        console.error('Error loading ArcGIS credentials:', err);
        setHasAttemptedAutoAuth(true);
      }
    };
    
    if (isOpen) {
      loadExistingCredentialsAndAutoAuth();
    }
  }, [db, orgId, isOpen, hasAttemptedAutoAuth]);

  /**
   * Auto-authenticate using a stored OAuth token (no password needed)
   */
  const performAutoAuthenticationWithToken = async (storedAccountType, storedPortalUrl, storedUsername, oauthToken) => {
    setIsLoading(true);
    setError(null);
    setStatusMessage('Using saved ArcGIS credentials...');

    try {
      const baseUrl = storedAccountType === 'online' 
        ? 'https://www.arcgis.com' 
        : storedPortalUrl.replace(/\/+$/, '');

      // We already have a valid token, just fetch user info
      setStatusMessage('Fetching user profile...');
      const userInfoUrl = `${baseUrl}/sharing/rest/community/self`;
      const userRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: userInfoUrl, token: oauthToken })
      });

      const userData = await userRes.json();
      if (userData.error) {
        throw new Error(userData.error.message || 'Failed to get user info');
      }

      setAuthToken(oauthToken);
      setPortalUser(userData);
      setIsAuthenticated(true);
      setStatusMessage('');
      
      // Skip login step - go directly to step 2 and discover web maps
      setCurrentStep(2);
      
      // Auto-discover web maps
      discoverWebMapsWithToken(oauthToken, userData);
      
    } catch (err) {
      console.error('OAuth token authentication error:', err);
      // Token might be invalid/expired - fall back to showing login form
      setStatusMessage('');
      setIsAutoAuthenticating(false);
    } finally {
      setIsLoading(false);
      setIsAutoAuthenticating(false);
    }
  };

  /**
   * Auto-authenticate with stored credentials
   * Skips the login step if successful
   */
  const performAutoAuthentication = async (storedAccountType, storedPortalUrl, storedUsername, storedPassword) => {
    setIsLoading(true);
    setError(null);
    setStatusMessage('Using saved ArcGIS credentials...');

    try {
      const baseUrl = storedAccountType === 'online' 
        ? 'https://www.arcgis.com' 
        : storedPortalUrl.replace(/\/+$/, '');

      // Generate token through proxy
      const response = await fetch(`${PROXY_BASE_URL}/api/arcgis/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: `${baseUrl}/sharing/rest`,
          username: storedUsername,
          password: storedPassword
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.token) {
        throw new Error('No token received from server');
      }

      setAuthToken(data.token);

      // Get user info
      setStatusMessage('Fetching user profile...');
      const userInfoUrl = `${baseUrl}/sharing/rest/community/self`;
      const userRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: userInfoUrl, token: data.token })
      });

      const userData = await userRes.json();
      if (userData.error) {
        throw new Error(userData.error.message || 'Failed to get user info');
      }

      setPortalUser(userData);
      setIsAuthenticated(true);
      setStatusMessage('');
      
      // Skip login step - go directly to step 2 and discover web maps
      setCurrentStep(2);
      
      // Auto-discover web maps
      discoverWebMapsWithToken(data.token, userData);
      
    } catch (err) {
      console.error('Auto-authentication error:', err);
      // Don't show error - just fall back to manual login
      // The user will see the login form and can enter credentials manually
      setStatusMessage('');
      setIsAutoAuthenticating(false);
      // Clear the auto-loaded password so user can enter their own
      setPassword('');
    } finally {
      setIsLoading(false);
      setIsAutoAuthenticating(false);
    }
  };

  // Reset state when wizard opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setError(null);
      setStatusMessage('');
      setTopWebMaps([]);
      setSelectedWebMaps([]);
      setWebMapFilter('');
      setWebMapSearchStart(1);
      setHasMoreWebMaps(false);
      setTotalWebMapsAvailable(0);
      setIsLoadingMoreWebMaps(false);
      setAllEndpoints([]);
      setRankedEndpoints([]);
      setSelectedEndpoints([]);
      setGeneratedNotifications([]);
      setIsAuthenticated(false);
      setAuthToken(null);
      setIsAutoAuthenticating(false);
      setHasAttemptedAutoAuth(false);
    }
  }, [isOpen]);

  /**
   * Get the portal URL based on account type
   */
  const getPortalBaseUrl = () => {
    if (accountType === 'online') {
      return 'https://www.arcgis.com';
    }
    return portalUrl.replace(/\/+$/, '');
  };

  /**
   * Authenticate with ArcGIS Portal/Online
   */
  const handleAuthenticate = async () => {
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    if (accountType === 'portal' && !portalUrl) {
      setError('Please enter your Portal URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage('Authenticating with ArcGIS...');

    try {
      const baseUrl = getPortalBaseUrl();

      // Generate token through proxy to avoid CORS
      const response = await fetch(`${PROXY_BASE_URL}/api/arcgis/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: `${baseUrl}/sharing/rest`,
          username,
          password
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.token) {
        throw new Error('No token received from server');
      }

      setAuthToken(data.token);

      // Get user info
      setStatusMessage('Fetching user profile...');
      const userInfoUrl = `${baseUrl}/sharing/rest/community/self`;
      const userRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: userInfoUrl, token: data.token })
      });

      const userData = await userRes.json();
      if (userData.error) {
        throw new Error(userData.error.message || 'Failed to get user info');
      }

      setPortalUser(userData);
      setIsAuthenticated(true);
      setStatusMessage('');
      
      // Automatically proceed to step 2 and discover web maps
      setCurrentStep(2);
      
      // Auto-discover web maps
      discoverWebMapsWithToken(data.token, userData);
      
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err.message || 'Authentication failed');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Calculate relevance score for a web map
   * Prioritizes: 1) User-owned maps, 2) View count, 3) Recently edited (last 15 days)
   */
  const calculateWebMapScore = (item, currentUsername) => {
    const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
    const isOwnedByUser = item.owner === currentUsername;
    const isRecentlyEdited = item.modified > fifteenDaysAgo;
    
    // Ownership bonus: +1000 points if owned by current user
    const ownershipBonus = isOwnedByUser ? 1000 : 0;
    
    // View count bonus: scale views to give significant weight (0-500 points for 0-10000 views)
    const viewScore = Math.min(item.numViews || 0, 10000) / 20;
    
    // Recency bonus: +100 points if edited in last 15 days, with decay
    let recencyBonus = 0;
    if (isRecentlyEdited) {
      // More recent = higher bonus (max 100, decays over 15 days)
      const daysSinceEdit = (Date.now() - item.modified) / (24 * 60 * 60 * 1000);
      recencyBonus = 100 * (1 - (daysSinceEdit / 15));
    }
    
    return ownershipBonus + viewScore + recencyBonus;
  };

  /**
   * Discover top web maps from the organization
   * Can be called with token/user params (from auth flow) or use state
   */
  const discoverWebMapsWithToken = async (token, user) => {
    const useToken = token || authToken;
    const useUser = user || portalUser;
    
    if (!useToken) {
      setError('Not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage('Searching for web maps...');

    try {
      const baseUrl = getPortalBaseUrl();
      
      // Search for web maps in the organization, sorted by modified date to get recent ones
      const searchParams = new URLSearchParams({
        q: `type:"Web Map" AND orgid:${useUser?.orgId || '*'}`,
        sortField: 'modified',
        sortOrder: 'desc',
        num: 25,
        start: 1,
        f: 'json'
      });

      const searchUrl = `${baseUrl}/sharing/rest/search?${searchParams.toString()}`;
      
      const searchRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: searchUrl, token: useToken })
      });

      const searchData = await searchRes.json();
      
      if (searchData.error) {
        throw new Error(searchData.error.message || 'Search failed');
      }

      // Score and sort web maps by relevance
      const currentUsername = useUser?.username || username;
      const webMaps = (searchData.results || [])
        .map(item => ({
          ...item,
          score: calculateWebMapScore(item, currentUsername),
          isOwnedByUser: item.owner === currentUsername,
          isRecentlyEdited: item.modified > (Date.now() - (15 * 24 * 60 * 60 * 1000))
        }))
        .sort((a, b) => b.score - a.score);

      setTopWebMaps(webMaps);
      setWebMapSearchStart(searchData.nextStart || -1);
      setHasMoreWebMaps(searchData.nextStart > 0);
      setTotalWebMapsAvailable(searchData.total || webMaps.length);
      
      // Don't pre-select any web maps - let user choose
      setSelectedWebMaps([]);
      
      setStatusMessage(`Found ${searchData.total || webMaps.length} web maps`);

    } catch (err) {
      console.error('Web map discovery error:', err);
      setError(err.message || 'Failed to discover web maps');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load more web maps from the organization
   */
  const loadMoreWebMaps = async () => {
    if (!authToken || !hasMoreWebMaps || isLoadingMoreWebMaps) return;

    setIsLoadingMoreWebMaps(true);
    setError(null);

    try {
      const baseUrl = getPortalBaseUrl();
      
      const searchParams = new URLSearchParams({
        q: `type:"Web Map" AND orgid:${portalUser?.orgId || '*'}`,
        sortField: 'modified',
        sortOrder: 'desc',
        num: 25,
        start: webMapSearchStart,
        f: 'json'
      });

      const searchUrl = `${baseUrl}/sharing/rest/search?${searchParams.toString()}`;
      
      const searchRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: searchUrl, token: authToken })
      });

      const searchData = await searchRes.json();
      
      if (searchData.error) {
        throw new Error(searchData.error.message || 'Search failed');
      }

      // Score new web maps
      const currentUsername = portalUser?.username || username;
      const newWebMaps = (searchData.results || []).map(item => ({
        ...item,
        score: calculateWebMapScore(item, currentUsername),
        isOwnedByUser: item.owner === currentUsername,
        isRecentlyEdited: item.modified > (Date.now() - (15 * 24 * 60 * 60 * 1000))
      }));

      // Append new web maps and re-sort entire list by score
      setTopWebMaps(prev => {
        const combined = [...prev, ...newWebMaps];
        // Remove duplicates by id
        const unique = combined.filter((wm, idx, self) => 
          idx === self.findIndex(w => w.id === wm.id)
        );
        return unique.sort((a, b) => b.score - a.score);
      });
      
      setWebMapSearchStart(searchData.nextStart || -1);
      setHasMoreWebMaps(searchData.nextStart > 0);

    } catch (err) {
      console.error('Load more web maps error:', err);
      setError(err.message || 'Failed to load more web maps');
    } finally {
      setIsLoadingMoreWebMaps(false);
    }
  };

  /**
   * Wrapper for discoverWebMaps using state values
   */
  const discoverWebMaps = async () => {
    await discoverWebMapsWithToken(authToken, portalUser);
  };

  /**
   * Toggle web map selection
   */
  const toggleWebMapSelection = (webMapId) => {
    setSelectedWebMaps(prev => {
      if (prev.includes(webMapId)) {
        return prev.filter(id => id !== webMapId);
      } else {
        return [...prev, webMapId];
      }
    });
  };

  /**
   * Process selected web maps - scan their endpoints
   */
  const processSelectedWebMaps = async () => {
    const mapsToProcess = topWebMaps.filter(wm => selectedWebMaps.includes(wm.id));
    if (mapsToProcess.length === 0) {
      setError('Please select at least one web map');
      return;
    }
    
    setCurrentStep(3);
    await scanEndpoints(mapsToProcess);
  };

  /**
   * Helper: Fetch layer metadata with anonymous-first approach
   * Tries anonymous access first, then falls back to token if auth is required
   */
  const fetchLayerMetadata = async (layerUrl, token) => {
    // Step 1: Try anonymous access first (no token)
    try {
      const anonRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceUrl: layerUrl })
      });

      const anonData = await anonRes.json();

      // If we got valid fields, anonymous access worked!
      if (anonData.fields && Array.isArray(anonData.fields)) {
        console.log(`[Anonymous OK] ${layerUrl}`);
        return anonData;
      }

      // Check if the error indicates authentication is required
      // Server now returns authRequired flag for clarity
      const needsAuth = anonRes.status === 401 || 
                        anonRes.status === 403 ||
                        anonData.authRequired === true ||
                        (anonData.error && typeof anonData.error === 'string' && (
                          anonData.error.toLowerCase().includes('token') ||
                          anonData.error.toLowerCase().includes('authentication') ||
                          anonData.error.toLowerCase().includes('authorized') ||
                          anonData.error.toLowerCase().includes('access denied')
                        ));

      if (!needsAuth) {
        // Some other error (not auth related) - return the error
        console.warn(`[Anonymous Failed - Not Auth] ${layerUrl}:`, anonData.error);
        return anonData;
      }

      console.log(`[Auth Required] ${layerUrl} - retrying with token...`);
    } catch (anonErr) {
      console.warn(`[Anonymous Error] ${layerUrl}:`, anonErr.message);
      // Continue to try with token
    }

    // Step 2: Anonymous failed with auth error - retry with token
    if (token) {
      try {
        const authRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceUrl: layerUrl, token })
        });

        const authData = await authRes.json();
        
        if (authData.fields && Array.isArray(authData.fields)) {
          console.log(`[Token OK] ${layerUrl}`);
        } else {
          console.warn(`[Token Failed] ${layerUrl}:`, authData.error);
        }
        
        return authData;
      } catch (authErr) {
        console.error(`[Token Error] ${layerUrl}:`, authErr.message);
        return { error: authErr.message };
      }
    }

    return { error: 'Authentication required but no token available' };
  };

  /**
   * Helper: Query layer data with anonymous-first approach
   * Tries anonymous access first, then falls back to token if auth is required
   */
  const queryLayerData = async (layerUrl, queryParams, token) => {
    // Step 1: Try anonymous access first (no token)
    try {
      const anonRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceUrl: layerUrl,
          ...queryParams
        })
      });

      // Check HTTP status for auth errors
      if (anonRes.status === 401 || anonRes.status === 403) {
        console.log(`[Query Auth Required] ${layerUrl} - retrying with token...`);
      } else {
        const anonData = await anonRes.json();
        
        // Check if the response indicates auth is needed via flag or error message
        const needsAuth = anonData.authRequired === true ||
          (anonData.error && typeof anonData.error === 'string' && (
            anonData.error.toLowerCase().includes('token') ||
            anonData.error.toLowerCase().includes('authentication')
          ));

        if (!needsAuth) {
          // Success or non-auth error
          return anonData;
        }
        
        console.log(`[Query Auth Required] ${layerUrl} - retrying with token...`);
      }
    } catch (anonErr) {
      console.warn(`[Query Anonymous Error] ${layerUrl}:`, anonErr.message);
    }

    // Step 2: Retry with token
    if (token) {
      try {
        const authRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceUrl: layerUrl,
            token,
            ...queryParams
          })
        });

        return await authRes.json();
      } catch (authErr) {
        console.error(`[Query Token Error] ${layerUrl}:`, authErr.message);
        return { error: authErr.message, features: [] };
      }
    }

    return { error: 'Authentication required but no token available', features: [] };
  };

  /**
   * Scan REST endpoints from web maps
   */
  const scanEndpoints = async (webMaps) => {
    if (!authToken || webMaps.length === 0) return;

    setIsLoading(true);
    setError(null);
    setStatusMessage('Scanning web map layers...');

    const endpoints = [];

    try {
      const baseUrl = getPortalBaseUrl();

      for (let i = 0; i < webMaps.length; i++) {
        const webMap = webMaps[i];
        setStatusMessage(`Scanning "${webMap.title}" (${i + 1}/${webMaps.length})...`);

        // Get web map data (operational layers) - this needs the token for portal access
        const webMapDataUrl = `${baseUrl}/sharing/rest/content/items/${webMap.id}/data`;
        
        const dataRes = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webMapDataUrl, token: authToken })
        });

        const webMapData = await dataRes.json();

        if (webMapData.operationalLayers) {
          for (const layer of webMapData.operationalLayers) {
            if (layer.url && (layer.url.includes('FeatureServer') || layer.url.includes('MapServer'))) {
              // Get layer metadata using anonymous-first approach
              try {
                const metadata = await fetchLayerMetadata(layer.url, authToken);

                if (metadata.fields && Array.isArray(metadata.fields)) {
                  // Find date fields (including newer ArcGIS date types)
                  const dateFields = metadata.fields.filter(f => 
                    f.type === 'esriFieldTypeDate' || 
                    f.type === 'esriFieldTypeDateOnly' ||
                    f.type === 'esriFieldTypeTimestampOffset'
                  );

                  // Check query capabilities
                  const capabilities = metadata.capabilities || '';
                  const supportsQuery = capabilities.toLowerCase().includes('query');
                  const supportsOrderBy = metadata.advancedQueryCapabilities?.supportsOrderBy !== false;

                  endpoints.push({
                    id: `${webMap.id}_${layer.id || layer.title}`,
                    url: layer.url,
                    title: layer.title || metadata.name || 'Unnamed Layer',
                    description: metadata.description || '',
                    webMapTitle: webMap.title,
                    webMapId: webMap.id,
                    fields: metadata.fields,
                    dateFields,
                    geometryType: metadata.geometryType,
                    recordCount: metadata.maxRecordCount || 'Unknown',
                    hasDateField: dateFields.length > 0,
                    supportsQuery,
                    supportsOrderBy
                  });
                }
              } catch (layerErr) {
                console.warn(`Could not fetch metadata for ${layer.url}:`, layerErr);
              }
            }

            // Handle nested layers in group layers
            if (layer.layers) {
              for (const subLayer of layer.layers) {
                if (subLayer.url && (subLayer.url.includes('FeatureServer') || subLayer.url.includes('MapServer'))) {
                  try {
                    const metadata = await fetchLayerMetadata(subLayer.url, authToken);

                    if (metadata.fields && Array.isArray(metadata.fields)) {
                      const dateFields = metadata.fields.filter(f => 
                        f.type === 'esriFieldTypeDate' || 
                        f.type === 'esriFieldTypeDateOnly' ||
                        f.type === 'esriFieldTypeTimestampOffset'
                      );

                      // Check query capabilities
                      const capabilities = metadata.capabilities || '';
                      const supportsQuery = capabilities.toLowerCase().includes('query');
                      const supportsOrderBy = metadata.advancedQueryCapabilities?.supportsOrderBy !== false;

                      endpoints.push({
                        id: `${webMap.id}_${subLayer.id || subLayer.title}`,
                        url: subLayer.url,
                        title: subLayer.title || metadata.name || 'Unnamed Layer',
                        description: metadata.description || '',
                        webMapTitle: webMap.title,
                        webMapId: webMap.id,
                        fields: metadata.fields,
                        dateFields,
                        geometryType: metadata.geometryType,
                        recordCount: metadata.maxRecordCount || 'Unknown',
                        hasDateField: dateFields.length > 0,
                        supportsQuery,
                        supportsOrderBy
                      });
                    }
                  } catch (subLayerErr) {
                    console.warn(`Could not fetch metadata for ${subLayer.url}:`, subLayerErr);
                  }
                }
              }
            }
          }
        }

        // Also check for tables in the webmap (tables with endpoints)
        if (webMapData.tables) {
          for (const table of webMapData.tables) {
            if (table.url && (table.url.includes('FeatureServer') || table.url.includes('MapServer'))) {
              try {
                const metadata = await fetchLayerMetadata(table.url, authToken);

                if (metadata.fields && Array.isArray(metadata.fields)) {
                  const dateFields = metadata.fields.filter(f => 
                    f.type === 'esriFieldTypeDate' || 
                    f.type === 'esriFieldTypeDateOnly' ||
                    f.type === 'esriFieldTypeTimestampOffset'
                  );

                  // Check query capabilities
                  const capabilities = metadata.capabilities || '';
                  const supportsQuery = capabilities.toLowerCase().includes('query');
                  const supportsOrderBy = metadata.advancedQueryCapabilities?.supportsOrderBy !== false;

                  endpoints.push({
                    id: `${webMap.id}_table_${table.id || table.title}`,
                    url: table.url,
                    title: table.title || metadata.name || 'Unnamed Table',
                    description: metadata.description || '',
                    webMapTitle: webMap.title,
                    webMapId: webMap.id,
                    fields: metadata.fields,
                    dateFields,
                    geometryType: metadata.geometryType || 'Table',
                    recordCount: metadata.maxRecordCount || 'Unknown',
                    hasDateField: dateFields.length > 0,
                    supportsQuery,
                    supportsOrderBy,
                    isTable: true
                  });
                }
              } catch (tableErr) {
                console.warn(`Could not fetch metadata for table ${table.url}:`, tableErr);
              }
            }
          }
        }
      }

      // Remove duplicates by URL
      const uniqueEndpoints = endpoints.filter((ep, idx, self) => 
        idx === self.findIndex(e => e.url === ep.url)
      );

      setAllEndpoints(uniqueEndpoints);
      setStatusMessage(`Found ${uniqueEndpoints.length} service endpoints`);

      // Proceed to AI ranking
      setTimeout(() => {
        setCurrentStep(4);
        rankEndpointsWithAI(uniqueEndpoints);
      }, 1000);

    } catch (err) {
      console.error('Endpoint scanning error:', err);
      setError(err.message || 'Failed to scan endpoints');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sample recent data from an endpoint to check update frequency
   * Uses multiple fallback approaches for maximum compatibility
   */
  const sampleEndpointData = async (endpoint) => {
    if (!endpoint.dateFields || endpoint.dateFields.length === 0) {
      return { recentRecordCount: 0, lastUpdateDate: null, updateFrequency: 'unknown' };
    }

    // Check if query is supported
    if (endpoint.supportsQuery === false) {
      console.log(`[Query Skipped] ${endpoint.url} - Query not supported`);
      return { recentRecordCount: 0, lastUpdateDate: null, updateFrequency: 'unknown', note: 'Query not supported' };
    }

    try {
      // Use the first date field to check for recent updates
      const dateField = endpoint.dateFields[0];
      
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoMs = thirtyDaysAgo.getTime();
      
      // Try multiple query approaches for compatibility
      let recentData = null;
      let querySucceeded = false;

      // Determine if we should include orderByFields based on capabilities
      const useOrderBy = endpoint.supportsOrderBy !== false;

      // Approach 1: Full query with orderByFields (if supported) and epoch milliseconds
      if (!querySucceeded) {
        try {
          const queryParams = {
            where: `${dateField.name} >= ${thirtyDaysAgoMs}`,
            outFields: dateField.name,
            resultRecordCount: 100
          };
          if (useOrderBy) {
            queryParams.orderByFields = `${dateField.name} DESC`;
          }
          
          recentData = await queryLayerData(endpoint.url, queryParams, authToken);
          
          if (recentData.features && !recentData.error) {
            querySucceeded = true;
          }
        } catch (e) {
          console.log(`[Query Approach 1 Failed] ${endpoint.url}: ${e.message}`);
        }
      }

      // Approach 2: Without orderByFields (some services don't support it)
      if (!querySucceeded && useOrderBy) {
        try {
          recentData = await queryLayerData(endpoint.url, {
            where: `${dateField.name} >= ${thirtyDaysAgoMs}`,
            outFields: dateField.name,
            resultRecordCount: 100
          }, authToken);
          
          if (recentData.features && !recentData.error) {
            querySucceeded = true;
            console.log(`[Query Approach 2 OK] ${endpoint.url} (no orderBy)`);
          }
        } catch (e) {
          console.log(`[Query Approach 2 Failed] ${endpoint.url}: ${e.message}`);
        }
      }

      // Approach 3: Use DATE format string instead of epoch (for older services)
      if (!querySucceeded) {
        try {
          const dateStr = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
          recentData = await queryLayerData(endpoint.url, {
            where: `${dateField.name} >= DATE '${dateStr}'`,
            outFields: dateField.name,
            resultRecordCount: 100
          }, authToken);
          
          if (recentData.features && !recentData.error) {
            querySucceeded = true;
            console.log(`[Query Approach 3 OK] ${endpoint.url} (DATE string)`);
          }
        } catch (e) {
          console.log(`[Query Approach 3 Failed] ${endpoint.url}: ${e.message}`);
        }
      }

      // Approach 4: Simple count query with 1=1 to at least verify service works
      if (!querySucceeded) {
        try {
          recentData = await queryLayerData(endpoint.url, {
            where: '1=1',
            outFields: dateField.name,
            resultRecordCount: 10
          }, authToken);
          
          if (recentData.features && !recentData.error) {
            // We got data but couldn't filter by date - mark as unknown frequency
            console.log(`[Query Approach 4 OK] ${endpoint.url} (basic query only)`);
            return { 
              recentRecordCount: 0, 
              lastUpdateDate: null, 
              updateFrequency: 'unknown',
              sampledDateField: dateField.name,
              note: 'Date filtering not supported'
            };
          }
        } catch (e) {
          console.log(`[Query Approach 4 Failed] ${endpoint.url}: ${e.message}`);
        }
      }

      // If all queries failed, return error state
      if (!querySucceeded || recentData?.error) {
        console.warn(`ArcGIS error for ${endpoint.url}: ${recentData?.error || 'All query approaches failed'}`);
        return { recentRecordCount: 0, lastUpdateDate: null, updateFrequency: 'error' };
      }
      
      let recentRecordCount = 0;
      let lastUpdateDate = null;
      let updateFrequency = 'none';
      
      if (recentData.features && recentData.features.length > 0) {
        recentRecordCount = recentData.features.length;
        
        // Get the most recent date - sort locally if orderBy wasn't supported
        const sortedFeatures = [...recentData.features].sort((a, b) => {
          const dateA = a.attributes?.[dateField.name] || 0;
          const dateB = b.attributes?.[dateField.name] || 0;
          return dateB - dateA;
        });
        
        const mostRecentRecord = sortedFeatures[0];
        if (mostRecentRecord?.attributes?.[dateField.name]) {
          lastUpdateDate = new Date(mostRecentRecord.attributes[dateField.name]);
        }
        
        // Determine update frequency based on record count in last 30 days
        if (recentRecordCount >= 50) {
          updateFrequency = 'very_high'; // Multiple updates per day
        } else if (recentRecordCount >= 20) {
          updateFrequency = 'high'; // Several per week
        } else if (recentRecordCount >= 5) {
          updateFrequency = 'medium'; // Weekly updates
        } else if (recentRecordCount >= 1) {
          updateFrequency = 'low'; // Some updates in past month
        }
      }

      return { 
        recentRecordCount, 
        lastUpdateDate: lastUpdateDate?.toISOString() || null, 
        updateFrequency,
        sampledDateField: dateField.name
      };
    } catch (err) {
      console.warn(`Could not sample data for ${endpoint.url}:`, err);
      return { recentRecordCount: 0, lastUpdateDate: null, updateFrequency: 'error' };
    }
  };

  /**
   * Use AI (Gemini) to rank endpoints by notification potential
   * Enhanced with data sampling to analyze update frequency
   */
  const rankEndpointsWithAI = async (endpoints) => {
    if (endpoints.length === 0) {
      setError('No endpoints found to analyze.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage('Analyzing update frequency for all endpoints...');

    try {
      // Process ALL endpoints
      const endpointsWithSamples = [];
      
      console.log(`[Processing] ${endpoints.length} total endpoints from all web maps`);
      
      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        setStatusMessage(`Analyzing: ${ep.title} (${i + 1}/${endpoints.length})...`);
        
        const sampleData = await sampleEndpointData(ep);
        endpointsWithSamples.push({
          ...ep,
          ...sampleData
        });
      }

      setStatusMessage('Analyzing endpoints for notification potential...');

      // Prepare endpoint summaries for AI with sample data
      const endpointSummaries = endpointsWithSamples.map(ep => ({
        title: ep.title,
        url: ep.url,
        webMapTitle: ep.webMapTitle,
        description: ep.description?.substring(0, 200) || '',
        fieldCount: ep.fields?.length || 0,
        dateFields: ep.dateFields?.map(f => ({ name: f.name, alias: f.alias })) || [],
        hasDateField: ep.hasDateField,
        geometryType: ep.geometryType || 'None',
        // Data freshness info from sampling
        recentRecordCount: ep.recentRecordCount || 0,
        lastUpdateDate: ep.lastUpdateDate || null,
        updateFrequency: ep.updateFrequency || 'unknown',
        // Key fields for context
        keyFields: ep.fields?.slice(0, 15).map(f => ({
          name: f.name,
          alias: f.alias,
          type: f.type
        })) || []
      }));

      const prompt = `You are an expert GIS analyst specializing in ArcGIS services and automated notification systems.

TASK: Analyze these endpoints and rank them by notification potential. For each endpoint, determine the most appropriate target audience based on the web map name, layer name, description, and field names.

DATA FRESHNESS IS CRITICAL: I've sampled each endpoint's recent data. Pay close attention to:
- \`recentRecordCount\`: Number of records added/updated in the LAST 30 DAYS
- \`updateFrequency\`: very_high (50+/month), high (20-49/month), medium (5-19/month), low (1-4/month), none (0/month)
- \`lastUpdateDate\`: When the most recent record was added

RANKING CRITERIA (in order of importance):
1. **ACTIVE DATA** - Endpoints with high/very_high updateFrequency should be ranked HIGHEST. Stale data with no recent updates should be ranked very low.
2. **Has date fields** - ESSENTIAL for date-based notifications
3. **Notification usefulness** - Would stakeholders benefit from being alerted about new records?

TARGET AUDIENCE EXAMPLES (determine based on content):
- "Property Owners" (for tax/assessment/parcel data)
- "Public Safety" (for emergency/fire/police data)
- "Developers & Contractors" (for permit/zoning data)
- "Operations Team" (for infrastructure/maintenance data)
- "General Public" (for general information)

Endpoints to analyze:
${JSON.stringify(endpointSummaries, null, 2)}

IMPORTANT RULES:
- STRONGLY PREFER endpoints with updateFrequency of "very_high" or "high"
- Endpoints with updateFrequency "none" or "unknown" should rarely be recommended
- Only include endpoints that have at least one date field
- Determine the most appropriate target audience based on the data content

Return ONLY a valid JSON array with the top 15 endpoints (or fewer if less than 15 qualify):
[
  {
    "url": "exact_url_from_input",
    "rank": 1,
    "reason": "Brief explanation focusing on data freshness and notification value",
    "targetAudience": "Determined audience based on content (2-4 words)",
    "webMapTitle": "the_webMapTitle_from_input",
    "suggestedDateField": "field_name_to_use_for_date_queries",
    "notificationIdea": "Specific notification idea",
    "updateFrequency": "the_update_frequency_from_input",
    "recentRecordCount": number_from_input
  }
]

Return ONLY the JSON array, no other text.`;

      // Use centralized Gemini configuration
      const response = await fetch(getGeminiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: GEMINI_CREATIVE_CONFIG
        })
      });

      const aiData = await response.json();
      
      console.log('AI Response:', JSON.stringify(aiData, null, 2)); // Debug log
      
      if (aiData.error) {
        throw new Error(aiData.error.message || 'AI ranking failed');
      }

      if (!aiData.candidates || aiData.candidates.length === 0) {
        throw new Error('AI returned empty response. Please try again.');
      }

      const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      console.log('AI Ranking Response:', aiText); // Debug log
      
      // Extract JSON from response - handle markdown code blocks
      let jsonStr = aiText;
      
      // Remove markdown code blocks if present
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      // Try to find JSON array
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Could not find JSON array in:', jsonStr);
        throw new Error('Could not parse AI response. Please try again.');
      }

      const aiRanking = JSON.parse(jsonMatch[0]);
      
      // Map AI rankings back to full endpoint data with sample info
      const ranked = aiRanking.map(r => {
        const endpoint = endpointsWithSamples.find(ep => ep.url === r.url);
        return endpoint ? { 
          ...endpoint, 
          aiRank: r.rank, 
          aiReason: r.reason,
          targetAudience: r.targetAudience || 'General Public',
          suggestedDateField: r.suggestedDateField,
          notificationIdea: r.notificationIdea
        } : null;
      }).filter(Boolean);

      if (ranked.length === 0) {
        throw new Error('Could not find suitable endpoints for notifications. Ensure your web maps contain layers with date fields and recent data.');
      }

      setRankedEndpoints(ranked);
      setStatusMessage(`Identified ${ranked.length} promising endpoints based on data freshness and relevance`);

    } catch (err) {
      console.error('AI ranking error:', err);
      setError(err.message || 'Ranking failed. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle endpoint selection
   */
  const toggleEndpointSelection = (endpoint) => {
    setSelectedEndpoints(prev => {
      const isSelected = prev.some(ep => ep.url === endpoint.url);
      if (isSelected) {
        return prev.filter(ep => ep.url !== endpoint.url);
      } else {
        return [...prev, endpoint];
      }
    });
  };

  /**
   * Generate notifications
   */
  const generateNotifications = async () => {
    if (selectedEndpoints.length === 0) {
      setError('Please select at least one endpoint');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage('Generating notification configurations...');
    setCurrentStep(5);

    try {
      const notifications = [];

      for (let i = 0; i < selectedEndpoints.length; i++) {
        const endpoint = selectedEndpoints[i];
        setStatusMessage(`Configuring notification ${i + 1} of ${selectedEndpoints.length}: "${endpoint.title}"...`);

        const notification = await generateNotificationWithAI(endpoint);
        if (notification) {
          notifications.push(notification);
        }
      }

      if (notifications.length === 0) {
        throw new Error('Could not generate any notifications. Please try again.');
      }

      setGeneratedNotifications(notifications);
      setStatusMessage(`Generated ${notifications.length} notification configuration${notifications.length !== 1 ? 's' : ''}`);

    } catch (err) {
      console.error('Notification generation error:', err);
      setError(err.message || 'Failed to generate notifications');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Calculate recommended notification frequency based on data recency
   * - Has data in past 2 days → daily
   * - Has data in past week (but not past 2 days) → weekly  
   * - No data in past week → monthly
   */
  const calculateRecommendedFrequency = (lastUpdateDate) => {
    if (!lastUpdateDate) {
      return { type: 'monthly', runDay: 1, queryLogic: 'previous_full_month' };
    }
    
    const now = new Date();
    const lastUpdate = new Date(lastUpdateDate);
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate <= 2) {
      // Data in past 2 days → daily
      return { type: 'daily', runDay: 0, queryLogic: 'previous_full_day' };
    } else if (daysSinceUpdate <= 7) {
      // Data in past week but not past 2 days → weekly
      return { type: 'weekly', runDay: 1, queryLogic: 'previous_full_week' }; // Monday
    } else {
      // No data in past week → monthly
      return { type: 'monthly', runDay: 1, queryLogic: 'previous_full_month' };
    }
  };

  /**
   * Generate a notification configuration using AI
   */
  const generateNotificationWithAI = async (endpoint) => {
    const targetAudience = endpoint.targetAudience || 'General Public';
    
    // Calculate recommended frequency based on actual data recency
    const recommendedFrequency = calculateRecommendedFrequency(endpoint.lastUpdateDate);
    
    const prompt = `You are an expert at configuring automated notification systems for ArcGIS REST services.

Create an optimal notification configuration for this ArcGIS service endpoint. This notification is targeted at: "${targetAudience}". Consider what notifications would be most valuable for this specific audience.

SERVICE DETAILS:
- Title: ${endpoint.title}
- URL: ${endpoint.url}
- Target Audience: ${targetAudience}
- Description: ${endpoint.description || 'No description available'}
- Suggestion: ${endpoint.notificationIdea || 'General data monitoring'}
- Suggested Date Field: ${endpoint.suggestedDateField || 'None suggested'}

AVAILABLE DATE FIELDS:
${endpoint.dateFields?.map(f => `- ${f.name} (alias: ${f.alias || f.name}, type: ${f.type})`).join('\n') || 'None'}

ALL AVAILABLE FIELDS:
${endpoint.fields?.map(f => `- ${f.name}: ${f.type} (alias: ${f.alias || f.name})`).join('\n')}

CONFIGURATION REQUIREMENTS:
1. **id**: Create a unique snake_case identifier (lowercase, underscores, no spaces, max 30 chars)
2. **name**: Human-friendly display name that clearly communicates what's being tracked
3. **description**: Brief description of what this notification does and who would benefit (mention the target audience: ${targetAudience})
4. **runTime**: Time in HH:MM format (use "07:30" or "08:00" for morning delivery)
5. **dateField**: The best date field to use for queries (must be from available date fields)
6. **displayFields**: Select 4-6 most important fields for the notification. Prioritize:
   - The date field first
   - Location/address fields
   - Key identifier fields (IDs, numbers)
   - Status or type fields
   - Any fields particularly relevant to ${targetAudience}
   Format each as: { "field": "FieldName", "label": "Display Label", "format": "string|date|currency" }

Return ONLY a valid JSON object:
{
  "id": "snake_case_id",
  "name": "Display Name",
  "description": "What this notification does",
  "runTime": "08:00",
  "dateField": "FieldName",
  "dateFieldType": "esriFieldTypeDate|esriFieldTypeDateOnly|esriFieldTypeTimestampOffset",
  "displayFields": [
    { "field": "FieldName", "label": "Label", "format": "date" }
  ]
}

Return ONLY the JSON object, no other text.`;

    try {
      // Use centralized Gemini configuration
      const response = await fetch(getGeminiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: GEMINI_STRUCTURED_CONFIG
        })
      });

      const aiData = await response.json();
      
      console.log('AI Config Response Data:', JSON.stringify(aiData, null, 2)); // Debug log
      
      if (aiData.error) {
        throw new Error(aiData.error.message);
      }

      if (!aiData.candidates || aiData.candidates.length === 0) {
        throw new Error('AI returned empty response');
      }

      const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      console.log('AI Config Response:', aiText); // Debug log
      
      // Extract JSON from response - handle markdown code blocks
      let jsonStr = aiText;
      
      // Remove markdown code blocks if present
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Could not find JSON object in:', jsonStr);
        throw new Error('Could not parse AI response');
      }

      const aiConfig = JSON.parse(jsonMatch[0]);
      
      // Find the date field type
      const dateFieldDef = endpoint.dateFields?.find(f => f.name === aiConfig.dateField);
      
      // Build full notification object matching NotificationEditor structure
      // Use calculated frequency based on actual data recency
      return {
        id: aiConfig.id || `notif_${Date.now().toString(36)}`,
        name: aiConfig.name || endpoint.title,
        description: aiConfig.description || `Notifications from ${endpoint.title}`,
        type: recommendedFrequency.type,
        runDay: recommendedFrequency.runDay,
        runTime: aiConfig.runTime || '08:00',
        method: 'email',
        paused: false,
        sendEmpty: false,
        isPublic: false,
        source: {
          type: 'arcgis_rest',
          url: endpoint.url,
          username: username,
          password: password,
          dateField: aiConfig.dateField || endpoint.dateFields?.[0]?.name || '',
          dateFieldType: dateFieldDef?.type || aiConfig.dateFieldType || 'esriFieldTypeDate',
          queryLogic: recommendedFrequency.queryLogic,
          displayFields: aiConfig.displayFields || [],
          queryConfig: { mode: 'none', rules: [], logic: 'AND' }
        },
        _endpoint: endpoint,
        _aiGenerated: true
      };
    } catch (err) {
      console.error('AI generation failed for endpoint:', endpoint.title, err);
      throw new Error(`Failed to configure "${endpoint.title}": ${err.message}`);
    }
  };

  /**
   * Save generated notifications to Firestore
   */
  const saveNotifications = async () => {
    if (generatedNotifications.length === 0) return;

    setSavingNotifications(true);
    setError(null);

    try {
      const orgRef = doc(db, PATHS.organizations, orgId);
      const orgSnap = await getDoc(orgRef);
      
      if (!orgSnap.exists()) {
        throw new Error('Organization configuration not found');
      }

      const existingData = orgSnap.data();
      const existingNotifications = existingData.notifications || [];

      // Clean notifications for storage (remove _endpoint and _aiGenerated)
      const cleanedNotifications = generatedNotifications.map(n => {
        const { _endpoint, _aiGenerated, ...clean } = n;
        return clean;
      });

      // Merge with existing notifications
      const updatedNotifications = [...existingNotifications, ...cleanedNotifications];

      await updateDoc(orgRef, {
        notifications: updatedNotifications
      });

      // Subscribe the creating user (org admin) to the new notifications
      let subscriptionSuccess = false;
      if (userEmail) {
        try {
          // Find the user document by querying for email
          const usersRef = collection(db, PATHS.users);
          const userQuery = query(usersRef, where("email", "==", userEmail.toLowerCase()));
          const userSnap = await getDocs(userQuery);
          
          // Build subscription updates for new notifications
          const newSubscriptions = {};
          cleanedNotifications.forEach(notif => {
            const subKey = `${orgId}_${notif.id}`;
            newSubscriptions[subKey] = true;
          });
          
          if (!userSnap.empty) {
            // User exists - update their subscriptions
            const userDoc = userSnap.docs[0];
            const existingSubscriptions = userDoc.data().subscriptions || {};
            
            await updateDoc(userDoc.ref, {
              subscriptions: {
                ...existingSubscriptions,
                ...newSubscriptions
              }
            });
            subscriptionSuccess = true;
          } else {
            // User doesn't have a document yet - create one
            // Use email as document ID for consistency
            const newUserRef = doc(db, PATHS.users, userEmail.toLowerCase());
            await setDoc(newUserRef, {
              email: userEmail.toLowerCase(),
              createdAt: serverTimestamp(),
              subscriptions: newSubscriptions,
              disabled: false
            });
            subscriptionSuccess = true;
          }
          
          console.log(`Subscribed ${userEmail} to ${cleanedNotifications.length} new notifications`);
        } catch (subErr) {
          console.error('Error subscribing user to notifications:', subErr);
          // Don't fail the whole operation if subscription fails
        }
      }

      const successMsg = subscriptionSuccess 
        ? `Created ${cleanedNotifications.length} notification(s), subscribed you to them, and broadcast sent!`
        : `Created ${cleanedNotifications.length} notification(s) and broadcast sent!`;
      
      addToast?.(successMsg, 'success');
      onNotificationsCreated?.(cleanedNotifications);
      onClose();

    } catch (err) {
      console.error('Error saving notifications:', err);
      setError(err.message || 'Failed to save notifications');
      addToast?.('Failed to save notifications', 'error');
    } finally {
      setSavingNotifications(false);
    }
  };

  /**
   * Remove a generated notification before saving
   */
  const removeGeneratedNotification = (index) => {
    setGeneratedNotifications(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Update a generated notification field
   */
  const updateGeneratedNotification = (index, field, value) => {
    setGeneratedNotifications(prev => {
      const updated = [...prev];
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        updated[index] = {
          ...updated[index],
          [parent]: {
            ...updated[index][parent],
            [child]: value
          }
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  if (!isOpen) return null;

  // Check for API key
  const hasApiKey = !!geminiApiKey;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div 
          className="px-6 py-4 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)` }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Notification Wizard</h2>
              <p className="text-xs text-white/80">Powered by CivQuest</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">API Key Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  This wizard requires an API key to function. Please add your API key to your organization's configuration file.
                </p>
                <a 
                  href="https://aistudio.google.com/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 mt-2"
                >
                  Get an API key <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Connect', icon: Globe },
              { num: 2, label: 'Select', icon: MapIcon },
              { num: 3, label: 'Scan', icon: Layers },
              { num: 4, label: 'Rank', icon: BarChart3 },
              { num: 5, label: 'Create', icon: Sparkles }
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.num 
                        ? 'text-white shadow-lg' 
                        : 'bg-slate-200 text-slate-400'
                    }`}
                    style={currentStep >= step.num ? { backgroundColor: accentColor } : {}}
                  >
                    {currentStep > step.num ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${
                    currentStep >= step.num ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {idx < 4 && (
                  <div 
                    className={`flex-1 h-0.5 mx-2 rounded transition-colors duration-300 ${
                      currentStep > step.num ? '' : 'bg-slate-200'
                    }`}
                    style={currentStep > step.num ? { backgroundColor: accentColor } : {}}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5 text-blue-500" />
              )}
              <p className="text-sm text-blue-700">{statusMessage}</p>
            </div>
          )}

          {/* Step 1: Connect to ArcGIS */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <Globe className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Connect to ArcGIS</h3>
                  <p className="text-sm text-slate-500">Sign in to discover your organization's web maps</p>
                </div>
              </div>

              {/* Auto-authentication loading state */}
              {isAutoAuthenticating ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: accentColor }} />
                  <p className="text-slate-600 font-medium">Connecting with saved credentials...</p>
                  <p className="text-sm text-slate-400 mt-1">Using your registered ArcGIS account</p>
                </div>
              ) : (
                <>
                  {/* Account Type Toggle */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAccountType('online')}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                        accountType === 'online' 
                          ? 'shadow-md' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      style={accountType === 'online' ? { borderColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                    >
                      <div className="flex items-center gap-3">
                        <Globe className={`w-5 h-5 ${accountType === 'online' ? '' : 'text-slate-400'}`} 
                          style={accountType === 'online' ? { color: accentColor } : {}} />
                        <div>
                          <p className="font-semibold text-slate-800">ArcGIS Online</p>
                          <p className="text-xs text-slate-500">arcgis.com</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setAccountType('portal')}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                        accountType === 'portal' 
                          ? 'shadow-md' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      style={accountType === 'portal' ? { borderColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                    >
                      <div className="flex items-center gap-3">
                        <Server className={`w-5 h-5 ${accountType === 'portal' ? '' : 'text-slate-400'}`}
                          style={accountType === 'portal' ? { color: accentColor } : {}} />
                        <div>
                          <p className="font-semibold text-slate-800">ArcGIS Portal</p>
                          <p className="text-xs text-slate-500">Enterprise</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Portal URL (if portal selected) */}
                  {accountType === 'portal' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Portal URL</label>
                      <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="url"
                          value={portalUrl}
                          onChange={(e) => setPortalUrl(e.target.value)}
                      placeholder="https://your-portal.domain.com/portal"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 transition-shadow"
                      style={{ '--tw-ring-color': `${accentColor}40` }}
                    />
                  </div>
                </div>
              )}

              {/* Credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 transition-shadow"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAuthenticate}
                disabled={isLoading || !username || !password || !hasApiKey}
                className="w-full py-3.5 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
                Connect & Continue
              </button>
                </>
              )}
            </div>
          )}

          {/* Step 2: Select Web Maps */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <MapIcon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Select Web Maps</h3>
                  <p className="text-sm text-slate-500">Choose which web maps to scan for notification sources</p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin mb-4" style={{ color: accentColor }} />
                  <p className="text-slate-600">{statusMessage || 'Discovering web maps...'}</p>
                </div>
              ) : topWebMaps.length > 0 ? (
                <>
                  {/* Filter Input */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={webMapFilter}
                      onChange={(e) => setWebMapFilter(e.target.value)}
                      placeholder="Filter web maps by name..."
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                      style={{ '--tw-ring-color': `${accentColor}40` }}
                    />
                    {webMapFilter && (
                      <button
                        onClick={() => setWebMapFilter('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {topWebMaps
                      .filter(wm => webMapFilter === '' || wm.title.toLowerCase().includes(webMapFilter.toLowerCase()))
                      .map((wm, idx) => {
                      const isSelected = selectedWebMaps.includes(wm.id);
                      return (
                        <div
                          key={wm.id}
                          onClick={() => toggleWebMapSelection(wm.id)}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-sm ${
                            isSelected 
                              ? 'shadow-md' 
                              : 'border-slate-200'
                          }`}
                          style={isSelected ? { borderColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                isSelected ? 'text-white' : 'border-slate-300'
                              }`}
                              style={isSelected ? { backgroundColor: accentColor, borderColor: accentColor } : {}}
                            >
                              {isSelected && <Check className="w-4 h-4" />}
                            </div>
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                              style={{ backgroundColor: accentColor }}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-slate-800 truncate">{wm.title}</p>
                                {wm.isOwnedByUser && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    Yours
                                  </span>
                                )}
                                {wm.isRecentlyEdited && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Recent
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">{wm.numViews?.toLocaleString() || 0} views • {wm.owner}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Load More / Show status */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Showing <span className="font-semibold">{topWebMaps.length}</span> of {totalWebMapsAvailable} web maps
                      {selectedWebMaps.length > 0 && (
                        <span className="ml-2">• <span className="font-semibold">{selectedWebMaps.length}</span> selected</span>
                      )}
                    </p>
                    {hasMoreWebMaps && (
                      <button
                        onClick={loadMoreWebMaps}
                        disabled={isLoadingMoreWebMaps}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        style={{ color: accentColor }}
                      >
                        {isLoadingMoreWebMaps ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {isLoadingMoreWebMaps ? 'Loading...' : 'Load More'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No web maps found in your organization</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Scan Endpoints */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <Layers className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Scanning Layers</h3>
                  <p className="text-sm text-slate-500">Extracting service endpoints from selected web maps</p>
                </div>
              </div>

              {topWebMaps.filter(wm => selectedWebMaps.includes(wm.id)).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Scanning {selectedWebMaps.length} Web Map{selectedWebMaps.length !== 1 ? 's' : ''}</h4>
                  {topWebMaps.filter(wm => selectedWebMaps.includes(wm.id)).map((wm, idx) => (
                    <div key={wm.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: accentColor }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{wm.title}</p>
                        <p className="text-xs text-slate-500">{wm.numViews?.toLocaleString() || 0} views</p>
                      </div>
                      {isLoading && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
                    </div>
                  ))}
                </div>
              )}

              {allEndpoints.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                      <p className="font-semibold text-green-800">Scan Complete</p>
                      <p className="text-sm text-green-600">Found {allEndpoints.length} service endpoints</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Ranking & Selection */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {isLoading ? 'Analyzing Endpoints' : 'Ranked Endpoints'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {isLoading 
                      ? 'Evaluating notification potential for each endpoint...' 
                      : 'Select endpoints to create notifications for'}
                  </p>
                </div>
              </div>

              {rankedEndpoints.length > 0 ? (
                <div className="space-y-6">
                  {/* Group endpoints by webmap */}
                  {Object.entries(
                    rankedEndpoints.reduce((groups, ep) => {
                      const key = ep.webMapTitle || 'Unknown Web Map';
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(ep);
                      return groups;
                    }, {})
                  ).map(([webMapTitle, endpoints]) => (
                    <div key={webMapTitle} className="space-y-3">
                      {/* Web Map Header */}
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                        <MapIcon className="w-5 h-5" style={{ color: accentColor }} />
                        <h4 className="font-semibold text-slate-700">{webMapTitle}</h4>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {/* Endpoints for this webmap */}
                      <div className="space-y-2 pl-2">
                        {endpoints.map((ep, idx) => {
                          const isSelected = selectedEndpoints.some(s => s.url === ep.url);
                          return (
                            <button
                              key={ep.url}
                              onClick={() => toggleEndpointSelection(ep)}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                isSelected 
                                  ? 'shadow-lg' 
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                              style={isSelected ? { 
                                borderColor: accentColor, 
                                backgroundColor: `${accentColor}08` 
                              } : {}}
                            >
                              <div className="flex items-start gap-4">
                                <div 
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                                    isSelected ? 'text-white' : 'bg-slate-100 text-slate-600'
                                  }`}
                                  style={isSelected ? { backgroundColor: accentColor } : {}}
                                >
                                  {isSelected ? <Check className="w-4 h-4" /> : idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <p className="font-semibold text-slate-800">{ep.title}</p>
                                    {ep.updateFrequency && ep.updateFrequency !== 'unknown' && ep.updateFrequency !== 'error' && (
                                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                        ep.updateFrequency === 'very_high' ? 'bg-purple-100 text-purple-700' :
                                        ep.updateFrequency === 'high' ? 'bg-blue-100 text-blue-700' :
                                        ep.updateFrequency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                        ep.updateFrequency === 'low' ? 'bg-orange-100 text-orange-700' :
                                        'bg-slate-100 text-slate-600'
                                      }`}>
                                        {ep.updateFrequency === 'very_high' ? '🔥 Very Active' :
                                         ep.updateFrequency === 'high' ? '📈 Active' :
                                         ep.updateFrequency === 'medium' ? '📊 Moderate' :
                                         ep.updateFrequency === 'low' ? '📉 Low Activity' :
                                         ep.updateFrequency === 'none' ? '⏸️ No Recent Updates' : ''}
                                      </span>
                                    )}
                                    {ep.targetAudience && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                        <Users className="w-3 h-3" />
                                        {ep.targetAudience}
                                      </span>
                                    )}
                                  </div>
                                  {ep.aiReason && (
                                    <p className="text-sm text-slate-600 flex items-start gap-2 mb-1">
                                      <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accentColor }} />
                                      {ep.aiReason}
                                    </p>
                                  )}
                                  {ep.notificationIdea && (
                                    <p className="text-sm text-slate-500 italic">
                                      💡 {ep.notificationIdea}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Database className="w-3 h-3" />
                                      {ep.fields?.length || 0} fields
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {ep.dateFields?.length || 0} date fields
                                    </span>
                                    {ep.recentRecordCount > 0 && (
                                      <span className="flex items-center gap-1 font-medium" style={{ color: accentColor }}>
                                        <TrendingUp className="w-3 h-3" />
                                        {ep.recentRecordCount}+ records (30 days)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !error && !isLoading && statusMessage ? (
                <div className="flex flex-col items-center py-12">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${accentColor}10` }}
                  >
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                  </div>
                  <p className="text-slate-600 font-medium">Processing endpoints...</p>
                  <p className="text-sm text-slate-400 mt-1">This may take a moment</p>
                </div>
              ) : !error && !isLoading && !statusMessage && (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No suitable endpoints found</p>
                  <p className="text-sm mt-1">Ensure your web maps contain layers with date fields</p>
                </div>
              )}

              {rankedEndpoints.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">{selectedEndpoints.length}</span> endpoint{selectedEndpoints.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review & Create */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {isLoading ? 'Generating Notifications' : 'Generated Notifications'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {isLoading 
                      ? 'Configuring optimal settings for each endpoint...' 
                      : 'Review and customize before saving'}
                  </p>
                </div>
              </div>

              {generatedNotifications.length > 0 ? (
                <div className="space-y-4">
                  {generatedNotifications.map((notif, idx) => (
                    <div key={notif.id} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${accentColor}15` }}
                          >
                            <Zap className="w-5 h-5" style={{ color: accentColor }} />
                          </div>
                          <input
                            type="text"
                            value={notif.name}
                            onChange={(e) => updateGeneratedNotification(idx, 'name', e.target.value)}
                            className="flex-1 font-semibold text-slate-800 bg-transparent border-b-2 border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:outline-none px-1 py-1 text-lg"
                          />
                        </div>
                        <button
                          onClick={() => removeGeneratedNotification(idx)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                        <textarea
                          value={notif.description}
                          onChange={(e) => updateGeneratedNotification(idx, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                          style={{ '--tw-ring-color': `${accentColor}40` }}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                          <select
                            value={notif.type}
                            onChange={(e) => updateGeneratedNotification(idx, 'type', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Run Day</label>
                          {notif.type === 'monthly' ? (
                            <input
                              type="number"
                              min="1"
                              max="28"
                              value={notif.runDay}
                              onChange={(e) => updateGeneratedNotification(idx, 'runDay', parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                          ) : notif.type === 'weekly' ? (
                            <select
                              value={notif.runDay}
                              onChange={(e) => updateGeneratedNotification(idx, 'runDay', parseInt(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                            >
                              <option value={0}>Sunday</option>
                              <option value={1}>Monday</option>
                              <option value={2}>Tuesday</option>
                              <option value={3}>Wednesday</option>
                              <option value={4}>Thursday</option>
                              <option value={5}>Friday</option>
                              <option value={6}>Saturday</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value="Every Day"
                              disabled
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500"
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Run Time (UTC)</label>
                          <input
                            type="time"
                            value={notif.runTime}
                            onChange={(e) => updateGeneratedNotification(idx, 'runTime', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Date Field</label>
                          <select
                            value={notif.source?.dateField || ''}
                            onChange={(e) => {
                              const selectedField = notif._endpoint?.dateFields?.find(f => f.name === e.target.value);
                              updateGeneratedNotification(idx, 'source', {
                                ...notif.source,
                                dateField: e.target.value,
                                dateFieldType: selectedField?.type || 'esriFieldTypeDate'
                              });
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                          >
                            {notif._endpoint?.dateFields?.map(field => (
                              <option key={field.name} value={field.name}>
                                {field.alias || field.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !error && !isLoading && statusMessage ? (
                <div className="flex flex-col items-center py-12">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${accentColor}10` }}
                  >
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                  </div>
                  <p className="text-slate-600 font-medium">Generating configurations...</p>
                  <p className="text-sm text-slate-400 mt-1">Analyzing fields and settings</p>
                </div>
              ) : !error && !isLoading && !statusMessage && (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No notifications generated</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || isLoading}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            
            {/* Step 2: Scan Selected Maps button */}
            {currentStep === 2 && topWebMaps.length > 0 && (
              <button
                onClick={processSelectedWebMaps}
                disabled={selectedWebMaps.length === 0 || isLoading}
                className="px-6 py-2.5 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Layers className="w-5 h-5" />
                )}
                Scan Selected Maps
              </button>
            )}
            
            {/* Step 4: Generate Notifications button */}
            {currentStep === 4 && rankedEndpoints.length > 0 && (
              <button
                onClick={generateNotifications}
                disabled={selectedEndpoints.length === 0 || isLoading}
                className="px-6 py-2.5 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                Generate Notifications
              </button>
            )}
            
            {/* Step 5: Save Notifications button */}
            {currentStep === 5 && generatedNotifications.length > 0 && (
              <button
                onClick={saveNotifications}
                disabled={savingNotifications}
                className="px-6 py-2.5 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {savingNotifications ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                Save {generatedNotifications.length} Notification{generatedNotifications.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}