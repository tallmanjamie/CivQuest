// src/atlas/AtlasApp.jsx
// CivQuest Atlas - Main Application Component
// Unified mapping and property search platform

import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { 
  Map, 
  Table2, 
  MessageSquare, 
  Menu, 
  X, 
  LogIn, 
  LogOut, 
  ChevronDown,
  HelpCircle,
  Loader2,
  AlertCircle,
  Home
} from 'lucide-react';

// Hooks
import { useAtlasConfig, useActiveMap, detectOrganizationId } from './hooks/useAtlasConfig';
import { useArcGISAuth } from './hooks/useArcGISAuth';

// Components
import MapView from './components/MapView';
import TableView from './components/TableView';
import ChatView from './components/ChatView';
import Header from './components/Header';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import OrgSelector from './components/OrgSelector';

// Create context for sharing state across components
export const AtlasContext = createContext(null);

export function useAtlas() {
  const context = useContext(AtlasContext);
  if (!context) {
    throw new Error('useAtlas must be used within AtlasApp');
  }
  return context;
}

// Mode configuration
const MODES = {
  chat: { id: 'chat', label: 'Chat', icon: MessageSquare },
  map: { id: 'map', label: 'Map', icon: Map },
  table: { id: 'table', label: 'Table', icon: Table2 }
};

/**
 * AtlasApp - Main application entry point
 */
export default function AtlasApp() {
  // Configuration & Auth
  const { config, loading: configLoading, error: configError, orgId, setOrgId, availableMaps } = useAtlasConfig();
  const { activeMap, activeMapIndex, setActiveMap } = useActiveMap(config);
  const { user: arcgisUser, loading: authLoading, signIn, signOut, isAuthenticated } = useArcGISAuth();
  
  // UI State
  const [mode, setMode] = useState('chat');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  
  // Search State (shared across views)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Refs for cross-component communication
  const mapViewRef = useRef(null);
  const tableViewRef = useRef(null);
  
  // Determine enabled modes from config
  const enabledModes = activeMap?.enabledModes || ['chat', 'map', 'table'];
  
  // Set initial mode based on config
  useEffect(() => {
    if (config && activeMap) {
      const savedMode = localStorage.getItem(`atlas_mode_${config.id}`);
      const defaultMode = activeMap.defaultMode || config.ui?.defaultMode || 'chat';
      const initialMode = savedMode && enabledModes.includes(savedMode) ? savedMode : defaultMode;
      
      if (enabledModes.includes(initialMode)) {
        setMode(initialMode);
      } else if (enabledModes.length > 0) {
        setMode(enabledModes[0]);
      }
    }
  }, [config, activeMap, enabledModes]);
  
  // Save mode preference
  const handleModeChange = useCallback((newMode) => {
    if (enabledModes.includes(newMode)) {
      setMode(newMode);
      if (config?.id) {
        localStorage.setItem(`atlas_mode_${config.id}`, newMode);
      }
    }
  }, [enabledModes, config?.id]);
  
  // Handle search execution
  const executeSearch = useCallback(async (query, options = {}) => {
    if (!query?.trim() || !activeMap) return;
    
    setIsSearching(true);
    setSearchQuery(query);
    
    try {
      // Search will be handled by the active view component
      // This just updates shared state
      console.log('[AtlasApp] Executing search:', query);
      
    } catch (err) {
      console.error('[AtlasApp] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [activeMap]);
  
  // Update results from child components
  const updateSearchResults = useCallback((results, location = null) => {
    setSearchResults(results);
    if (location) setSearchLocation(location);
  }, []);
  
  // Navigate to feature on map
  const zoomToFeature = useCallback((feature) => {
    if (mapViewRef.current?.zoomToFeature) {
      mapViewRef.current.zoomToFeature(feature);
    }
    // Switch to map mode if not already
    if (mode !== 'map' && enabledModes.includes('map')) {
      handleModeChange('map');
    }
  }, [mode, enabledModes, handleModeChange]);
  
  // Highlight feature on map
  const highlightFeature = useCallback((feature) => {
    if (mapViewRef.current?.highlightFeature) {
      mapViewRef.current.highlightFeature(feature);
    }
  }, []);
  
  // Context value
  const contextValue = {
    // Config
    config,
    orgId,
    setOrgId,
    activeMap,
    activeMapIndex,
    setActiveMap,
    availableMaps,
    
    // Auth
    arcgisUser,
    isAuthenticated,
    signIn,
    signOut,
    
    // Mode
    mode,
    setMode: handleModeChange,
    enabledModes,
    
    // Search
    searchQuery,
    setSearchQuery,
    searchResults,
    updateSearchResults,
    searchLocation,
    setSearchLocation,
    isSearching,
    executeSearch,
    
    // Actions
    zoomToFeature,
    highlightFeature,
    
    // Refs
    mapViewRef,
    tableViewRef
  };
  
  // Show org selector if no org specified
  if (!configLoading && !orgId) {
    return <OrgSelector onSelect={setOrgId} />;
  }
  
  // Loading state
  if (configLoading || authLoading) {
    return <LoadingScreen message="Loading Atlas..." />;
  }
  
  // Error state
  if (configError) {
    return (
      <ErrorScreen 
        title="Configuration Error"
        message={configError}
        action={
          <button
            onClick={() => setShowOrgSelector(true)}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            Select Organization
          </button>
        }
      />
    );
  }
  
  // No config loaded
  if (!config) {
    return (
      <ErrorScreen 
        title="No Configuration"
        message="Unable to load Atlas configuration."
      />
    );
  }
  
  // No maps available
  if (!activeMap) {
    return (
      <ErrorScreen 
        title="No Maps Available"
        message={isAuthenticated 
          ? "You don't have access to any maps in this organization."
          : "Sign in with ArcGIS to access protected maps."}
        action={!isAuthenticated && (
          <button
            onClick={signIn}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign in with ArcGIS
          </button>
        )}
      />
    );
  }
  
  // Theme color from config
  const themeColor = config.ui?.themeColor || 'sky';
  
  return (
    <AtlasContext.Provider value={contextValue}>
      <div className="h-dvh flex flex-col bg-slate-100 font-sans">
        {/* Header */}
        <Header 
          config={config}
          mode={mode}
          onModeChange={handleModeChange}
          enabledModes={enabledModes}
          onMenuToggle={() => setShowMobileMenu(!showMobileMenu)}
          showMobileMenu={showMobileMenu}
        />
        
        {/* Main Content */}
        <main className="flex-1 relative overflow-hidden">
          {/* Chat View */}
          <div 
            className={`absolute inset-0 transition-opacity duration-200 ${
              mode === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <ChatView />
          </div>
          
          {/* Map View */}
          <div 
            className={`absolute inset-0 transition-opacity duration-200 ${
              mode === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <MapView ref={mapViewRef} />
          </div>
          
          {/* Table View */}
          <div 
            className={`absolute inset-0 transition-opacity duration-200 ${
              mode === 'table' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <TableView ref={tableViewRef} />
          </div>
        </main>
        
        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <MobileMenu 
            config={config}
            mode={mode}
            onModeChange={handleModeChange}
            enabledModes={enabledModes}
            onClose={() => setShowMobileMenu(false)}
            arcgisUser={arcgisUser}
            onSignIn={signIn}
            onSignOut={signOut}
          />
        )}
        
        {/* Org Selector Modal */}
        {showOrgSelector && (
          <OrgSelector 
            onSelect={(newOrgId) => {
              setOrgId(newOrgId);
              setShowOrgSelector(false);
            }}
            onCancel={() => setShowOrgSelector(false)}
            currentOrg={orgId}
          />
        )}
      </div>
    </AtlasContext.Provider>
  );
}

/**
 * Mobile Menu Component
 */
function MobileMenu({ config, mode, onModeChange, enabledModes, onClose, arcgisUser, onSignIn, onSignOut }) {
  const themeColor = config?.ui?.themeColor || 'sky';
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu Header */}
        <div className={`p-4 bg-${themeColor}-700 text-white flex justify-between items-center`}>
          <span className="font-semibold">Menu</span>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Mode Selection */}
        <div className="p-4 border-b">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">View Mode</h3>
          <div className="space-y-1">
            {Object.values(MODES).filter(m => enabledModes.includes(m.id)).map(m => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => { onModeChange(m.id); onClose(); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                    isActive 
                      ? `bg-${themeColor}-100 text-${themeColor}-700` 
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* User Section */}
        <div className="p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Account</h3>
          {arcgisUser ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-600">
                Signed in as <span className="font-medium">{arcgisUser.fullName || arcgisUser.username}</span>
              </div>
              <button
                onClick={() => { onSignOut(); onClose(); }}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onSignIn(); onClose(); }}
              className={`flex items-center gap-2 text-${themeColor}-600 hover:text-${themeColor}-700`}
            >
              <LogIn className="w-4 h-4" />
              Sign in with ArcGIS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
