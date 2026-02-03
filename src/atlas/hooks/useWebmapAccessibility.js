// src/atlas/hooks/useWebmapAccessibility.js
// Hook to check webmap accessibility based on authentication state
//
// Implements the Atlas authentication workflow:
// 1. Check each webmap in config for public accessibility
// 2. If user not logged in and there are public maps: show them
// 3. If user logged in: show accessible private maps FIRST, then public maps
//    (Private maps are prioritized so the default selected map is the private one)
// 4. If user not logged in and no public maps: require login

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkMultipleWebmapsAccess } from '@shared/services/arcgis-auth';

/**
 * Hook to manage webmap accessibility based on authentication state
 *
 * @param {Object} options
 * @param {Array} options.allMaps - All maps from the config
 * @param {Object|null} options.firebaseUser - Current Firebase user (null if not logged in)
 * @param {Object|null} options.firebaseUserData - User data from Firestore (contains arcgisProfile)
 * @param {Object|null} options.arcgisPortal - ArcGIS Portal instance (from useArcGISAuth)
 * @param {boolean} options.arcgisAuthLoading - Whether ArcGIS auth is still loading
 * @returns {Object} { accessibleMaps, publicMaps, privateMaps, loading, requiresLogin, hasCheckedAccess }
 */
export function useWebmapAccessibility({
  allMaps = [],
  firebaseUser = null,
  firebaseUserData = null,
  arcgisPortal = null,
  arcgisAuthLoading = false
}) {
  const [accessibleMaps, setAccessibleMaps] = useState([]);
  const [publicMaps, setPublicMaps] = useState([]);
  const [privateMaps, setPrivateMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [hasCheckedAccess, setHasCheckedAccess] = useState(false);

  // Track which maps we've already checked to avoid redundant calls
  const checkedMapsRef = useRef(new Set());
  const publicAccessResultsRef = useRef(new Map());

  /**
   * Check public accessibility of all webmaps
   */
  const checkPublicAccess = useCallback(async () => {
    if (!allMaps?.length) {
      setLoading(false);
      setRequiresLogin(true);
      return { publicMaps: [], privateMaps: [] };
    }

    console.log('[useWebmapAccessibility] Checking public access for', allMaps.length, 'maps');

    // Check all maps for public access
    const accessResults = await checkMultipleWebmapsAccess(allMaps);
    publicAccessResultsRef.current = accessResults;

    const publicList = [];
    const privateList = [];

    allMaps.forEach((map, index) => {
      const itemId = map.webMap?.itemId;
      if (!itemId) {
        // Maps without itemId are treated as private/invalid
        privateList.push({ map, index });
        return;
      }

      const result = accessResults.get(itemId);
      if (result?.isPublic) {
        publicList.push({ map, index, accessResult: result });
      } else {
        privateList.push({ map, index, accessResult: result });
      }
    });

    console.log('[useWebmapAccessibility] Public maps:', publicList.length, 'Private maps:', privateList.length);

    return { publicList, privateList };
  }, [allMaps]);

  /**
   * Check if user has access to private maps via their linked ArcGIS account
   */
  const checkPrivateMapAccess = useCallback(async (privateMapsInfo, portal) => {
    if (!privateMapsInfo?.length || !portal) {
      return [];
    }

    console.log('[useWebmapAccessibility] Checking private map access for', privateMapsInfo.length, 'maps');

    try {
      // Query the portal for all private map item IDs
      const itemIds = privateMapsInfo
        .map(info => info.map.webMap?.itemId)
        .filter(Boolean);

      if (itemIds.length === 0) return [];

      // Query portal for accessible items
      const queryString = itemIds.map(id => `id:"${id}"`).join(' OR ');
      const result = await portal.queryItems({
        query: queryString,
        num: 100
      });

      const accessibleIds = new Set(result.results.map(item => item.id));

      // Return the maps that the user can access
      return privateMapsInfo.filter(info => {
        const itemId = info.map.webMap?.itemId;
        return itemId && accessibleIds.has(itemId);
      });
    } catch (err) {
      console.warn('[useWebmapAccessibility] Error checking private map access:', err);
      return [];
    }
  }, []);

  /**
   * Main effect to check webmap accessibility
   */
  useEffect(() => {
    // Wait for ArcGIS auth to finish loading before making decisions
    if (arcgisAuthLoading) {
      return;
    }

    const checkAccess = async () => {
      setLoading(true);

      // Step 1: Check public accessibility of all maps
      const { publicList, privateList } = await checkPublicAccess();

      // Extract just the map objects
      const publicMapObjects = publicList.map(info => info.map);
      const privateMapObjects = privateList.map(info => info.map);

      setPublicMaps(publicMapObjects);
      setPrivateMaps(privateMapObjects);

      // Step 2: Determine what maps are accessible based on auth state
      let accessible = [];

      // If user is logged in and has linked ArcGIS account, check private maps
      const hasLinkedArcGIS = firebaseUserData?.arcgisProfile?.username ||
                              firebaseUserData?.linkedArcGISUsername;

      if (firebaseUser && hasLinkedArcGIS && arcgisPortal) {
        console.log('[useWebmapAccessibility] User has linked ArcGIS account, checking private maps');
        const accessiblePrivate = await checkPrivateMapAccess(privateList, arcgisPortal);
        const accessiblePrivateMaps = accessiblePrivate.map(info => info.map);
        // When signed in, prioritize private maps over public maps
        // This ensures the default selected map is the private one when available
        accessible = [...accessiblePrivateMaps, ...publicMapObjects];
        console.log('[useWebmapAccessibility] Accessible private maps:', accessiblePrivateMaps.length);
      } else {
        // Not signed in or no linked ArcGIS - use public maps only
        accessible = [...publicMapObjects];
      }

      // Step 3: Determine if login is required
      // Login is required ONLY if:
      // - User is not logged in AND
      // - There are no public maps
      const noPublicMaps = publicMapObjects.length === 0;
      const userNotLoggedIn = !firebaseUser;
      const loginRequired = userNotLoggedIn && noPublicMaps;

      console.log('[useWebmapAccessibility] Final state:', {
        accessible: accessible.length,
        public: publicMapObjects.length,
        private: privateMapObjects.length,
        loginRequired,
        userLoggedIn: !!firebaseUser,
        hasLinkedArcGIS
      });

      setAccessibleMaps(accessible);
      setRequiresLogin(loginRequired);
      setHasCheckedAccess(true);
      setLoading(false);
    };

    checkAccess();
  }, [
    allMaps,
    firebaseUser,
    firebaseUserData,
    arcgisPortal,
    arcgisAuthLoading,
    checkPublicAccess,
    checkPrivateMapAccess
  ]);

  // Determine if all maps are public (no private maps exist)
  const allMapsPublic = hasCheckedAccess && privateMaps.length === 0 && publicMaps.length > 0;

  // Determine if the default map (first map in config) is public
  const defaultMapIsPublic = hasCheckedAccess && allMaps.length > 0 && publicMaps.some(
    publicMap => publicMap.webMap?.itemId === allMaps[0]?.webMap?.itemId
  );

  return {
    // The maps the user can access (public + accessible private)
    accessibleMaps,
    // Maps that are publicly accessible
    publicMaps,
    // Maps that require authentication
    privateMaps,
    // Whether we're still checking access
    loading,
    // Whether the user must log in (no public maps and not logged in)
    requiresLogin,
    // Whether we've completed the access check
    hasCheckedAccess,
    // Whether all configured maps are public (no private maps)
    allMapsPublic,
    // Whether the default/first map is public
    defaultMapIsPublic,
    // Helper to check if a specific map is public
    isMapPublic: useCallback((itemId) => {
      const result = publicAccessResultsRef.current.get(itemId);
      return result?.isPublic ?? false;
    }, [])
  };
}

export default useWebmapAccessibility;
