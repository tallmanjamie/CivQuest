// src/admin/components/SpatialFilter.jsx
// Interactive Map-based Geofence Editor using @arcgis/core ES modules
// Migrated to CivQuest unified admin app
// 
// Features:
// - Drawing tools: point, polyline, polygon with SketchViewModel
// - Buffer zones: configurable distance/unit with bright green visualization
// - Reference layer support: loads ArcGIS services as dark blue overlay
// - Credential resolution: explicit props > linked ArcGIS account > anonymous
// - Saves FeatureCollection format for filter and buffer geometries
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Save, Eraser, Navigation, Loader2, Map as MapIcon, AlertTriangle, Edit, MousePointer2, Link2 } from 'lucide-react';

// Esri ES Modules - Import directly from @arcgis/core
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import Search from '@arcgis/core/widgets/Search';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import Point from '@arcgis/core/geometry/Point';
import Polyline from '@arcgis/core/geometry/Polyline';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import esriId from '@arcgis/core/identity/IdentityManager';

// Import Esri CSS
import '@arcgis/core/assets/esri/themes/light/main.css';

/**
 * SpatialFilter Component
 * 
 * Updates:
 * - Buffer, Drawing, and Edit tools grouped together in a unified toolbar.
 * - Filter Feature: Bright Blue.
 * - Buffer: Bright Green.
 * - Source Data: Dark Blue.
 * - Fixed: Initial geometry now properly displays on load when editing existing geofences.
 * - Added: Comprehensive error trapping and console logging for debugging.
 * 
 * NEW (2025-01-11): Geofence data now saved as FeatureCollection format:
 * {
 *   type: 'FeatureCollection',
 *   features: [
 *     { role: 'filter', geometry: {...} },           // User-drawn shape (always present)
 *     { role: 'buffer', geometry: {...}, bufferConfig: { distance, unit } }  // Optional buffer
 *   ]
 * }
 * 
 * This allows:
 * - 0 features: No filter (null saved)
 * - 1 feature: Filter shape only (no buffer)
 * - 2 features: Filter shape + buffer (both editable independently)
 * 
 * Backwards compatible: Still loads legacy single-geometry format.
 * 
 * NEW (2025-01-17): Support for linked ArcGIS accounts
 * - Accepts optional `linkedArcGISAccount` prop from organization settings
 * - If linked account exists and no explicit credentials passed, uses linked account
 * - Shows indicator when using linked account authentication
 */
export default function SpatialFilter({ 
  isOpen, 
  onClose, 
  onSave, 
  initialGeometry, 
  serviceUrl, 
  credentials, 
  proxyUrl,
  linkedArcGISAccount // NEW: Optional linked ArcGIS account from org settings
}) {
  const mapDiv = useRef(null);
  const viewRef = useRef(null);
  const sketchVMRef = useRef(null);
  const bufferLayerRef = useRef(null);
  const sketchLayerRef = useRef(null);
  const featureLayerRef = useRef(null);

  const [graphic, setGraphic] = useState(null);
  const [bufferConfig, setBufferConfig] = useState({ distance: 0, unit: 'miles' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasGraphic, setHasGraphic] = useState(false);
  const [usingLinkedAccount, setUsingLinkedAccount] = useState(false); // NEW: Track if using linked account
  
  const bufferConfigRef = useRef(bufferConfig);

  // ---------------------------------------------------------------------------
  // CREDENTIAL RESOLUTION
  // Determines which credentials to use: explicit props > linked account > none
  // ---------------------------------------------------------------------------
  
  const resolveCredentials = useCallback(() => {
    // If explicit credentials are provided, use those
    if (credentials?.username && credentials?.password) {
      console.log('[SpatialFilter] Using explicitly provided credentials');
      return {
        username: credentials.username,
        password: credentials.password,
        portalUrl: credentials.portalUrl || null,
        source: 'explicit'
      };
    }
    
    // If linked ArcGIS account exists, use that
    if (linkedArcGISAccount?.username && linkedArcGISAccount?.password) {
      console.log('[SpatialFilter] Using linked ArcGIS account:', linkedArcGISAccount.type);
      return {
        username: linkedArcGISAccount.username,
        password: linkedArcGISAccount.password,
        portalUrl: linkedArcGISAccount.type === 'portal' ? linkedArcGISAccount.portalUrl : null,
        source: 'linked',
        accountType: linkedArcGISAccount.type
      };
    }
    
    // No credentials available
    console.log('[SpatialFilter] No credentials available - using anonymous access');
    return null;
  }, [credentials, linkedArcGISAccount]);

  // ---------------------------------------------------------------------------
  // SYMBOLS & STYLES
  // ---------------------------------------------------------------------------

  // 1. Filter Feature Symbol - Bright Blue
  const getSymbol = useCallback((type) => {
    const brightBlue = [0, 191, 255, 0.6]; // Bright Blue Fill
    const brightBlueOutline = [0, 191, 255, 1]; // Bright Blue Outline

    if (type === 'point') {
      return new SimpleMarkerSymbol({
        style: 'circle',
        color: brightBlue,
        size: 14,
        outline: { color: [255, 255, 255, 1], width: 2 } // White halo for contrast
      });
    }
    if (type === 'polyline') {
      return new SimpleLineSymbol({
        color: brightBlueOutline,
        width: 4
      });
    }
    // Default to polygon
    return new SimpleFillSymbol({
      color: brightBlue,
      style: 'solid',
      outline: {
        color: brightBlueOutline,
        width: 3
      }
    });
  }, []);

  // 2. Buffer Symbol - Bright Green
  const applyBuffer = useCallback((sourceGraphic, dist, unit) => {
    console.log('[SpatialFilter] applyBuffer called:', { 
      hasGraphic: !!sourceGraphic, 
      distance: dist, 
      unit 
    });

    const bufferLayer = bufferLayerRef.current;
    if (!sourceGraphic || !bufferLayer) {
      console.log('[SpatialFilter] applyBuffer early exit - missing graphic or buffer layer');
      return;
    }

    bufferLayer.removeAll();

    if (!dist || dist <= 0) {
      console.log('[SpatialFilter] applyBuffer - no buffer distance, skipping');
      return;
    }

    try {
      const bufferedGeom = geometryEngine.buffer(sourceGraphic.geometry, dist, unit);
      if (!bufferedGeom) {
        console.warn('[SpatialFilter] applyBuffer - geometryEngine.buffer returned null');
        return;
      }

      const bufferGraphic = new Graphic({
        geometry: bufferedGeom,
        symbol: {
          type: 'simple-fill',
          color: [50, 255, 50, 0.3], // Bright Green Fill
          outline: { color: [0, 200, 0, 1], width: 2, style: 'solid' } // Darker Green Outline
        }
      });

      bufferLayer.add(bufferGraphic);
      console.log('[SpatialFilter] applyBuffer - buffer graphic added successfully');
    } catch (e) {
      console.error('[SpatialFilter] Buffer error:', e);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // MAP LOGIC
  // ---------------------------------------------------------------------------

  const isValidExtent = (extent) => {
    return extent && (extent.width > 0 || extent.height > 0);
  };

  // 3. Source Data Layer - Dark Blue
  const addReferenceLayer = useCallback(async (url, map, mapView, shouldZoom) => {
    console.log('[SpatialFilter] addReferenceLayer called:', { url, shouldZoom });
    
    try {
      if (featureLayerRef.current) {
        map.remove(featureLayerRef.current);
        featureLayerRef.current = null;
      }

      const layer = new FeatureLayer({
        url: url.split('?')[0],
        outFields: ['*'],
        opacity: 0.9,
        popupEnabled: true
      });

      await layer.load();
      console.log('[SpatialFilter] Reference layer loaded:', layer.title, 'geometryType:', layer.geometryType);

      // Dark Blue Color Scheme
      const darkBlue = [0, 0, 139]; 
      
      let renderer;
      if (layer.geometryType === 'point' || layer.geometryType === 'multipoint') {
        renderer = {
          type: 'simple',
          symbol: {
            type: 'simple-marker',
            style: 'circle',
            color: darkBlue,
            size: 8,
            outline: { color: [255, 255, 255, 0.8], width: 1 }
          }
        };
      } else if (layer.geometryType === 'polyline') {
        renderer = {
          type: 'simple',
          symbol: {
            type: 'simple-line',
            color: darkBlue,
            width: 2
          }
        };
      } else if (layer.geometryType === 'polygon') {
        renderer = {
          type: 'simple',
          symbol: {
            type: 'simple-fill',
            color: [...darkBlue, 0.4], // 40% opacity
            outline: { color: darkBlue, width: 2 }
          }
        };
      }

      if (renderer) {
        layer.renderer = renderer;
      }

      // Generate Popup Template
      if (layer.fields && layer.fields.length > 0) {
        const fieldInfos = layer.fields
          .filter(f => !['shape', 'objectid', 'globalid'].some(k => f.name.toLowerCase().includes(k)) && f.type !== 'geometry')
          .slice(0, 10)
          .map(f => ({ fieldName: f.name, label: f.alias || f.name }));

        layer.popupTemplate = {
          title: layer.title || 'Feature Details',
          content: [{ type: 'fields', fieldInfos: fieldInfos }],
          outFields: ['*']
        };
      }

      featureLayerRef.current = layer;
      // Add at index 1 (above buffer[0], below sketch[2])
      map.add(layer, 1);

      // Smart Zoom Logic
      if (shouldZoom) {
        try {
          const query = layer.createQuery();
          query.where = '1=1';
          const extentResult = await layer.queryExtent(query);

          if (extentResult.count > 0 && extentResult.extent && isValidExtent(extentResult.extent)) {
            await mapView.goTo(extentResult.extent.expand(1.2));
          } else if (layer.fullExtent) {
            await mapView.goTo(layer.fullExtent);
          }
        } catch (e) {
          console.warn('[SpatialFilter] Extent query failed, using fullExtent:', e);
          if (layer.fullExtent) await mapView.goTo(layer.fullExtent);
        }
      }
    } catch (e) {
      console.warn('[SpatialFilter] Could not add reference layer:', e);
    }
  }, []);

  /**
   * Helper to create a geometry object from JSON data
   */
  const createGeometryFromData = useCallback((geomData) => {
    if (!geomData) return null;
    
    // Determine geometry type
    let geomType = geomData.type?.toLowerCase();
    
    // If type is not explicitly set, infer from structure
    if (!geomType) {
      if (geomData.rings) {
        geomType = 'polygon';
      } else if (geomData.paths) {
        geomType = 'polyline';
      } else if (geomData.x !== undefined && geomData.y !== undefined) {
        geomType = 'point';
      } else {
        console.error('[SpatialFilter] Could not determine geometry type from data:', geomData);
        return null;
      }
    }

    try {
      if (geomType === 'polygon') {
        return { geometry: new Polygon(geomData), type: 'polygon' };
      } else if (geomType === 'point') {
        return { geometry: new Point(geomData), type: 'point' };
      } else if (geomType === 'polyline') {
        return { geometry: new Polyline(geomData), type: 'polyline' };
      }
    } catch (e) {
      console.error('[SpatialFilter] Failed to create geometry:', e);
    }
    return null;
  }, []);

  /**
   * Rehydrate geometry from JSON and add to sketch layer
   * Now supports FeatureCollection format with separate filter shape and buffer
   * Format: { type: 'FeatureCollection', features: [{ geometry, role: 'filter'|'buffer', bufferConfig? }] }
   */
  const rehydrateGeometry = useCallback(async (geomJson, sketchLayer, bufferLayer, mapView) => {
    console.log('[SpatialFilter] rehydrateGeometry called with:', typeof geomJson);
    
    try {
      // Parse if string
      let geomData;
      if (typeof geomJson === 'string') {
        try {
          geomData = JSON.parse(geomJson);
          console.log('[SpatialFilter] Parsed geometry JSON successfully');
        } catch (parseError) {
          console.error('[SpatialFilter] Failed to parse geometry JSON:', parseError);
          return null;
        }
      } else {
        geomData = geomJson;
      }

      // Validate geometry data
      if (!geomData) {
        console.warn('[SpatialFilter] rehydrateGeometry - geomData is null/undefined');
        return null;
      }

      // Clear existing graphics
      sketchLayer.removeAll();
      bufferLayer.removeAll();

      // Check if this is a FeatureCollection (new format with separate filter/buffer)
      if (geomData.type === 'FeatureCollection' && Array.isArray(geomData.features)) {
        console.log('[SpatialFilter] Detected FeatureCollection format with', geomData.features.length, 'features');
        
        let filterGraphic = null;
        let bufferGraphic = null;
        let loadedBufferConfig = null;

        for (const feature of geomData.features) {
          const result = createGeometryFromData(feature.geometry);
          if (!result) continue;

          if (feature.role === 'filter') {
            // This is the user-drawn filter shape
            const symbol = getSymbol(result.type);
            filterGraphic = new Graphic({ 
              geometry: result.geometry, 
              symbol: symbol 
            });
            sketchLayer.add(filterGraphic);
            console.log('[SpatialFilter] Added filter shape to sketch layer');
            
          } else if (feature.role === 'buffer') {
            // This is the buffer geometry
            bufferGraphic = new Graphic({
              geometry: result.geometry,
              symbol: {
                type: 'simple-fill',
                color: [50, 255, 50, 0.3], // Bright Green Fill
                outline: { color: [0, 200, 0, 1], width: 2, style: 'solid' }
              }
            });
            bufferLayer.add(bufferGraphic);
            console.log('[SpatialFilter] Added buffer to buffer layer');
            
            // Restore buffer config if saved
            if (feature.bufferConfig) {
              loadedBufferConfig = feature.bufferConfig;
              console.log('[SpatialFilter] Restoring buffer config:', loadedBufferConfig);
            }
          }
        }

        // Update state with filter graphic
        if (filterGraphic) {
          setGraphic(filterGraphic);
          setHasGraphic(true);
        }

        // Restore buffer config if present
        if (loadedBufferConfig) {
          setBufferConfig(loadedBufferConfig);
        }

        // Zoom to combined extent
        try {
          let zoomTarget = null;
          if (bufferGraphic?.geometry?.extent && isValidExtent(bufferGraphic.geometry.extent)) {
            zoomTarget = bufferGraphic.geometry.extent;
          } else if (filterGraphic?.geometry) {
            if (filterGraphic.geometry.type === 'point') {
              await mapView.goTo({ target: filterGraphic.geometry, zoom: 12 });
              return filterGraphic;
            } else if (filterGraphic.geometry.extent && isValidExtent(filterGraphic.geometry.extent)) {
              zoomTarget = filterGraphic.geometry.extent;
            }
          }
          
          if (zoomTarget) {
            await mapView.goTo(zoomTarget.expand(1.5));
            console.log('[SpatialFilter] Zoomed to combined extent');
          }
        } catch (zoomError) {
          console.warn('[SpatialFilter] Error zooming to geometry:', zoomError);
        }

        return filterGraphic;
      }

      // Legacy format: single geometry (backwards compatibility)
      console.log('[SpatialFilter] Detected legacy single geometry format');
      console.log('[SpatialFilter] Geometry data:', {
        type: geomData.type,
        hasRings: !!geomData.rings,
        hasPaths: !!geomData.paths,
        hasXY: !!(geomData.x !== undefined && geomData.y !== undefined),
        spatialReference: geomData.spatialReference
      });

      const result = createGeometryFromData(geomData);
      if (!result) {
        console.error('[SpatialFilter] Could not create geometry from legacy data');
        return null;
      }

      const { geometry: geom, type: geomType } = result;
      console.log('[SpatialFilter] Created geometry object:', geomType);

      // Create the graphic with appropriate symbol
      const symbol = getSymbol(geomType);
      const initialGraphic = new Graphic({ 
        geometry: geom, 
        symbol: symbol 
      });

      console.log('[SpatialFilter] Created graphic, adding to sketch layer');
      sketchLayer.add(initialGraphic);

      // Verify the graphic was added
      const graphicCount = sketchLayer.graphics.length;
      console.log('[SpatialFilter] Sketch layer now has', graphicCount, 'graphics');

      if (graphicCount === 0) {
        console.error('[SpatialFilter] Graphic was not added to sketch layer!');
        return null;
      }

      // Update state
      setGraphic(initialGraphic);
      setHasGraphic(true);

      // Zoom to the geometry
      try {
        if (geomType === 'point') {
          await mapView.goTo({ target: geom, zoom: 12 });
          console.log('[SpatialFilter] Zoomed to point');
        } else if (geom.extent && isValidExtent(geom.extent)) {
          await mapView.goTo(geom.extent.expand(1.5));
          console.log('[SpatialFilter] Zoomed to geometry extent');
        } else {
          await mapView.goTo(geom);
          console.log('[SpatialFilter] Zoomed to geometry (no valid extent)');
        }
      } catch (zoomError) {
        console.warn('[SpatialFilter] Error zooming to geometry:', zoomError);
      }

      return initialGraphic;

    } catch (error) {
      console.error('[SpatialFilter] rehydrateGeometry failed:', error);
      return null;
    }
  }, [getSymbol, createGeometryFromData]);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapDiv.current) {
      console.log('[SpatialFilter] Skipping init - isOpen:', isOpen, 'mapDiv:', !!mapDiv.current);
      return;
    }

    console.log('[SpatialFilter] Initializing map...');
    console.log('[SpatialFilter] initialGeometry present:', !!initialGeometry);
    console.log('[SpatialFilter] serviceUrl:', serviceUrl);

    let mapView = null;
    let isDestroyed = false;

    const initMap = async () => {
      setIsLoading(true);
      setError(null);
      setUsingLinkedAccount(false);

      // Variable to store token for use when creating FeatureLayer
      let arcgisToken = null;
      
      try {
        // CRITICAL: Resolve and get token BEFORE creating any layers
        const resolvedCreds = resolveCredentials();
        
        if (serviceUrl && resolvedCreds && proxyUrl) {
          console.log('[SpatialFilter] Attempting token registration with', resolvedCreds.source, 'credentials...');
          
          // Track if using linked account
          if (resolvedCreds.source === 'linked') {
            setUsingLinkedAccount(true);
          }
          
          try {
            const response = await fetch(`${proxyUrl}/api/arcgis/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceUrl: serviceUrl,
                username: resolvedCreds.username,
                password: resolvedCreds.password,
                // Include portal URL for Portal authentication
                portalUrl: resolvedCreds.portalUrl || null
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.token) {
                arcgisToken = data.token;
                
                // Extract server URL for IdentityManager
                const urlObj = new URL(serviceUrl);
                const pathLower = urlObj.pathname.toLowerCase();
                const restIndex = pathLower.indexOf('/rest/services');
                const serverUrl = restIndex !== -1 
                  ? `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.substring(0, restIndex)}`
                  : `${urlObj.protocol}//${urlObj.host}`;

                console.log('[SpatialFilter] Registering token for:', serverUrl);
                
                // Register with IdentityManager
                esriId.registerToken({
                  server: serverUrl,
                  token: data.token,
                  expires: data.expires || (Date.now() + 3600000)
                });
                
                // Also register for the full service URL path
                esriId.registerToken({
                  server: serviceUrl.split('?')[0],
                  token: data.token,
                  expires: data.expires || (Date.now() + 3600000)
                });
                
                console.log('[SpatialFilter] Token registered successfully via', resolvedCreds.source, 'credentials');
              }
            } else {
              console.warn('[SpatialFilter] Token request failed:', response.status);
              if (resolvedCreds.source === 'linked') {
                console.warn('[SpatialFilter] Linked account authentication failed - credentials may need to be updated');
              }
            }
          } catch (tokenErr) {
            console.warn('[SpatialFilter] Token registration failed:', tokenErr.message);
          }
        }

        // Create graphics layers
        const bufferLayer = new GraphicsLayer({ title: 'Buffer Layer', listMode: 'hide' });
        const sketchLayer = new GraphicsLayer({ title: 'Sketch Layer', listMode: 'hide' });

        bufferLayerRef.current = bufferLayer;
        sketchLayerRef.current = sketchLayer;

        console.log('[SpatialFilter] Created graphics layers');

        // Create map
        const map = new Map({
          basemap: 'gray-vector',
          layers: [bufferLayer, sketchLayer]
        });

        // Create map view
        mapView = new MapView({
          container: mapDiv.current,
          map: map,
          center: [-98, 38],
          zoom: 4,
          popup: {
            dockEnabled: true,
            dockOptions: { buttonEnabled: false, breakpoint: false, position: 'bottom-right' }
          }
        });

        await mapView.when();
        
        if (isDestroyed) { 
          console.log('[SpatialFilter] Map destroyed before init complete');
          mapView.destroy(); 
          return; 
        }
        
        viewRef.current = mapView;
        console.log('[SpatialFilter] MapView ready');

        // Add search widget
        const search = new Search({ view: mapView });
        mapView.ui.add(search, 'top-right');

        // Create sketch view model
        const sketch = new SketchViewModel({
          view: mapView,
          layer: sketchLayer,
          pointSymbol: getSymbol('point'),
          polylineSymbol: getSymbol('polyline'),
          polygonSymbol: getSymbol('polygon'),
          updateOnGraphicClick: false,
          defaultUpdateOptions: { tool: 'reshape', toggleToolOnClick: false }
        });

        sketch.on('create', (event) => {
          console.log('[SpatialFilter] Sketch create event:', event.state);
          if (event.state === 'complete') {
            setGraphic(event.graphic);
            setHasGraphic(true);
            setActiveTool(null);
            const config = bufferConfigRef.current;
            applyBuffer(event.graphic, config.distance, config.unit);
          }
        });

        sketch.on('update', (event) => {
          console.log('[SpatialFilter] Sketch update event:', event.state);
          if (event.state === 'active' || event.state === 'complete') {
            const updatedGraphic = event.graphics[0];
            if (updatedGraphic) {
              setGraphic(updatedGraphic);
              const config = bufferConfigRef.current;
              applyBuffer(updatedGraphic, config.distance, config.unit);
            }
          }
        });

        sketchVMRef.current = sketch;
        console.log('[SpatialFilter] SketchViewModel created');

        // Determine if we have initial geometry (for zoom logic)
        let hasInitialGeom = false;
        if (initialGeometry) {
          try {
            const geomData = typeof initialGeometry === 'string' 
              ? JSON.parse(initialGeometry) 
              : initialGeometry;
            hasInitialGeom = !!(geomData && (geomData.type || geomData.rings || geomData.paths || geomData.x !== undefined));
            console.log('[SpatialFilter] Has valid initial geometry:', hasInitialGeom);
          } catch (e) {
            console.warn('[SpatialFilter] Could not parse initialGeometry for validation:', e);
          }
        }

        // Add reference layer (don't zoom if we have initial geometry)
        if (serviceUrl) {
          // If we have a token, create the layer inline with the token appended to URL
          if (arcgisToken) {
            console.log('[SpatialFilter] Creating authenticated FeatureLayer...');
            try {
              if (featureLayerRef.current) {
                map.remove(featureLayerRef.current);
                featureLayerRef.current = null;
              }
              
              // Append token to URL for authenticated access
              const baseUrl = serviceUrl.split('?')[0];
              const layer = new FeatureLayer({
                url: `${baseUrl}?token=${arcgisToken}`,
                outFields: ['*'],
                opacity: 0.9,
                popupEnabled: true
              });

              await layer.load();
              console.log('[SpatialFilter] Authenticated layer loaded:', layer.title, 'geometryType:', layer.geometryType);

              // Dark Blue Color Scheme
              const darkBlue = [0, 0, 139]; 
              
              let renderer;
              if (layer.geometryType === 'point' || layer.geometryType === 'multipoint') {
                renderer = {
                  type: 'simple',
                  symbol: {
                    type: 'simple-marker',
                    style: 'circle',
                    color: darkBlue,
                    size: 8,
                    outline: { color: [255, 255, 255, 0.8], width: 1 }
                  }
                };
              } else if (layer.geometryType === 'polyline') {
                renderer = {
                  type: 'simple',
                  symbol: {
                    type: 'simple-line',
                    color: darkBlue,
                    width: 2
                  }
                };
              } else if (layer.geometryType === 'polygon') {
                renderer = {
                  type: 'simple',
                  symbol: {
                    type: 'simple-fill',
                    color: [...darkBlue, 0.4],
                    outline: { color: darkBlue, width: 2 }
                  }
                };
              }

              if (renderer) {
                layer.renderer = renderer;
              }

              // Generate Popup Template from layer fields
              if (layer.fields && layer.fields.length > 0) {
                const fieldInfos = layer.fields
                  .filter(f => !['shape', 'objectid', 'globalid'].some(k => f.name.toLowerCase().includes(k)) && f.type !== 'geometry')
                  .slice(0, 10)
                  .map(f => ({ fieldName: f.name, label: f.alias || f.name }));

                layer.popupTemplate = {
                  title: layer.title || 'Feature Details',
                  content: [{ type: 'fields', fieldInfos: fieldInfos }],
                  outFields: ['*']
                };
              }

              featureLayerRef.current = layer;
              map.add(layer, 1);

              // Zoom if needed
              if (!hasInitialGeom) {
                try {
                  const query = layer.createQuery();
                  query.where = '1=1';
                  const extentResult = await layer.queryExtent(query);
                  if (extentResult.count > 0 && extentResult.extent && isValidExtent(extentResult.extent)) {
                    await mapView.goTo(extentResult.extent.expand(1.2));
                  } else if (layer.fullExtent) {
                    await mapView.goTo(layer.fullExtent);
                  }
                } catch (e) {
                  console.warn('[SpatialFilter] Extent query failed:', e);
                  if (layer.fullExtent) await mapView.goTo(layer.fullExtent);
                }
              }
            } catch (e) {
              console.warn('[SpatialFilter] Could not add authenticated reference layer:', e);
            }
          } else {
            // No token, use the regular callback for anonymous services
            await addReferenceLayer(serviceUrl, map, mapView, !hasInitialGeom);
          }
        }

        // CRITICAL: Rehydrate existing geometry AFTER the map is fully ready
        if (initialGeometry) {
          console.log('[SpatialFilter] Starting geometry rehydration...');
          
          // Small delay to ensure the map is fully rendered
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const rehydratedGraphic = await rehydrateGeometry(initialGeometry, sketchLayer, bufferLayer, mapView);
          
          if (rehydratedGraphic) {
            console.log('[SpatialFilter] Geometry rehydrated successfully');
          } else {
            console.warn('[SpatialFilter] Geometry rehydration returned null');
          }
        }

        setIsLoading(false);
        setIsMapReady(true);
        console.log('[SpatialFilter] Map initialization complete');

      } catch (err) {
        console.error('[SpatialFilter] Map init error:', err);
        setError('Failed to load map: ' + err.message);
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      console.log('[SpatialFilter] Cleanup - destroying map view');
      isDestroyed = true;
      if (viewRef.current) { 
        viewRef.current.destroy(); 
        viewRef.current = null; 
      }
      sketchVMRef.current = null;
    };
  }, [isOpen, initialGeometry, serviceUrl, getSymbol, applyBuffer, addReferenceLayer, rehydrateGeometry, createGeometryFromData, resolveCredentials, proxyUrl]);

  // Update buffer when config changes
  useEffect(() => {
    bufferConfigRef.current = bufferConfig;
    if (graphic && isMapReady) {
      console.log('[SpatialFilter] Buffer config changed, reapplying buffer');
      applyBuffer(graphic, bufferConfig.distance, bufferConfig.unit);
    }
  }, [bufferConfig, graphic, isMapReady, applyBuffer]);

  // Tools
  const startTool = (tool) => {
    console.log('[SpatialFilter] Starting tool:', tool);
    const sketch = sketchVMRef.current;
    if (!sketch) {
      console.warn('[SpatialFilter] Cannot start tool - sketchVM not ready');
      return;
    }
    
    sketchLayerRef.current?.removeAll();
    bufferLayerRef.current?.removeAll();
    setGraphic(null);
    setHasGraphic(false);
    setActiveTool(tool);
    sketch.create(tool);
  };

  const startEdit = () => {
    console.log('[SpatialFilter] Starting edit mode');
    const sketch = sketchVMRef.current;
    const sketchLayer = sketchLayerRef.current;
    
    if (!sketch || !sketchLayer || sketchLayer.graphics.length === 0) {
      console.warn('[SpatialFilter] Cannot start edit - no graphic to edit');
      return;
    }
    
    const graphicToEdit = sketchLayer.graphics.getItemAt(0);
    console.log('[SpatialFilter] Editing graphic:', graphicToEdit.geometry?.type);
    sketch.update([graphicToEdit], { tool: 'reshape' });
  };

  const handleClear = () => {
    console.log('[SpatialFilter] Clearing all graphics');
    sketchVMRef.current?.cancel();
    sketchLayerRef.current?.removeAll();
    bufferLayerRef.current?.removeAll();
    setGraphic(null);
    setHasGraphic(false);
    setActiveTool(null);
    setBufferConfig(prev => ({ ...prev, distance: 0 }));
  };

  const handleSave = () => {
    console.log('[SpatialFilter] handleSave called');
    
    const sourceGraphic = sketchLayerRef.current?.graphics.getItemAt(0) || graphic;
    
    if (!sourceGraphic) {
      console.log('[SpatialFilter] No graphic to save, calling onSave(null)');
      onSave(null); 
      onClose(); 
      return;
    }

    const filterGeometry = sourceGraphic.geometry;
    console.log('[SpatialFilter] Source geometry type:', filterGeometry?.type);
    
    // Build FeatureCollection with filter shape and optional buffer
    const featureCollection = {
      type: 'FeatureCollection',
      features: []
    };

    // Add the filter shape
    featureCollection.features.push({
      role: 'filter',
      geometry: filterGeometry.toJSON()
    });

    // Add buffer if present
    if (bufferConfig.distance > 0) {
      try {
        const bufferedGeom = geometryEngine.buffer(filterGeometry, bufferConfig.distance, bufferConfig.unit);
        if (bufferedGeom) {
          featureCollection.features.push({
            role: 'buffer',
            geometry: bufferedGeom.toJSON(),
            bufferConfig: { distance: bufferConfig.distance, unit: bufferConfig.unit }
          });
        }
      } catch (e) {
        console.error('[SpatialFilter] Error creating buffer for save:', e);
      }
    }

    console.log('[SpatialFilter] Saving FeatureCollection with', featureCollection.features.length, 'features');
    // IMPORTANT: Stringify the FeatureCollection to avoid Firebase "nested arrays" error
    // Firebase Firestore does not support nested arrays, and geometry data (rings, paths) contains nested arrays
    // The rehydrateGeometry function already handles JSON string parsing, so this is backwards compatible
    onSave(JSON.stringify(featureCollection));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <MapIcon className="w-6 h-6 text-[#004E7C]" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Spatial Filter</h2>
              <p className="text-xs text-slate-500">Draw a shape to filter notifications by location</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>

        {/* Consolidated Toolbar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
            
            {/* Left Group: Creation & Buffer Tools */}
            <div className="flex items-center gap-4">
              
              {/* Drawing Tools Group */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 select-none">Draw</span>
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                
                <button
                  onClick={() => startTool('point')}
                  className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${
                    activeTool === 'point'
                      ? 'bg-white shadow text-[#004E7C] ring-1 ring-[#004E7C]/20'
                      : 'text-slate-600 hover:bg-white hover:text-[#004E7C]'
                  }`}
                  title="Draw a Point"
                >
                  <div className="w-3 h-3 rounded-full border-2 border-current"></div>
                </button>
                
                <button
                  onClick={() => startTool('polyline')}
                  className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${
                    activeTool === 'polyline'
                      ? 'bg-white shadow text-[#004E7C] ring-1 ring-[#004E7C]/20'
                      : 'text-slate-600 hover:bg-white hover:text-[#004E7C]'
                  }`}
                  title="Draw a Line"
                >
                   <div className="w-3 h-3 border-b-2 border-l-2 border-current transform rotate-45"></div>
                </button>
                
                <button
                  onClick={() => startTool('polygon')}
                  className={`p-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all ${
                    activeTool === 'polygon'
                      ? 'bg-white shadow text-[#004E7C] ring-1 ring-[#004E7C]/20'
                      : 'text-slate-600 hover:bg-white hover:text-[#004E7C]'
                  }`}
                  title="Draw a Polygon"
                >
                  <div className="w-3 h-3 border-2 border-current bg-current/20"></div>
                </button>
              </div>

              {/* Buffer Tools Group */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 select-none">Buffer</span>
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                
                <div className="flex items-center gap-2 px-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={bufferConfig.distance}
                    onChange={(e) => setBufferConfig(prev => ({...prev, distance: parseFloat(e.target.value) || 0}))}
                    className="w-16 px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#004E7C]/20 focus:border-[#004E7C] text-right"
                  />
                  <select
                    value={bufferConfig.unit}
                    onChange={(e) => setBufferConfig(prev => ({ ...prev, unit: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004E7C]/20 focus:border-[#004E7C]"
                  >
                    <option value="miles">Miles</option>
                    <option value="feet">Feet</option>
                    <option value="kilometers">km</option>
                    <option value="meters">m</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Right Group: Actions */}
            <div className="flex items-center gap-2">
               {hasGraphic && (
                <button
                  onClick={startEdit}
                  className="text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
                >
                  <Edit className="w-4 h-4" /> Edit Shape
                </button>
              )}
              
              <button
                onClick={handleClear}
                className="text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
                title="Clear all graphics"
              >
                <Eraser className="w-4 h-4" /> Clear
              </button>
            </div>

          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-slate-200">
          <div ref={mapDiv} className="w-full h-full" />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 text-slate-500 gap-3 backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 animate-spin text-[#004E7C]" />
              <span className="text-sm font-semibold tracking-wide">INITIALIZING MAP...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20 text-red-600 gap-2 p-6 text-center">
              <AlertTriangle className="w-12 h-12" />
              <span className="text-lg font-bold">Map Error</span>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {/* Legend Overlay */}
          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-slate-200 text-xs space-y-2 z-0 max-w-[200px]">
            <div className="font-semibold text-slate-700 border-b border-slate-200 pb-1 mb-1">Layer Legend</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[rgba(0,191,255,0.6)] border-2 border-[rgb(0,191,255)] rounded-sm"></div>
              <span>Filter Shape</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[rgba(50,255,50,0.3)] border-2 border-[rgb(0,200,0)] rounded-sm"></div>
              <span>Buffer Zone</span>
            </div>
            {serviceUrl && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[rgba(0,0,139,0.4)] border-2 border-[rgb(0,0,139)] rounded-sm"></div>
                <span>Source Data</span>
              </div>
            )}
          </div>

          {/* NEW: Linked Account Indicator */}
          {usingLinkedAccount && (
            <div className="absolute top-4 left-4 bg-green-50 border border-green-200 text-green-800 px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium flex items-center gap-1.5 z-10">
              <Link2 className="w-3.5 h-3.5" />
              Using linked ArcGIS account
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-500 flex items-center gap-2 flex-1 mr-4">
            {serviceUrl && (
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="font-medium text-slate-600 shrink-0">Reference:</span>
                <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded truncate border border-slate-300" title={serviceUrl}>
                  {serviceUrl}
                </span>
                <button
                  onClick={() => viewRef.current && addReferenceLayer(serviceUrl, viewRef.current.map, viewRef.current, true)}
                  className="hover:bg-white hover:text-[#004E7C] p-1.5 rounded-md border border-transparent hover:border-slate-200 text-slate-400 transition-all shrink-0"
                  title="Zoom to Source Extent"
                >
                  <Navigation className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-[#004E7C] text-white rounded-lg font-medium text-sm hover:bg-[#003B5C] flex items-center gap-2 shadow-sm hover:shadow transition-all"
            >
              <Save className="w-4 h-4" /> 
              {bufferConfig.distance > 0 ? 'Apply Filter & Buffer' : 'Apply Filter'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}