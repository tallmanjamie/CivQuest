// src/atlas/components/MapView.jsx
// CivQuest Atlas - Map View Component
// ArcGIS WebMap integration with results layer and modern tool components
//
// INTEGRATED COMPONENTS:
// - SearchResultsPanel: Expandable list of search results (top)
// - MarkupTool: Drawing and annotation tools
// - LayersPanel: Collapsible layer list with legends and map picker
// - BasemapPicker: Basemap selection with swipe tool
// - MapExport: Map export functionality (stub)
// - FeatureInfoPanel: Feature details (right side desktop / bottom mobile)
//
// LAYOUT:
// - Top Left: SearchResultsPanel, MarkupTool, LayersPanel, BasemapPicker, MapExport (stacked)
// - Top Right: Results count, Clear button
// - Bottom Right: Zoom controls

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
  ChevronRight
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
    highlightFeature: contextHighlightFeature
  } = useAtlas();

  // Refs
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const mapRef = useRef(null);
  const graphicsLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const pushpinLayerRef = useRef(null);
  const markupLayerRef = useRef(null);
  const mountedRef = useRef(true);
  const initStartedRef = useRef(false);
  const originalPopupEnabledRef = useRef(new Map()); // Store original popupEnabled state for each layer

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

  // Tool Panel States
  const [showFeaturePanel, setShowFeaturePanel] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const [showMapExport, setShowMapExport] = useState(false);
  const [showMarkupTool, setShowMarkupTool] = useState(false);

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const toolsMenuRef = useRef(null);

  // Theme
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

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

        graphicsLayerRef.current = graphicsLayer;
        highlightLayerRef.current = highlightLayer;
        pushpinLayerRef.current = pushpinLayer;
        markupLayerRef.current = markupLayer;

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

        // Add graphics layers (markup on top, then pushpins, then highlight, then results)
        webMap.addMany([graphicsLayer, highlightLayer, pushpinLayer, markupLayer]);

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
              view.popup.close();
              view.popup.visible = false;
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
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      mapRef.current = null;
      graphicsLayerRef.current = null;
      highlightLayerRef.current = null;
      pushpinLayerRef.current = null;
      markupLayerRef.current = null;
      initStartedRef.current = false;
    };
  }, [activeMap?.webMap?.itemId, getExtentStorageKey]);

  /**
   * Handle map click events
   */
  const handleMapClick = useCallback(async (event) => {
    if (!viewRef.current) return;

    // Force close the Esri popup on every click
    if (viewRef.current.popup) {
      viewRef.current.popup.close();
      viewRef.current.popup.visible = false;
    }

    console.log('[MapView] handleMapClick - Starting hit test');
    console.log('[MapView] handleMapClick - Popup state before:', {
      autoOpenEnabled: viewRef.current.popup?.autoOpenEnabled,
      visible: viewRef.current.popup?.visible
    });

    try {
      const response = await viewRef.current.hitTest(event);
      console.log('[MapView] handleMapClick - Hit test results:', response.results.length, 'hits');
      
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

        // Check if it's a markup feature
        if (clickedGraphic.layer === markupLayerRef.current) {
          setSelectedFeature({
            geometry: clickedGraphic.geometry,
            attributes: clickedGraphic.attributes || {}
          });
          setIsMarkupFeature(true);
          setRelatedFeatures([]);
          setShowFeaturePanel(true);
          return;
        }

        // Handle search result click
        const featureIndex = clickedGraphic.attributes?._index;
        if (featureIndex !== undefined && searchResults?.features) {
          const feature = searchResults.features[featureIndex];
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
            handleFeatureSelect(enrichedFeature, null, sourceLayer);
          }
        }
        return;
      }

      // Check for operational layer hits - only include layers that had popup enabled in webmap
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

        // Only include layers that had popup enabled in the original webmap config
        const originalPopupEnabled = originalPopupEnabledRef.current.get(layerId);
        return originalPopupEnabled === true;
      });

      console.log('[MapView] handleMapClick - Layer hits (popup enabled only):', layerHits.length);
      layerHits.forEach((hit, idx) => {
        console.log(`[MapView] handleMapClick - Layer hit ${idx}:`, {
          layerId: hit.graphic.layer?.id,
          layerTitle: hit.graphic.layer?.title,
          hasPopupTemplate: !!hit.graphic.layer?.popupTemplate,
          originalPopupEnabled: originalPopupEnabledRef.current.get(hit.graphic.layer?.id)
        });
      });

      if (layerHits.length > 0) {
        const hit = layerHits[0];
        const feature = {
          geometry: hit.graphic.geometry?.toJSON?.() || hit.graphic.geometry,
          attributes: hit.graphic.attributes || {},
          sourceLayerId: hit.graphic.layer?.id
        };

        console.log('[MapView] handleMapClick - Selected feature:', {
          sourceLayerId: feature.sourceLayerId,
          attributeKeys: Object.keys(feature.attributes || {}),
          hasGeometry: !!feature.geometry
        });

        // Force close popup again before opening panel
        if (viewRef.current.popup) {
          viewRef.current.popup.close();
          viewRef.current.popup.visible = false;
        }

        handleFeatureSelect(feature, hit.graphic, hit.graphic.layer);
      }
      
    } catch (err) {
      console.warn('[MapView] Click handler error:', err);
    }
  }, [searchResults]);

  /**
   * Handle feature selection (opens FeatureInfoPanel)
   */
  const handleFeatureSelect = useCallback((feature, graphic = null, layer = null) => {
    console.log('[MapView] handleFeatureSelect - Input:', {
      featureSourceLayerId: feature?.sourceLayerId,
      featureAttributeKeys: Object.keys(feature?.attributes || {}),
      graphicProvided: !!graphic,
      layerProvided: !!layer,
      layerId: layer?.id,
      layerTitle: layer?.title
    });

    // If no layer provided, try to find the custom feature layer
    let resolvedLayer = layer;
    let enrichedFeature = feature;

    if (!layer && activeMap?.customFeatureInfo?.layerId && mapRef.current) {
      const customLayerId = activeMap.customFeatureInfo.layerId;
      console.log('[MapView] handleFeatureSelect - Looking for custom layer:', customLayerId);
      resolvedLayer = mapRef.current.allLayers?.find(l => l.id === customLayerId);
      console.log('[MapView] handleFeatureSelect - Found custom layer:', !!resolvedLayer, resolvedLayer?.title);
      if (resolvedLayer) {
        enrichedFeature = {
          ...feature,
          sourceLayerId: customLayerId
        };
      }
    }

    console.log('[MapView] handleFeatureSelect - Resolved:', {
      resolvedLayerId: resolvedLayer?.id,
      resolvedLayerTitle: resolvedLayer?.title,
      hasPopupTemplate: !!resolvedLayer?.popupTemplate,
      popupTemplateTitle: resolvedLayer?.popupTemplate?.title,
      popupTemplateContentType: typeof resolvedLayer?.popupTemplate?.content,
      popupTemplateContentIsArray: Array.isArray(resolvedLayer?.popupTemplate?.content),
      enrichedFeatureSourceLayerId: enrichedFeature?.sourceLayerId,
      customFeatureInfoLayerId: activeMap?.customFeatureInfo?.layerId,
      customFeatureInfoTabs: activeMap?.customFeatureInfo?.tabs?.length || 0
    });

    // Log popup template content details for debugging
    if (resolvedLayer?.popupTemplate?.content) {
      console.log('[MapView] handleFeatureSelect - PopupTemplate content:',
        JSON.stringify(resolvedLayer.popupTemplate.content, null, 2).substring(0, 1000)
      );
    }

    setSelectedFeature(enrichedFeature);
    setSelectedFeatureLayer(resolvedLayer);
    setIsMarkupFeature(false);
    setShowFeaturePanel(true);

    // Highlight the feature
    highlightFeature(feature);

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

    console.log('[MapView] Rendering', features.length, 'results');

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
  const highlightFeature = useCallback((feature) => {
    if (!highlightLayerRef.current || !mapReady) {
      console.log('[MapView] highlightFeature - early return:', {
        hasHighlightLayer: !!highlightLayerRef.current,
        mapReady
      });
      return;
    }

    highlightLayerRef.current.removeAll();

    if (!feature?.geometry) {
      console.log('[MapView] highlightFeature - no geometry on feature');
      return;
    }

    const geom = feature.geometry;
    console.log('[MapView] highlightFeature - geometry type detection:', {
      hasRings: !!geom.rings,
      hasPaths: !!geom.paths,
      hasX: geom.x !== undefined,
      hasLongitude: geom.longitude !== undefined,
      type: geom.type,
      keys: Object.keys(geom)
    });

    let geometry;
    let geometryType;

    // Detect geometry type - check for rings (polygon), paths (polyline), or point coordinates
    if (geom.rings && geom.rings.length > 0) {
      geometryType = 'polygon';
      geometry = new Polygon({
        rings: geom.rings,
        spatialReference: geom.spatialReference || { wkid: 4326 }
      });
    } else if (geom.paths && geom.paths.length > 0) {
      geometryType = 'polyline';
      geometry = new Polyline({
        paths: geom.paths,
        spatialReference: geom.spatialReference || { wkid: 4326 }
      });
    } else if (geom.x !== undefined && geom.y !== undefined) {
      geometryType = 'point';
      geometry = new Point({
        x: geom.x,
        y: geom.y,
        spatialReference: geom.spatialReference || { wkid: 4326 }
      });
    } else if (geom.longitude !== undefined && geom.latitude !== undefined) {
      // Handle lat/lon format
      geometryType = 'point';
      geometry = new Point({
        x: geom.longitude,
        y: geom.latitude,
        spatialReference: geom.spatialReference || { wkid: 4326 }
      });
    }

    if (!geometry) {
      console.log('[MapView] highlightFeature - could not create geometry');
      return;
    }

    let symbol;
    if (geometryType === 'polygon') {
      symbol = new SimpleFillSymbol({
        color: [255, 255, 0, 0.3],
        outline: new SimpleLineSymbol({ color: [255, 200, 0], width: 3 })
      });
    } else if (geometryType === 'polyline') {
      symbol = new SimpleLineSymbol({ color: [255, 200, 0], width: 4 });
    } else {
      symbol = new SimpleMarkerSymbol({
        color: [255, 200, 0],
        size: 16,
        outline: { color: [255, 255, 255], width: 3 }
      });
    }

    // Add highlighted feature geometry
    highlightLayerRef.current.add(new Graphic({ geometry, symbol }));
    console.log('[MapView] highlightFeature - added highlight graphic for', geometryType);

    // Also highlight the pushpin marker at feature center (for multi-result views)
    const center = getGeometryCenter(feature.geometry);
    if (center) {
      const pushpinPoint = new Point({
        x: center.x,
        y: center.y,
        spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
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
  }, [mapReady, getGeometryCenter]);

  /**
   * Zoom to a specific feature
   */
  const zoomToFeature = useCallback((feature) => {
    if (!viewRef.current || !feature?.geometry || !mapReady) return;

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
  }, [highlightFeature, mapReady]);

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
   * Handle saving a feature as markup
   */
  const handleSaveAsMarkup = useCallback((feature) => {
    if (!markupLayerRef.current || !feature?.geometry) {
      console.warn('[MapView] Cannot save as markup: missing layer or geometry');
      return;
    }

    console.log('[MapView] Saving feature as markup:', feature);

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

    // Get a name for the markup from feature attributes
    const attrs = feature.attributes || {};
    const featureName = attrs.displayName || attrs.title || attrs.TITLE ||
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
   */
  const handleExportPDF = useCallback(() => {
    console.log('[MapView] Export PDF not yet implemented');
  }, []);

  /**
   * Close feature panel
   */
  const handleCloseFeaturePanel = useCallback(() => {
    setShowFeaturePanel(false);
    setSelectedFeature(null);
    setSelectedFeatureLayer(null);
    setRelatedFeatures([]);
    setIsMarkupFeature(false);
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAll();
    }
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    renderResults,
    highlightFeature,
    zoomToFeature,
    zoomToAllResults,
    clearResults,
    selectFeature: handleFeatureSelect,
    get view() { return viewRef.current; },
    get map() { return mapRef.current; },
    get markupLayer() { return markupLayerRef.current; }
  }), [renderResults, highlightFeature, zoomToFeature, zoomToAllResults, clearResults, handleFeatureSelect]);

  // Update results when searchResults change
  useEffect(() => {
    if (searchResults?.features && mapReady) {
      renderResults(searchResults.features);
    }
  }, [searchResults, renderResults, mapReady]);

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

      {/* ==================== TOP LEFT CONTROLS ==================== */}
      {mapReady && !isLoading && !error && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
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
            </>
          )}
        </div>
      )}


      {/* ==================== BOTTOM RIGHT CONTROLS ==================== */}
      {mapReady && !isLoading && !error && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
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
          relatedFeatures={relatedFeatures}
          currentRelatedIndex={currentRelatedIndex}
          onNavigateRelated={setCurrentRelatedIndex}
          isMarkupFeature={isMarkupFeature}
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
