/**
 * Elevation Service Utility
 *
 * Provides methods to query elevation data from ArcGIS Terrain3D/ImageServer
 * Used for Z mapping tools in Atlas markup
 */

import Point from '@arcgis/core/geometry/Point';
import Multipoint from '@arcgis/core/geometry/Multipoint';
import ElevationLayer from '@arcgis/core/layers/ElevationLayer';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

// Default elevation service URL
const DEFAULT_ELEVATION_SERVICE_URL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';

// Cache for ElevationLayer instances by URL to avoid recreating them
const elevationLayerCache = new Map();

// Conversion factors
const METERS_TO_FEET = 3.28084;

/**
 * Convert elevation value between units
 * @param {number} value - Elevation value in meters
 * @param {string} targetUnit - 'meters' or 'feet'
 * @returns {number} Converted value
 */
export const convertElevation = (value, targetUnit = 'feet') => {
  if (targetUnit === 'feet') {
    return value * METERS_TO_FEET;
  }
  return value;
};

/**
 * Format elevation value with units
 * @param {number} value - Elevation value (already converted)
 * @param {string} unit - 'meters' or 'feet'
 * @returns {string} Formatted string with units
 */
export const formatElevation = (value, unit = 'feet') => {
  const suffix = unit === 'feet' ? 'ft' : 'm';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${suffix}`;
};

/**
 * Get or create an ElevationLayer instance for the given URL
 * @param {string} serviceUrl - Elevation service URL
 * @returns {ElevationLayer} ElevationLayer instance
 */
const getElevationLayer = (serviceUrl) => {
  if (!elevationLayerCache.has(serviceUrl)) {
    const layer = new ElevationLayer({
      url: serviceUrl
    });
    elevationLayerCache.set(serviceUrl, layer);
  }
  return elevationLayerCache.get(serviceUrl);
};

/**
 * Query elevation at a single point using ElevationLayer.queryElevation
 * @param {object} geometry - Point geometry
 * @param {string} serviceUrl - Elevation service URL
 * @returns {Promise<number>} Elevation in meters
 */
export const getPointElevation = async (geometry, serviceUrl = DEFAULT_ELEVATION_SERVICE_URL) => {
  try {
    // Debug: Log incoming geometry
    console.log('[ElevationService] getPointElevation input geometry:', {
      type: geometry?.type,
      x: geometry?.x,
      y: geometry?.y,
      longitude: geometry?.longitude,
      latitude: geometry?.latitude,
      spatialReference: geometry?.spatialReference,
      declaredClass: geometry?.declaredClass
    });

    // Ensure geometry is a proper Point class for queryElevation to work correctly
    let pointGeometry = geometry;
    if (!geometry.declaredClass && geometry.type === 'point') {
      // Convert plain JSON to Point class
      pointGeometry = new Point({
        x: geometry.x,
        y: geometry.y,
        spatialReference: geometry.spatialReference || { wkid: 4326 }
      });
      console.log('[ElevationService] Converted JSON to Point class');
    }

    // Get the elevation layer
    const elevationLayer = getElevationLayer(serviceUrl);
    console.log('[ElevationService] Using ElevationLayer with URL:', serviceUrl);

    // Query elevation using the ArcGIS ElevationLayer API
    const result = await elevationLayer.queryElevation(pointGeometry);

    if (result && result.geometry && result.geometry.z !== undefined) {
      const elevation = result.geometry.z;
      console.log('[ElevationService] queryElevation result z:', elevation);
      return elevation;
    }

    console.log('[ElevationService] No elevation data returned from queryElevation');
    return null;
  } catch (error) {
    console.error('[ElevationService] Error getting point elevation:', error);
    throw error;
  }
};

/**
 * Query elevation along a polyline using ElevationLayer.queryElevation
 * @param {object} geometry - Polyline geometry
 * @param {string} serviceUrl - Elevation service URL
 * @param {number} sampleCount - Number of sample points along the line
 * @returns {Promise<{points: Array, stats: object}>} Elevation data with stats
 */
export const getLineElevation = async (geometry, serviceUrl = DEFAULT_ELEVATION_SERVICE_URL, sampleCount = 50) => {
  try {
    // Get the length of the line in meters
    const length = geometryEngine.geodesicLength(geometry, 'meters');

    // Calculate interval for densification
    const interval = Math.max(length / sampleCount, 2);

    // Densify the geometry for elevation sampling
    const densified = geometryEngine.densify(geometry, interval, 'meters');

    // Get the elevation layer and query elevation for the densified polyline
    const elevationLayer = getElevationLayer(serviceUrl);
    console.log('[ElevationService] Querying line elevation with densified geometry');

    const result = await elevationLayer.queryElevation(densified);

    if (!result || !result.geometry || !result.geometry.paths) {
      console.error('[ElevationService] No elevation data returned for line');
      return { points: [], stats: { min: null, max: null, median: null, range: null }, totalDistance: length };
    }

    // Extract elevation profile from the result geometry with Z values
    const profilePoints = [];
    let accumulatedDistance = 0;
    const paths = result.geometry.paths;

    for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
      const path = paths[pathIdx];
      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        const x = pt[0];
        const y = pt[1];
        const z = pt[2];

        // Calculate distance from previous point
        if (i > 0) {
          const prevPt = path[i - 1];
          const segmentLength = geometryEngine.geodesicLength(
            { type: 'polyline', paths: [[[prevPt[0], prevPt[1]], [x, y]]], spatialReference: result.geometry.spatialReference },
            'meters'
          );
          accumulatedDistance += segmentLength;
        }

        if (z !== undefined && z !== null) {
          profilePoints.push({
            distance: accumulatedDistance,
            x: x,
            y: y,
            elevation: z
          });
        }
      }
    }

    // Calculate stats
    const validElevations = profilePoints.map(p => p.elevation).filter(e => e !== null);
    const stats = calculateElevationStats(validElevations);

    console.log('[ElevationService] Line elevation result:', profilePoints.length, 'points');

    return {
      points: profilePoints,
      stats,
      totalDistance: length
    };
  } catch (error) {
    console.error('[ElevationService] Error getting line elevation:', error);
    throw error;
  }
};

/**
 * Query elevation for a polygon (grid sampling) using ElevationLayer.queryElevation
 * @param {object} geometry - Polygon geometry
 * @param {string} serviceUrl - Elevation service URL
 * @param {number} gridSize - Grid resolution (e.g., 10 = 10x10 grid)
 * @returns {Promise<{grid: Array, stats: object}>} Elevation grid data with stats
 */
export const getPolygonElevation = async (geometry, serviceUrl = DEFAULT_ELEVATION_SERVICE_URL, gridSize = 15) => {
  try {
    // Get the extent of the polygon
    const extent = geometry.extent;

    // Calculate cell size
    const cellWidth = (extent.xmax - extent.xmin) / gridSize;
    const cellHeight = (extent.ymax - extent.ymin) / gridSize;

    // Create grid of points and track their metadata
    const gridPoints = [];
    const multipointCoords = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = extent.xmin + (col + 0.5) * cellWidth;
        const y = extent.ymin + (row + 0.5) * cellHeight;

        const testPoint = new Point({
          x,
          y,
          spatialReference: geometry.spatialReference
        });

        // Check if point is within polygon
        if (geometryEngine.contains(geometry, testPoint)) {
          gridPoints.push({
            row,
            col,
            x,
            y
          });
          multipointCoords.push([x, y]);
        }
      }
    }

    if (multipointCoords.length === 0) {
      console.warn('[ElevationService] No points found within polygon');
      return {
        grid: [],
        stats: { min: null, max: null, median: null, range: null },
        gridSize,
        extent: { xmin: extent.xmin, ymin: extent.ymin, xmax: extent.xmax, ymax: extent.ymax }
      };
    }

    // Create a multipoint geometry with all grid points
    const multipoint = new Multipoint({
      points: multipointCoords,
      spatialReference: geometry.spatialReference
    });

    // Get the elevation layer and query elevation for all points at once
    const elevationLayer = getElevationLayer(serviceUrl);
    console.log('[ElevationService] Querying polygon elevation with', multipointCoords.length, 'points');

    const result = await elevationLayer.queryElevation(multipoint);

    if (!result || !result.geometry || !result.geometry.points) {
      console.error('[ElevationService] No elevation data returned for polygon');
      return {
        grid: [],
        stats: { min: null, max: null, median: null, range: null },
        gridSize,
        extent: { xmin: extent.xmin, ymin: extent.ymin, xmax: extent.xmax, ymax: extent.ymax }
      };
    }

    // Extract z values from the result
    const resultPoints = result.geometry.points;
    const grid = gridPoints.map((pt, i) => {
      const z = resultPoints[i] && resultPoints[i][2];
      return {
        ...pt,
        elevation: (z !== undefined && z !== null) ? z : null
      };
    }).filter(pt => pt.elevation !== null);

    // Calculate stats
    const validElevations = grid.map(p => p.elevation).filter(e => e !== null);
    const stats = calculateElevationStats(validElevations);

    console.log('[ElevationService] Polygon elevation result:', grid.length, 'points with elevation');

    return {
      grid,
      stats,
      gridSize,
      extent: {
        xmin: extent.xmin,
        ymin: extent.ymin,
        xmax: extent.xmax,
        ymax: extent.ymax
      }
    };
  } catch (error) {
    console.error('[ElevationService] Error getting polygon elevation:', error);
    throw error;
  }
};

/**
 * Calculate elevation statistics
 * @param {Array<number>} elevations - Array of elevation values
 * @returns {object} Statistics object with min, max, median, range
 */
export const calculateElevationStats = (elevations) => {
  if (!elevations || elevations.length === 0) {
    return { min: null, max: null, median: null, range: null };
  }

  const sorted = [...elevations].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const range = max - min;

  return { min, max, median, range };
};

export default {
  getPointElevation,
  getLineElevation,
  getPolygonElevation,
  calculateElevationStats,
  convertElevation,
  formatElevation,
  DEFAULT_ELEVATION_SERVICE_URL
};
