// src/atlas/hooks/useAtlasConfig.js
// Hook to load Atlas configuration from Firestore organizations/{orgId}.atlasConfig
// Supports draft preview mode via ?preview=draft query parameter
//
// UPDATED: Added draft preview support for admin preview functionality

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import { PATHS } from '../../shared/services/paths';

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
    logoRight: null,
    botAvatar: null,
    themeColor: 'sky',
    defaultMode: 'chat',
    searchBarPosition: 'top',
    searchPlaceholder: ''  // Empty = use default
  },
  messages: {
    welcomeTitle: '',  // Empty = hidden
    welcomeText: '',   // Empty = hidden
    exampleQuestions: [],
    importantNote: '', // Empty = hidden
    searchTip: ''      // Empty = hidden
  },
  disclaimer: {
    enabled: false,              // Off by default
    width: '600',                // Width value
    widthUnit: 'px',             // 'px' or '%'
    height: '400',               // Height value
    heightUnit: 'px',            // 'px' or '%'
    contentMode: 'html',         // 'html' or 'embed'
    htmlContent: '',             // HTML content for the disclaimer
    embedUrl: '',                // URL to embed in iframe
    confirmationType: 'confirmation', // 'confirmation' or 'dontShowAgain'
    checkboxText: 'I agree to the terms and conditions',
    buttonText: 'Continue'
  },
  basemaps: [],
  data: {
    maps: [],
    systemPrompt: '',
    maxRecordCount: 1000,
    timeZoneOffset: -5,
    defaultSort: ''
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
  
  // Check if we're in draft preview mode
  const [isPreviewMode] = useState(() => isPreviewDraftMode());
  
  // Allow manual org ID change
  const setOrgId = useCallback((newOrgId) => {
    setOrgIdState(newOrgId);
    if (newOrgId) {
      localStorage.setItem('atlas_last_org', newOrgId);
    }
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
          const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...atlasConfig,
            id: orgId,
            ui: { ...DEFAULT_CONFIG.ui, ...atlasConfig.ui },
            messages: { ...DEFAULT_CONFIG.messages, ...atlasConfig.messages },
            disclaimer: { ...DEFAULT_CONFIG.disclaimer, ...atlasConfig.disclaimer },
            data: { ...DEFAULT_CONFIG.data, ...atlasConfig.data },
            // Explicitly preserve arrays from atlasConfig
            basemaps: atlasConfig.basemaps || DEFAULT_CONFIG.basemaps || [],
            exportTemplates: atlasConfig.exportTemplates || [],
            featureExportTemplates: atlasConfig.featureExportTemplates || []
          };

          // DEBUG: Log the merged config
          console.log('[useAtlasConfig] Merged config:', mergedConfig);
          console.log('[useAtlasConfig] Final themeColor:', mergedConfig.ui.themeColor);
          console.log('[useAtlasConfig] exportTemplates:', mergedConfig.exportTemplates);
          console.log('[useAtlasConfig] featureExportTemplates:', mergedConfig.featureExportTemplates);
          
          setConfig(mergedConfig);
          setAvailableMaps(mergedConfig.data?.maps || []);
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
  }, [orgId, isPreviewMode]);

  return {
    config,
    loading,
    error,
    orgId,
    setOrgId,
    availableMaps,
    isPreviewMode  // NEW: Returns true if viewing draft preview
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
 */
export function useActiveMap(config) {
  const [activeMapIndex, setActiveMapIndex] = useState(() => {
    const saved = localStorage.getItem(`atlas_active_map_${config?.id}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const activeMap = config?.data?.maps?.[activeMapIndex] || config?.data?.maps?.[0] || null;
  
  const setActiveMap = useCallback((index) => {
    setActiveMapIndex(index);
    if (config?.id) {
      localStorage.setItem(`atlas_active_map_${config.id}`, index.toString());
    }
  }, [config?.id]);
  
  return { activeMap, activeMapIndex, setActiveMap };
}

export default useAtlasConfig;
