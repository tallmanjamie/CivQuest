// src/atlas/hooks/useWebmapAccessibility.js
// Hook to check webmap accessibility based on authentication state
//
// Implements the Atlas authentication workflow:
// 1. Check each webmap in config for public accessibility (ArcGIS webmap sharing)
// 2. If user not logged in and there are public maps AND not all maps are configured private: show them
// 3. If user logged in: show accessible private maps FIRST, then public maps
//    (Private maps are prioritized so the default selected map is the private one)
// 4. If user not logged in and no public maps: require login
// 5. If user not logged in and ALL maps in Atlas config have access="private": require login
//    (This enforces login even if underlying ArcGIS webmaps are publicly shared)

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkMultipleWebmapsAccess, checkPrivateWebmapsAccess, getStoredArcGISToken } from '@shared/services/arcgis-auth';

/**
 * Hook to manage webmap accessibility based on authentication state
 *
 * @param {Object} options
 * @param {Array} options.allMaps - All maps from the config
 * @param {Object|null} options.firebaseUser - Current Firebase user (null if not logged in)
 * @param {Object|null} options.firebaseUserData - User data from Firestore (contains arcgisProfile)
 * @param {Object|null} options.arcgisPortal - (Deprecated) No longer used - token is now stored separately
 * @param {boolean} options.arcgisAuthLoading - Whether ArcGIS auth is still loading
 * @returns {Object} { accessibleMaps, publicMaps, privateMaps, loading, requiresLogin, hasCheckedAccess }
 */
export function useWebmapAccessibility({
  allMaps = [],
  firebaseUser = null,
  firebaseUserData = null,
  arcgisPortal = null, // Kept for backward compatibility, no longer used
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
    console.log('[useWebmapAccessibility] All maps from config:', allMaps.map(m => ({ name: m.name, itemId: m.webMap?.itemId })));

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
   * Check if user has access to private maps via their stored ArcGIS OAuth token
   * This uses the token stored during OAuth login to directly query the ArcGIS REST API
   */
  const checkPrivateMapAccess = useCallback(async (privateMapsInfo) => {
    if (!privateMapsInfo?.length) {
      return [];
    }

    // Check if we have a stored OAuth token
    const storedToken = getStoredArcGISToken();
    if (!storedToken?.access_token) {
      console.log('[useWebmapAccessibility] No stored ArcGIS token, skipping private map check');
      return [];
    }

    console.log('[useWebmapAccessibility] Checking private map access for', privateMapsInfo.length, 'maps using stored token');

    try {
      // Get all private map item IDs
      const itemIds = privateMapsInfo
        .map(info => info.map.webMap?.itemId)
        .filter(Boolean);

      if (itemIds.length === 0) return [];

      // Use the stored token to check which private maps the user can access
      const accessibleIds = await checkPrivateWebmapsAccess(itemIds);

      console.log('[useWebmapAccessibility] Accessible private map IDs:', accessibleIds.size);

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
      // Uses stored OAuth token from login for authentication
      const hasLinkedArcGIS = firebaseUserData?.arcgisProfile?.username ||
                              firebaseUserData?.linkedArcGISUsername;
      const hasStoredToken = !!getStoredArcGISToken();

      if (firebaseUser && hasLinkedArcGIS && hasStoredToken) {
        console.log('[useWebmapAccessibility] User has linked ArcGIS account with stored token, checking private maps');
        const accessiblePrivate = await checkPrivateMapAccess(privateList);
        const accessiblePrivateMaps = accessiblePrivate.map(info => info.map);
        // When signed in, prioritize private maps over public maps
        // This ensures the default selected map is the private one when available
        accessible = [...accessiblePrivateMaps, ...publicMapObjects];
        console.log('[useWebmapAccessibility] Accessible private maps:', accessiblePrivateMaps.length);
      } else {
        // Not signed in or no linked ArcGIS/stored token - use public maps only
        accessible = [...publicMapObjects];
      }

      // Step 3: Determine if login is required
      // Login is required if user is not logged in AND:
      // - There are no public maps (ArcGIS webmaps not publicly accessible), OR
      // - All maps in the Atlas config are set to private (access: "private")
      //   This enforces login even if the underlying ArcGIS webmaps are publicly shared
      const noPublicMaps = publicMapObjects.length === 0;
      const userNotLoggedIn = !firebaseUser;
      const allMapsConfiguredPrivate = allMaps.length > 0 && allMaps.every(map => map.access === 'private');
      const loginRequired = userNotLoggedIn && (noPublicMaps || allMapsConfiguredPrivate);

      console.log('[useWebmapAccessibility] Final state:', {
        accessible: accessible.length,
        accessibleNames: accessible.map(m => m.name),
        public: publicMapObjects.length,
        publicNames: publicMapObjects.map(m => m.name),
        private: privateMapObjects.length,
        privateNames: privateMapObjects.map(m => m.name),
        loginRequired,
        allMapsConfiguredPrivate,
        userLoggedIn: !!firebaseUser,
        hasLinkedArcGIS,
        hasStoredToken
      });
      console.log('[useWebmapAccessibility] MAP PICKER: Should show dropdown?', accessible.length > 1, '(need > 1 accessible maps)');

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
    arcgisAuthLoading,
    checkPublicAccess,
    checkPrivateMapAccess
  ]);

  // Determine if all maps are public (no private maps exist based on ArcGIS accessibility)
  const allMapsPublic = hasCheckedAccess && privateMaps.length === 0 && publicMaps.length > 0;

  // Determine if all maps in the Atlas config are set to private (access: "private")
  // This is separate from ArcGIS accessibility - it's the admin's intent for the map
  const allMapsConfiguredPrivate = allMaps.length > 0 && allMaps.every(map => map.access === 'private');

  // Determine if the default map (first map in config) is public
  const defaultMapIsPublic = hasCheckedAccess && allMaps.length > 0 && publicMaps.some(
    publicMap => publicMap.webMap?.itemId === allMaps[0]?.webMap?.itemId
  );

  return {
    // The maps the user can access (public + accessible private)
    accessibleMaps,
    // Maps that are publicly accessible (based on ArcGIS webmap access)
    publicMaps,
    // Maps that require authentication (based on ArcGIS webmap access)
    privateMaps,
    // Whether we're still checking access
    loading,
    // Whether the user must log in (no public maps OR all maps configured as private in Atlas)
    requiresLogin,
    // Whether we've completed the access check
    hasCheckedAccess,
    // Whether all configured maps are public based on ArcGIS accessibility (no private maps)
    allMapsPublic,
    // Whether all maps in Atlas config are set to private (access: "private")
    allMapsConfiguredPrivate,
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
