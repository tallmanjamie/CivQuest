// src/atlas/AtlasApp.jsx
// CivQuest Atlas - Main Application Component
// Unified mapping and property search platform
//
// UPDATED: Now uses themeColors utility for proper dynamic theming
// Tailwind can't handle dynamic class names like `bg-${color}-600`
// So we use inline styles with the theme utility

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
  Home,
  Search,
  Send,
  Plus,
  Clock,
  Filter
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

// Theme utility for proper dynamic theming
import { getThemeColors, getThemeCssVars } from './utils/themeColors';

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
 * SearchToolbar Component
 * Unified search bar with mode toggle - available in all modes
 * Position can be 'top' or 'bottom' based on config.ui.searchBarPosition
 */
function SearchToolbar({ 
  config, 
  mode, 
  onModeChange, 
  enabledModes,
  searchQuery,
  onSearch,
  isSearching,
  activeMap,
  onShowHistory,
  onShowAdvanced,
  position = 'top'
}) {
  const [inputValue, setInputValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef(null);
  
  // Get theme colors from config
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const isBottom = position === 'bottom';
  
  const handleSubmit = (e) => {
    e?.preventDefault();
    if (inputValue.trim() && onSearch) {
      onSearch(inputValue.trim());
      setInputValue('');
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`bg-white ${isBottom ? 'border-t' : 'border-b'} border-slate-200 px-3 py-2 flex items-center gap-2`}>
      {/* Mode Toggle */}
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
        {Object.values(MODES)
          .filter(m => enabledModes.includes(m.id))
          .map(m => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                style={isActive ? { color: colors.text700 } : {}}
                title={m.label}
              >
                <Icon className="w-4 h-4" />
                {isActive && <span>{m.label}</span>}
              </button>
            );
          })}
      </div>
      
      {/* Search Input */}
      <div className="flex-1 flex items-center gap-2 relative">
        {/* Menu Button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg flex-shrink-0"
          title="More options"
        >
          <Plus className="w-5 h-5" />
        </button>
        
        {/* Menu Dropdown */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className={`absolute ${isBottom ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 bg-white border border-slate-200 shadow-xl rounded-xl w-56 p-1.5 z-50`}>
              <button
                onClick={() => { onShowAdvanced?.(); setShowMenu(false); }}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100, color: colors.text600 }}
                >
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-slate-700">Advanced Search</span>
                  <span className="block text-xs text-slate-400">Filter by specific fields</span>
                </div>
              </button>
              <button
                onClick={() => { onShowHistory?.(); setShowMenu(false); }}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100, color: colors.text600 }}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-slate-700">Search History</span>
                  <span className="block text-xs text-slate-400">View recent searches</span>
                </div>
              </button>
            </div>
          </>
        )}
        
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={activeMap?.searchPlaceholder || config?.ui?.searchPlaceholder || "Search properties..."}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:bg-white transition"
            style={{ 
              '--tw-ring-color': colors.bg500,
              borderColor: inputValue ? colors.border300 : undefined
            }}
          />
        </div>
        
        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isSearching}
          className={`p-2 rounded-lg transition-colors ${
            inputValue.trim() 
              ? 'text-white hover:opacity-90' 
              : 'bg-slate-100 text-slate-400'
          }`}
          style={inputValue.trim() ? { backgroundColor: colors.bg600 } : {}}
          title="Search"
        >
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}

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
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Search State (shared across views)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLocation, setSearchLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Refs for cross-component communication
  const mapViewRef = useRef(null);
  const tableViewRef = useRef(null);
  const chatViewRef = useRef(null);
  
  // Determine enabled modes from config
  const enabledModes = activeMap?.enabledModes || ['chat', 'map', 'table'];
  
  // Determine search bar position from config (default: 'top')
  const searchBarPosition = config?.ui?.searchBarPosition || 'top';
  
  // Get theme colors
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const cssVars = getThemeCssVars(themeColor);
  
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
  
  // Handle search execution from unified toolbar
  const handleSearch = useCallback(async (query) => {
    if (!query?.trim() || !activeMap) return;
    
    setSearchQuery(query);
    setIsSearching(true);
    
    // Delegate to ChatView's search logic
    if (chatViewRef.current?.handleSearch) {
      chatViewRef.current.handleSearch(query);
    }
  }, [activeMap]);
  
  // Update results from child components
  const updateSearchResults = useCallback((results, location = null) => {
    setSearchResults(results);
    if (location) setSearchLocation(location);
    setIsSearching(false);
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
  
  // Context value - includes theme colors for child components
  const contextValue = {
    // Config
    config,
    orgId,
    setOrgId,
    activeMap,
    activeMapIndex,
    setActiveMap,
    availableMaps,
    
    // Theme colors (for child components)
    themeColor,
    colors,
    
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
    setIsSearching,
    
    // Actions
    zoomToFeature,
    highlightFeature,
    
    // Refs
    mapViewRef,
    tableViewRef,
    chatViewRef,
    
    // UI State
    showHistory,
    setShowHistory,
    showAdvanced,
    setShowAdvanced
  };
  
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
      <OrgSelector 
        onSelect={(newOrgId) => setOrgId(newOrgId)}
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
  
  // Search toolbar component (rendered in both positions conditionally)
  const searchToolbar = (
    <SearchToolbar
      config={config}
      mode={mode}
      onModeChange={handleModeChange}
      enabledModes={enabledModes}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      isSearching={isSearching}
      activeMap={activeMap}
      onShowHistory={() => setShowHistory(true)}
      onShowAdvanced={() => setShowAdvanced(true)}
      position={searchBarPosition}
    />
  );
  
  return (
    <AtlasContext.Provider value={contextValue}>
      {/* Apply CSS variables for theme colors */}
      <div className="h-dvh flex flex-col bg-slate-100 font-sans" style={cssVars}>
        {/* Header */}
        <Header 
          config={config}
          mode={mode}
          onModeChange={handleModeChange}
          enabledModes={enabledModes}
          onMenuToggle={() => setShowMobileMenu(!showMobileMenu)}
          showMobileMenu={showMobileMenu}
        />
        
        {/* Search Toolbar - Top Position */}
        {searchBarPosition === 'top' && searchToolbar}
        
        {/* Main Content */}
        <main className="flex-1 relative overflow-hidden">
          {/* Chat View */}
          <div 
            className={`absolute inset-0 transition-opacity duration-200 ${
              mode === 'chat' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <ChatView ref={chatViewRef} />
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
        
        {/* Search Toolbar - Bottom Position */}
        {searchBarPosition === 'bottom' && searchToolbar}
        
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
            colors={colors}
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
function MobileMenu({ config, mode, onModeChange, enabledModes, onClose, arcgisUser, onSignIn, onSignOut, colors }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu Header */}
        <div 
          className="p-4 text-white flex justify-between items-center"
          style={{ backgroundColor: colors.bg700 }}
        >
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
                      ? 'font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  style={isActive ? { backgroundColor: colors.bg50, color: colors.text700 } : {}}
                >
                  <Icon className="w-5 h-5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* User Section */}
        <div className="p-4">
          {arcgisUser ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100 }}
                >
                  {arcgisUser.thumbnailUrl ? (
                    <img src={arcgisUser.thumbnailUrl} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <span className="text-lg font-semibold" style={{ color: colors.text600 }}>
                      {arcgisUser.fullName?.[0] || arcgisUser.username?.[0] || '?'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{arcgisUser.fullName || arcgisUser.username}</p>
                  <p className="text-xs text-slate-500">{arcgisUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => { onSignOut(); onClose(); }}
                className="w-full py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => { onSignIn(); onClose(); }}
              className="w-full py-2 text-white rounded-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: colors.bg600 }}
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
