// src/atlas/components/MapView.jsx
// CivQuest Atlas - Map View Component
// ArcGIS WebMap integration with results layer and modern tool components

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Home,
  X,
  Loader2,
  Menu,
  Search,
  Pencil,
  Layers,
  Globe,
  Printer,
  ChevronRight,
  Navigation,
  HelpCircle
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors, COLOR_PALETTE } from '../utils/themeColors';

// Tool Components
import SearchResultsPanel from './SearchResultsPanel';
import FeatureInfoPanel from './FeatureInfoPanel';
import LayersPanel from './LayersPanel';
import BasemapPicker from './BasemapPicker';
import MapExportTool from './MapExportTool';
import MarkupTool from './MarkupTool';
import MarkupPopup from './MarkupPopup';

// ArcGIS ES Modules
import WebMap from '@arcgis/core/WebMap';
import EsriMapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import Extent from '@arcgis/core/geometry/Extent';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

// Layer IDs
const RESULTS_LAYER_ID = 'atlas-results-layer';
const HIGHLIGHT_LAYER_ID = 'atlas-highlight-layer';
const PUSHPIN_LAYER_ID = 'atlas-pushpin-layer';
const MARKUP_LAYER_ID = 'atlas-markup-layer';
const GPS_LAYER_ID = 'atlas-gps-layer';
const NEARBY_BUFFER_LAYER_ID = 'atlas-nearby-buffer-layer';

// Import Feature Export Service
import { exportFeatureToPDF } from '../utils/FeatureExportService';

/**
 * MapView Component
 * Renders ArcGIS WebMap with search results overlay and integrated tool panels
 */
const MapView = forwardRef(function MapView(props, ref) {
  const {
    config,
    activeMap,
    activeMapIndex,
    setActiveMap,
    availableMaps,
    searchResults,
    searchLocation,
    updateSearchResults,
    isSearching,
    zoomToFeature: contextZoomToFeature,
    highlightFeature: contextHighlightFeature,
    setShowHelpPanel,
    chatViewRef
  } = useAtlas();

  // Refs
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const mapRef = useRef(null);
  const graphicsLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const pushpinLayerRef = useRef(null);
  const markupLayerRef = useRef(null);
  const nearbyBufferLayerRef = useRef(null);
  const markupToolRef = useRef(null);
  const mountedRef = useRef(true);
  const initStartedRef = useRef(false);
  const originalPopupEnabledRef = useRef(new Map()); // Store original popupEnabled state for each layer
  const searchResultsRef = useRef(null); // Track current searchResults to avoid stale closure in click handler

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Feature Panel State
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedFeatureLayer, setSelectedFeatureLayer] = useState(null);
  const [relatedFeatures, setRelatedFeatures] = useState([]);
  const [currentRelatedIndex, setCurrentRelatedIndex] = useState(0);
  const [isMarkupFeature, setIsMarkupFeature] = useState(false);

  // Markup Popup State
  const [selectedMarkup, setSelectedMarkup] = useState(null);
  const [showMarkupPopup, setShowMarkupPopup] = useState(false);
  const [markupPopupWidth, setMarkupPopupWidth] = useState(400);
  const [isEditingMarkup, setIsEditingMarkup] = useState(false);
  const [markupRefreshKey, setMarkupRefreshKey] = useState(0);

  // Tool Panel States
  const [showFeaturePanel, setShowFeaturePanel] = useState(false);
  const [featurePanelWidth, setFeaturePanelWidth] = useState(400);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const [showMapExport, setShowMapExport] = useState(false);
  const [showMarkupTool, setShowMarkupTool] = useState(false);

  // Nearby Search state - track buffer for converting to markup
  const [nearbyBufferGeometry, setNearbyBufferGeometry] = useState(null);
  const [nearbySearchInfo, setNearbySearchInfo] = useState(null);

  // PDF Export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportPDFProgress, setExportPDFProgress] = useState('');

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const toolsMenuRef = useRef(null);

  // GPS Location state
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsTracking, setGpsTracking] = useState(false); // Continuous tracking mode
  const [gpsTrackingInterval, setGpsTrackingInterval] = useState(5000); // Default 5 seconds
  const [showGpsSettings, setShowGpsSettings] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const gpsIntervalRef = useRef(null);
  const gpsLayerRef = useRef(null);
  const gpsWatchIdRef = useRef(null);

  // Theme
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Map Tools Position and Layout Configuration
  const mapToolsPosition = config?.ui?.mapToolsPosition || 'upper-left';
  const mapToolsLayout = config?.ui?.mapToolsLayout || 'stacked';

  // Compute position classes based on config
  const getToolsPositionClasses = useCallback(() => {
    const baseClasses = 'absolute z-20';
    const layoutClasses = mapToolsLayout === 'horizontal' ? 'flex-row' : 'flex-col';

    let positionClasses;
    switch (mapToolsPosition) {
      case 'center':
        positionClasses = 'top-4 left-1/2 -translate-x-1/2';
        break;
      case 'lower-left':
        positionClasses = 'bottom-4 left-4';
        break;
      case 'lower-center':
        positionClasses = 'bottom-4 left-1/2 -translate-x-1/2';
        break;
      case 'upper-left':
      default:
        positionClasses = 'top-4 left-4';
        break;
    }

    return `${baseClasses} ${positionClasses} flex ${layoutClasses} gap-2`;
  }, [mapToolsPosition, mapToolsLayout]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close tools menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
        setShowToolsMenu(false);
      }
    };

    if (showToolsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showToolsMenu]);

  // Keep searchResultsRef in sync to avoid stale closure in click handler
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  /**
   * Get storage key for persisting map extent
   */
  const getExtentStorageKey = useCallback(() => {
    return `atlas_extent_${config?.id || 'default'}_${activeMapIndex || 0}`;
  }, [config?.id, activeMapIndex]);

  /**
   * Get center point from geometry
   */
  const getGeometryCenter = useCallback((geometry) => {
    if (!geometry) return null;
    
    if (geometry.x !== undefined && geometry.y !== undefined) {
      return { x: geometry.x, y: geometry.y };
    }
    
    if (geometry.rings && geometry.rings.length > 0) {
      const ring = geometry.rings[0];
      let sumX = 0, sumY = 0;
      for (const point of ring) {
        sumX += point[0];
        sumY += point[1];
      }
      return { x: sumX / ring.length, y: sumY / ring.length };
    }
    
    if (geometry.paths && geometry.paths.length > 0) {
      const path = geometry.paths[0];
      const midIndex = Math.floor(path.length / 2);
      return { x: path[midIndex][0], y: path[midIndex][1] };
    }
    
    if (geometry.extent) {
      return { x: geometry.extent.center.x, y: geometry.extent.center.y };
    }
    
    return null;
  }, []);

  /**
   * Initialize ArcGIS Map
   */
  useEffect(() => {
    if (!containerRef.current || !activeMap?.webMap?.itemId) {
      return;
    }

    if (initStartedRef.current) {
      return;
    }

    if (viewRef.current) {
      return;
    }

    initStartedRef.current = true;
    mountedRef.current = true;

    const initializeMap = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[MapView] Initializing map with ES modules...');

        // Try to restore saved extent
        let initialExtent = null;
        try {
          const saved = localStorage.getItem(getExtentStorageKey());
          if (saved) {
            const extentJson = JSON.parse(saved);
            initialExtent = Extent.fromJSON(extentJson);
          }
        } catch (e) {
          console.warn('[MapView] Could not restore extent:', e);
        }

        if (!mountedRef.current || !containerRef.current) {
          console.log('[MapView] Component unmounted before map creation');
          return;
        }

        console.log('[MapView] Creating WebMap...');

        // Create WebMap
        const webMap = new WebMap({
          portalItem: { 
            id: activeMap.webMap.itemId,
            portal: { url: activeMap.webMap.portalUrl || 'https://www.arcgis.com' }
          }
        });

        mapRef.current = webMap;

        // Create graphics layers
        const graphicsLayer = new GraphicsLayer({
          id: RESULTS_LAYER_ID,
          title: 'Search Results',
          listMode: 'hide'
        });

        const highlightLayer = new GraphicsLayer({
          id: HIGHLIGHT_LAYER_ID,
          title: 'Highlight',
          listMode: 'hide'
        });

        const pushpinLayer = new GraphicsLayer({
          id: PUSHPIN_LAYER_ID,
          title: 'Result Markers',
          listMode: 'hide'
        });

        const markupLayer = new GraphicsLayer({
          id: MARKUP_LAYER_ID,
          title: 'Markup',
          listMode: 'hide'
        });

        const gpsLayer = new GraphicsLayer({
          id: GPS_LAYER_ID,
          title: 'GPS Location',
          listMode: 'hide'
        });

        const nearbyBufferLayer = new GraphicsLayer({
          id: NEARBY_BUFFER_LAYER_ID,
          title: 'Nearby Search Buffer',
          listMode: 'hide'
        });

        graphicsLayerRef.current = graphicsLayer;
        highlightLayerRef.current = highlightLayer;
        pushpinLayerRef.current = pushpinLayer;
        markupLayerRef.current = markupLayer;
        gpsLayerRef.current = gpsLayer;
        nearbyBufferLayerRef.current = nearbyBufferLayer;

        if (!mountedRef.current || !containerRef.current) {
          console.log('[MapView] Component unmounted before view creation');
          return;
        }

        console.log('[MapView] Creating MapView...');

        // Create MapView with popup DISABLED (we use FeatureInfoPanel instead)
        const view = new EsriMapView({
          container: containerRef.current,
          map: webMap,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          constraints: {
            rotationEnabled: false // Disable map rotation
          },
          ui: {
            components: ['attribution']
          },
          popup: {
            autoOpenEnabled: false, // Disable default popup - we use FeatureInfoPanel
            dockEnabled: false,
            collapseEnabled: false
          }
        });

        // Ensure popup is fully disabled - close it if it opens and prevent auto-open
        view.popup.autoOpenEnabled = false;
        view.popup.visible = false;
        console.log('[MapView] Popup disabled - autoOpenEnabled:', view.popup.autoOpenEnabled);

        viewRef.current = view;

        console.log('[MapView] Waiting for map to load...');
        await view.when();

        if (!mountedRef.current) {
          console.log('[MapView] Component unmounted after view.when()');
          view.destroy();
          return;
        }

        console.log('[MapView] Map loaded, adding layers...');

        // Add graphics layers (GPS on top, then markup, then pushpins, then highlight, then nearby buffer, then results)
        webMap.addMany([graphicsLayer, nearbyBufferLayer, highlightLayer, pushpinLayer, markupLayer, gpsLayer]);

        // Apply saved extent
        if (initialExtent) {
          view.extent = initialExtent;
        }

        // Add scale bar
        const scaleBar = new ScaleBar({
          view: view,
          unit: 'dual'
        });
        view.ui.add(scaleBar, 'bottom-left');

        // Watch for popup opening and close it immediately (belt and suspenders approach)
        reactiveUtils.watch(
          () => view.popup?.visible,
          (visible) => {
            if (visible) {
              console.log('[MapView] Popup attempted to open - closing it');
              // Safe close: prioritize visible = false
              if (view.popup) {
                view.popup.visible = false;
                // Only call close if it's a function (sometimes checking if it exists is safer)
                if (typeof view.popup.close === 'function') {
                  try {
                    view.popup.close();
                  } catch (e) {
                    // Ignore close error if not ready
                  }
                }
              }
            }
          }
        );

        // Store original popupEnabled state and disable popup on all operational layers
        // We use FeatureInfoPanel instead of native popup, but need to know which layers
        // should show popup based on webmap configuration
        originalPopupEnabledRef.current.clear();
        webMap.allLayers.forEach(layer => {
          if (layer.popupEnabled !== undefined) {
            // Store original state before disabling
            originalPopupEnabledRef.current.set(layer.id, layer.popupEnabled);
            console.log('[MapView] Layer popup config:', layer.id, layer.title, 'enabled:', layer.popupEnabled);
            layer.popupEnabled = false;
          }
        });

        // Watch for new layers being added and disable their popups (but store original state)
        webMap.allLayers.on('change', (event) => {
          if (event.added) {
            event.added.forEach(layer => {
              if (layer.popupEnabled !== undefined) {
                // Store original state before disabling
                originalPopupEnabledRef.current.set(layer.id, layer.popupEnabled);
                console.log('[MapView] New layer popup config:', layer.id, layer.title, 'enabled:', layer.popupEnabled);
                layer.popupEnabled = false;
              }
            });
          }
        });

        // Save extent on view change
        reactiveUtils.when(
          () => view.stationary === true,
          () => {
            if (view.extent && mountedRef.current) {
              try {
                localStorage.setItem(getExtentStorageKey(), JSON.stringify(view.extent.toJSON()));
              } catch (e) {}
            }
          }
        );

        // Handle map clicks
        view.on('click', handleMapClick);

        console.log('[MapView] Map initialization complete');
        setMapReady(true);
        setIsLoading(false);

      } catch (err) {
        console.error('[MapView] Map initialization error:', err);
        setError(err.message || 'Failed to load map');
        setIsLoading(false);
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      mountedRef.current = false;
      // Clear GPS tracking
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      if (gpsWatchIdRef.current) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      mapRef.current = null;
      graphicsLayerRef.current = null;
      highlightLayerRef.current = null;
      pushpinLayerRef.current = null;
      markupLayerRef.current = null;
      gpsLayerRef.current = null;
      initStartedRef.current = false;
    };
  }, [activeMap?.webMap?.itemId, getExtentStorageKey]);

  /**
   * Handle map click events
   */
  const handleMapClick = useCallback(async (event) => {
    if (!viewRef.current) return;

    // DEBUG: Click detected
    console.log('[MapView] Click detected at:', event.mapPoint);

    // Force close the Esri popup on every click with safety checks
    if (viewRef.current.popup) {
      viewRef.current.popup.visible = false;
      if (typeof viewRef.current.popup.close === 'function') {
        try {
          viewRef.current.popup.close();
        } catch (e) {
          // Ignore close errors if popup is not fully initialized
        }
      }
    }

    try {
      const response = await viewRef.current.hitTest(event);
      console.log('[MapView] HitTest results:', response.results);
      
      // Check for graphics layer hits (search results, pushpins, markup)
      const graphicHits = response.results.filter(r => 
        r.graphic && (
          r.graphic.layer === graphicsLayerRef.current || 
          r.graphic.layer === pushpinLayerRef.current ||
          r.graphic.layer === markupLayerRef.current
        )
      );
      
      if (graphicHits.length > 0) {
        const clickedGraphic = graphicHits[0].graphic;

        // Check if it's a markup feature - open MarkupPopup instead of FeatureInfoPanel
        if (clickedGraphic.layer === markupLayerRef.current) {
          // Skip label graphics
          if (clickedGraphic.attributes?.isLabel) {
            return;
          }

          // Close any open feature panel
          setShowFeaturePanel(false);
          setSelectedFeature(null);
          setIsMarkupFeature(false);

          // Open markup popup
          setSelectedMarkup(clickedGraphic);
          setShowMarkupPopup(true);

          // Check if this markup is currently being edited
          const isEditing = markupToolRef.current?.editingMarkup?.attributes?.id === clickedGraphic.attributes?.id;
          setIsEditingMarkup(isEditing);

          // Highlight the markup
          highlightFeature({ geometry: clickedGraphic.geometry, attributes: clickedGraphic.attributes }, clickedGraphic);
          return;
        }

        // Handle search result click - use ref to avoid stale closure
        const featureIndex = clickedGraphic.attributes?._index;
        const currentSearchResults = searchResultsRef.current;
        if (featureIndex !== undefined && currentSearchResults?.features) {
          const feature = currentSearchResults.features[featureIndex];
          if (feature) {
            // Try to find the source layer for custom popup support
            const customLayerId = activeMap?.customFeatureInfo?.layerId;
            let sourceLayer = null;
            if (customLayerId && mapRef.current) {
              sourceLayer = mapRef.current.allLayers?.find(l => l.id === customLayerId);
            }
            // Add the layer ID to the feature for FeatureInfoPanel
            const enrichedFeature = sourceLayer ? {
              ...feature,
              sourceLayerId: customLayerId
            } : feature;
            // Highlight feature using the cloned graphic if available
            handleFeatureSelect(enrichedFeature, clickedGraphic, sourceLayer);
          }
        }
        return;
      }

      // Check for operational layer hits - only include layers that have popup enabled in webmap
      const layerHits = response.results.filter(r => {
        if (!r.graphic || !r.graphic.layer) return false;

        const layerId = r.graphic.layer.id;
        // Exclude our internal layers
        if (layerId === RESULTS_LAYER_ID ||
            layerId === HIGHLIGHT_LAYER_ID ||
            layerId === PUSHPIN_LAYER_ID ||
            layerId === MARKUP_LAYER_ID) {
          return false;
        }

        // Only show popup for layers that have popupEnabled in the webmap configuration
        const originalPopupEnabled = originalPopupEnabledRef.current.get(layerId);
        if (originalPopupEnabled === true) {
          console.log(`[MapView] Layer hit with popup enabled: ${layerId}`);
          return true;
        }

        console.log(`[MapView] Skipping layer hit (popup disabled in webmap): ${layerId}`);
        return false;
      });

      if (layerHits.length > 0) {
        const hit = layerHits[0];
        console.log('[MapView] Selected feature from layer:', hit.graphic.layer.title);

        // Ensure we pass the geometry in a usable format (JSON with attributes)
        // If geometry is missing, we rely on the graphic's geometry
        const feature = {
          geometry: hit.graphic.geometry?.toJSON?.() || hit.graphic.geometry,
          attributes: hit.graphic.attributes || {},
          sourceLayerId: hit.graphic.layer?.id
        };

        // Pass the raw graphic as well so we can use it for exact geometry references
        handleFeatureSelect(feature, hit.graphic, hit.graphic.layer);
      } else {
        console.log('[MapView] No valid layer hits found.');
      }
      
    } catch (err) {
      console.warn('[MapView] Click handler error:', err);
    }
  }, [activeMap]); // Note: searchResults accessed via ref to avoid stale closure

  /**
   * Handle feature selection (opens FeatureInfoPanel)
   */
  const handleFeatureSelect = useCallback((feature, graphic = null, layer = null) => {
    // If no layer provided, try to find the custom feature layer
    let resolvedLayer = layer;
    let enrichedFeature = feature;

    if (!layer && activeMap?.customFeatureInfo?.layerId && mapRef.current) {
      const customLayerId = activeMap.customFeatureInfo.layerId;
      resolvedLayer = mapRef.current.allLayers?.find(l => l.id === customLayerId);
      if (resolvedLayer) {
        enrichedFeature = {
          ...feature,
          sourceLayerId: customLayerId
        };
      }
    }

    // Close any open markup popup
    setShowMarkupPopup(false);
    setSelectedMarkup(null);
    setIsEditingMarkup(false);

    setSelectedFeature(enrichedFeature);
    setSelectedFeatureLayer(resolvedLayer);
    setIsMarkupFeature(false);
    setShowFeaturePanel(true);

    // Highlight the feature - Pass the graphic explicitly!
    highlightFeature(feature, graphic);

    // Query for related features if configured
    queryRelatedFeatures(feature, graphic);
  }, [activeMap?.customFeatureInfo?.layerId]);

  /**
   * Query related features based on config
   */
  const queryRelatedFeatures = useCallback(async (feature, graphic) => {
    const relatedConfig = activeMap?.customFeatureInfo?.relatedLayer;
    
    if (!relatedConfig?.enabled || !viewRef.current || !feature.geometry) {
      setRelatedFeatures([]);
      setCurrentRelatedIndex(0);
      return;
    }

    try {
      // Find the related layer
      const relatedLayer = mapRef.current?.allLayers?.find(l => l.id === relatedConfig.layerId);
      
      if (!relatedLayer?.queryFeatures) {
        setRelatedFeatures([]);
        return;
      }

      // Query features that intersect with the selected feature
      const query = relatedLayer.createQuery();
      query.geometry = graphic?.geometry || feature.geometry;
      query.spatialRelationship = relatedConfig.spatialRelationship || 'intersects';
      query.outFields = ['*'];
      query.returnGeometry = true;
      
      if (relatedConfig.orderByField) {
        query.orderByFields = [`${relatedConfig.orderByField} ${relatedConfig.orderByDirection || 'ASC'}`];
      }

      const results = await relatedLayer.queryFeatures(query);
      
      const related = results.features.map(f => ({
        geometry: f.geometry?.toJSON?.() || f.geometry,
        attributes: f.attributes,
        title: f.attributes?.[relatedConfig.titleField] || 'Related Feature'
      }));

      setRelatedFeatures(related);
      setCurrentRelatedIndex(0);
      
    } catch (err) {
      console.warn('[MapView] Related features query error:', err);
      setRelatedFeatures([]);
    }
  }, [activeMap]);

  /**
   * Render search results on map
   */
  const renderResults = useCallback((features) => {
    if (!graphicsLayerRef.current || !mapReady) return;

    // Clear existing graphics
    graphicsLayerRef.current.removeAll();
    if (pushpinLayerRef.current) {
      pushpinLayerRef.current.removeAll();
    }
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAll();
    }

    if (!features || features.length === 0) return;

    // Get theme color RGB values
    const palette = COLOR_PALETTE[themeColor] || COLOR_PALETTE.sky;
    const hex500 = palette[500];
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [14, 165, 233];
    };
    const [r, g, b] = hexToRgb(hex500);

    const isMultiResult = features.length > 1;

    // Create graphics for each feature
    const geometryGraphics = features.map((feature, idx) => {
      if (!feature.geometry) return null;

      let geometry;
      if (feature.geometry.rings) {
        geometry = new Polygon({
          rings: feature.geometry.rings,
          spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
        });
      } else if (feature.geometry.paths) {
        geometry = new Polyline({
          paths: feature.geometry.paths,
          spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
        });
      } else if (feature.geometry.x !== undefined) {
        geometry = new Point({
          x: feature.geometry.x,
          y: feature.geometry.y,
          spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
        });
      }

      if (!geometry) return null;

      let symbol;
      if (feature.geometry.rings) {
        symbol = new SimpleFillSymbol({
          color: isMultiResult ? [r, g, b, 0.15] : [r, g, b, 0.2],
          outline: new SimpleLineSymbol({
            color: [r, g, b],
            width: isMultiResult ? 1.5 : 2
          })
        });
      } else if (feature.geometry.paths) {
        symbol = new SimpleLineSymbol({
          color: [r, g, b],
          width: isMultiResult ? 2 : 3
        });
      } else {
        symbol = new SimpleMarkerSymbol({
          color: [r, g, b],
          size: 12,
          outline: { color: [255, 255, 255], width: 2 }
        });
      }

      return new Graphic({
        geometry,
        symbol,
        attributes: { ...feature.attributes, _index: idx }
      });
    }).filter(Boolean);

    graphicsLayerRef.current.addMany(geometryGraphics);

    // For multi-result searches, add pushpin markers
    if (isMultiResult && pushpinLayerRef.current) {
      const pushpinGraphics = features.map((feature, idx) => {
        if (!feature.geometry) return null;

        const center = getGeometryCenter(feature.geometry);
        if (!center) return null;

        const pushpinPoint = new Point({
          x: center.x,
          y: center.y,
          spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
        });

        const pushpinSymbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: [r, g, b],
          size: 14,
          outline: { color: [255, 255, 255], width: 2 }
        });

        return new Graphic({
          geometry: pushpinPoint,
          symbol: pushpinSymbol,
          attributes: { ...feature.attributes, _index: idx }
        });
      }).filter(Boolean);

      pushpinLayerRef.current.addMany(pushpinGraphics);
    }

    // Zoom to results
    if (viewRef.current && geometryGraphics.length > 0) {
      viewRef.current.goTo(geometryGraphics, { padding: 50 });
    }
  }, [themeColor, mapReady, getGeometryCenter]);

  /**
   * Highlight a single feature (including its pushpin if multi-result)
   */
  const highlightFeature = useCallback((feature, originalGraphic = null) => {
    // Use refs instead of state to avoid stale closure issues
    // The click handler captures an old version of this function, so we check refs directly
    if (!highlightLayerRef.current || !viewRef.current) {
      console.warn('[MapView] Highlight skipped: Layer or View not ready');
      return;
    }

    highlightLayerRef.current.removeAll();

    // --- Helper to create standard highlight symbols ---
    const getHighlightSymbol = (type) => {
      if (type === 'polygon') {
        return new SimpleFillSymbol({
          color: [255, 255, 0, 0.3],
          style: "solid",
          outline: { color: [255, 200, 0], width: 3 }
        });
      } else if (type === 'polyline') {
        return new SimpleLineSymbol({
          color: [255, 200, 0],
          width: 4,
          style: "solid"
        });
      } else {
        return new SimpleMarkerSymbol({
          color: [255, 200, 0],
          size: 16,
          style: "circle",
          outline: { color: [255, 255, 255], width: 3 }
        });
      }
    };

    // --- STRATEGY 1: Use Original Graphic (Best for Map Clicks) ---
    // If we have the original graphic from the hitTest, clone it.
    // This is robust because it guarantees the geometry type and spatial reference are correct.
    if (originalGraphic && originalGraphic.geometry) {
      try {
        console.log('[MapView] Highlight Strategy 1: Cloning original graphic', originalGraphic);
        const clone = originalGraphic.clone();

        // Determine type for symbol
        let type = 'point';
        if (clone.geometry.type) {
           type = clone.geometry.type;
        } else if (clone.geometry.rings) {
           type = 'polygon';
        } else if (clone.geometry.paths) {
           type = 'polyline';
        }

        clone.symbol = getHighlightSymbol(type);
        highlightLayerRef.current.add(clone);
        return;
      } catch (e) {
        console.warn("[MapView] Failed to clone original graphic for highlight:", e);
        // Fall through to Strategy 2
      }
    }

    // --- STRATEGY 2: Reconstruct from JSON (Best for Search Results) ---

    if (!feature?.geometry) {
      console.warn('[MapView] Highlight failed: No geometry found');
      return;
    }

    console.log('[MapView] Highlight Strategy 2: Reconstructing from JSON', feature.geometry);

    const geom = feature.geometry;
    let geometry;
    let geometryType = 'point'; // Default

    // Default to the view's spatial reference if missing in the feature geometry (common with JSON objects)
    const defaultSR = viewRef.current?.spatialReference || { wkid: 4326 };
    const geomSR = geom.spatialReference || defaultSR;

    // Detect geometry type - check for rings (polygon), paths (polyline), or point coordinates
    if (geom.rings && geom.rings.length > 0) {
      geometryType = 'polygon';
      geometry = new Polygon({
        rings: geom.rings,
        spatialReference: geomSR
      });
    } else if (geom.paths && geom.paths.length > 0) {
      geometryType = 'polyline';
      geometry = new Polyline({
        paths: geom.paths,
        spatialReference: geomSR
      });
    } else if (geom.x !== undefined && geom.y !== undefined) {
      geometryType = 'point';
      geometry = new Point({
        x: geom.x,
        y: geom.y,
        spatialReference: geomSR
      });
    } else if (geom.longitude !== undefined && geom.latitude !== undefined) {
      // Handle lat/lon format
      geometryType = 'point';
      geometry = new Point({
        x: geom.longitude,
        y: geom.latitude,
        spatialReference: geomSR
      });
    }

    if (!geometry) {
      console.warn('[MapView] Highlight failed: Could not create geometry from', geom);
      return;
    }

    const symbol = getHighlightSymbol(geometryType);

    // Add highlighted feature geometry
    highlightLayerRef.current.add(new Graphic({ geometry, symbol }));

    // Find and highlight the associated pushpin if this is a multi-result search
    // Check if feature has an _index attribute (indicating it's a search result)
    const featureIndex = feature.attributes?._index;
    const isMultiResult = searchResults?.features?.length > 1;

    if (isMultiResult && pushpinLayerRef.current) {
      // Find the pushpin with matching _index in the pushpin layer
      const pushpinGraphics = pushpinLayerRef.current.graphics;
      let matchingPushpin = null;

      // If we have a feature index, find the matching pushpin
      if (featureIndex !== undefined) {
        pushpinGraphics.forEach(g => {
          if (g.attributes?._index === featureIndex) {
            matchingPushpin = g;
          }
        });
      }

      // If no index match, try to find pushpin by geometry center
      if (!matchingPushpin) {
        const center = getGeometryCenter(feature.geometry);
        if (center) {
          // Find pushpin closest to feature center
          let minDist = Infinity;
          pushpinGraphics.forEach(g => {
            if (g.geometry?.x !== undefined && g.geometry?.y !== undefined) {
              const dist = Math.sqrt(
                Math.pow(g.geometry.x - center.x, 2) +
                Math.pow(g.geometry.y - center.y, 2)
              );
              if (dist < minDist) {
                minDist = dist;
                matchingPushpin = g;
              }
            }
          });
        }
      }

      // Create a highlight ring around the pushpin
      if (matchingPushpin && matchingPushpin.geometry) {
        const pushpinHighlightSymbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: [255, 200, 0, 0.8],
          size: 22,
          outline: { color: [255, 255, 255], width: 3 }
        });

        highlightLayerRef.current.add(new Graphic({
          geometry: matchingPushpin.geometry.clone(),
          symbol: pushpinHighlightSymbol
        }));
      }
    } else if (!originalGraphic) {
      // For single results or when no pushpin layer, add highlight at feature center
      const center = getGeometryCenter(feature.geometry);
      if (center) {
        const pushpinPoint = new Point({
          x: center.x,
          y: center.y,
          spatialReference: geomSR
        });

        const pushpinHighlightSymbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: [255, 200, 0],
          size: 18,
          outline: { color: [255, 255, 255], width: 3 }
        });

        highlightLayerRef.current.add(new Graphic({
          geometry: pushpinPoint,
          symbol: pushpinHighlightSymbol
        }));
      }
    }
  }, [getGeometryCenter, searchResults]);

  /**
   * Zoom to a specific feature
   */
  const zoomToFeature = useCallback((feature) => {
    // Use ref check instead of mapReady state to avoid stale closure issues
    if (!viewRef.current || !feature?.geometry) return;

    highlightFeature(feature);

    const geometry = feature.geometry;
    const hasExtent = geometry.rings || geometry.paths || geometry.extent;
    
    if (hasExtent) {
      // For polygons/polylines, get the extent and expand it
      let extent;
      if (geometry.extent) {
        extent = Extent.fromJSON ? Extent.fromJSON(geometry.extent) : new Extent(geometry.extent);
      } else if (geometry.rings) {
        // Create extent from polygon
        const poly = new Polygon(geometry);
        extent = poly.extent;
      } else if (geometry.paths) {
        // Create extent from polyline
        const line = new Polyline(geometry);
        extent = line.extent;
      }
      
      if (extent) {
        // Expand extent by 50% for better buffer around feature
        const expandedExtent = extent.clone().expand(1.5);
        viewRef.current.goTo(
          { target: expandedExtent },
          { duration: 500 }
        );
      } else {
        viewRef.current.goTo(
          { target: geometry },
          { duration: 500 }
        );
      }
    } else {
      // For point features, zoom to a reasonable level (not too close)
      // Use zoom level 15 max to keep more context visible
      const targetZoom = Math.min(viewRef.current.zoom + 2, 15);
      viewRef.current.goTo(
        { target: geometry, zoom: targetZoom },
        { duration: 500 }
      );
    }
  }, [highlightFeature]);

  /**
   * Clear results
   */
  const clearResults = useCallback(() => {
    if (graphicsLayerRef.current) graphicsLayerRef.current.removeAll();
    if (highlightLayerRef.current) highlightLayerRef.current.removeAll();
    if (pushpinLayerRef.current) pushpinLayerRef.current.removeAll();

    setSelectedFeature(null);
    setShowFeaturePanel(false);
    setShowSearchResults(false);
    setRelatedFeatures([]);

    // Clear search results in context
    if (updateSearchResults) {
      updateSearchResults({ features: [] });
    }
  }, [updateSearchResults]);

  /**
   * Zoom to all results
   */
  const zoomToAllResults = useCallback(() => {
    if (!viewRef.current || !graphicsLayerRef.current || !mapReady) return;

    const graphics = graphicsLayerRef.current.graphics;
    if (graphics.length === 0) return;

    // Zoom to all graphics in the results layer
    viewRef.current.goTo(graphics, { padding: 50, duration: 500 });
  }, [mapReady]);

  /**
   * Zoom controls
   */
  const zoomIn = useCallback(() => {
    if (viewRef.current && mapReady) {
      viewRef.current.goTo({ zoom: viewRef.current.zoom + 1 }, { duration: 200 });
    }
  }, [mapReady]);

  const zoomOut = useCallback(() => {
    if (viewRef.current && mapReady) {
      viewRef.current.goTo({ zoom: viewRef.current.zoom - 1 }, { duration: 200 });
    }
  }, [mapReady]);

  const goHome = useCallback(() => {
    if (viewRef.current && mapRef.current?.initialViewProperties?.viewpoint && mapReady) {
      viewRef.current.goTo(mapRef.current.initialViewProperties.viewpoint, { duration: 500 });
    }
  }, [mapReady]);

  /**
   * Display GPS marker at the given coordinates
   */
  const displayGpsMarker = useCallback((latitude, longitude, accuracy) => {
    if (!gpsLayerRef.current || !viewRef.current) return;

    // Clear previous marker
    gpsLayerRef.current.removeAll();

    const point = new Point({
      longitude,
      latitude,
      spatialReference: { wkid: 4326 }
    });

    // Create GPS marker symbol (blue dot with white outline and pulse effect ring)
    const markerSymbol = new SimpleMarkerSymbol({
      style: 'circle',
      color: [66, 133, 244, 1], // Google blue
      size: 14,
      outline: {
        color: [255, 255, 255],
        width: 3
      }
    });

    // Create accuracy circle if accuracy is available
    if (accuracy) {
      const accuracySymbol = new SimpleFillSymbol({
        color: [66, 133, 244, 0.15],
        outline: new SimpleLineSymbol({
          color: [66, 133, 244, 0.5],
          width: 1
        })
      });

      // Create a circle representing accuracy (approximate - 1 degree ≈ 111km at equator)
      const metersPerDegree = 111320 * Math.cos(latitude * Math.PI / 180);
      const radiusDegrees = accuracy / metersPerDegree;

      // Create a simple circular polygon for accuracy
      const numPoints = 64;
      const ring = [];
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        ring.push([
          longitude + radiusDegrees * Math.cos(angle),
          latitude + radiusDegrees * Math.sin(angle)
        ]);
      }

      const accuracyCircle = new Polygon({
        rings: [ring],
        spatialReference: { wkid: 4326 }
      });

      gpsLayerRef.current.add(new Graphic({
        geometry: accuracyCircle,
        symbol: accuracySymbol
      }));
    }

    // Add the GPS marker on top
    gpsLayerRef.current.add(new Graphic({
      geometry: point,
      symbol: markerSymbol
    }));
  }, []);

  /**
   * Get user's current location and center the map
   */
  const getCurrentLocation = useCallback((centerMap = true) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser');
      return;
    }

    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log('[MapView] GPS location:', latitude, longitude, 'accuracy:', accuracy);

        displayGpsMarker(latitude, longitude, accuracy);

        if (centerMap && viewRef.current) {
          const point = new Point({
            longitude,
            latitude,
            spatialReference: { wkid: 4326 }
          });
          viewRef.current.goTo(
            { target: point, zoom: Math.max(viewRef.current.zoom, 16) },
            { duration: 500 }
          );
        }

        setGpsActive(true);
      },
      (error) => {
        console.error('[MapView] GPS error:', error);
        let errorMessage = 'Unable to retrieve location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setGpsError(errorMessage);
        setGpsActive(false);
        setGpsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [displayGpsMarker]);

  /**
   * Start continuous GPS tracking with interval refresh
   */
  const startGpsTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser');
      return;
    }

    // First get the current location
    getCurrentLocation(true);

    // Clear any existing interval
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
    }

    // Set up interval for periodic updates
    gpsIntervalRef.current = setInterval(() => {
      getCurrentLocation(false); // Don't center map on updates, just update marker
    }, gpsTrackingInterval);

    setGpsTracking(true);
    console.log('[MapView] GPS tracking started with interval:', gpsTrackingInterval, 'ms');
  }, [getCurrentLocation, gpsTrackingInterval]);

  /**
   * Stop GPS tracking
   */
  const stopGpsTracking = useCallback(() => {
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }

    if (gpsWatchIdRef.current) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }

    // Clear GPS marker
    if (gpsLayerRef.current) {
      gpsLayerRef.current.removeAll();
    }

    setGpsTracking(false);
    setGpsActive(false);
    setShowGpsSettings(false);
    console.log('[MapView] GPS tracking stopped');
  }, []);

  /**
   * Toggle GPS - single location or tracking mode
   */
  const toggleGps = useCallback(() => {
    if (gpsTracking) {
      stopGpsTracking();
    } else if (gpsActive) {
      // Already have a location, show settings for tracking
      setShowGpsSettings(!showGpsSettings);
    } else {
      // Get initial location
      getCurrentLocation(true);
    }
  }, [gpsActive, gpsTracking, showGpsSettings, getCurrentLocation, stopGpsTracking]);

  /**
   * Handle saving a feature as markup
   */
  const handleSaveAsMarkup = useCallback((feature, popupTitle) => {
    if (!markupLayerRef.current || !feature?.geometry) {
      console.warn('[MapView] Cannot save as markup: missing layer or geometry');
      return;
    }

    console.log('[MapView] Saving feature as markup:', feature, 'with title:', popupTitle);

    // Determine geometry type and create appropriate symbol
    const geometry = feature.geometry;
    let graphicGeometry;
    let symbol;
    let toolType = 'polygon';

    // Get theme color for the markup
    const palette = COLOR_PALETTE[themeColor] || COLOR_PALETTE.sky;
    const hex500 = palette[500];
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [14, 165, 233];
    };
    const [r, g, b] = hexToRgb(hex500);

    if (geometry.rings) {
      // Polygon
      graphicGeometry = new Polygon({
        rings: geometry.rings,
        spatialReference: geometry.spatialReference || { wkid: 4326 }
      });
      symbol = new SimpleFillSymbol({
        color: [r, g, b, 0.35],
        outline: new SimpleLineSymbol({
          color: [r, g, b],
          width: 2
        })
      });
      toolType = 'polygon';
    } else if (geometry.paths) {
      // Polyline
      graphicGeometry = new Polyline({
        paths: geometry.paths,
        spatialReference: geometry.spatialReference || { wkid: 4326 }
      });
      symbol = new SimpleLineSymbol({
        color: [r, g, b],
        width: 3
      });
      toolType = 'polyline';
    } else if (geometry.x !== undefined) {
      // Point
      graphicGeometry = new Point({
        x: geometry.x,
        y: geometry.y,
        spatialReference: geometry.spatialReference || { wkid: 4326 }
      });
      symbol = new SimpleMarkerSymbol({
        color: [r, g, b],
        size: 12,
        outline: { color: [255, 255, 255], width: 2 }
      });
      toolType = 'point';
    } else {
      console.warn('[MapView] Unsupported geometry type for markup');
      return;
    }

    // Get a name for the markup - prefer the popup title passed from FeatureInfoPanel
    const attrs = feature.attributes || {};
    const featureName = popupTitle || attrs.displayName || attrs.title || attrs.TITLE ||
                        attrs.name || attrs.NAME || attrs.ADDRESS ||
                        attrs.address || attrs.PARCELID || 'Saved Feature';

    // Create the markup graphic
    const markupGraphic = new Graphic({
      geometry: graphicGeometry,
      symbol,
      attributes: {
        id: `markup_${Date.now()}`,
        name: featureName,
        tool: toolType,
        symbolStyle: toolType === 'point' ? 'circle' : 'solid',
        color: hex500,
        isMarkup: true,
        timestamp: Date.now(),
        savedFrom: 'feature-info-panel'
      }
    });

    // Add to markup layer
    markupLayerRef.current.add(markupGraphic);
    console.log('[MapView] Feature saved as markup:', markupGraphic.attributes.name);
  }, [themeColor]);

  /**
   * Handle export to PDF
   * Uses FeatureExportService to generate a multi-page PDF
   * @param {object} feature - The feature to export (optional, defaults to selectedFeature)
   * @param {string} title - Optional title for the export
   */
  const handleExportPDF = useCallback(async (feature = null, title = null) => {
    const featureToExport = feature || selectedFeature;

    if (!featureToExport) {
      console.warn('[MapView] No feature selected for PDF export');
      return;
    }

    console.log('[MapView] Starting PDF export for feature:', featureToExport);

    // If a title is provided, add it to the feature attributes for display
    const enrichedFeature = title ? {
      ...featureToExport,
      attributes: {
        ...featureToExport.attributes,
        displayName: title
      }
    } : featureToExport;

    // Set loading state
    setIsExportingPDF(true);
    setExportPDFProgress('Preparing...');

    try {
      await exportFeatureToPDF({
        feature: enrichedFeature,
        atlasConfig: config,
        mapConfig: activeMap,
        mapView: viewRef.current,
        sourceLayer: selectedFeatureLayer,
        onProgress: (status) => {
          console.log('[MapView] PDF Export:', status);
          setExportPDFProgress(status);
        }
      });
    } catch (err) {
      console.error('[MapView] PDF export failed:', err);
      // Could add a toast notification here in the future
    } finally {
      // Reset loading state
      setIsExportingPDF(false);
      setExportPDFProgress('');
    }
  }, [selectedFeature, selectedFeatureLayer, config, activeMap]);

  /**
   * Close feature panel
   */
  const handleCloseFeaturePanel = useCallback(() => {
    setShowFeaturePanel(false);
    setSelectedFeature(null);
    setSelectedFeatureLayer(null);
    setRelatedFeatures([]);
    setIsMarkupFeature(false);
    // Clear nearby buffer state and graphic
    setNearbyBufferGeometry(null);
    setNearbySearchInfo(null);
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAll();
    }
    if (nearbyBufferLayerRef.current) {
      nearbyBufferLayerRef.current.removeAll();
    }
  }, []);

  /**
   * Handle nearby search results
   * Updates search results, renders on map, and triggers chat message
   */
  const handleNearbySearch = useCallback((features, bufferGeometry, searchInfo) => {
    console.log('[MapView] Nearby search completed:', features.length, 'features found');

    // Store buffer geometry and search info for "Save as markup" functionality
    setNearbyBufferGeometry(bufferGeometry);
    setNearbySearchInfo(searchInfo);

    // Update search results context - this updates search results panel and table view
    updateSearchResults({ features });

    // Add message to chat
    if (chatViewRef?.current?.addMessage) {
      const { distance, unit, sourceName } = searchInfo || {};
      if (features.length === 0) {
        chatViewRef.current.addMessage('ai', `No features found within **${distance} ${unit}** of **${sourceName}**.`);
      } else {
        chatViewRef.current.addMessage('ai', `Found **${features.length}** feature${features.length !== 1 ? 's' : ''} within **${distance} ${unit}** of **${sourceName}**.`, {
          features,
          showResultActions: true,
          searchMetadata: {
            queryType: 'nearbySearch',
            whereClause: `Spatial query within ${distance} ${unit} buffer`,
            interpretation: `Searching for features near ${sourceName}`
          }
        });
      }
    }

    // Get theme color for rendering
    const palette = COLOR_PALETTE[themeColor] || COLOR_PALETTE.sky;
    const hex500 = palette[500];
    const hex700 = palette[700]; // Darker shade for popup buffer
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [14, 165, 233];
    };
    const [r, g, b] = hexToRgb(hex500);

    // Check if this search was triggered from a popup (markup or feature info)
    const isFromPopup = searchInfo?.sourceType === 'markup-popup' || searchInfo?.sourceType === 'feature-info';

    // Render buffer graphic on map (on top of results with dashed outline)
    if (nearbyBufferLayerRef.current && bufferGeometry) {
      nearbyBufferLayerRef.current.removeAll();

      // If from popup: no fill, use darker shade (700) for outline to stand out
      // Otherwise: light fill with standard color
      const [bufferR, bufferG, bufferB] = isFromPopup ? hexToRgb(hex700) : [r, g, b];
      const bufferSymbol = new SimpleFillSymbol({
        color: isFromPopup ? [0, 0, 0, 0] : [r, g, b, 0.1], // No fill for popup, light fill otherwise
        outline: new SimpleLineSymbol({
          color: [bufferR, bufferG, bufferB, 1],
          width: isFromPopup ? 3 : 2, // Thicker for popup to stand out more
          style: 'dash' // Dashed outline to distinguish from results
        })
      });

      const bufferGraphic = new Graphic({
        geometry: bufferGeometry,
        symbol: bufferSymbol,
        attributes: {
          type: 'nearby-buffer',
          distance: searchInfo?.distance,
          unit: searchInfo?.unit,
          sourceName: searchInfo?.sourceName
        }
      });

      nearbyBufferLayerRef.current.add(bufferGraphic);
      console.log('[MapView] Buffer graphic added to map', isFromPopup ? '(popup style)' : '');
    }

    // If from popup, automatically save buffer as markup
    if (isFromPopup && bufferGeometry && markupLayerRef.current) {
      const bufferName = `${searchInfo?.distance} ${searchInfo?.unit} buffer around ${searchInfo?.sourceName}`;
      console.log('[MapView] Auto-saving buffer as markup from popup:', bufferName);

      // Create polygon from buffer geometry
      const graphicGeometry = new Polygon({
        rings: bufferGeometry.rings,
        spatialReference: bufferGeometry.spatialReference || { wkid: 4326 }
      });

      // Use the darker shade (700) with no fill for the markup
      const [markupR, markupG, markupB] = hexToRgb(hex700);
      const symbol = new SimpleFillSymbol({
        color: [0, 0, 0, 0], // No fill
        outline: new SimpleLineSymbol({
          color: [markupR, markupG, markupB],
          width: 3,
          style: 'dash'
        })
      });

      const markupGraphic = new Graphic({
        geometry: graphicGeometry,
        symbol,
        attributes: {
          id: `markup_${Date.now()}`,
          name: bufferName,
          tool: 'polygon',
          symbolStyle: 'dash',
          color: hex700,
          lineColor: hex700,
          lineType: 'dash',
          lineWidth: 3,
          fillOpacity: 0,
          isMarkup: true,
          timestamp: Date.now(),
          savedFrom: 'nearby-search-popup'
        }
      });

      markupLayerRef.current.add(markupGraphic);
      console.log('[MapView] Buffer auto-saved as markup:', bufferName);
    }

    // Render results on map
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
      features.forEach(feature => {
        if (!feature.geometry) return;

        let geometry = feature.geometry;
        // Ensure geometry has type
        if (geometry && typeof geometry === 'object' && !geometry.declaredClass) {
          geometry = { ...geometry };
          if (!geometry.type) {
            if (geometry.rings) geometry.type = 'polygon';
            else if (geometry.paths) geometry.type = 'polyline';
            else if (geometry.x !== undefined) geometry.type = 'point';
          }
        }

        let symbol;
        if (geometry.type === 'polygon' || geometry.rings) {
          symbol = new SimpleFillSymbol({
            color: [r, g, b, 0.35],
            outline: new SimpleLineSymbol({
              color: [r, g, b],
              width: 2
            })
          });
        } else if (geometry.type === 'polyline' || geometry.paths) {
          symbol = new SimpleLineSymbol({
            color: [r, g, b],
            width: 3
          });
        } else {
          symbol = new SimpleMarkerSymbol({
            color: [r, g, b],
            size: 10,
            outline: { color: [255, 255, 255], width: 2 }
          });
        }

        const graphic = new Graphic({
          geometry,
          symbol,
          attributes: feature.attributes
        });
        graphicsLayerRef.current.add(graphic);
      });

      // Zoom to buffer extent (includes all results)
      if (bufferGeometry && viewRef.current) {
        const bufferExtent = bufferGeometry.extent;
        if (bufferExtent) {
          viewRef.current.goTo(bufferExtent.expand(1.2));
        }
      } else if (features.length > 0 && viewRef.current) {
        // Fallback to results extent if no buffer
        const extent = graphicsLayerRef.current.graphics.reduce((ext, g) => {
          if (!g.geometry) return ext;
          const geomExt = g.geometry.extent || g.geometry;
          if (!ext) return geomExt.extent || geomExt;
          return ext.union(geomExt.extent || geomExt);
        }, null);
        if (extent) {
          viewRef.current.goTo(extent.expand(1.2));
        }
      }
    }

    // Show search results panel
    setShowSearchResults(true);

    // Keep feature panel/markup popup open so user can refine search or save buffer
  }, [updateSearchResults, themeColor, chatViewRef]);

  /**
   * Handle saving buffer geometry as markup
   */
  const handleSaveBufferAsMarkup = useCallback((bufferGeometry, bufferName) => {
    if (!markupLayerRef.current || !bufferGeometry) {
      console.warn('[MapView] Cannot save buffer as markup: missing layer or geometry');
      return;
    }

    console.log('[MapView] Saving buffer as markup:', bufferName);

    // Get theme color
    const palette = COLOR_PALETTE[themeColor] || COLOR_PALETTE.sky;
    const hex500 = palette[500];
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [14, 165, 233];
    };
    const [r, g, b] = hexToRgb(hex500);

    // Create polygon from buffer geometry
    const graphicGeometry = new Polygon({
      rings: bufferGeometry.rings,
      spatialReference: bufferGeometry.spatialReference || { wkid: 4326 }
    });

    const symbol = new SimpleFillSymbol({
      color: [r, g, b, 0.25],
      outline: new SimpleLineSymbol({
        color: [r, g, b],
        width: 2,
        style: 'dash'
      })
    });

    const markupGraphic = new Graphic({
      geometry: graphicGeometry,
      symbol,
      attributes: {
        id: `markup_${Date.now()}`,
        name: bufferName,
        tool: 'polygon',
        symbolStyle: 'solid',
        color: hex500,
        isMarkup: true,
        timestamp: Date.now(),
        savedFrom: 'nearby-search'
      }
    });

    markupLayerRef.current.add(markupGraphic);
    console.log('[MapView] Buffer saved as markup:', bufferName);
  }, [themeColor]);

  /**
   * Close markup popup
   */
  const handleCloseMarkupPopup = useCallback(() => {
    setShowMarkupPopup(false);
    setSelectedMarkup(null);
    setIsEditingMarkup(false);
    // Clear nearby buffer state and graphic
    setNearbyBufferGeometry(null);
    setNearbySearchInfo(null);
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAll();
    }
    if (nearbyBufferLayerRef.current) {
      nearbyBufferLayerRef.current.removeAll();
    }
  }, []);

  /**
   * Handle zoom to markup
   */
  const handleZoomToMarkup = useCallback((markup) => {
    if (!viewRef.current || !markup?.geometry) return;

    const geometry = markup.geometry;
    if (geometry.type === 'point') {
      viewRef.current.goTo({ target: geometry, zoom: 16 }, { duration: 500 });
    } else {
      // Clone the extent before expanding to avoid modifying the original
      const extent = geometry.extent?.clone?.() || geometry.extent;
      const expandedExtent = extent?.expand?.(1.5) || extent;
      viewRef.current.goTo({ target: expandedExtent }, { duration: 500 });
    }
  }, []);

  /**
   * Handle edit markup - delegates to MarkupTool
   */
  const handleEditMarkup = useCallback((markup) => {
    if (!markupToolRef.current || !markup) return;

    // Expand the markup tool if it's collapsed
    if (!showMarkupTool) {
      setShowMarkupTool(true);
    }

    // Start editing via MarkupTool ref
    markupToolRef.current.startEdit(markup);
    setIsEditingMarkup(true);
  }, [showMarkupTool]);

  /**
   * Handle done editing markup - completes the edit
   */
  const handleDoneEditing = useCallback(() => {
    if (!markupToolRef.current) return;
    markupToolRef.current.completeEdit();
    setIsEditingMarkup(false);
    // Force refresh the popup to show updated geometry/measurement
    setMarkupRefreshKey(k => k + 1);
  }, []);

  /**
   * Handle cancel editing markup - cancels the edit
   */
  const handleCancelEditing = useCallback(() => {
    if (!markupToolRef.current) return;
    markupToolRef.current.cancelEdit();
    setIsEditingMarkup(false);
  }, []);

  /**
   * Handle update markup attributes
   */
  const handleUpdateMarkupAttributes = useCallback((markup, updates) => {
    if (!markupToolRef.current || !markup) return;
    markupToolRef.current.updateMarkupAttributes(markup, updates);
  }, []);

  /**
   * Handle update markup label
   */
  const handleUpdateMarkupLabel = useCallback((markup, showLabel, labelText) => {
    if (!markupToolRef.current || !markup) return;
    markupToolRef.current.updateMarkupLabel(markup, showLabel, labelText);
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    renderResults,
    highlightFeature,
    zoomToFeature,
    zoomToAllResults,
    clearResults,
    selectFeature: handleFeatureSelect,
    closeFeaturePanel: handleCloseFeaturePanel,
    get view() { return viewRef.current; },
    get map() { return mapRef.current; },
    get markupLayer() { return markupLayerRef.current; }
  }), [renderResults, highlightFeature, zoomToFeature, zoomToAllResults, clearResults, handleFeatureSelect, handleCloseFeaturePanel]);

  // Update results when searchResults change
  useEffect(() => {
    if (searchResults?.features && mapReady) {
      renderResults(searchResults.features);
    }
  }, [searchResults, renderResults, mapReady]);

  // Sync editing state with MarkupTool
  useEffect(() => {
    if (!showMarkupPopup || !selectedMarkup) return;

    const checkEditingState = () => {
      const isEditing = markupToolRef.current?.editingMarkup?.attributes?.id === selectedMarkup.attributes?.id;
      setIsEditingMarkup(isEditing);
    };

    // Check periodically while popup is open (to sync when editing completes)
    const interval = setInterval(checkEditingState, 500);
    return () => clearInterval(interval);
  }, [showMarkupPopup, selectedMarkup]);

  // Get config values
  const basemaps = activeMap?.basemaps || config?.basemaps || [];
  const hiddenLayers = activeMap?.hiddenLayers || [];
  const mapId = `${config?.id || 'atlas'}_${activeMapIndex || 0}`;

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: colors.text600 }} />
            <p className="text-sm text-slate-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-20">
          <div className="text-center max-w-md px-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Map Error</h3>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        </div>
      )}

      {/* ==================== MAP TOOLS CONTROLS ==================== */}
      {mapReady && !isLoading && !error && (
        <div className={getToolsPositionClasses()}>
          {/* Mobile Tools Menu */}
          {isMobile ? (
            <>
              {/* Tools Menu Button */}
              {!showSearchResults && !showMarkupTool && !showLayersPanel && !showBasemapPicker && !showMapExport && (
                <div className="relative" ref={toolsMenuRef}>
                  <button
                    onClick={() => setShowToolsMenu(!showToolsMenu)}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200
                               hover:bg-slate-50 transition-colors"
                    title="Map Tools"
                  >
                    <Menu className="w-4 h-4" style={{ color: colors.bg600 }} />
                    <span className="text-sm font-medium text-slate-700">Tools</span>
                  </button>

                  {/* Tools Dropdown Menu */}
                  {showToolsMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          setShowSearchResults(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <Search className="w-4 h-4" style={{ color: colors.bg600 }} />
                        <span className="text-sm text-slate-700">Results</span>
                        {searchResults?.features?.length > 0 && (
                          <span
                            className="ml-auto px-1.5 py-0.5 text-xs rounded-full text-white"
                            style={{ backgroundColor: colors.bg500 }}
                          >
                            {searchResults.features.length}
                          </span>
                        )}
                        <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                      </button>
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          setShowMarkupTool(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" style={{ color: colors.bg600 }} />
                        <span className="text-sm text-slate-700">Markup</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                      </button>
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          setShowLayersPanel(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <Layers className="w-4 h-4" style={{ color: colors.bg600 }} />
                        <span className="text-sm text-slate-700">Layers</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                      </button>
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          setShowBasemapPicker(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <Globe className="w-4 h-4" style={{ color: colors.bg600 }} />
                        <span className="text-sm text-slate-700">Base</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                      </button>
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          setShowMapExport(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <Printer className="w-4 h-4" style={{ color: colors.bg600 }} />
                        <span className="text-sm text-slate-700">Export</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                      </button>
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          setShowHelpPanel?.(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <HelpCircle className="w-4 h-4" style={{ color: colors.bg600 }} />
                        <span className="text-sm text-slate-700">Help</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 ml-auto" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded Tool Panels (Mobile) */}
              {showSearchResults && (
                <SearchResultsPanel
                  view={viewRef.current}
                  config={config}
                  isExpanded={true}
                  onToggle={() => setShowSearchResults(false)}
                  onFeatureSelect={handleFeatureSelect}
                  onClearResults={clearResults}
                  onZoomToAll={zoomToAllResults}
                  searchFields={activeMap?.searchFields || []}
                />
              )}
              {showMarkupTool && (
                <MarkupTool
                  ref={markupToolRef}
                  view={viewRef.current}
                  graphicsLayer={markupLayerRef.current}
                  config={config}
                  mapId={mapId}
                  isExpanded={true}
                  onToggle={() => setShowMarkupTool(false)}
                />
              )}
              {showLayersPanel && (
                <LayersPanel
                  view={viewRef.current}
                  map={mapRef.current}
                  config={config}
                  mapId={mapId}
                  hiddenLayers={hiddenLayers}
                  isExpanded={true}
                  onToggle={() => setShowLayersPanel(false)}
                />
              )}
              {showBasemapPicker && (
                <BasemapPicker
                  view={viewRef.current}
                  map={mapRef.current}
                  basemaps={basemaps}
                  config={config}
                  mapId={mapId}
                  isExpanded={true}
                  onToggle={() => setShowBasemapPicker(false)}
                />
              )}
              {showMapExport && (
                <MapExportTool
                  mapView={viewRef.current}
                  mapConfig={activeMap}
                  atlasConfig={config}
                  accentColor={colors.bg600}
                  isExpanded={true}
                  onToggle={() => setShowMapExport(false)}
                  onClose={() => setShowMapExport(false)}
                />
              )}
            </>
          ) : (
            /* Desktop: Show all tool buttons */
            <>
              {/* 1. Search Results (TOP) */}
              <SearchResultsPanel
                view={viewRef.current}
                config={config}
                isExpanded={showSearchResults}
                onToggle={() => {
                  setShowSearchResults(!showSearchResults);
                  if (!showSearchResults) {
                    setShowMarkupTool(false);
                    setShowLayersPanel(false);
                    setShowBasemapPicker(false);
                    setShowMapExport(false);
                  }
                }}
                onFeatureSelect={handleFeatureSelect}
                onClearResults={clearResults}
                onZoomToAll={zoomToAllResults}
                searchFields={activeMap?.searchFields || []}
              />

              {/* 2. Markup Tool */}
              <MarkupTool
                ref={markupToolRef}
                view={viewRef.current}
                graphicsLayer={markupLayerRef.current}
                config={config}
                mapId={mapId}
                isExpanded={showMarkupTool}
                onToggle={() => {
                  setShowMarkupTool(!showMarkupTool);
                  if (!showMarkupTool) {
                    setShowSearchResults(false);
                    setShowLayersPanel(false);
                    setShowBasemapPicker(false);
                    setShowMapExport(false);
                  }
                }}
              />

              {/* 3. Layers Panel */}
              <LayersPanel
                view={viewRef.current}
                map={mapRef.current}
                config={config}
                mapId={mapId}
                hiddenLayers={hiddenLayers}
                isExpanded={showLayersPanel}
                onToggle={() => {
                  setShowLayersPanel(!showLayersPanel);
                  if (!showLayersPanel) {
                    setShowSearchResults(false);
                    setShowMarkupTool(false);
                    setShowBasemapPicker(false);
                    setShowMapExport(false);
                  }
                }}
              />

              {/* 4. Basemap Picker */}
              <BasemapPicker
                view={viewRef.current}
                map={mapRef.current}
                basemaps={basemaps}
                config={config}
                mapId={mapId}
                isExpanded={showBasemapPicker}
                onToggle={() => {
                  setShowBasemapPicker(!showBasemapPicker);
                  if (!showBasemapPicker) {
                    setShowSearchResults(false);
                    setShowMarkupTool(false);
                    setShowLayersPanel(false);
                    setShowMapExport(false);
                  }
                }}
              />

              {/* 5. Map Export */}
              <MapExportTool
                mapView={viewRef.current}
                mapConfig={activeMap}
                atlasConfig={config}
                accentColor={colors.bg600}
                isExpanded={showMapExport}
                onToggle={() => {
                  setShowMapExport(!showMapExport);
                  if (!showMapExport) {
                    setShowSearchResults(false);
                    setShowMarkupTool(false);
                    setShowLayersPanel(false);
                    setShowBasemapPicker(false);
                  }
                }}
                onClose={() => setShowMapExport(false)}
              />

              {/* 6. Help Button */}
              <button
                onClick={() => setShowHelpPanel?.(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Get Help"
              >
                <HelpCircle className="w-4 h-4" style={{ color: colors.bg600 }} />
                <span className="text-sm font-medium text-slate-700">Help</span>
              </button>
            </>
          )}
        </div>
      )}


      {/* ==================== BOTTOM RIGHT CONTROLS ==================== */}
      {mapReady && !isLoading && !error && (
        <div
          className="absolute bottom-4 flex flex-col gap-2 z-20 transition-[right] duration-300"
          style={{
            right: (showFeaturePanel && selectedFeature && !isMobile)
              ? featurePanelWidth + 16
              : (showMarkupPopup && selectedMarkup && !isMobile)
                ? markupPopupWidth + 16
                : 16
          }}
        >
          {/* GPS Button and Settings */}
          <div className="relative">
            <div className="flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={toggleGps}
                className={`p-2 hover:bg-slate-100 transition-colors ${gpsTracking ? 'bg-blue-50' : ''}`}
                title={gpsTracking ? 'Stop GPS Tracking' : gpsActive ? 'GPS Settings' : 'Show My Location'}
              >
                <Navigation
                  className={`w-5 h-5 ${gpsTracking ? 'animate-pulse' : ''}`}
                  style={{ color: gpsTracking ? '#4285F4' : gpsActive ? '#4285F4' : colors.bg600 }}
                  fill={gpsTracking ? '#4285F4' : 'none'}
                />
              </button>
            </div>

            {/* GPS Settings Dropdown */}
            {showGpsSettings && !gpsTracking && (
              <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">GPS Tracking</span>
                  <button
                    onClick={() => setShowGpsSettings(false)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="mb-3">
                  <label className="block text-xs text-slate-500 mb-1">Refresh Interval</label>
                  <select
                    value={gpsTrackingInterval}
                    onChange={(e) => setGpsTrackingInterval(Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={2000}>2 seconds</option>
                    <option value={5000}>5 seconds</option>
                    <option value={10000}>10 seconds</option>
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>1 minute</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      getCurrentLocation(true);
                      setShowGpsSettings(false);
                    }}
                    className="flex-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                  >
                    Locate Once
                  </button>
                  <button
                    onClick={() => {
                      startGpsTracking();
                      setShowGpsSettings(false);
                    }}
                    className="flex-1 px-3 py-1.5 text-sm text-white rounded transition-colors"
                    style={{ backgroundColor: '#4285F4' }}
                  >
                    Start Tracking
                  </button>
                </div>

                <div className="border-t border-slate-200 mt-3 pt-3">
                  <button
                    onClick={() => {
                      stopGpsTracking();
                    }}
                    className="w-full px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                  >
                    Disable GPS
                  </button>
                </div>
              </div>
            )}

            {/* GPS Error Toast */}
            {gpsError && (
              <div className="absolute bottom-full right-0 mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-600">{gpsError}</span>
                </div>
                <button
                  onClick={() => setGpsError(null)}
                  className="mt-1 text-xs text-red-500 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* GPS Tracking Active Indicator */}
            {gpsTracking && (
              <div className="absolute bottom-full right-0 mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 min-w-[160px]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-blue-700">Tracking Active</span>
                </div>
                <span className="text-xs text-blue-600">
                  Updating every {gpsTrackingInterval / 1000}s
                </span>
                <button
                  onClick={stopGpsTracking}
                  className="mt-2 w-full px-2 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                >
                  Stop Tracking
                </button>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={zoomIn}
              className="p-2 hover:bg-slate-100 border-b border-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" style={{ color: colors.bg600 }} />
            </button>
            <button
              onClick={zoomOut}
              className="p-2 hover:bg-slate-100 border-b border-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" style={{ color: colors.bg600 }} />
            </button>
            <button
              onClick={goHome}
              className="p-2 hover:bg-slate-100"
              title="Home"
            >
              <Home className="w-5 h-5" style={{ color: colors.bg600 }} />
            </button>
          </div>
        </div>
      )}

      {/* ==================== FEATURE INFO PANEL ==================== */}
      {showFeaturePanel && selectedFeature && (
        <FeatureInfoPanel
          feature={selectedFeature}
          view={viewRef.current}
          config={config}
          customFeatureInfo={activeMap?.customFeatureInfo}
          sourceLayer={selectedFeatureLayer}
          onClose={handleCloseFeaturePanel}
          onSaveAsMarkup={handleSaveAsMarkup}
          onExportPDF={handleExportPDF}
          onZoomTo={zoomToFeature}
          onNearbySearch={handleNearbySearch}
          relatedFeatures={relatedFeatures}
          currentRelatedIndex={currentRelatedIndex}
          onNavigateRelated={setCurrentRelatedIndex}
          isMarkupFeature={isMarkupFeature}
          onWidthChange={setFeaturePanelWidth}
          isExportingPDF={isExportingPDF}
          exportPDFProgress={exportPDFProgress}
        />
      )}

      {/* ==================== MARKUP POPUP ==================== */}
      {showMarkupPopup && selectedMarkup && (
        <MarkupPopup
          markup={selectedMarkup}
          view={viewRef.current}
          config={config}
          onClose={handleCloseMarkupPopup}
          onZoomTo={handleZoomToMarkup}
          onEditMarkup={handleEditMarkup}
          onDoneEditing={handleDoneEditing}
          onCancelEditing={handleCancelEditing}
          onUpdateMarkup={handleUpdateMarkupAttributes}
          onUpdateLabel={handleUpdateMarkupLabel}
          onNearbySearch={handleNearbySearch}
          onSaveBufferAsMarkup={handleSaveBufferAsMarkup}
          isEditing={isEditingMarkup}
          onWidthChange={setMarkupPopupWidth}
          refreshKey={markupRefreshKey}
        />
      )}

      {/* ==================== SEARCHING INDICATOR ==================== */}
      {isSearching && mapReady && !isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.text600 }} />
          <span className="text-sm text-slate-600">Searching...</span>
        </div>
      )}
    </div>
  );
});

export default MapView;