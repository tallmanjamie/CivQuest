// src/atlas/AtlasApp.jsx
// CivQuest Atlas - Main Application Component
// Unified mapping and property search platform
//
// UPDATED: Now uses themeColors utility for proper dynamic theming
// Tailwind can't handle dynamic class names like `bg-${color}-600`
// So we use inline styles with the theme utility
//
// UPDATED: Now uses Firebase auth (same as Notify) with ArcGIS OAuth support
// Users sign up from org page and are automatically assigned to that org

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
  ChevronRight,
  HelpCircle,
  Loader2,
  AlertCircle,
  Home,
  Search,
  Send,
  Plus,
  Clock,
  Filter,
  Settings,
  Check
} from 'lucide-react';

// Firebase Auth
import { auth, db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import {
  parseOAuthCallback,
  clearOAuthParams,
  verifyOAuthState,
  completeArcGISOAuth,
  generateDeterministicPassword,
  getOAuthMode,
  getOAuthRedirectUri,
  initiateArcGISLogin,
  storeArcGISToken,
  clearStoredArcGISToken
} from '@shared/services/arcgis-auth';
import { getESRISettings } from '@shared/services/systemConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { sendWelcomeEmail } from '@shared/services/email';

// Hooks
import { useAtlasConfig, useActiveMap, detectOrganizationId } from './hooks/useAtlasConfig';
import { useArcGISAuth } from './hooks/useArcGISAuth';
import { useWebmapAccessibility } from './hooks/useWebmapAccessibility';
import { useIntegrations } from './hooks/useIntegrations';
import PreviewBanner, { usePreviewBannerPadding } from './components/PreviewBanner';

// Components
import MapView from './components/MapView';
import TableView from './components/TableView';
import ChatView from './components/ChatView';
import Header from './components/Header';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import OrgSelector from './components/OrgSelector';
import AdvancedSearchModal from './components/AdvancedSearchModal';
import AuthScreen from './components/AuthScreen';
import AccountSettings from './components/AccountSettings';
import DisclaimerPopup from './components/DisclaimerPopup';
import HelpChatPanel from './components/HelpChatPanel';
import EagleViewModal from './components/EagleViewModal';
import NearmapModal from './components/NearmapModal';

// Theme utility for proper dynamic theming
import { getThemeColors, getThemeCssVars } from './utils/themeColors';

// Data exclusion utility
import { applyDataExclusions } from './utils/dataExclusion';

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
 *
 * UPDATED: Now includes autocomplete suggestions based on activeMap.autocomplete configuration
 * Each autocomplete field can have: type, field, label, icon, pattern, description, maxSuggestions
 *
 * UPDATED: Added geocoding autocomplete support. When a geocoding service is configured
 * (activeMap.geocoder.enabled), the search toolbar will also fetch address suggestions
 * from the geocoder's suggest endpoint, combining them with any configured autocomplete fields.
 */
function SearchToolbar({
  config,
  mode,
  onModeChange,
  enabledModes,
  searchQuery,
  onSearch,
  onGeocodingLocation,
  isSearching,
  activeMap,
  availableMaps,
  activeMapIndex,
  onMapSelect,
  showHistory,
  onShowHistory,
  onHideHistory,
  searchHistory,
  onClearHistory,
  onShowAdvanced,
  showHelpPanel,
  onShowHelp,
  onHideHelp,
  position = 'top',
  helpModeEnabled = false,
  searchBarSize = 'medium'
}) {
  const [inputValue, setInputValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showMapSubmenu, setShowMapSubmenu] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Get theme colors from config
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);
  const isBottom = position === 'bottom';

  // Size configurations for desktop (mobile uses default/small)
  // These use responsive classes: base is mobile, md: is desktop
  const sizeConfig = {
    small: {
      modeIcon: 'w-4 h-4',
      modeButton: 'px-2.5 py-1.5',
      modeText: 'text-sm',
      menuIcon: 'w-5 h-5',
      menuButton: 'p-2',
      searchIcon: 'w-4 h-4',
      input: 'pl-9 pr-4 py-2 text-sm',
      submitIcon: 'w-5 h-5',
      submitButton: 'p-2'
    },
    medium: {
      modeIcon: 'w-4 h-4 md:w-5 md:h-5',
      modeButton: 'px-2.5 py-1.5 md:px-3 md:py-2',
      modeText: 'text-sm md:text-base',
      menuIcon: 'w-5 h-5 md:w-6 md:h-6',
      menuButton: 'p-2 md:p-2.5',
      searchIcon: 'w-4 h-4 md:w-5 md:h-5',
      input: 'pl-9 pr-4 py-2 text-sm md:pl-11 md:pr-5 md:py-2.5 md:text-base',
      submitIcon: 'w-5 h-5 md:w-6 md:h-6',
      submitButton: 'p-2 md:p-2.5'
    },
    large: {
      modeIcon: 'w-4 h-4 md:w-6 md:h-6',
      modeButton: 'px-2.5 py-1.5 md:px-4 md:py-2.5',
      modeText: 'text-sm md:text-lg',
      menuIcon: 'w-5 h-5 md:w-7 md:h-7',
      menuButton: 'p-2 md:p-3',
      searchIcon: 'w-4 h-4 md:w-6 md:h-6',
      input: 'pl-9 pr-4 py-2 text-sm md:pl-12 md:pr-6 md:py-3 md:text-lg',
      submitIcon: 'w-5 h-5 md:w-7 md:h-7',
      submitButton: 'p-2 md:p-3'
    }
  };

  // Get current size configuration (fallback to medium if invalid)
  const sizes = sizeConfig[searchBarSize] || sizeConfig.medium;

  // Get autocomplete configuration from active map
  const autocompleteConfig = activeMap?.autocomplete || [];

  // Get geocoder configuration from active map or global config
  const geocoderConfig = activeMap?.geocoder || config?.data?.geocoder;
  const isGeocoderEnabled = geocoderConfig?.enabled === true;
  const geocoderUrl = geocoderConfig?.url || 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

  /**
   * Check which autocomplete patterns match the current input
   */
  const getMatchingAutocomplete = useCallback((input) => {
    if (!input || !autocompleteConfig.length) return null;

    for (const ac of autocompleteConfig) {
      if (ac.pattern) {
        try {
          const regex = new RegExp(ac.pattern, 'i');
          if (regex.test(input)) {
            return ac;
          }
        } catch (e) {
          console.warn('[SearchToolbar] Invalid regex pattern:', ac.pattern, e);
        }
      }
    }
    return null;
  }, [autocompleteConfig]);

  /**
   * Fetch suggestions from the feature service
   */
  const fetchSuggestions = useCallback(async (input, autocompleteField) => {
    if (!activeMap?.endpoint || !autocompleteField?.field) return [];

    try {
      const searchValue = input.toUpperCase();
      // Use field-specific maxSuggestions, fall back to global config, then default to 100
      const maxSuggestions = autocompleteField.maxSuggestions || config?.data?.autocompleteMaxResults || 100;

      // Query for suggestions using LIKE
      const params = new URLSearchParams({
        f: 'json',
        where: `UPPER(${autocompleteField.field}) LIKE '%${searchValue}%'`,
        outFields: autocompleteField.field,
        returnGeometry: 'false',
        returnDistinctValues: 'true',
        resultRecordCount: String(maxSuggestions),
        orderByFields: autocompleteField.field
      });

      const response = await fetch(`${activeMap.endpoint}/query?${params}`);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        return data.features.map(f => ({
          value: f.attributes[autocompleteField.field],
          type: autocompleteField.type,
          label: autocompleteField.label,
          icon: autocompleteField.icon,
          description: autocompleteField.description,
          field: autocompleteField.field
        }));
      }
    } catch (err) {
      console.error('[SearchToolbar] Error fetching suggestions:', err);
    }

    return [];
  }, [activeMap?.endpoint, config?.data?.autocompleteMaxResults]);

  /**
   * Fetch geocoding suggestions from the geocoder's suggest endpoint
   * ArcGIS geocoding services support a suggest endpoint for autocomplete
   */
  const fetchGeocodingSuggestions = useCallback(async (input) => {
    if (!isGeocoderEnabled || !input || input.length < 3) return [];

    try {
      const params = new URLSearchParams({
        f: 'json',
        text: input,
        maxSuggestions: '5'
      });

      const response = await fetch(`${geocoderUrl}/suggest?${params}`);
      const data = await response.json();

      if (data.suggestions && data.suggestions.length > 0) {
        return data.suggestions.map(suggestion => ({
          value: suggestion.text,
          type: 'address',
          label: 'Address',
          icon: '📍',
          description: 'Geocoded address',
          isGeocodingSuggestion: true,
          magicKey: suggestion.magicKey // Used for more accurate geocoding when selected
        }));
      }
    } catch (err) {
      console.error('[SearchToolbar] Error fetching geocoding suggestions:', err);
    }

    return [];
  }, [isGeocoderEnabled, geocoderUrl]);

  /**
   * Handle input change with debounced suggestion fetching
   * NOTE: Autocomplete is disabled when helpModeEnabled is true
   *
   * UPDATED: Now also fetches geocoding suggestions when geocoder is enabled,
   * combining them with any autocomplete field suggestions.
   */
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedSuggestionIndex(-1);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Disable autocomplete in help mode - don't show feature suggestions
    if (helpModeEnabled) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Don't fetch suggestions for very short inputs
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Find matching autocomplete config
    const matchingAc = getMatchingAutocomplete(value);

    // Determine if we should fetch any suggestions
    const shouldFetchFieldSuggestions = !!matchingAc;
    const shouldFetchGeocodingSuggestions = isGeocoderEnabled && value.length >= 3;

    if (shouldFetchFieldSuggestions || shouldFetchGeocodingSuggestions) {
      // Show loading state
      setIsLoadingSuggestions(true);
      setShowSuggestions(true);

      // Debounce the fetch
      debounceRef.current = setTimeout(async () => {
        // Fetch both types of suggestions in parallel
        const [fieldResults, geocodingResults] = await Promise.all([
          shouldFetchFieldSuggestions ? fetchSuggestions(value, matchingAc) : Promise.resolve([]),
          shouldFetchGeocodingSuggestions ? fetchGeocodingSuggestions(value) : Promise.resolve([])
        ]);

        // Combine results: field suggestions first, then geocoding suggestions
        const combinedResults = [...fieldResults, ...geocodingResults];
        setSuggestions(combinedResults);
        setIsLoadingSuggestions(false);
      }, 300);
    } else if (autocompleteConfig.length > 0 || isGeocoderEnabled) {
      // No pattern match, but show available autocomplete types as hints
      const typeHints = autocompleteConfig.map(ac => ({
        value: null,
        type: ac.type,
        label: ac.label,
        icon: ac.icon,
        description: ac.description,
        isTypeHint: true
      }));

      // Add geocoding hint if enabled
      if (isGeocoderEnabled) {
        typeHints.push({
          value: null,
          type: 'address',
          label: 'Address',
          icon: '📍',
          description: 'Type an address to search',
          isTypeHint: true
        });
      }

      setSuggestions(typeHints);
      setShowSuggestions(true);
      setIsLoadingSuggestions(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [getMatchingAutocomplete, fetchSuggestions, fetchGeocodingSuggestions, autocompleteConfig, helpModeEnabled, isGeocoderEnabled]);

  /**
   * Handle suggestion selection
   * For geocoding suggestions, use the dedicated handler to zoom to location
   * without treating it as a property search
   */
  const handleSelectSuggestion = useCallback((suggestion) => {
    if (suggestion.isTypeHint) {
      // Just close suggestions, user needs to continue typing
      setShowSuggestions(false);
      inputRef.current?.focus();
      return;
    }

    setInputValue(suggestion.value);
    setShowSuggestions(false);
    setSuggestions([]);

    // For geocoding suggestions, use the dedicated handler
    if (suggestion.isGeocodingSuggestion && onGeocodingLocation) {
      onGeocodingLocation(suggestion.value, suggestion.magicKey);
      setInputValue('');
      return;
    }

    // Auto-submit the search for other suggestions
    if (onSearch) {
      onSearch(suggestion.value);
      setInputValue('');
    }
  }, [onSearch, onGeocodingLocation]);

  /**
   * Handle keyboard navigation in suggestions
   */
  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
          handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        } else {
          handleSubmit();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSelectSuggestion]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (inputValue.trim() && onSearch) {
      onSearch(inputValue.trim());
      setInputValue('');
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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
                className={`flex items-center gap-1.5 ${sizes.modeButton} rounded-md ${sizes.modeText} font-medium transition-all ${
                  isActive
                    ? 'bg-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                style={isActive ? { color: colors.text700 } : {}}
                title={m.label}
              >
                <Icon className={sizes.modeIcon} />
                {isActive && <span>{m.label}</span>}
              </button>
            );
          })}
      </div>

      {/* Search Input */}
      <div className="flex-1 flex items-center gap-2 relative">
        {/* Menu Button */}
        <button
          ref={menuButtonRef}
          onClick={() => {
            if (showHistory) {
              onHideHistory?.();
            } else {
              setShowMenu(!showMenu);
            }
          }}
          className={`${sizes.menuButton} text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg flex-shrink-0`}
          title="More options"
        >
          <Plus className={sizes.menuIcon} />
        </button>

        {/* Menu Dropdown */}
        {showMenu && !showHistory && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setShowMenu(false); setShowMapSubmenu(false); }} />
            <div className={`absolute ${isBottom ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 bg-white border border-slate-200 shadow-xl rounded-xl w-56 p-1.5 z-50`}>
              {/* Map Toggle - only shown when multiple maps available */}
              {availableMaps && availableMaps.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowMapSubmenu(!showMapSubmenu)}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: colors.bg100, color: colors.text600 }}
                    >
                      <Map className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-700">Switch Map</span>
                      <span className="block text-xs text-slate-400 truncate">{activeMap?.name || 'Select map'}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showMapSubmenu ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Map Submenu */}
                  {showMapSubmenu && (
                    <div className="absolute left-full top-0 ml-1 bg-white border border-slate-200 shadow-xl rounded-xl w-56 p-1.5 z-50 max-h-64 overflow-y-auto">
                      {availableMaps.map((mapOption, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            onMapSelect?.(idx);
                            setShowMenu(false);
                            setShowMapSubmenu(false);
                          }}
                          className={`flex items-center gap-2 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left
                                     ${activeMapIndex === idx ? 'bg-slate-50' : ''}`}
                        >
                          {activeMapIndex === idx ? (
                            <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.text600 }} />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                          <span className={`text-sm truncate ${activeMapIndex === idx ? 'font-medium text-slate-700' : 'text-slate-600'}`}>
                            {mapOption.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => { onShowAdvanced?.(); setShowMenu(false); setShowMapSubmenu(false); }}
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
                onClick={() => { onShowHistory?.(); setShowMenu(false); setShowMapSubmenu(false); }}
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
              <button
                onClick={() => { onShowHelp?.(); setShowMenu(false); setShowMapSubmenu(false); }}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-slate-50 text-left"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100, color: colors.text600 }}
                >
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-slate-700">Ask for Help</span>
                  <span className="block text-xs text-slate-400">Get help using Atlas</span>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Search History Dropdown Panel */}
        {showHistory && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => onHideHistory?.()} />
            <div className={`absolute ${isBottom ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 bg-white border border-slate-200 shadow-xl rounded-xl w-80 z-50 overflow-hidden`}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: colors.text600 }} />
                  <span className="font-semibold text-slate-800 text-sm">Recent Searches</span>
                </div>
                <button
                  onClick={() => onHideHistory?.()}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* History List */}
              <div className="max-h-64 overflow-y-auto">
                {(!searchHistory || searchHistory.length === 0) ? (
                  <div className="p-6 text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">No search history yet</p>
                    <p className="text-xs text-slate-400 mt-1">Your recent searches will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {searchHistory.slice(0, 10).map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onSearch?.(item.query);
                          onHideHistory?.();
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                      >
                        <Search className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{item.query}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(item.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - Clear button */}
              {searchHistory && searchHistory.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => {
                      onClearHistory?.();
                    }}
                    className="w-full py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Clear History
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Help Chat Panel */}
        <HelpChatPanel
          isOpen={showHelpPanel}
          onClose={onHideHelp}
          config={config}
          position={position}
        />

        {/* Search Input with Autocomplete */}
        <div className="flex-1 relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${sizes.searchIcon} text-slate-400`} />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.length >= 2 && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={helpModeEnabled ? "Ask for help." : (activeMap?.searchPlaceholder || config?.ui?.searchPlaceholder || "Search properties...")}
            className={`w-full ${sizes.input} bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition`}
            style={{
              '--tw-ring-color': colors.bg500,
              borderColor: inputValue ? colors.border300 : undefined
            }}
            autoComplete="off"
          />

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && (
            <div
              ref={suggestionsRef}
              className={`absolute ${isBottom ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden z-50`}
            >
              {isLoadingSuggestions ? (
                <div className="p-3 flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading suggestions...</span>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="max-h-64 overflow-y-auto">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        selectedSuggestionIndex === idx
                          ? 'bg-slate-100'
                          : 'hover:bg-slate-50'
                      } ${suggestion.isTypeHint ? 'opacity-60' : ''}`}
                    >
                      {/* Icon */}
                      <span className="text-lg flex-shrink-0 w-6 text-center">
                        {suggestion.icon || '🔍'}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {suggestion.isTypeHint ? (
                          <>
                            <span className="text-sm text-slate-500">{suggestion.label}</span>
                            {suggestion.description && (
                              <span className="block text-xs text-slate-400 truncate">{suggestion.description}</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-slate-800 block truncate">{suggestion.value}</span>
                            <span className="text-xs text-slate-500">{suggestion.label}</span>
                          </>
                        )}
                      </div>

                      {/* Type badge */}
                      {suggestion.type && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colors.bg100, color: colors.text700 }}
                        >
                          {suggestion.type}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="w-full p-3 flex items-center gap-2 text-slate-600 hover:bg-slate-50 transition-colors text-left"
                >
                  <Search className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">Search for "<span className="font-medium">{inputValue}</span>"</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isSearching}
          className={`${sizes.submitButton} rounded-lg transition-colors ${
            inputValue.trim()
              ? 'text-white hover:opacity-90'
              : 'bg-slate-100 text-slate-400'
          }`}
          style={inputValue.trim() ? { backgroundColor: colors.bg600 } : {}}
          title={helpModeEnabled ? "Ask for help" : "Search"}
        >
          {isSearching ? (
            <Loader2 className={`${sizes.submitIcon} animate-spin`} />
          ) : helpModeEnabled ? (
            <HelpCircle className={sizes.submitIcon} />
          ) : (
            <Send className={sizes.submitIcon} />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * AtlasApp - Main application entry point
 *
 * Authentication Workflow:
 * 1. Check each webmap in config for public accessibility
 * 2. If user not logged in AND there are public maps: show them and open app
 * 3. If user logged in: show public maps + check if user has ArcGIS account linked
 *    - If linked, check remaining webmaps for access and make accessible ones available
 * 4. If user not logged in AND no public maps: show login screen
 */
export default function AtlasApp() {
  // Configuration & Auth
  const { config, loading: configLoading, error: configError, orgId, setOrgId, availableMaps: configMaps, isPreviewMode } = useAtlasConfig();
  // ArcGIS Portal auth - used for map access control (separate from user account auth)
  const { user: arcgisUser, loading: arcgisAuthLoading, signIn: arcgisSignIn, signOut: arcgisSignOut, isAuthenticated: isArcGISAuthenticated, portal: arcgisPortal } = useArcGISAuth();

  // Firebase Auth State - user account authentication
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [firebaseUserData, setFirebaseUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [oauthProcessing, setOauthProcessing] = useState(false);
  const [oauthError, setOauthError] = useState(null);

  // Webmap accessibility check - determines which maps user can access
  const {
    accessibleMaps,
    publicMaps,
    privateMaps,
    loading: accessCheckLoading,
    requiresLogin,
    hasCheckedAccess,
    allMapsPublic,
    allMapsConfiguredPrivate,
    defaultMapIsPublic
  } = useWebmapAccessibility({
    allMaps: configMaps,
    firebaseUser,
    firebaseUserData,
    arcgisPortal,
    arcgisAuthLoading
  });

  // Use accessible maps for the active map selection
  const { activeMap, activeMapIndex, setActiveMap } = useActiveMap({
    ...config,
    data: { ...config?.data, maps: accessibleMaps }
  });

  // Add padding to body when preview banner is shown
  usePreviewBannerPadding(isPreviewMode);

  // Integrations (EagleView, Nearmap, etc.)
  const {
    isPictometryEnabled,
    openEagleView,
    closeEagleView,
    eagleViewModal,
    isNearmapEnabled,
    openNearmap,
    closeNearmap,
    nearmapModal
  } = useIntegrations(orgId);

  // Handle OAuth callback on mount
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { code, state, error, errorDescription } = parseOAuthCallback();

      if (error) {
        setOauthError(errorDescription || error);
        clearOAuthParams();
        return;
      }

      if (!code) return;

      // Verify state for CSRF protection
      if (!verifyOAuthState(state)) {
        setOauthError('Invalid OAuth state. Please try again.');
        clearOAuthParams();
        return;
      }

      // Get the mode (signin or signup) that was set before redirecting
      const oauthMode = getOAuthMode() || 'signin';
      // Get the org ID that was stored before OAuth redirect
      const signupOrgId = sessionStorage.getItem('atlas_signup_org');
      sessionStorage.removeItem('atlas_signup_org');

      setOauthProcessing(true);

      try {
        const redirectUri = getOAuthRedirectUri();
        const { token, user: agolUser, org: agolOrg } = await completeArcGISOAuth(code, redirectUri);

        // Store the ArcGIS token for later use in authenticated API calls (e.g., checking private map access)
        storeArcGISToken(token);

        // Clear OAuth params from URL
        clearOAuthParams();

        // Get email from AGOL user profile
        const email = agolUser.email;
        if (!email) {
          throw new Error('No email address found in your ArcGIS account. Please ensure your ArcGIS profile has an email address.');
        }

        // Generate deterministic password based on ArcGIS credentials
        const password = await generateDeterministicPassword(agolUser.username, email);

        if (oauthMode === 'signup') {
          // SIGN UP MODE: Only create account, error if exists
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const userUid = cred.user.uid;

            // Build user document with AGOL data
            const userData = {
              email: email.toLowerCase(),
              createdAt: serverTimestamp(),
              subscriptions: {},
              disabled: false,
              suspended: false,
              linkedArcGISUsername: agolUser.username,
              arcgisProfile: {
                username: agolUser.username,
                fullName: agolUser.fullName || '',
                email: agolUser.email,
                orgId: agolUser.orgId || null,
                linkedAt: new Date().toISOString()
              }
            };

            if (agolOrg) {
              userData.arcgisOrganization = {
                id: agolOrg.id,
                name: agolOrg.name,
                urlKey: agolOrg.urlKey || null
              };
            }

            // Grant Atlas access to the signup organization
            if (signupOrgId || orgId) {
              const targetOrgId = signupOrgId || orgId;
              userData.atlasAccess = {
                [targetOrgId]: {
                  enabled: true,
                  grantedAt: serverTimestamp(),
                  grantedBy: 'self-signup'
                }
              };
            }

            await setDoc(doc(db, PATHS.user(userUid)), userData);

            // Send welcome email via Brevo
            try {
              await sendWelcomeEmail(email, agolUser.fullName || '');
            } catch (emailErr) {
              console.warn("Could not send welcome email:", emailErr);
            }

            // Wait for auth state to propagate
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
              setOauthError(`An account with email ${email} already exists. Please use the Sign In option instead.`);
            } else {
              throw authErr;
            }
          }

        } else {
          // SIGN IN MODE: Only sign in, error if account doesn't exist
          try {
            const cred = await signInWithEmailAndPassword(auth, email, password);

            // Check if user is suspended
            const userRef = doc(db, PATHS.user(cred.user.uid));
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              const userData = userSnap.data();
              if (userData.suspended) {
                await firebaseSignOut(auth);
                setOauthError('Your account has been suspended. Please contact the administrator.');
                setOauthProcessing(false);
                return;
              }

              // Grant access to this org if not already
              if ((signupOrgId || orgId) && !userData.atlasAccess?.[signupOrgId || orgId]?.enabled) {
                await updateDoc(userRef, {
                  [`atlasAccess.${signupOrgId || orgId}`]: {
                    enabled: true,
                    grantedAt: serverTimestamp(),
                    grantedBy: 'self-signup'
                  }
                });
              }
            }

            // Wait for auth state to propagate
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (signInErr) {
            if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
              setOauthError(`No account found with email ${email}. Please use the Create Account option first.`);
            } else {
              throw signInErr;
            }
          }
        }

      } catch (err) {
        console.error('OAuth error:', err);
        setOauthError(err.message || 'Failed to sign in with ArcGIS. Please try again.');
      } finally {
        setOauthProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [orgId]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);

      if (currentUser) {
        // Fetch user data from Firestore
        try {
          const userRef = doc(db, PATHS.user(currentUser.uid));
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();

            // Check if user is suspended
            if (userData.suspended) {
              await firebaseSignOut(auth);
              setOauthError('Your account has been suspended. Please contact the administrator.');
              setFirebaseUser(null);
              setFirebaseUserData(null);
            } else {
              setFirebaseUserData(userData);

              // Ensure user has access to current org
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
            // Create user document if it doesn't exist
            const newUserData = {
              email: currentUser.email?.toLowerCase(),
              createdAt: serverTimestamp(),
              subscriptions: {},
              disabled: false,
              suspended: false
            };

            if (orgId) {
              newUserData.atlasAccess = {
                [orgId]: {
                  enabled: true,
                  grantedAt: serverTimestamp(),
                  grantedBy: 'self-signup'
                }
              };
            }

            await setDoc(userRef, newUserData);
            setFirebaseUserData(newUserData);
          }
        } catch (err) {
          console.error('[AtlasApp] Error fetching user data:', err);
        }
      } else {
        setFirebaseUserData(null);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [orgId]);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      // Clear stored ArcGIS OAuth token
      clearStoredArcGISToken();
      // Also sign out of ArcGIS Portal if needed
      arcgisSignOut?.();
    } catch (err) {
      console.error('[AtlasApp] Sign out error:', err);
    }
  }, [arcgisSignOut]);

  // Check if user has access to current org
  const hasOrgAccess = firebaseUserData?.atlasAccess?.[orgId]?.enabled === true;
  
  // UI State
  const [mode, setMode] = useState('chat');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showOrgSelector, setShowOrgSelector] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // Help mode state (shared with ChatView and SearchToolbar)
  const [helpModeEnabled, setHelpModeEnabled] = useState(false);

  // Search History State (shared across all views)
  const [searchHistory, setSearchHistory] = useState([]);

  // Load search history from localStorage on mount
  useEffect(() => {
    if (config?.id) {
      const key = `atlas_history_${config.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setSearchHistory(JSON.parse(saved));
        } catch (e) {
          console.warn('[AtlasApp] Failed to parse search history:', e);
        }
      }
    }
  }, [config?.id]);

  // Save search to history (limited to 10 items)
  const saveToHistory = useCallback((query) => {
    if (!query?.trim() || !config?.id) return;

    const key = `atlas_history_${config.id}`;
    const newHistory = [
      { query: query.trim(), timestamp: Date.now() },
      ...searchHistory.filter(h => h.query !== query.trim()).slice(0, 9) // Keep 9 + 1 new = 10 max
    ];
    setSearchHistory(newHistory);
    localStorage.setItem(key, JSON.stringify(newHistory));
  }, [config?.id, searchHistory]);

  // Clear search history
  const clearHistory = useCallback(() => {
    if (!config?.id) return;
    const key = `atlas_history_${config.id}`;
    setSearchHistory([]);
    localStorage.removeItem(key);
  }, [config?.id]);
  
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

    // Close any open feature panel before starting new search
    if (mapViewRef.current?.closeFeaturePanel) {
      mapViewRef.current.closeFeaturePanel();
    }

    setSearchQuery(query);
    setIsSearching(true);

    // Delegate to ChatView's search logic
    if (chatViewRef.current?.handleSearch) {
      chatViewRef.current.handleSearch(query);
    }
  }, [activeMap]);
  
  // Update results from child components
  // Applies data exclusion rules before storing results so all views receive redacted data
  const updateSearchResults = useCallback((results, location = null) => {
    if (results?.features?.length > 0 && activeMap?.dataExclusion?.enabled) {
      const redactedFeatures = applyDataExclusions(results.features, activeMap);
      setSearchResults({ ...results, features: redactedFeatures });
    } else {
      setSearchResults(results);
    }
    if (location) setSearchLocation(location);
    setIsSearching(false);
  }, [activeMap]);
  
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

  // Handle advanced search results
  // Note: AdvancedSearchModal already calls updateSearchResults({ features }) and setIsSearching(false)
  // This callback handles mode switching and zooming to results
  const handleAdvancedSearch = useCallback((features, whereClause) => {
    console.log(`[AtlasApp] Advanced search completed: ${features.length} features`);

    // If we have results and map mode is enabled, switch to map mode to show them
    if (features.length > 0 && enabledModes.includes('map')) {
      handleModeChange('map');

      // Zoom to all results on the map
      setTimeout(() => {
        if (mapViewRef.current?.zoomToAllResults) {
          mapViewRef.current.zoomToAllResults();
        }
      }, 100);
    }
  }, [enabledModes, handleModeChange]);

  /**
   * Handle geocoding location selection from autocomplete
   * This zooms to the location without treating it as a property search
   * - In chat mode: Shows a location message with mini map and "Open in Map" button
   * - In map mode: Just zooms to the location without search results
   */
  const handleGeocodingLocation = useCallback(async (address, magicKey) => {
    console.log('[AtlasApp] Geocoding location:', address, 'magicKey:', magicKey);

    const geocoderConfig = activeMap?.geocoder || config?.data?.geocoder;
    const geocoderUrl = geocoderConfig?.url ||
      'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

    try {
      // Use findAddressCandidates with magicKey for more precise results
      const params = new URLSearchParams({
        f: 'json',
        SingleLine: address,
        outFields: '*',
        outSR: '4326',
        maxLocations: '1'
      });

      // If we have a magicKey from the suggestion, use it for better accuracy
      if (magicKey) {
        params.set('magicKey', magicKey);
      }

      const response = await fetch(`${geocoderUrl}/findAddressCandidates?${params}`);
      const data = await response.json();

      if (data.error) {
        console.error('[AtlasApp] Geocoder error:', data.error);
        return;
      }

      if (!data.candidates || data.candidates.length === 0) {
        console.warn('[AtlasApp] No geocoding results for:', address);
        return;
      }

      const result = data.candidates[0];
      const location = {
        lat: result.location.y,
        lng: result.location.x,
        formatted: result.address || address
      };

      console.log('[AtlasApp] Geocoded location:', location);

      // Clear any previous search results since we're now showing a geocoded location
      updateSearchResults({ features: [] });

      // Handle based on current mode
      if (mode === 'map') {
        // Check if select nearest feature mode is enabled
        if (geocoderConfig?.selectNearestFeature && mapViewRef.current?.selectNearestFeatureAtPoint) {
          // Select the nearest map feature to the geocoded location
          console.log('[AtlasApp] Geocoder selectNearestFeature enabled, finding nearest feature...');
          mapViewRef.current.selectNearestFeatureAtPoint(location.lat, location.lng, 17);
        } else if (mapViewRef.current?.zoomToCoordinate) {
          // Default: Just zoom to the location with a pushpin
          mapViewRef.current.zoomToCoordinate(location.lat, location.lng, 17);
        }
      } else {
        // In chat mode: Show a location message with mini map and "Open in Map" button
        if (chatViewRef.current?.addLocationMessage) {
          chatViewRef.current.addLocationMessage(location, address);
        }
      }
    } catch (err) {
      console.error('[AtlasApp] Geocoding error:', err);
    }
  }, [activeMap?.geocoder, config?.data?.geocoder, mode, updateSearchResults]);

  // Debug logging for map picker feature
  console.log('[AtlasApp] Map picker context debug:', {
    configMaps: configMaps?.map(m => m.name),
    configMapsLength: configMaps?.length,
    accessibleMaps: accessibleMaps?.map(m => m.name),
    accessibleMapsLength: accessibleMaps?.length,
    publicMaps: publicMaps?.map(m => m.name),
    privateMaps: privateMaps?.map(m => m.name),
    activeMap: activeMap?.name,
    activeMapIndex,
    firebaseUser: !!firebaseUser,
    hasCheckedAccess,
    allMapsConfiguredPrivate,
    requiresLogin
  });

  // Context value - includes theme colors for child components
  const contextValue = {
    // Config
    config,
    orgId,
    setOrgId,
    activeMap,
    activeMapIndex,
    setActiveMap,
    availableMaps: accessibleMaps,  // Maps the user can actually access
    publicMaps,                      // Maps available to everyone
    privateMaps,                     // Maps requiring authentication
    allMapsPublic,                   // True if all configured maps are public (no private maps based on ArcGIS)
    allMapsConfiguredPrivate,        // True if all maps in Atlas config have access="private"
    defaultMapIsPublic,              // True if the default/first map is public

    // Theme colors (for child components)
    themeColor,
    colors,

    // Firebase Auth (user account)
    user: firebaseUser,
    userData: firebaseUserData,
    signOut: handleSignOut,
    isLoggedIn: !!firebaseUser,

    // ArcGIS Portal Auth (map access)
    arcgisUser,
    isArcGISAuthenticated,
    arcgisSignIn,
    arcgisSignOut,
    
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
    setShowAdvanced,

    // Search History (shared across all views)
    searchHistory,
    saveToHistory,
    clearHistory,

    // Help mode (shared with ChatView and SearchToolbar)
    helpModeEnabled,
    setHelpModeEnabled,

    // Help panel
    showHelpPanel,
    setShowHelpPanel,

    // EagleView / Integrations
    isPictometryEnabled,
    openEagleView,
    closeEagleView,
    eagleViewModal,

    // Nearmap
    isNearmapEnabled,
    openNearmap,
    closeNearmap,
    nearmapModal
  };
  
  // Loading state - wait for config, auth, OAuth processing, and webmap access check
  if (configLoading || authLoading || oauthProcessing || (configMaps?.length > 0 && !hasCheckedAccess)) {
    return (
      <LoadingScreen
        message={oauthProcessing ? "Signing in with ArcGIS..." : accessCheckLoading ? "Checking map access..." : "Loading Atlas..."}
      />
    );
  }

  // Authentication required - show auth screen when:
  // - No effectively public maps available (all maps are ArcGIS-private or Atlas config access='private')
  // - AND user is not logged in
  // If there are effectively public maps, show them without requiring login
  if (requiresLogin) {
    return (
      <div className="h-dvh flex flex-col bg-slate-100 font-sans">
        {/* Simple header for auth screen */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
          <img
            src="https://geoplan.nyc3.digitaloceanspaces.com/CivQuest/CVG_Logo_Medium.jpg"
            alt="CivQuest Logo"
            className="h-10 w-auto object-contain rounded-sm"
          />
          <h1 className="font-bold text-xl tracking-tight" style={{ color: colors.text700 }}>
            {config?.name || 'CivQuest Atlas'}
          </h1>
        </header>

        <main className="flex-1 overflow-auto">
          <AuthScreen
            orgId={orgId}
            orgName={config?.name}
            themeColor={themeColor}
            oauthError={oauthError}
            setOauthError={setOauthError}
          />
        </main>
      </div>
    );
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
  
  // No maps available - user is authenticated but has no accessible maps
  if (!activeMap) {
    // Determine the appropriate message and action based on auth state
    const hasLinkedArcGIS = firebaseUserData?.arcgisProfile?.username ||
                            firebaseUserData?.linkedArcGISUsername;

    let message = "No maps are configured for this organization.";
    let action = null;

    if (privateMaps?.length > 0) {
      // There are private maps but user can't access them
      if (!firebaseUser) {
        message = "All maps in this organization require authentication. Please sign in to access them.";
        action = (
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        );
      } else if (!hasLinkedArcGIS) {
        message = "Some maps require an ArcGIS account. Link your ArcGIS account to access protected maps.";
        action = (
          <button
            onClick={arcgisSignIn}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Link ArcGIS Account
          </button>
        );
      } else {
        message = "You don't have access to any maps in this organization. Contact the administrator for access.";
      }
    }

    return (
      <ErrorScreen
        title="No Maps Available"
        message={message}
        action={action}
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
      onGeocodingLocation={handleGeocodingLocation}
      isSearching={isSearching}
      activeMap={activeMap}
      availableMaps={accessibleMaps}
      activeMapIndex={activeMapIndex}
      onMapSelect={setActiveMap}
      showHistory={showHistory}
      onShowHistory={() => setShowHistory(true)}
      onHideHistory={() => setShowHistory(false)}
      searchHistory={searchHistory}
      onClearHistory={clearHistory}
      onShowAdvanced={() => setShowAdvanced(true)}
      showHelpPanel={showHelpPanel}
      onShowHelp={() => setShowHelpPanel(true)}
      onHideHelp={() => setShowHelpPanel(false)}
      position={searchBarPosition}
      helpModeEnabled={helpModeEnabled}
      searchBarSize={firebaseUserData?.preferences?.searchBarSize || 'medium'}
    />
  );
  
  return (
    <AtlasContext.Provider value={contextValue}>
      {/* Preview Mode Banner - shown when ?preview=draft is in URL */}
      {isPreviewMode && <PreviewBanner orgId={orgId} />}
      
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
          onOpenSettings={() => setShowAccountSettings(true)}
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
            user={firebaseUser}
            userData={firebaseUserData}
            onSignOut={handleSignOut}
            onOpenSettings={() => setShowAccountSettings(true)}
            colors={colors}
            allMapsPublic={allMapsPublic}
            orgId={orgId}
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

        {/* Advanced Search Panel */}
        <AdvancedSearchModal
          isOpen={showAdvanced}
          onClose={() => setShowAdvanced(false)}
          onSearch={handleAdvancedSearch}
          position={searchBarPosition}
        />

        {/* Account Settings Modal */}
        <AccountSettings
          isOpen={showAccountSettings}
          onClose={() => setShowAccountSettings(false)}
        />

        {/* Disclaimer Popup - shown when enabled and not yet accepted */}
        {config?.disclaimer?.enabled && !disclaimerAccepted && (
          <DisclaimerPopup
            config={config}
            orgId={orgId}
            onAccept={() => setDisclaimerAccepted(true)}
          />
        )}

        {/* EagleView Modal - embedded aerial imagery viewer */}
        <EagleViewModal
          isOpen={eagleViewModal.isOpen}
          onClose={closeEagleView}
          url={eagleViewModal.url}
          title={eagleViewModal.title}
          themeColor={eagleViewModal.themeColor}
          windowConfig={eagleViewModal.windowConfig}
        />

        {/* Nearmap Modal - embedded aerial imagery viewer */}
        <NearmapModal
          isOpen={nearmapModal.isOpen}
          onClose={closeNearmap}
          url={nearmapModal.url}
          title={nearmapModal.title}
          themeColor={nearmapModal.themeColor}
          windowConfig={nearmapModal.windowConfig}
        />
      </div>
    </AtlasContext.Provider>
  );
}

/**
 * Mobile Menu Component
 */
function MobileMenu({ config, mode, onModeChange, enabledModes, onClose, user, userData, onSignOut, onOpenSettings, colors, allMapsPublic, orgId }) {
  // Get display name - prefer firstName/lastName, then arcgisProfile.fullName, then email
  const getDisplayName = () => {
    if (userData?.firstName || userData?.lastName) {
      return [userData.firstName, userData.lastName].filter(Boolean).join(' ');
    }
    return userData?.arcgisProfile?.fullName || user?.email || 'User';
  };
  const displayName = getDisplayName();

  // Get initial for avatar
  const getInitial = () => {
    if (userData?.firstName) return userData.firstName[0].toUpperCase();
    if (userData?.lastName) return userData.lastName[0].toUpperCase();
    if (userData?.arcgisProfile?.fullName) return userData.arcgisProfile.fullName[0].toUpperCase();
    return user?.email?.[0]?.toUpperCase() || '?';
  };

  // Handle sign-in with Esri account
  const handleSignIn = async () => {
    // Store the org ID in session storage so we can use it after OAuth callback
    if (orgId) {
      sessionStorage.setItem('atlas_signup_org', orgId);
    }

    // Fetch admin-configured ESRI client ID
    let esriClientId = null;
    try {
      const esriSettings = await getESRISettings();
      esriClientId = esriSettings?.clientId || null;
    } catch (err) {
      console.warn('Could not fetch ESRI settings, using default client ID:', err);
    }

    const redirectUri = getOAuthRedirectUri();
    initiateArcGISLogin(redirectUri, 'signin', esriClientId);
    onClose();
  };

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
          {user ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: colors.bg100 }}
                >
                  <span className="text-lg font-semibold" style={{ color: colors.text600 }}>
                    {getInitial()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-slate-800">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => { onOpenSettings?.(); onClose(); }}
                  className="w-full py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={() => { onSignOut(); onClose(); }}
                  className="w-full py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            // Only show sign-in button if not all maps are public
            !allMapsPublic ? (
              <button
                onClick={handleSignIn}
                className="w-full py-2.5 text-sm font-medium text-white rounded-lg flex items-center justify-center gap-2 bg-[#0079C1] hover:bg-[#006699] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In with Esri Account
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}