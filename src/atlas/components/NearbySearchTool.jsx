// src/atlas/components/NearbySearchTool.jsx
// CivQuest Atlas - Nearby Search Tool Component
// Allows users to find features within a buffer distance of a geometry

import React, { useState, useCallback, useMemo } from 'react';
import {
  Search,
  Loader2,
  X,
  Bookmark,
  MapPin
} from 'lucide-react';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import Polygon from '@arcgis/core/geometry/Polygon';
import { getThemeColors } from '../utils/themeColors';

// Distance units configuration
const DISTANCE_UNITS = [
  { id: 'feet', label: 'Feet', arcgisUnit: 'feet' },
  { id: 'meters', label: 'Meters', arcgisUnit: 'meters' },
  { id: 'miles', label: 'Miles', arcgisUnit: 'miles' },
  { id: 'kilometers', label: 'Kilometers', arcgisUnit: 'kilometers' }
];

/**
 * Ensures the geometry is a proper ArcGIS Geometry class instance.
 * Plain JSON objects need to be converted to class instances for geometryEngine to work.
 */
const ensureGeometry = (geom) => {
  if (!geom) return null;

  // If it's already a proper geometry instance with declaredClass, return as-is
  if (geom.declaredClass) return geom;

  // Otherwise, construct the appropriate geometry class based on type
  const type = geom.type;
  const spatialReference = geom.spatialReference || { wkid: 4326 };

  if (type === 'point' || (geom.x !== undefined && geom.y !== undefined)) {
    return new Point({
      x: geom.x,
      y: geom.y,
      spatialReference
    });
  } else if (type === 'polyline' || geom.paths) {
    return new Polyline({
      paths: geom.paths,
      spatialReference
    });
  } else if (type === 'polygon' || geom.rings) {
    return new Polygon({
      rings: geom.rings,
      spatialReference
    });
  }

  // Fallback - return the original
  return geom;
};

/**
 * NearbySearchTool Component
 * Provides UI for searching features within a buffer distance
 *
 * @param {object} geometry - The source geometry to buffer
 * @param {string} endpoint - The feature service endpoint to query
 * @param {object} customFeatureInfo - Custom feature info config with layerId
 * @param {function} onResults - Callback with found features
 * @param {function} onSaveBufferAsMarkup - Callback to save buffer geometry as markup
 * @param {function} onClose - Callback to close the tool
 * @param {string} themeColor - Theme color name
 * @param {string} sourceName - Name of the source feature/markup
 */
export default function NearbySearchTool({
  geometry,
  endpoint,
  customFeatureInfo,
  onResults,
  onSaveBufferAsMarkup,
  onClose,
  themeColor = 'sky',
  sourceName = 'Feature'
}) {
  const colors = getThemeColors(themeColor);

  const [distance, setDistance] = useState(100);
  const [unit, setUnit] = useState('feet');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [lastBufferGeometry, setLastBufferGeometry] = useState(null);
  const [resultCount, setResultCount] = useState(null);

  // Get the configured layer ID for querying
  const queryLayerId = useMemo(() => {
    return customFeatureInfo?.layerId || null;
  }, [customFeatureInfo]);

  /**
   * Create buffer geometry from source
   */
  const createBuffer = useCallback((sourceGeometry, bufferDistance, bufferUnit) => {
    try {
      const properGeometry = ensureGeometry(sourceGeometry);
      if (!properGeometry) {
        throw new Error('Invalid geometry');
      }

      const unitConfig = DISTANCE_UNITS.find(u => u.id === bufferUnit);
      const arcgisUnit = unitConfig?.arcgisUnit || 'feet';

      // Create the buffer
      const bufferGeometry = geometryEngine.geodesicBuffer(properGeometry, bufferDistance, arcgisUnit);

      if (!bufferGeometry) {
        throw new Error('Failed to create buffer geometry');
      }

      return bufferGeometry;
    } catch (err) {
      console.error('[NearbySearchTool] Buffer creation error:', err);
      throw err;
    }
  }, []);

  /**
   * Query features within the buffer
   */
  const queryFeaturesInBuffer = useCallback(async (bufferGeometry, serviceEndpoint) => {
    if (!serviceEndpoint) {
      throw new Error('No endpoint configured for nearby search');
    }

    // Convert buffer geometry to JSON for the query
    const geometryJson = JSON.stringify(bufferGeometry.toJSON());

    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      geometry: geometryJson,
      geometryType: 'esriGeometryPolygon',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      inSR: bufferGeometry.spatialReference?.wkid || '4326',
      resultRecordCount: '1000'
    });

    console.log('[NearbySearchTool] Querying:', serviceEndpoint);

    const response = await fetch(`${serviceEndpoint}/query?${params}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Query failed');
    }

    // Ensure all features have spatial reference
    const features = (data.features || []).map(feature => {
      if (feature.geometry && !feature.geometry.spatialReference) {
        feature.geometry.spatialReference = data.spatialReference || { wkid: 4326 };
      }
      return feature;
    });

    return features;
  }, []);

  /**
   * Handle the nearby search
   */
  const handleSearch = useCallback(async () => {
    if (!geometry || !endpoint) {
      setError('Missing geometry or endpoint configuration');
      return;
    }

    if (distance <= 0) {
      setError('Distance must be greater than 0');
      return;
    }

    setIsSearching(true);
    setError(null);
    setResultCount(null);

    try {
      // Create buffer
      console.log('[NearbySearchTool] Creating buffer:', distance, unit);
      const bufferGeometry = createBuffer(geometry, distance, unit);
      setLastBufferGeometry(bufferGeometry);

      // Query features
      console.log('[NearbySearchTool] Querying features within buffer');
      const features = await queryFeaturesInBuffer(bufferGeometry, endpoint);

      console.log('[NearbySearchTool] Found', features.length, 'features');
      setResultCount(features.length);

      // Send results back
      if (onResults) {
        onResults(features, bufferGeometry, {
          distance,
          unit,
          sourceName
        });
      }
    } catch (err) {
      console.error('[NearbySearchTool] Search error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [geometry, endpoint, distance, unit, sourceName, createBuffer, queryFeaturesInBuffer, onResults]);

  /**
   * Handle saving buffer as markup
   */
  const handleSaveBufferAsMarkup = useCallback(() => {
    if (lastBufferGeometry && onSaveBufferAsMarkup) {
      onSaveBufferAsMarkup(lastBufferGeometry, `${distance} ${unit} buffer around ${sourceName}`);
    }
  }, [lastBufferGeometry, onSaveBufferAsMarkup, distance, unit, sourceName]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200" style={{ backgroundColor: colors.bg50 }}>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: colors.bg600 }} />
          <span className="font-semibold text-slate-800 text-sm">Find Nearby</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white rounded transition"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Distance Input */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Search Distance
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
              min="1"
              step="1"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': colors.bg500 }}
              placeholder="100"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white"
              style={{ '--tw-ring-color': colors.bg500 }}
            >
              {DISTANCE_UNITS.map(u => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Result Count */}
        {resultCount !== null && !error && (
          <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg50 }}>
            <p className="text-sm" style={{ color: colors.text700 }}>
              Found <strong>{resultCount}</strong> feature{resultCount !== 1 ? 's' : ''} within {distance} {unit}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={isSearching || distance <= 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: colors.bg600 }}
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find</span>
              </>
            )}
          </button>

          {/* Save Buffer as Markup - only show if buffer was created */}
          {lastBufferGeometry && onSaveBufferAsMarkup && (
            <button
              onClick={handleSaveBufferAsMarkup}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <Bookmark className="w-4 h-4" />
              <span>Save Buffer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
