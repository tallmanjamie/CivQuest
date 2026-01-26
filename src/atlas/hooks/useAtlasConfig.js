// src/atlas/hooks/useAtlasConfig.js
// Hook to load Atlas configuration from Firestore organizations/{orgId}.atlasConfig

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import { PATHS } from '../../shared/services/paths';

/**
 * Default configuration structure when none is found
 */
const DEFAULT_CONFIG = {
  id: 'default',
  ui: {
    title: 'CivQuest Atlas',
    headerTitle: 'CivQuest',
    headerSubtitle: 'Atlas Property Search',
    headerClass: 'bg-sky-700',
    logoLeft: null,
    logoRight: null,
    botAvatar: null,
    themeColor: 'sky',
    defaultMode: 'chat'
  },
  messages: {
    welcomeTitle: 'Welcome!',
    welcomeText: 'CivQuest Atlas is an interactive map and search tool. Search for an address or parcel ID to learn more about a property.',
    exampleQuestions: [],
    importantNote: ''
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
 * @param {string} orgId - Organization ID (optional, auto-detected if not provided)
 * @returns {Object} { config, loading, error, orgId, setOrgId, availableMaps }
 */
export function useAtlasConfig(providedOrgId = null) {
  const [orgId, setOrgIdState] = useState(providedOrgId || detectOrganizationId());
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableMaps, setAvailableMaps] = useState([]);
  
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

    setLoading(true);
    setError(null);

    const docRef = doc(db, PATHS.organization(orgId));
    
    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const orgData = docSnap.data();
          const atlasConfig = orgData.atlasConfig || {};
          
          // Merge with defaults
          const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...atlasConfig,
            id: orgId,
            ui: { ...DEFAULT_CONFIG.ui, ...atlasConfig.ui },
            messages: { ...DEFAULT_CONFIG.messages, ...atlasConfig.messages },
            data: { ...DEFAULT_CONFIG.data, ...atlasConfig.data }
          };
          
          setConfig(mergedConfig);
          setAvailableMaps(mergedConfig.data?.maps || []);
          setLoading(false);
          
          // Store last used org
          localStorage.setItem('atlas_last_org', orgId);
        } else {
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
  }, [orgId]);

  return {
    config,
    loading,
    error,
    orgId,
    setOrgId,
    availableMaps
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
