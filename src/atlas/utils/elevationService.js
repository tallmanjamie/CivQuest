/**
 * Elevation Service Utility
 *
 * Provides methods to query elevation data from ArcGIS Terrain3D/ImageServer
 * Used for Z mapping tools in Atlas markup
 */

import Point from '@arcgis/core/geometry/Point';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import * as projection from '@arcgis/core/geometry/projection';

// Default elevation service URL
const DEFAULT_ELEVATION_SERVICE_URL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';

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
 * Query elevation at a single point
 * @param {object} geometry - Point geometry
 * @param {string} serviceUrl - Elevation service URL
 * @returns {Promise<number>} Elevation in meters
 */
export const getPointElevation = async (geometry, serviceUrl = DEFAULT_ELEVATION_SERVICE_URL) => {
  try {
    // Ensure projection module is loaded
    await projection.load();

    // Get coordinates in WGS84
    let x, y;
    if (geometry.spatialReference?.wkid === 4326) {
      x = geometry.x ?? geometry.longitude;
      y = geometry.y ?? geometry.latitude;
    } else {
      // Project to WGS84
      const projected = projection.project(geometry, { wkid: 4326 });
      x = projected.x ?? projected.longitude;
      y = projected.y ?? projected.latitude;
    }

    // Use identify operation on the image service
    const url = new URL(`${serviceUrl}/identify`);
    url.searchParams.set('geometry', JSON.stringify({ x, y }));
    url.searchParams.set('geometryType', 'esriGeometryPoint');
    url.searchParams.set('returnGeometry', 'false');
    url.searchParams.set('returnCatalogItems', 'false');
    url.searchParams.set('f', 'json');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    // The value is returned in the 'value' field
    if (data.value !== undefined && data.value !== 'NoData') {
      return parseFloat(data.value);
    }

    return null;
  } catch (error) {
    console.error('[ElevationService] Error getting point elevation:', error);
    throw error;
  }
};

/**
 * Query elevation along a polyline
 * @param {object} geometry - Polyline geometry
 * @param {string} serviceUrl - Elevation service URL
 * @param {number} sampleCount - Number of sample points along the line
 * @returns {Promise<{points: Array, stats: object}>} Elevation data with stats
 */
export const getLineElevation = async (geometry, serviceUrl = DEFAULT_ELEVATION_SERVICE_URL, sampleCount = 50) => {
  try {
    // Ensure projection module is loaded
    await projection.load();

    // Get the length of the line in meters
    const length = geometryEngine.geodesicLength(geometry, 'meters');

    // Calculate sample interval
    const interval = length / (sampleCount - 1);

    // Sample points along the line
    const points = [];
    const elevations = [];

    for (let i = 0; i < sampleCount; i++) {
      const distance = i * interval;

      // Get point at distance along line
      const point = getPointAtDistance(geometry, distance, length);
      if (point) {
        points.push({
          distance,
          x: point.x,
          y: point.y
        });
      }
    }

    // Query elevations for all points (in batches to avoid overloading)
    const batchSize = 10;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      const batchElevations = await Promise.all(
        batch.map(async (pt) => {
          try {
            const elev = await getPointElevation(
              new Point({ x: pt.x, y: pt.y, spatialReference: geometry.spatialReference }),
              serviceUrl
            );
            return elev;
          } catch {
            return null;
          }
        })
      );
      elevations.push(...batchElevations);
    }

    // Combine points with elevations
    const profilePoints = points.map((pt, i) => ({
      ...pt,
      elevation: elevations[i]
    })).filter(pt => pt.elevation !== null);

    // Calculate stats
    const validElevations = profilePoints.map(p => p.elevation).filter(e => e !== null);
    const stats = calculateElevationStats(validElevations);

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
 * Query elevation for a polygon (grid sampling)
 * @param {object} geometry - Polygon geometry
 * @param {string} serviceUrl - Elevation service URL
 * @param {number} gridSize - Grid resolution (e.g., 10 = 10x10 grid)
 * @returns {Promise<{grid: Array, stats: object}>} Elevation grid data with stats
 */
export const getPolygonElevation = async (geometry, serviceUrl = DEFAULT_ELEVATION_SERVICE_URL, gridSize = 15) => {
  try {
    // Ensure projection module is loaded
    await projection.load();

    // Get the extent of the polygon
    const extent = geometry.extent;

    // Calculate cell size
    const cellWidth = (extent.xmax - extent.xmin) / gridSize;
    const cellHeight = (extent.ymax - extent.ymin) / gridSize;

    // Create grid of points within the polygon
    const gridPoints = [];

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
        }
      }
    }

    // Query elevations for all points (in batches)
    const elevations = [];
    const batchSize = 10;

    for (let i = 0; i < gridPoints.length; i += batchSize) {
      const batch = gridPoints.slice(i, i + batchSize);
      const batchElevations = await Promise.all(
        batch.map(async (pt) => {
          try {
            const elev = await getPointElevation(
              new Point({ x: pt.x, y: pt.y, spatialReference: geometry.spatialReference }),
              serviceUrl
            );
            return elev;
          } catch {
            return null;
          }
        })
      );
      elevations.push(...batchElevations);
    }

    // Combine points with elevations
    const grid = gridPoints.map((pt, i) => ({
      ...pt,
      elevation: elevations[i]
    })).filter(pt => pt.elevation !== null);

    // Calculate stats
    const validElevations = grid.map(p => p.elevation).filter(e => e !== null);
    const stats = calculateElevationStats(validElevations);

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

/**
 * Get a point at a specific distance along a polyline
 * @param {object} polyline - Polyline geometry
 * @param {number} targetDistance - Distance along line in meters
 * @param {number} totalLength - Total length of line in meters
 * @returns {object|null} Point coordinates
 */
const getPointAtDistance = (polyline, targetDistance, totalLength) => {
  if (!polyline.paths || polyline.paths.length === 0) {
    return null;
  }

  // Densify the geometry for more accurate sampling
  const densified = geometryEngine.densify(polyline, totalLength / 100, 'meters');

  // Walk along the path to find the point
  let accumulatedDistance = 0;
  const paths = densified.paths;

  for (let pathIdx = 0; pathIdx < paths.length; pathIdx++) {
    const path = paths[pathIdx];
    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = path[i];
      const [x2, y2] = path[i + 1];

      // Calculate segment length
      const segmentPoint1 = new Point({
        x: x1,
        y: y1,
        spatialReference: polyline.spatialReference
      });
      const segmentPoint2 = new Point({
        x: x2,
        y: y2,
        spatialReference: polyline.spatialReference
      });

      const segmentLength = geometryEngine.geodesicLength(
        { type: 'polyline', paths: [[[x1, y1], [x2, y2]]], spatialReference: polyline.spatialReference },
        'meters'
      );

      if (accumulatedDistance + segmentLength >= targetDistance) {
        // The target point is within this segment
        const ratio = (targetDistance - accumulatedDistance) / segmentLength;
        return {
          x: x1 + (x2 - x1) * ratio,
          y: y1 + (y2 - y1) * ratio
        };
      }

      accumulatedDistance += segmentLength;
    }
  }

  // Return last point if we've exceeded the length
  const lastPath = paths[paths.length - 1];
  const lastPoint = lastPath[lastPath.length - 1];
  return { x: lastPoint[0], y: lastPoint[1] };
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
