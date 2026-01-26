// src/admin/components/ServiceFinder.jsx
// Full ArcGIS Service Discovery Component
// Migrated to CivQuest unified admin app
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Server, 
  Globe, 
  Folder, 
  FolderOpen,
  FileText, 
  Layers, 
  ChevronRight, 
  ArrowLeft, 
  Map as MapIcon, 
  User, 
  LogIn,
  Loader2,
  Check,
  AlertCircle,
  Home,
  Building2,
  BookOpen
} from 'lucide-react';

// Configuration for the Proxy Service
const PROXY_BASE_URL = window.ARCGIS_PROXY_URL || 'https://notify.civ.quest';

export default function ServiceFinder({ isOpen, onClose, onSelect }) {
  const [mode, setMode] = useState('portal'); // Default to 'portal'
  
  // Server Mode State
  const [serverUrl, setServerUrl] = useState('https://sampleserver6.arcgisonline.com/arcgis/rest/services');
  const [serverCreds, setServerCreds] = useState({ username: '', password: '' });
  const [serverToken, setServerToken] = useState(null); // Token for Server mode
  const [currentPath, setCurrentPath] = useState('');
  const [serverItems, setServerItems] = useState({ folders: [], services: [], layers: [] });
  const [serverBreadcrumbs, setServerBreadcrumbs] = useState([]);
  
  // Portal Mode State
  const [portalUrl, setPortalUrl] = useState('https://www.arcgis.com');
  const [isCustomPortal, setIsCustomPortal] = useState(false); // Toggle for custom portal URL
  const [portalCreds, setPortalCreds] = useState({ username: '', password: '' });
  const [portalToken, setPortalToken] = useState(null);
  const [portalUser, setPortalUser] = useState(null);
  
  // Portal Content Browsing State
  const [portalScope, setPortalScope] = useState('my_content'); // 'my_content' | 'org' | 'agol'
  const [portalSearchQuery, setPortalSearchQuery] = useState('');
  const [portalContent, setPortalContent] = useState({ folders: [], items: [] });
  const [portalBreadcrumbs, setPortalBreadcrumbs] = useState([]);
  const [selectedWebMap, setSelectedWebMap] = useState(null); // Selected WebMap details
  
  // Web Map Layer Navigation State (Drill-down)
  const [webMapRootLayers, setWebMapRootLayers] = useState([]); // Root layers of selected WebMap
  const [webMapLayerStack, setWebMapLayerStack] = useState([]); // Stack for group layer navigation
  
  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState(null); // The final URL selected

  if (!isOpen) return null;

  // --- Common Helpers ---

  /**
   * Helper to fetch resources (JSON) from Portal/ArcGIS.
   * Routes through the proxy if a token is present (handling CORS for secure portals),
   * or fetches directly if anonymous.
   */
  const fetchPortalResource = async (url, token) => {
    if (token) {
      // Authenticated: Use Proxy
      const res = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Proxy Error (${res.status}): ${errText}`);
      }

      const json = await res.json();

      // Check for Token Expiry inside ArcGIS error response
      if (json.error) {
        if (json.error.code === 498 || json.error.code === 499) {
          setPortalToken(null);
          setPortalUser(null);
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(json.error.message || 'ArcGIS Error');
      }
      return json;
    } else {
      // Anonymous: Direct Fetch (usually assumes public AGOL/Server)
      // Ensure f=json is present
      const fetchUrl = url.includes('?') ? `${url}&f=json` : `${url}?f=json`;
      const res = await fetch(fetchUrl);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    }
  };

  // --- Server Navigation Logic ---

  /**
   * Fetches JSON from an ArcGIS Server URL.
   * If an auth token is active (serverToken), it uses the proxy to avoid CORS/Auth issues.
   */
  const fetchServerPath = async (url, tokenOverride = null) => {
    setLoading(true);
    setError(null);
    setServerItems({ folders: [], services: [], layers: [] });
    setSelectedService(null);

    const activeToken = tokenOverride || serverToken;

    try {
      let json;

      if (activeToken) {
        // Authenticated Request: Use Proxy
        const res = await fetch(`${PROXY_BASE_URL}/api/arcgis/json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                token: activeToken
            })
        });
        
        if (!res.ok) {
             const errText = await res.text();
             throw new Error(`Proxy Error (${res.status}): ${errText}`);
        }
        
        json = await res.json();
      } else {
        // Unauthenticated Request: Direct Fetch
        // Ensure json format
        const fetchUrl = url.includes('?') ? `${url}&f=json` : `${url}?f=json`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      }

      if (json.error) {
        // Handle Token Expiry explicitly
        if (json.error.code === 498 || json.error.code === 499) {
            setServerToken(null); // Clear invalid token
            throw new Error("Session expired. Please connect again.");
        }
        throw new Error(json.error.message || 'ArcGIS Error');
      }

      // Detect content type
      if (json.folders || json.services) {
        // It's a Folder or Root
        setServerItems({
          folders: json.folders || [],
          services: json.services || [],
          layers: []
        });
      } else if (json.layers) {
        // It's a MapServer/FeatureServer
        setServerItems({
          folders: [],
          services: [],
          layers: json.layers
        });
      } else {
        throw new Error('Unrecognized endpoint format or no content found.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectServer = async () => {
    // Reset Navigation
    setServerBreadcrumbs([{ name: 'Root', url: serverUrl }]);
    setCurrentPath(serverUrl);
    setServerToken(null);
    setError(null);

    // Authentication Logic
    if (serverCreds.username && serverCreds.password) {
        setLoading(true);
        try {
            // Step 1: Get Token via Proxy
            const res = await fetch(`${PROXY_BASE_URL}/api/arcgis/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceUrl: serverUrl,
                    username: serverCreds.username,
                    password: serverCreds.password
                })
            });

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error);
            }
            
            if (data.token) {
                setServerToken(data.token);
                // Step 2: Fetch Root with new Token
                await fetchServerPath(serverUrl, data.token);
            } else {
                throw new Error("Authentication succeeded but no token was returned.");
            }

        } catch (err) {
            setError(`Connection Failed: ${err.message}`);
            setLoading(false);
        }
    } else {
        // Anonymous Connection
        fetchServerPath(serverUrl);
    }
  };

  const navigateServer = (item, type) => {
    let newUrl = '';
    
    if (type === 'folder') {
      newUrl = `${currentPath}/${item}`;
      const newCrumbs = [...serverBreadcrumbs, { name: item, url: newUrl }];
      setServerBreadcrumbs(newCrumbs);
      setCurrentPath(newUrl);
      fetchServerPath(newUrl);
    } else if (type === 'service') {
      const serviceName = item.name.split('/').pop();
      newUrl = `${currentPath}/${serviceName}/${item.type}`;
      
      const newCrumbs = [...serverBreadcrumbs, { name: serviceName, url: newUrl }];
      setServerBreadcrumbs(newCrumbs);
      setCurrentPath(newUrl);
      fetchServerPath(newUrl);
    }
  };

  const handleBreadcrumbClick = (crumb, index) => {
    const newCrumbs = serverBreadcrumbs.slice(0, index + 1);
    setServerBreadcrumbs(newCrumbs);
    setCurrentPath(crumb.url);
    fetchServerPath(crumb.url);
  };

  // --- Portal Navigation Logic ---

  const handleCustomPortalToggle = (checked) => {
    setIsCustomPortal(checked);
    if (!checked) {
      setPortalUrl('https://www.arcgis.com');
    } else {
      setPortalUrl(''); // Clear for user input
    }
  };

  const handlePortalLogin = async () => {
    setLoading(true);
    setError(null);
    
    // Ensure we don't have trailing slashes which might confuse the proxy
    const rawUrl = isCustomPortal ? portalUrl : 'https://www.arcgis.com';
    const targetUrl = rawUrl.replace(/\/+$/, '');

    try {
      // Updated: Use Proxy Service for Token Generation
      // This routes the auth request through the proxy to handle Enterprise/Federated auth & CORS
      // It matches the exact same pattern used in handleConnectServer above.
      const res = await fetch(`${PROXY_BASE_URL}/api/arcgis/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            serviceUrl: targetUrl,
            username: portalCreds.username,
            password: portalCreds.password
        })
      });
      
      if (!res.ok) {
        throw new Error(`Proxy service returned ${res.status}`);
      }

      const json = await res.json();
      
      if (json.error) throw new Error(json.error);
      if (!json.token) throw new Error("Authentication succeeded but no token was returned.");
      
      setPortalToken(json.token);
      
      // Get User Info
      // Use fetchPortalResource to ensure subsequent requests also go through proxy if needed
      const userUrl = `${targetUrl}/sharing/rest/community/users/${portalCreds.username}`;
      const userJson = await fetchPortalResource(userUrl, json.token);
      
      setPortalUser(userJson);
      
      // Default load: My Content Root
      navigatePortalFolder(json.token, portalCreds.username, null);
      
    } catch (err) {
      setError(`Login Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper to decide whether to browse folders or search
  const refreshPortalView = (token = portalToken, scope = portalScope, query = portalSearchQuery) => {
    // If scope is ORG, AGOL, or there is a search query, we must use Search API (Flattened)
    if (scope === 'org' || scope === 'agol' || query.trim() !== '') {
        performPortalSearch(token, scope, query);
    } else {
        // Otherwise, browse My Content folders
        navigatePortalFolder(token, portalCreds.username, null);
    }
  };

  const performPortalSearch = async (token, scope, query) => {
    setLoading(true);
    setError(null);
    setWebMapRootLayers([]);
    setWebMapLayerStack([]);
    setSelectedWebMap(null);
    setPortalContent({ folders: [], items: [] }); // Clear previous
    setPortalBreadcrumbs([]); // Clear breadcrumbs in search mode
    
    const targetUrl = isCustomPortal ? portalUrl.replace(/\/+$/, '') : 'https://www.arcgis.com';

    try {
        let q = `(type:"Web Map" OR type:"Feature Service" OR type:"Map Service" OR type:"Image Service")`;
        let sortField = 'modified'; // Default sort
        
        // Scope Filter
        if (scope === 'my_content') {
            q += ` AND owner:"${portalCreds.username}"`;
        } else if (scope === 'org' && portalUser?.orgId) {
            q += ` AND orgid:"${portalUser.orgId}"`;
        } else if (scope === 'agol') {
            // Search all public content
            q += ` AND access:public`;
            sortField = 'numViews'; // Sort by popularity for general browsing
        }

        // Text Search
        if (query.trim()) {
            q += ` AND (${query})`;
        }

        const searchUrl = `${targetUrl}/sharing/rest/search?q=${encodeURIComponent(q)}&num=50&sortField=${sortField}&sortOrder=desc`;
        
        // Use helper (proxies if token exists)
        const json = await fetchPortalResource(searchUrl, token);

        setPortalContent({
            folders: [], // Search results don't have folders
            items: json.results || []
        });

    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const navigatePortalFolder = async (token, username, folder) => {
    setLoading(true);
    setError(null);
    setWebMapRootLayers([]);
    setWebMapLayerStack([]);
    setSelectedWebMap(null);
    
    const targetUrl = isCustomPortal ? portalUrl.replace(/\/+$/, '') : 'https://www.arcgis.com';

    try {
        let url = `${targetUrl}/sharing/rest/content/users/${username}`;
        if (folder) {
            url += `/${folder.id}`;
        }
        url += `?num=100`; // Proxy helper will add f=json and token

        const json = await fetchPortalResource(url, token);

        setPortalContent({
            folders: folder ? [] : (json.folders || []),
            items: json.items || []
        });

        // Update breadcrumbs
        if (!folder) {
            setPortalBreadcrumbs([{ id: 'root', title: 'My Content' }]);
        } else {
            setPortalBreadcrumbs(prev => {
                const existingIdx = prev.findIndex(c => c.id === folder.id);
                if (existingIdx !== -1) return prev.slice(0, existingIdx + 1);
                return [...prev, { id: folder.id, title: folder.title }];
            });
        }

    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handlePortalBreadcrumb = (crumb, index) => {
    if (index === 0) {
        navigatePortalFolder(portalToken, portalCreds.username, null);
    } else {
        navigatePortalFolder(portalToken, portalCreds.username, { id: crumb.id, title: crumb.title });
    }
  };

  const handlePortalItemClick = async (item) => {
    // Clear selection state
    setSelectedService(null);

    if (item.type === 'Web Map') {
        selectWebMap(item);
    } else if (item.type === 'Feature Service' || item.type === 'Map Service' || item.type === 'Image Service') {
        // Drill down into service to find layers
        selectServiceItem(item);
    }
  };

  const selectWebMap = async (item) => {
    setSelectedWebMap(item);
    setWebMapLayerStack([]); // Reset stack
    setLoading(true);
    
    const targetUrl = isCustomPortal ? portalUrl.replace(/\/+$/, '') : 'https://www.arcgis.com';

    try {
      const url = `${targetUrl}/sharing/rest/content/items/${item.id}/data`;
      const json = await fetchPortalResource(url, portalToken);
      
      if (json.operationalLayers) {
        setWebMapRootLayers(json.operationalLayers);
      } else {
        setWebMapRootLayers([]);
        setError("No operational layers found in this map.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectServiceItem = async (item) => {
    setSelectedWebMap(item); // Use the same UI container as Web Maps
    setWebMapLayerStack([]); 
    setLoading(true);

    try {
        const serviceUrl = item.url;
        // fetchPortalResource will handle token and f=json
        const json = await fetchPortalResource(serviceUrl, portalToken);

        let layers = [];
        
        // Handle MapServer/FeatureServer that have layers
        if (json.layers) {
            // Build hierarchy from flat layers list
            const layerMap = {};
            
            // First pass: create nodes
            json.layers.forEach(l => {
                layerMap[l.id] = {
                    title: l.name,
                    id: l.id,
                    url: `${serviceUrl}/${l.id}`,
                    // layers property is NOT set here; only if children exist later
                };
            });
            
            // Second pass: link parents/children
            const rootLayers = [];
            json.layers.forEach(l => {
                const current = layerMap[l.id];
                if (l.parentLayerId !== -1 && l.parentLayerId !== undefined && layerMap[l.parentLayerId]) {
                    const parent = layerMap[l.parentLayerId];
                    if (!parent.layers) parent.layers = [];
                    parent.layers.push(current);
                } else {
                    rootLayers.push(current);
                }
            });
            
            // Also handle tables if present
            if (json.tables) {
                json.tables.forEach(t => {
                   rootLayers.push({
                       title: t.name,
                       id: t.id,
                       url: `${serviceUrl}/${t.id}`
                   });
                });
            }

            layers = rootLayers;
        } 
        // Fallback for simple services or ImageServers without layer list
        else {
           layers = [{
               title: item.title,
               url: item.url,
               // No children
           }];
        }

        setWebMapRootLayers(layers);

    } catch (err) {
        setError(err.message);
        setWebMapRootLayers([]);
    } finally {
        setLoading(false);
    }
  };

  // --- Web Map Group Layer Navigation ---

  const handleEnterGroupLayer = (layer) => {
    setWebMapLayerStack([...webMapLayerStack, layer]);
  };

  const handleLeaveGroupLayer = (index) => {
    if (index === -1) {
        setWebMapLayerStack([]); // Back to root
    } else {
        setWebMapLayerStack(webMapLayerStack.slice(0, index + 1));
    }
  };

  const handleLayerSelect = (url, name) => {
    setSelectedService({ url, name });
  };

  const handleConfirm = () => {
    if (selectedService) {
      // Determine which credentials to send based on the active mode
      // If user provided credentials in this session, pass them along
      let activeUsername = '';
      let activePassword = '';

      if (mode === 'server') {
        activeUsername = serverCreds.username;
        activePassword = serverCreds.password;
      } else if (mode === 'portal') {
        activeUsername = portalCreds.username;
        activePassword = portalCreds.password;
      }

      onSelect({
        url: selectedService.url,
        username: activeUsername || '', // Ensure empty string if null/undefined
        password: activePassword || ''
      });
      onClose();
    }
  };

  // Determine which layers to show in the right panel
  const visibleWebMapLayers = webMapLayerStack.length > 0 
    ? webMapLayerStack[webMapLayerStack.length - 1].layers || [] 
    : webMapRootLayers;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Browse ArcGIS Services</h2>
              <p className="text-sm text-slate-500">Locate a service endpoint to use as your data source.</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-4 border-b border-slate-200">
            <button 
              onClick={() => setMode('portal')}
              className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${mode === 'portal' ? 'border-[#004E7C] text-[#004E7C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Globe className="w-4 h-4" /> ArcGIS Online / Portal
            </button>
            <button 
              onClick={() => setMode('server')}
              className={`pb-2 px-1 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${mode === 'server' ? 'border-[#004E7C] text-[#004E7C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Server className="w-4 h-4" /> ArcGIS Server
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50/50">
          
          {/* Mode: Server Browser */}
          {mode === 'server' && (
            <div className="flex flex-col h-full p-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex gap-2 mb-2">
                  <input 
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md text-sm font-mono"
                    placeholder="https://gis.example.com/arcgis/rest/services"
                  />
                  <button 
                    onClick={handleConnectServer}
                    disabled={loading}
                    className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Connect
                  </button>
                </div>
                
                {/* Auth Details (Optional) */}
                <details className="text-xs text-slate-500">
                   <summary className="cursor-pointer hover:text-slate-700 font-medium select-none flex items-center gap-1 w-fit mb-1">
                      <User className="w-3 h-3" /> Credentials (Optional)
                   </summary>
                   <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-slate-50 rounded border border-slate-100 animate-in slide-in-from-top-1">
                      <div>
                        <label className="block mb-1 font-medium">Username</label>
                        <input 
                          type="text" 
                          className="w-full px-2 py-1.5 border rounded text-xs"
                          placeholder="ArcGIS Server User"
                          value={serverCreds.username}
                          onChange={e => setServerCreds({...serverCreds, username: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block mb-1 font-medium">Password</label>
                        <input 
                          type="password" 
                          className="w-full px-2 py-1.5 border rounded text-xs"
                          placeholder="••••••••"
                          value={serverCreds.password}
                          onChange={e => setServerCreds({...serverCreds, password: e.target.value})}
                        />
                      </div>
                      <div className="col-span-2 text-[10px] text-slate-400">
                        Leave blank for public servers. If provided, requests will be proxied securely.
                      </div>
                   </div>
                </details>
              </div>

              {serverBreadcrumbs.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500 overflow-x-auto pb-2 border-b border-slate-200">
                  {serverBreadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.url}>
                      {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                      <button 
                        onClick={() => handleBreadcrumbClick(crumb, idx)}
                        className={`hover:text-[#004E7C] whitespace-nowrap ${idx === serverBreadcrumbs.length - 1 ? 'font-bold text-slate-700' : ''}`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                  {serverToken && (
                     <span className="ml-auto flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                        <Check className="w-3 h-3" /> Authenticated
                     </span>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto bg-white border rounded-md shadow-sm p-2">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" /> Loading...
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2 p-8 text-center">
                    <AlertCircle className="w-8 h-8" /> 
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="text-sm underline mt-2">Dismiss</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Folders */}
                    {serverItems.folders.map(folder => (
                      <button
                        key={folder}
                        onClick={() => navigateServer(folder, 'folder')}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex items-center gap-3 group transition-colors"
                      >
                        <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                        <span className="text-sm font-medium text-slate-700">{folder}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-slate-500" />
                      </button>
                    ))}

                    {/* Services */}
                    {serverItems.services.map(service => (
                      <button
                        key={service.name}
                        onClick={() => navigateServer(service, 'service')}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex items-center gap-3 group transition-colors border border-transparent hover:border-slate-100"
                      >
                        {service.type === 'MapServer' ? <MapIcon className="w-5 h-5 text-blue-500" /> : <Layers className="w-5 h-5 text-green-600" />}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{service.name.split('/').pop()}</span>
                          <span className="text-[10px] text-slate-400 uppercase">{service.type}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-slate-500" />
                      </button>
                    ))}

                    {/* Layers (Selectable) */}
                    {serverItems.layers.map(layer => {
                      const layerUrl = `${currentPath}/${layer.id}`;
                      const isSelected = selectedService?.url === layerUrl;
                      
                      return (
                        <button
                          key={layer.id}
                          onClick={() => handleLayerSelect(layerUrl, layer.name)}
                          className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 border ring-1 ring-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                             <FileText className="w-3 h-3" />
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className={`text-sm ${isSelected ? 'font-bold text-indigo-900' : 'font-medium text-slate-700'}`}>{layer.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {layer.id}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </button>
                      );
                    })}

                    {serverItems.folders.length === 0 && serverItems.services.length === 0 && serverItems.layers.length === 0 && (
                      <div className="text-center py-10 text-slate-400 text-sm">
                        Use the "Connect" button to load services.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode: Portal Browser */}
          {mode === 'portal' && (
            <div className="flex flex-col h-full">
              {!portalToken ? (
                // Login Screen
                <div className="flex flex-col items-center justify-center h-full p-8 max-w-md mx-auto w-full">
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 w-full space-y-4">
                    <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-slate-800">Sign in to ArcGIS</h3>
                      <p className="text-xs text-slate-500 mt-1">Access your Content to find services</p>
                    </div>
                    
                    <div className="space-y-3">
                      
                      {/* Custom Portal Checkbox */}
                      <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded border border-slate-100">
                        <input 
                            type="checkbox" 
                            id="useCustomPortal"
                            checked={isCustomPortal}
                            onChange={(e) => handleCustomPortalToggle(e.target.checked)}
                            className="rounded border-slate-300 text-[#004E7C] focus:ring-[#004E7C] w-4 h-4"
                        />
                        <label htmlFor="useCustomPortal" className="text-xs text-slate-700 select-none cursor-pointer">I am using an <strong>ArcGIS Enterprise Portal</strong></label>
                      </div>

                      {/* Portal URL Input (Conditional) */}
                      {isCustomPortal && (
                        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                           <label className="text-xs font-medium text-slate-600 block mb-1">Portal URL</label>
                           <input 
                             value={portalUrl}
                             onChange={e => setPortalUrl(e.target.value)}
                             placeholder="https://portal.domain.com/arcgis"
                             className="w-full px-3 py-2 border rounded text-sm"
                           />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Username</label>
                            <input 
                              value={portalCreds.username}
                              onChange={e => setPortalCreds({...portalCreds, username: e.target.value})}
                              className="w-full px-3 py-2 border rounded text-sm"
                            />
                         </div>
                         <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Password</label>
                            <input 
                              type="password"
                              value={portalCreds.password}
                              onChange={e => setPortalCreds({...portalCreds, password: e.target.value})}
                              className="w-full px-3 py-2 border rounded text-sm"
                            />
                         </div>
                      </div>
                    </div>
                    
                    {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}

                    <button 
                      onClick={handlePortalLogin}
                      disabled={loading || !portalCreds.username || !portalCreds.password || (isCustomPortal && !portalUrl)}
                      className="w-full bg-[#004E7C] text-white py-2 rounded font-medium hover:bg-[#003B5C] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      {isCustomPortal ? 'Sign In to Portal' : 'Sign In to ArcGIS Online'}
                    </button>
                  </div>
                </div>
              ) : (
                // Authenticated View
                <div className="flex h-full">
                  {/* Left: Content Browser */}
                  <div className={`w-1/2 flex flex-col border-r border-slate-200 bg-white ${selectedWebMap ? 'hidden md:flex' : 'flex'}`}>
                     <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-3">
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                             <User className="w-3 h-3" />
                             {portalUser ? portalUser.username : 'User'}
                           </span>
                           <button onClick={() => { setPortalToken(null); setSelectedWebMap(null); }} className="text-xs text-red-500 hover:underline">Sign Out</button>
                        </div>
                        
                        {/* Scope Switcher */}
                        <div className="flex bg-slate-200 p-0.5 rounded-md gap-0.5">
                          <button 
                            onClick={() => { setPortalScope('my_content'); refreshPortalView(portalToken, 'my_content', portalSearchQuery); }}
                            className={`flex-1 text-[10px] font-medium py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all whitespace-nowrap ${portalScope === 'my_content' ? 'bg-white text-[#004E7C] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             <Home className="w-3 h-3" /> My Content
                          </button>
                          <button 
                            onClick={() => { setPortalScope('org'); refreshPortalView(portalToken, 'org', portalSearchQuery); }}
                            className={`flex-1 text-[10px] font-medium py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all whitespace-nowrap ${portalScope === 'org' ? 'bg-white text-[#004E7C] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             <Building2 className="w-3 h-3" /> Organization
                          </button>
                          <button 
                            onClick={() => { setPortalScope('agol'); refreshPortalView(portalToken, 'agol', portalSearchQuery); }}
                            className={`flex-1 text-[10px] font-medium py-1.5 px-1 rounded flex items-center justify-center gap-1 transition-all whitespace-nowrap ${portalScope === 'agol' ? 'bg-white text-[#004E7C] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             <Globe className="w-3 h-3" /> ArcGIS Online
                          </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                           <Search className="w-4 h-4 absolute left-2 top-2 text-slate-400" />
                           <input 
                              value={portalSearchQuery}
                              onChange={(e) => setPortalSearchQuery(e.target.value)}
                              onKeyDown={(e) => {
                                 if (e.key === 'Enter') refreshPortalView(portalToken, portalScope, portalSearchQuery);
                              }}
                              placeholder={`Search ${portalScope === 'org' ? 'Organization' : portalScope === 'agol' ? 'ArcGIS Online' : 'My Content'}...`}
                              className="w-full pl-8 pr-3 py-1.5 text-sm border rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004E7C]"
                           />
                           {portalSearchQuery && (
                             <button onClick={() => { setPortalSearchQuery(''); refreshPortalView(portalToken, portalScope, ''); }} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                               <X className="w-3 h-3" />
                             </button>
                           )}
                        </div>
                        
                        {/* Breadcrumbs (Only visible in My Content Browse mode) */}
                        {portalScope === 'my_content' && !portalSearchQuery && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 overflow-x-auto pb-1 pt-1 border-t border-slate-200">
                              {portalBreadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={crumb.id}>
                                  {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                                  <button 
                                    onClick={() => handlePortalBreadcrumb(crumb, idx)}
                                    className={`hover:text-[#004E7C] whitespace-nowrap ${idx === portalBreadcrumbs.length - 1 ? 'font-bold text-slate-700' : ''}`}
                                  >
                                    {crumb.title}
                                  </button>
                                </React.Fragment>
                              ))}
                            </div>
                        )}
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading && !selectedWebMap ? (
                           <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                        ) : (
                            <>
                                {/* Render Folders (My Content Mode Only) */}
                                {portalContent.folders.map(folder => (
                                    <button
                                        key={folder.id}
                                        onClick={() => navigatePortalFolder(portalToken, portalCreds.username, folder)}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex items-center gap-3 group transition-colors"
                                    >
                                        <Folder className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                                        <span className="text-sm font-medium text-slate-700">{folder.title}</span>
                                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-slate-500" />
                                    </button>
                                ))}

                                {/* Render Items (Web Maps & Services) */}
                                {portalContent.items.map(item => {
                                   const isSupported = item.type === 'Web Map' || item.type === 'Feature Service' || item.type === 'Map Service' || item.type === 'Image Service';
                                   if (!isSupported) return null; // Skip non-service items

                                   const isSelected = selectedService?.url === item.url;

                                   return (
                                      <button 
                                        key={item.id}
                                        onClick={() => handlePortalItemClick(item)}
                                        className={`w-full text-left p-2 rounded border transition-all hover:shadow-sm flex items-start gap-3 ${selectedWebMap?.id === item.id || isSelected ? 'border-[#004E7C] bg-indigo-50 ring-1 ring-[#004E7C]' : 'border-transparent hover:bg-slate-50'}`}
                                      >
                                         <div className="w-8 h-8 bg-slate-100 rounded overflow-hidden shrink-0 mt-1">
                                            {item.type === 'Web Map' ? (
                                                <MapIcon className="w-full h-full p-1.5 text-blue-500" />
                                            ) : (
                                                <Layers className="w-full h-full p-1.5 text-green-600" />
                                            )}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-slate-800 truncate">{item.title}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] uppercase bg-slate-100 text-slate-500 px-1 rounded">{item.type}</span>
                                                <span className="text-[10px] text-slate-400 truncate">
                                                    {item.owner === portalCreds.username ? 'Me' : item.owner} • {new Date(item.modified).toLocaleDateString()}
                                                </span>
                                            </div>
                                         </div>
                                         {(selectedWebMap?.id === item.id || isSelected) && <Check className="w-4 h-4 text-[#004E7C] mt-2" />}
                                      </button>
                                   );
                                })}
                                
                                {portalContent.folders.length === 0 && portalContent.items.filter(i => i.type === 'Web Map' || i.type.includes('Service')).length === 0 && (
                                    <div className="p-8 text-center text-sm text-slate-400">
                                        {portalSearchQuery ? 'No results found matching your query.' : 'No content available.'}
                                    </div>
                                )}
                            </>
                        )}
                     </div>
                  </div>

                  {/* Right: Layers List (Web Maps & Group Layer Drill-down) */}
                  <div className={`md:w-1/2 flex flex-col bg-slate-50 ${selectedWebMap ? 'w-full flex' : 'hidden'}`}>
                      {selectedWebMap ? (
                        <>
                           <div className="p-3 border-b border-slate-200 bg-white">
                              <div className="flex items-center gap-2 mb-2">
                                <button onClick={() => setSelectedWebMap(null)} className="md:hidden p-1 hover:bg-slate-100 rounded">
                                   <ArrowLeft className="w-4 h-4" />
                                </button>
                                <div>
                                   <h4 className="text-sm font-bold text-slate-800 line-clamp-1">Layers in "{selectedWebMap.title}"</h4>
                                   <p className="text-xs text-slate-500">Drill down to find service endpoints.</p>
                                </div>
                              </div>
                              
                              {/* Web Map Layer Breadcrumbs */}
                              <div className="flex items-center gap-1 text-xs text-slate-500 overflow-x-auto">
                                <button 
                                  onClick={() => handleLeaveGroupLayer(-1)}
                                  className={`hover:text-[#004E7C] whitespace-nowrap ${webMapLayerStack.length === 0 ? 'font-bold text-slate-700' : ''}`}
                                >
                                  Top Level
                                </button>
                                {webMapLayerStack.map((group, idx) => (
                                  <React.Fragment key={idx}>
                                    <ChevronRight className="w-3 h-3 text-slate-300" />
                                    <button 
                                      onClick={() => handleLeaveGroupLayer(idx)}
                                      className={`hover:text-[#004E7C] whitespace-nowrap ${idx === webMapLayerStack.length - 1 ? 'font-bold text-slate-700' : ''}`}
                                    >
                                      {group.title}
                                    </button>
                                  </React.Fragment>
                                ))}
                              </div>
                           </div>

                           <div className="flex-1 overflow-y-auto p-2 space-y-1">
                              {loading ? (
                                 <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                              ) : visibleWebMapLayers.length === 0 ? (
                                 <div className="p-4 text-center text-sm text-slate-400">No layers found at this level.</div>
                              ) : (
                                 visibleWebMapLayers.map((layer, idx) => {
                                    // Check if Group Layer (has 'layers' property or specific type)
                                    // Also check if we explicitly populated layers array (even if empty) for our service logic
                                    const isGroup = layer.layerType === 'GroupLayer' || (layer.layers && Array.isArray(layer.layers));
                                    
                                    if (isGroup) {
                                      return (
                                        <button
                                          key={idx}
                                          onClick={() => handleEnterGroupLayer(layer)}
                                          className="w-full text-left px-3 py-3 rounded flex items-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 group"
                                        >
                                          <FolderOpen className="w-5 h-5 text-amber-500 fill-amber-100" />
                                          <div className="flex-1">
                                             <div className="text-sm font-medium text-slate-800">{layer.title}</div>
                                             <div className="text-[10px] text-slate-400">Group Layer</div>
                                          </div>
                                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                                        </button>
                                      );
                                    }

                                    // Check for regular Service Layer
                                    // Some layers might not have a URL (e.g. Map Notes), so we can disable them or style differently
                                    const layerUrl = layer.url; 
                                    const isSelected = selectedService?.url === layerUrl;
                                    const hasUrl = !!layerUrl;

                                    return (
                                       <button
                                          key={idx}
                                          disabled={!hasUrl}
                                          onClick={() => hasUrl && handleLayerSelect(layerUrl, layer.title)}
                                          className={`w-full text-left px-3 py-3 rounded flex items-center gap-3 transition-all 
                                            ${isSelected ? 'bg-white border-indigo-500 border shadow-md ring-1 ring-indigo-500' : 'bg-white border border-slate-200'}
                                            ${hasUrl ? 'hover:border-slate-300' : 'opacity-60 cursor-not-allowed bg-slate-50'}
                                          `}
                                       >
                                          <Layers className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : hasUrl ? 'text-slate-500' : 'text-slate-300'}`} />
                                          <div className="flex-1 overflow-hidden">
                                             <div className="text-sm font-medium text-slate-800 truncate">{layer.title}</div>
                                             {hasUrl ? (
                                                <div className="text-[10px] text-slate-400 font-mono truncate">{layerUrl}</div>
                                              ) : (
                                                <div className="text-[10px] text-slate-400 italic">No Service Endpoint</div>
                                              )}
                                          </div>
                                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                       </button>
                                    );
                                 })
                              )}
                           </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                           <Layers className="w-12 h-12 mb-3 opacity-20" />
                           <p className="max-w-xs">Select a <strong>Web Map</strong> to browse its layers, or select a <strong>Feature Service</strong> directly.</p>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-4 flex flex-col gap-3">
          <div className="w-full">
             <label className="text-xs font-bold text-slate-700 mb-1 block">Selected Service Endpoint</label>
             <div className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-mono text-slate-600 break-all select-all shadow-inner min-h-[3rem] flex items-center">
               {selectedService ? selectedService.url : <span className="text-slate-400 italic opacity-50">No service selected...</span>}
             </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-1">
             <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800 text-sm">Cancel</button>
             <button 
               onClick={handleConfirm}
               disabled={!selectedService}
               className="px-6 py-2 bg-[#004E7C] text-white rounded-lg font-medium hover:bg-[#003B5C] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all text-sm"
             >
               Use Selected Service
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}