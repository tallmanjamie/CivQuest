// src/atlas/hooks/useAtlasConfig.js
// Hook to load Atlas configuration from Firestore organizations/{orgId}.atlasConfig
// Supports draft preview mode via ?preview=draft query parameter
//
// UPDATED: Added draft preview support for admin preview functionality

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import { PATHS } from '../../shared/services/paths';
import { subscribeToGlobalHelp } from '../../shared/services/systemConfig';

/**
 * Default configuration structure when none is found
 * NOTE: Optional text fields default to empty string so they are hidden when not configured
 */
const DEFAULT_CONFIG = {
  id: 'default',
  ui: {
    title: 'CivQuest Atlas',
    headerTitle: 'CivQuest',
    headerSubtitle: '',  // Empty = hidden
    headerClass: 'bg-sky-700',
    logoLeft: null,
    logoLeftSize: 'small',      // Logo size: 'small', 'medium', 'large'
    logoLeftLink: '',            // Hyperlink URL for left logo
    logoRight: null,
    logoRightSize: 'small',     // Logo size: 'small', 'medium', 'large'
    logoRightLink: '',           // Hyperlink URL for right logo
    botAvatar: null,
    botAvatarSize: 'small',     // Avatar size: 'small', 'medium', 'large'
    themeColor: 'sky',
    defaultMode: 'chat',
    searchBarPosition: 'top',
    searchPlaceholder: '',  // Empty = use default
    defaultSearchBarSize: 'medium',  // Default search bar size for org users (small, medium, large)
    // Info button configuration - shows info popup when clicked
    info: {
      enabled: false,                  // Disabled by default
      text: '',                        // Text displayed at top of popup
      logo: null,                      // Logo URL displayed below text
      buttons: []                      // Array of { label: string, url: string }
    },
    // Header links configuration - shows links in header
    links: {
      enabled: false,                  // Disabled by default
      layout: 'horizontal',            // 'horizontal' (across banner) or 'stacked' (right-justified, vertical)
      items: []                        // Array of { label: string, url: string } (max 4)
    }
  },
  messages: {
    welcomeTitle: '',  // Empty = hidden
    welcomeText: '',   // Empty = hidden
    exampleQuestions: [],
    importantNote: '', // Empty = hidden
    searchTip: '',     // Empty = hidden
    noResultsMessage: '' // Empty = use default message
  },
  disclaimer: {
    enabled: false,              // Off by default
    title: 'Notice',             // Configurable title for the disclaimer popup
    width: '600',                // Width value
    widthUnit: 'px',             // 'px' or '%'
    height: '400',               // Height value
    heightUnit: 'px',            // 'px' or '%'
    contentMode: 'richText',     // 'richText', 'html', or 'embed'
    richTextContent: '',         // Rich text content (WYSIWYG editor output)
    htmlContent: '',             // HTML content for the disclaimer
    embedUrl: '',                // URL to embed in iframe
    confirmationType: 'confirmation', // 'confirmation' or 'dontShowAgain'
    checkboxText: 'I agree to the terms and conditions',
    buttonText: 'Continue'
  },
  basemaps: [],
  data: {
    maps: [],
    maxRecordCount: 1000,
    timeZoneOffset: -5,
    defaultSort: ''
  },
  // Help configuration
  helpDocumentation: [],     // Organization-specific help
  useGlobalHelp: true,       // Whether to use global Atlas help (default: true)
  // ArcGIS Portal URL for organization authentication
  arcgisPortalUrl: '',
  // Export options configuration - controls which export formats are available
  exportOptions: {
    chatSearchResults: { csv: true, pdf: true, shp: true },
    searchResultsPanel: { csv: true, shp: true },
    mapMarkup: { csv: true, shp: true },
    tableMode: { csv: true, shp: true }
  }
};

/**
 * Detect if preview mode is enabled from URL
 * @returns {boolean} True if ?preview=draft is present
 */
export function isPreviewDraftMode() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('preview') === 'draft';
}

/**
 * Detect organization ID from URL
 * Supports: subdomain (chesapeake.atlas.civ.quest), path (/atlas/chesapeake), query param (?org=chesapeake)
 */
export function detectOrganizationId() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  
  // 1. Check query parameter
  const queryOrg = params.get('org');
  if (queryOrg) return queryOrg;
  
  // 2. Check path: /atlas/chesapeake or /chesapeake
  const pathMatch = pathname.match(/^\/(?:atlas\/)?([a-z0-9_-]+)/i);
  if (pathMatch && pathMatch[1] !== 'atlas') {
    return pathMatch[1];
  }
  
  // 3. Check subdomain: chesapeake.atlas.civ.quest
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[1] === 'atlas') {
    return parts[0];
  }
  
  // 4. Check for org subdomain directly: chesapeake.civ.quest
  if (parts.length >= 2 && !['www', 'atlas', 'notify', 'admin', 'localhost'].includes(parts[0])) {
    return parts[0];
  }
  
  // 5. Default fallback - check localStorage for last used org
  const lastOrg = localStorage.getItem('atlas_last_org');
  if (lastOrg) return lastOrg;
  
  return null;
}

/**
 * Hook to load and subscribe to Atlas configuration
 * Supports draft preview mode via ?preview=draft query parameter
 * 
 * @param {string} providedOrgId - Organization ID (optional, auto-detected if not provided)
 * @returns {Object} { config, loading, error, orgId, setOrgId, availableMaps, isPreviewMode }
 */
export function useAtlasConfig(providedOrgId = null) {
  const [orgId, setOrgIdState] = useState(providedOrgId || detectOrganizationId());
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [globalHelp, setGlobalHelp] = useState([]);

  // Check if we're in draft preview mode
  const [isPreviewMode] = useState(() => isPreviewDraftMode());

  // Allow manual org ID change
  const setOrgId = useCallback((newOrgId) => {
    setOrgIdState(newOrgId);
    if (newOrgId) {
      localStorage.setItem('atlas_last_org', newOrgId);
    }
  }, []);

  // Subscribe to global help documentation
  useEffect(() => {
    const unsubscribe = subscribeToGlobalHelp((help) => {
      console.log('[useAtlasConfig] Global help loaded:', help?.length || 0, 'articles');
      setGlobalHelp(help || []);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      setError('No organization specified. Please provide an organization ID.');
      return;
    }

    console.log('[useAtlasConfig] Loading config for org:', orgId, isPreviewMode ? '(PREVIEW MODE)' : '');
    setLoading(true);
    setError(null);

    const docRef = doc(db, PATHS.organization(orgId));
    
    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const orgData = docSnap.data();
          
          // DRAFT PREVIEW SUPPORT:
          // If ?preview=draft is in the URL, use atlasConfigDraft if it exists
          // Otherwise fall back to atlasConfig (live)
          let atlasConfig;
          
          if (isPreviewMode) {
            // In preview mode, prefer draft config
            if (orgData.atlasConfigDraft) {
              atlasConfig = orgData.atlasConfigDraft;
              console.log('[useAtlasConfig] PREVIEW MODE: Using draft config');
            } else {
              // No draft exists, fall back to live config
              atlasConfig = orgData.atlasConfig || {};
              console.log('[useAtlasConfig] PREVIEW MODE: No draft found, using live config');
            }
          } else {
            // Normal mode: use live config
            atlasConfig = orgData.atlasConfig || {};
          }
          
          // DEBUG: Log the raw config from Firestore
          console.log('[useAtlasConfig] Raw atlasConfig from Firestore:', atlasConfig);
          console.log('[useAtlasConfig] atlasConfig.ui:', atlasConfig.ui);
          console.log('[useAtlasConfig] atlasConfig.ui?.themeColor:', atlasConfig.ui?.themeColor);
          
          // Merge with defaults - deep merge for nested objects
          // IMPORTANT: Explicitly preserve top-level arrays that aren't in DEFAULT_CONFIG

          // Determine which help documentation to use
          // If useGlobalHelp is true (default), use global help from system config
          // If useGlobalHelp is false, use organization's custom help documentation
          // If supplementGlobalHelp is true AND useGlobalHelp is true, merge both with org taking precedence
          const useGlobalHelpSetting = atlasConfig.useGlobalHelp !== false; // Default to true
          const supplementGlobalHelpSetting = atlasConfig.supplementGlobalHelp === true; // Default to false
          const orgHelpDocs = atlasConfig.helpDocumentation || [];

          // Effective help:
          // - If useGlobalHelp is false: use org help only
          // - If useGlobalHelp is true and supplementGlobalHelp is true: merge org + global (org takes precedence)
          // - If useGlobalHelp is true and supplementGlobalHelp is false: use global help only
          let effectiveHelpDocumentation;

          if (!useGlobalHelpSetting) {
            // Only org help
            effectiveHelpDocumentation = orgHelpDocs;
          } else if (supplementGlobalHelpSetting && orgHelpDocs.length > 0) {
            // Merge: org help takes precedence (appears first in search results)
            effectiveHelpDocumentation = [...orgHelpDocs, ...globalHelp];
          } else {
            // Global help only
            effectiveHelpDocumentation = globalHelp;
          }

          console.log('[useAtlasConfig] Help config - useGlobalHelp:', useGlobalHelpSetting,
            'supplementGlobalHelp:', supplementGlobalHelpSetting,
            'orgHelpDocs:', orgHelpDocs.length, 'globalHelp:', globalHelp.length,
            'effective:', effectiveHelpDocumentation.length);

          const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...atlasConfig,
            id: orgId,
            ui: {
              ...DEFAULT_CONFIG.ui,
              ...atlasConfig.ui,
              // Deep merge nested ui objects
              info: { ...DEFAULT_CONFIG.ui.info, ...atlasConfig.ui?.info },
              links: { ...DEFAULT_CONFIG.ui.links, ...atlasConfig.ui?.links }
            },
            messages: { ...DEFAULT_CONFIG.messages, ...atlasConfig.messages },
            disclaimer: { ...DEFAULT_CONFIG.disclaimer, ...atlasConfig.disclaimer },
            data: { ...DEFAULT_CONFIG.data, ...atlasConfig.data },
            // Explicitly preserve arrays from atlasConfig
            basemaps: atlasConfig.basemaps || DEFAULT_CONFIG.basemaps || [],
            exportTemplates: atlasConfig.exportTemplates || [],
            featureExportTemplates: atlasConfig.featureExportTemplates || [],
            // Explicitly preserve service URLs
            printServiceUrl: atlasConfig.printServiceUrl || null,
            elevationServiceUrl: atlasConfig.elevationServiceUrl || null,
            // Help documentation - uses global or org-specific based on setting
            helpDocumentation: effectiveHelpDocumentation,
            useGlobalHelp: useGlobalHelpSetting,
            supplementGlobalHelp: supplementGlobalHelpSetting,
            customHelpModeText: atlasConfig.customHelpModeText || '',
            // Also store the org's own help docs in case admin needs to edit them
            orgHelpDocumentation: orgHelpDocs,
            // ArcGIS Portal URL for organization authentication
            arcgisPortalUrl: atlasConfig.arcgisPortalUrl || DEFAULT_CONFIG.arcgisPortalUrl,
            // Export options - deep merge to preserve individual format settings
            exportOptions: {
              chatSearchResults: { ...DEFAULT_CONFIG.exportOptions.chatSearchResults, ...atlasConfig.exportOptions?.chatSearchResults },
              searchResultsPanel: { ...DEFAULT_CONFIG.exportOptions.searchResultsPanel, ...atlasConfig.exportOptions?.searchResultsPanel },
              mapMarkup: { ...DEFAULT_CONFIG.exportOptions.mapMarkup, ...atlasConfig.exportOptions?.mapMarkup },
              tableMode: { ...DEFAULT_CONFIG.exportOptions.tableMode, ...atlasConfig.exportOptions?.tableMode }
            }
          };

          // DEBUG: Log the merged config
          console.log('[useAtlasConfig] Merged config:', mergedConfig);
          console.log('[useAtlasConfig] Final themeColor:', mergedConfig.ui.themeColor);
          console.log('[useAtlasConfig] exportTemplates:', mergedConfig.exportTemplates);
          console.log('[useAtlasConfig] featureExportTemplates:', mergedConfig.featureExportTemplates);
          console.log('[useAtlasConfig] elevationServiceUrl:', mergedConfig.elevationServiceUrl);
          console.log('[useAtlasConfig] printServiceUrl:', mergedConfig.printServiceUrl);
          
          setConfig(mergedConfig);
          const mapsFromConfig = mergedConfig.data?.maps || [];
          console.log('[useAtlasConfig] MAP PICKER: Maps loaded from config:', {
            count: mapsFromConfig.length,
            maps: mapsFromConfig.map(m => ({ name: m.name, itemId: m.webMap?.itemId, access: m.access }))
          });
          setAvailableMaps(mapsFromConfig);
          setLoading(false);
          
          // Store last used org (but don't store if in preview mode to avoid confusion)
          if (!isPreviewMode) {
            localStorage.setItem('atlas_last_org', orgId);
          }
        } else {
          console.warn('[useAtlasConfig] Organization document not found:', orgId);
          setError(`Organization "${orgId}" not found.`);
          setConfig(null);
          setLoading(false);
        }
      },
      (err) => {
        console.error('[useAtlasConfig] Firestore error:', err);
        setError(`Failed to load configuration: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, isPreviewMode, globalHelp]);

  return {
    config,
    loading,
    error,
    orgId,
    setOrgId,
    availableMaps,
    isPreviewMode,  // Returns true if viewing draft preview
    globalHelp      // Global help documentation for admin reference
  };
}

/**
 * Get a specific map configuration from the loaded config
 * @param {Object} config - Full atlas config
 * @param {number} mapIndex - Index of the map (default 0)
 * @returns {Object|null} Map configuration or null
 */
export function getMapConfig(config, mapIndex = 0) {
  if (!config?.data?.maps?.length) return null;
  return config.data.maps[mapIndex] || config.data.maps[0];
}

/**
 * Get the current active map configuration
 * Checks localStorage for user preference, falls back to first map
 *
 * IMPORTANT: When the maps array order changes (e.g., when user signs in and
 * private maps are prioritized), the hook automatically resets to the first map.
 * This ensures private maps are selected by default when the user is authenticated.
 */
export function useActiveMap(config) {
  const [activeMapIndex, setActiveMapIndex] = useState(() => {
    const saved = localStorage.getItem(`atlas_active_map_${config?.id}`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Track the first map's itemId to detect when the array order changes
  const firstMapItemId = config?.data?.maps?.[0]?.webMap?.itemId;
  const prevFirstMapItemIdRef = useRef(firstMapItemId);

  // When the first map in the array changes (e.g., private map becomes first after sign-in),
  // reset to index 0 to ensure the newly prioritized map is selected
  useEffect(() => {
    const prevFirstMapItemId = prevFirstMapItemIdRef.current;

    // Only reset if:
    // 1. There are maps in the array
    // 2. The first map's itemId has changed (indicating reordering)
    // 3. We had a previous first map to compare against
    if (firstMapItemId && prevFirstMapItemId && firstMapItemId !== prevFirstMapItemId) {
      console.log('[useActiveMap] Map array order changed, resetting to first map');
      console.log('[useActiveMap] Previous first map:', prevFirstMapItemId);
      console.log('[useActiveMap] New first map:', firstMapItemId);
      setActiveMapIndex(0);
      if (config?.id) {
        localStorage.setItem(`atlas_active_map_${config.id}`, '0');
      }
    }

    // Update ref for next comparison
    prevFirstMapItemIdRef.current = firstMapItemId;
  }, [firstMapItemId, config?.id]);

  // Ensure index is within bounds of the current maps array
  const maps = config?.data?.maps || [];
  const validIndex = activeMapIndex < maps.length ? activeMapIndex : 0;
  const activeMap = maps[validIndex] || null;

  const setActiveMap = useCallback((index) => {
    setActiveMapIndex(index);
    if (config?.id) {
      localStorage.setItem(`atlas_active_map_${config.id}`, index.toString());
    }
  }, [config?.id]);

  return { activeMap, activeMapIndex: validIndex, setActiveMap };
}

export default useAtlasConfig;
