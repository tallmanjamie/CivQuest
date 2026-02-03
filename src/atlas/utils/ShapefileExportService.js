// src/atlas/utils/ShapefileExportService.js
// Shapefile Export Service - Export features and markups to shapefile format
//
// Supports:
// - Exporting search results (features) to a single shapefile
// - Exporting markups to multiple shapefiles (points, lines, polygons, text)
//
// Uses @mapbox/shp-write for shapefile generation

import shpwrite from '@mapbox/shp-write';

/**
 * Convert ArcGIS geometry to GeoJSON geometry
 * Handles points, polylines, and polygons
 */
function arcgisToGeoJSON(geometry) {
  if (!geometry) return null;

  // Handle Point geometry
  if (geometry.type === 'point' || (geometry.x !== undefined && geometry.y !== undefined)) {
    return {
      type: 'Point',
      coordinates: [
        geometry.longitude ?? geometry.x,
        geometry.latitude ?? geometry.y
      ]
    };
  }

  // Handle Polyline geometry
  if (geometry.type === 'polyline' || geometry.paths) {
    const paths = geometry.paths || [];
    if (paths.length === 1) {
      return {
        type: 'LineString',
        coordinates: paths[0].map(pt => [pt[0], pt[1]])
      };
    } else if (paths.length > 1) {
      return {
        type: 'MultiLineString',
        coordinates: paths.map(path => path.map(pt => [pt[0], pt[1]]))
      };
    }
    return null;
  }

  // Handle Polygon geometry
  if (geometry.type === 'polygon' || geometry.rings) {
    const rings = geometry.rings || [];
    if (rings.length === 0) return null;

    // GeoJSON polygons: first ring is exterior, rest are holes
    // For simplicity, we treat each ring as a separate polygon
    if (rings.length === 1) {
      return {
        type: 'Polygon',
        coordinates: [rings[0].map(pt => [pt[0], pt[1]])]
      };
    } else {
      // Multiple rings - create a Polygon with holes or MultiPolygon
      return {
        type: 'Polygon',
        coordinates: rings.map(ring => ring.map(pt => [pt[0], pt[1]]))
      };
    }
  }

  // Handle already-GeoJSON geometry
  if (geometry.type === 'Point' || geometry.type === 'LineString' ||
      geometry.type === 'Polygon' || geometry.type === 'MultiPolygon' ||
      geometry.type === 'MultiLineString' || geometry.type === 'MultiPoint') {
    return geometry;
  }

  console.warn('[ShapefileExportService] Unknown geometry type:', geometry);
  return null;
}

/**
 * Sanitize property value for shapefile DBF format
 * DBF has limited support for data types
 */
function sanitizePropertyValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

/**
 * Truncate field name to DBF limit (10 characters)
 */
function truncateFieldName(name, usedNames = new Set()) {
  let truncated = String(name).substring(0, 10);

  // Handle duplicates by adding suffix
  let counter = 1;
  let finalName = truncated;
  while (usedNames.has(finalName)) {
    const suffix = String(counter);
    finalName = truncated.substring(0, 10 - suffix.length) + suffix;
    counter++;
  }

  usedNames.add(finalName);
  return finalName;
}

/**
 * Convert features to GeoJSON FeatureCollection
 */
function featuresToGeoJSON(features, includeAllAttributes = true) {
  const usedFieldNames = new Set();
  const fieldNameMapping = {};

  // Build field name mapping from first feature
  if (features.length > 0 && features[0].attributes) {
    Object.keys(features[0].attributes).forEach(key => {
      // Skip internal fields
      if (key.startsWith('_') || key === 'Shape__Area' || key === 'Shape__Length') return;
      fieldNameMapping[key] = truncateFieldName(key, usedFieldNames);
    });
  }

  const geojsonFeatures = features
    .map((feature, index) => {
      const geometry = arcgisToGeoJSON(feature.geometry);
      if (!geometry) return null;

      const properties = {};
      const attrs = feature.attributes || {};

      if (includeAllAttributes) {
        Object.entries(attrs).forEach(([key, value]) => {
          // Skip internal fields
          if (key.startsWith('_') || key === 'Shape__Area' || key === 'Shape__Length') return;
          const fieldName = fieldNameMapping[key] || truncateFieldName(key, usedFieldNames);
          properties[fieldName] = sanitizePropertyValue(value);
        });
      }

      // Ensure there's at least an ID
      if (Object.keys(properties).length === 0) {
        properties.ID = index + 1;
      }

      return {
        type: 'Feature',
        geometry,
        properties
      };
    })
    .filter(f => f !== null);

  return {
    type: 'FeatureCollection',
    features: geojsonFeatures
  };
}

/**
 * Download a file from a blob/data
 */
function downloadFile(data, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export search results to shapefile
 * Creates a single shapefile containing all features
 *
 * @param {Object} options
 * @param {Array} options.features - Array of ArcGIS features with geometry and attributes
 * @param {string} options.filename - Name for the exported file (without extension)
 * @param {Function} options.onProgress - Optional progress callback
 */
export async function exportSearchResultsToShapefile({ features, filename = 'search-results', onProgress }) {
  if (!features || features.length === 0) {
    throw new Error('No features to export');
  }

  onProgress?.('Converting features...');

  // Convert to GeoJSON
  const geojson = featuresToGeoJSON(features);

  if (geojson.features.length === 0) {
    throw new Error('No valid geometries found in features');
  }

  onProgress?.('Generating shapefile...');

  // Generate shapefile
  const options = {
    folder: filename,
    outputType: 'blob',
    types: {
      point: 'points',
      polygon: 'polygons',
      line: 'lines'
    }
  };

  try {
    const zipData = await shpwrite.zip(geojson, options);

    onProgress?.('Downloading...');

    // Download the zip file
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(zipData, `${filename}-${dateStr}.zip`);

    onProgress?.('Complete');
    return true;
  } catch (err) {
    console.error('[ShapefileExportService] Export error:', err);
    throw new Error(`Failed to generate shapefile: ${err.message}`);
  }
}

/**
 * Export markup graphics to shapefiles
 * Creates separate shapefiles for points, lines, polygons, and text
 *
 * @param {Object} options
 * @param {Array} options.markups - Array of ArcGIS graphics from markup layer
 * @param {string} options.filename - Base name for the exported files (without extension)
 * @param {Function} options.onProgress - Optional progress callback
 */
export async function exportMarkupsToShapefile({ markups, filename = 'markups', onProgress }) {
  if (!markups || markups.length === 0) {
    throw new Error('No markups to export');
  }

  onProgress?.('Categorizing markups...');

  // Filter out label graphics (they're associated with parent markups)
  const mainMarkups = markups.filter(m =>
    m.attributes?.isMarkup && !m.attributes?.isLabel
  );

  if (mainMarkups.length === 0) {
    throw new Error('No valid markups found to export');
  }

  // Categorize markups by type
  const points = [];
  const lines = [];
  const polygons = [];
  const texts = [];

  mainMarkups.forEach(markup => {
    const tool = markup.attributes?.tool;
    const geometry = markup.geometry;

    if (!geometry) return;

    // Build properties for this markup
    const properties = {
      name: markup.attributes?.name || '',
      metric: markup.attributes?.metric || '',
      color: markup.attributes?.color || '',
      created: markup.attributes?.timestamp ? new Date(markup.attributes.timestamp).toISOString() : ''
    };

    const geoJsonGeometry = arcgisToGeoJSON(geometry);
    if (!geoJsonGeometry) return;

    const feature = {
      type: 'Feature',
      geometry: geoJsonGeometry,
      properties
    };

    if (tool === 'text') {
      // Text markups are points with text content
      properties.text = markup.symbol?.text || markup.attributes?.name || '';
      properties.fontsize = markup.symbol?.font?.size || 14;
      texts.push(feature);
    } else if (tool === 'point' || geometry.type === 'point' || (geometry.x !== undefined && geometry.y !== undefined)) {
      properties.style = markup.attributes?.symbolStyle || 'circle';
      points.push(feature);
    } else if (tool === 'polyline' || geometry.type === 'polyline' || geometry.paths) {
      properties.style = markup.attributes?.symbolStyle || 'solid';
      lines.push(feature);
    } else if (tool === 'polygon' || geometry.type === 'polygon' || geometry.rings) {
      properties.style = markup.attributes?.symbolStyle || 'solid';
      polygons.push(feature);
    }
  });

  onProgress?.('Generating shapefiles...');

  // Create a combined zip with all shapefiles
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const dateStr = new Date().toISOString().split('T')[0];

  // Helper to generate and add shapefile to zip
  const addShapefileToZip = async (features, layerName) => {
    if (features.length === 0) return;

    const geojson = {
      type: 'FeatureCollection',
      features
    };

    try {
      // Generate shapefile data
      const shpData = await shpwrite.zip(geojson, {
        folder: layerName,
        types: {
          point: layerName,
          polygon: layerName,
          line: layerName
        },
        outputType: 'arraybuffer'
      });

      // Add to our combined zip
      const shpZip = await JSZip.loadAsync(shpData);

      // Extract and add files from the shapefile zip
      for (const [path, file] of Object.entries(shpZip.files)) {
        if (!file.dir) {
          const content = await file.async('arraybuffer');
          // Put files directly in the zip with layer prefix
          const fileName = path.split('/').pop();
          zip.file(`${layerName}/${fileName}`, content);
        }
      }
    } catch (err) {
      console.warn(`[ShapefileExportService] Failed to create ${layerName} shapefile:`, err);
    }
  };

  // Generate shapefiles for each type
  if (points.length > 0) {
    onProgress?.(`Processing ${points.length} points...`);
    await addShapefileToZip(points, 'points');
  }

  if (lines.length > 0) {
    onProgress?.(`Processing ${lines.length} lines...`);
    await addShapefileToZip(lines, 'lines');
  }

  if (polygons.length > 0) {
    onProgress?.(`Processing ${polygons.length} polygons...`);
    await addShapefileToZip(polygons, 'polygons');
  }

  if (texts.length > 0) {
    onProgress?.(`Processing ${texts.length} text labels...`);
    await addShapefileToZip(texts, 'text');
  }

  // Generate the combined zip
  onProgress?.('Creating zip file...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // Download
  onProgress?.('Downloading...');
  downloadFile(zipBlob, `${filename}-${dateStr}.zip`);

  onProgress?.('Complete');
  return {
    points: points.length,
    lines: lines.length,
    polygons: polygons.length,
    text: texts.length
  };
}

/**
 * Export features filtered by geometry type to shapefile
 * Useful when you need to export only specific geometry types
 *
 * @param {Object} options
 * @param {Array} options.features - Array of features
 * @param {string} options.geometryType - 'point', 'polyline', or 'polygon'
 * @param {string} options.filename - Name for the exported file
 * @param {Function} options.onProgress - Optional progress callback
 */
export async function exportFeaturesByType({ features, geometryType, filename, onProgress }) {
  const filtered = features.filter(f => {
    const geom = f.geometry;
    if (!geom) return false;

    switch (geometryType) {
      case 'point':
        return geom.type === 'point' || (geom.x !== undefined && geom.y !== undefined);
      case 'polyline':
        return geom.type === 'polyline' || geom.paths;
      case 'polygon':
        return geom.type === 'polygon' || geom.rings;
      default:
        return false;
    }
  });

  if (filtered.length === 0) {
    throw new Error(`No ${geometryType} features found to export`);
  }

  return exportSearchResultsToShapefile({ features: filtered, filename, onProgress });
}

export default {
  exportSearchResultsToShapefile,
  exportMarkupsToShapefile,
  exportFeaturesByType
};
