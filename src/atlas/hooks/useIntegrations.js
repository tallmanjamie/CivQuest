// src/atlas/hooks/useIntegrations.js
// Hook for accessing integration configurations in Atlas

import { useState, useEffect, useCallback } from 'react';
import { db } from '@shared/services/firebase';
import { PATHS } from '@shared/services/paths';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

/**
 * Hook to get integrations enabled for a specific organization
 *
 * @param {string} orgId - Organization ID
 * @returns {object} - { integrations, pictometryConfig, isLoading, openEagleView }
 */
export function useIntegrations(orgId) {
  const [integrations, setIntegrations] = useState([]);
  const [orgIntegrations, setOrgIntegrations] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load system-level integrations
  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }

    // Subscribe to system config for integrations
    const unsubscribe = onSnapshot(
      doc(db, PATHS.systemConfig),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const allIntegrations = data.integrations || [];

          // Filter to only integrations that include this org
          const orgIntegrationsList = allIntegrations.filter(
            (i) => i.enabled && i.organizations?.includes(orgId)
          );

          setIntegrations(orgIntegrationsList);
        } else {
          setIntegrations([]);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('[useIntegrations] Error loading integrations:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId]);

  // Load org-level integration configs
  useEffect(() => {
    if (!orgId) return;

    const loadOrgIntegrations = async () => {
      try {
        const orgDocRef = doc(db, PATHS.organization(orgId));
        const orgSnap = await getDoc(orgDocRef);

        if (orgSnap.exists()) {
          const orgData = orgSnap.data();
          setOrgIntegrations(orgData.integrations || {});
        }
      } catch (error) {
        console.error('[useIntegrations] Error loading org integrations:', error);
      }
    };

    loadOrgIntegrations();
  }, [orgId]);

  // Check if Pictometry/EagleView is enabled
  const pictometryIntegration = integrations.find((i) => i.type === 'pictometry');
  const pictometryConfig = orgIntegrations.pictometry || null;

  // Helper to check if a specific integration type is enabled
  const isIntegrationEnabled = useCallback(
    (integrationType) => {
      return integrations.some((i) => i.type === integrationType);
    },
    [integrations]
  );

  // Get config for a specific integration type
  const getIntegrationConfig = useCallback(
    (integrationType) => {
      return orgIntegrations[integrationType] || null;
    },
    [orgIntegrations]
  );

  /**
   * Open EagleView in a new window with the given feature
   *
   * @param {object} params - Parameters for opening EagleView
   * @param {object} params.geometry - ArcGIS geometry object (point, polygon, polyline)
   * @param {string} params.title - Feature title to display
   * @param {string} params.themeColor - Theme color for highlighting (hex code)
   */
  const openEagleView = useCallback(
    ({ geometry, title, themeColor }) => {
      if (!pictometryConfig?.apiKey) {
        console.warn('[useIntegrations] No Pictometry API key configured');
        return;
      }

      if (!geometry) {
        console.warn('[useIntegrations] No geometry provided');
        return;
      }

      // Infer geometry type if not present
      let geometryType = geometry.type;
      if (!geometryType) {
        if (geometry.rings) geometryType = 'polygon';
        else if (geometry.paths) geometryType = 'polyline';
        else if (geometry.x !== undefined && geometry.y !== undefined) geometryType = 'point';
        else if (geometry.latitude !== undefined && geometry.longitude !== undefined) geometryType = 'point';
        else if (geometry.xmin !== undefined) geometryType = 'extent';
        else if (geometry.points) geometryType = 'multipoint';
      }

      // Calculate center coordinates from geometry
      let lat, lon;

      if (geometryType === 'point') {
        lat = geometry.y || geometry.latitude;
        lon = geometry.x || geometry.longitude;
      } else if (geometryType === 'polygon' && geometry.rings?.[0]) {
        // Calculate centroid of first ring
        const ring = geometry.rings[0];
        let sumLon = 0,
          sumLat = 0;
        for (const pt of ring) {
          sumLon += pt[0];
          sumLat += pt[1];
        }
        lon = sumLon / ring.length;
        lat = sumLat / ring.length;
      } else if (geometryType === 'polyline' && geometry.paths?.[0]) {
        // Use midpoint of first path
        const path = geometry.paths[0];
        const midIndex = Math.floor(path.length / 2);
        lon = path[midIndex][0];
        lat = path[midIndex][1];
      } else if (geometryType === 'extent' || geometry.extent) {
        // Use center of extent
        const ext = geometryType === 'extent' ? geometry : geometry.extent;
        lat = (ext.ymin + ext.ymax) / 2;
        lon = (ext.xmin + ext.xmax) / 2;
      } else if (geometryType === 'multipoint' && geometry.points?.[0]) {
        // Use first point of multipoint
        lon = geometry.points[0][0];
        lat = geometry.points[0][1];
      }

      if (!lat || !lon) {
        console.warn('[useIntegrations] Could not calculate coordinates from geometry');
        return;
      }

      // Store geometry in sessionStorage (URL might be too long)
      const geometryKey = 'eagleview_geometry';
      try {
        // Serialize geometry properly
        const geoData = {
          type: geometryType,
          spatialReference: geometry.spatialReference || { wkid: 4326 }
        };

        if (geometryType === 'point') {
          geoData.x = geometry.x || geometry.longitude;
          geoData.y = geometry.y || geometry.latitude;
        } else if (geometryType === 'polygon') {
          geoData.rings = geometry.rings;
        } else if (geometryType === 'polyline') {
          geoData.paths = geometry.paths;
        } else if (geometryType === 'multipoint') {
          geoData.points = geometry.points;
        } else if (geometryType === 'extent') {
          geoData.xmin = geometry.xmin;
          geoData.ymin = geometry.ymin;
          geoData.xmax = geometry.xmax;
          geoData.ymax = geometry.ymax;
        }

        sessionStorage.setItem(geometryKey, JSON.stringify(geoData));
      } catch (e) {
        console.warn('[useIntegrations] Could not store geometry in sessionStorage', e);
      }

      // Build URL with parameters
      const params = new URLSearchParams({
        apiKey: pictometryConfig.apiKey,
        lat: lat.toString(),
        lon: lon.toString(),
        themeColor: themeColor || '#0ea5e9',
        title: title || 'Feature',
        geometryType: geometryType || 'unknown'
      });

      const url = `/eagleview.html?${params.toString()}`;

      // Open in new window
      const windowFeatures = 'width=1200,height=800,resizable=yes,scrollbars=yes';
      window.open(url, 'eagleview', windowFeatures);
    },
    [pictometryConfig]
  );

  return {
    integrations,
    isLoading,
    isIntegrationEnabled,
    getIntegrationConfig,

    // Pictometry/EagleView specific
    isPictometryEnabled: !!pictometryIntegration && !!pictometryConfig?.apiKey,
    pictometryConfig,
    openEagleView
  };
}

export default useIntegrations;
