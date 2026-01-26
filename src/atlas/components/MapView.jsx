// src/atlas/components/MapView.jsx
// CivQuest Atlas - Map View Component
// ArcGIS WebMap integration with results layer and tools

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Home, 
  Layers, 
  Maximize2, 
  Minimize2,
  MapPin,
  Search,
  X,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

// Layer IDs
const RESULTS_LAYER_ID = 'atlas-results-layer';
const HIGHLIGHT_LAYER_ID = 'atlas-highlight-layer';
const BUFFER_LAYER_ID = 'atlas-buffer-layer';

/**
 * MapView Component
 * Renders ArcGIS WebMap with search results overlay
 */
const MapView = forwardRef(function MapView(props, ref) {
  const {
    config,
    activeMap,
    searchResults,
    searchLocation,
    updateSearchResults,
    isSearching
  } = useAtlas();

  // Refs
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const mapRef = useRef(null);
  const modulesRef = useRef(null);
  const graphicsLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);

  /**
   * Get storage key for persisting map extent
   */
  const getExtentStorageKey = useCallback(() => {
    return `atlas_extent_${config?.id || 'default'}`;
  }, [config?.id]);

  /**
   * Initialize ArcGIS Map
   */
  const initializeMap = useCallback(async () => {
    if (!containerRef.current || !activeMap?.webMap?.itemId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load ArcGIS modules
      const modules = await new Promise((resolve, reject) => {
        require([
          'esri/WebMap',
          'esri/views/MapView',
          'esri/layers/GraphicsLayer',
          'esri/layers/TileLayer',
          'esri/layers/WMSLayer',
          'esri/Graphic',
          'esri/geometry/Point',
          'esri/geometry/Polygon',
          'esri/geometry/Extent',
          'esri/Viewpoint',
          'esri/symbols/SimpleMarkerSymbol',
          'esri/symbols/SimpleFillSymbol',
          'esri/symbols/SimpleLineSymbol',
          'esri/Basemap',
          'esri/widgets/Home',
          'esri/widgets/ScaleBar',
          'esri/core/reactiveUtils'
        ], (...mods) => {
          resolve({
            WebMap: mods[0],
            MapView: mods[1],
            GraphicsLayer: mods[2],
            TileLayer: mods[3],
            WMSLayer: mods[4],
            Graphic: mods[5],
            Point: mods[6],
            Polygon: mods[7],
            Extent: mods[8],
            Viewpoint: mods[9],
            SimpleMarkerSymbol: mods[10],
            SimpleFillSymbol: mods[11],
            SimpleLineSymbol: mods[12],
            Basemap: mods[13],
            Home: mods[14],
            ScaleBar: mods[15],
            reactiveUtils: mods[16]
          });
        }, reject);
      });

      modulesRef.current = modules;

      const { 
        WebMap, MapView: EsriMapView, GraphicsLayer, Extent, Viewpoint,
        Home: HomeWidget, ScaleBar, reactiveUtils 
      } = modules;

      // Try to restore saved extent
      let initialExtent = null;
      try {
        const saved = localStorage.getItem(getExtentStorageKey());
        if (saved) {
          initialExtent = Extent.fromJSON(JSON.parse(saved));
        }
      } catch (e) {
        console.warn('[MapView] Could not restore extent:', e);
      }

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
        listMode: 'show'
      });
      graphicsLayerRef.current = graphicsLayer;

      const highlightLayer = new GraphicsLayer({
        id: HIGHLIGHT_LAYER_ID,
        title: 'Highlight',
        listMode: 'hide'
      });
      highlightLayerRef.current = highlightLayer;

      webMap.addMany([graphicsLayer, highlightLayer]);

      // Create MapView
      const view = new EsriMapView({
        container: containerRef.current,
        map: webMap,
        extent: initialExtent,
        constraints: {
          minScale: 0,
          maxScale: 0,
          snapToZoom: false
        },
        ui: {
          components: ['attribution']
        },
        popup: {
          autoOpenEnabled: false,
          defaultPopupTemplateEnabled: false
        }
      });

      viewRef.current = view;

      // Wait for view to be ready
      await view.when();

      // Add widgets
      const homeWidget = new HomeWidget({ view });
      const scaleBar = new ScaleBar({ view, unit: 'dual' });
      
      // Set home viewpoint
      if (webMap.initialViewProperties?.viewpoint && !initialExtent) {
        homeWidget.viewpoint = webMap.initialViewProperties.viewpoint;
      }

      view.ui.add(scaleBar, 'bottom-left');

      // Watch for extent changes to save
      reactiveUtils.when(
        () => view.stationary,
        () => {
          if (view.extent) {
            localStorage.setItem(getExtentStorageKey(), JSON.stringify(view.extent.toJSON()));
          }
        }
      );

      // Handle map clicks
      view.on('click', async (event) => {
        const response = await view.hitTest(event);
        const results = response.results.filter(r => 
          r.graphic?.layer?.id === RESULTS_LAYER_ID
        );
        
        if (results.length > 0) {
          const graphic = results[0].graphic;
          setSelectedFeature(graphic.attributes);
          setShowSidePanel(true);
          highlightFeature(graphic.attributes);
        }
      });

      // Hide hidden layers from config
      if (activeMap.hiddenLayers?.length) {
        webMap.layers.forEach(layer => {
          if (activeMap.hiddenLayers.includes(layer.id)) {
            layer.visible = false;
          }
        });
      }

      setIsInitialized(true);
      setIsLoading(false);

    } catch (err) {
      console.error('[MapView] Initialization error:', err);
      setError(err.message || 'Failed to load map');
      setIsLoading(false);
    }
  }, [activeMap, getExtentStorageKey]);

  /**
   * Render search results on map
   */
  const renderResults = useCallback((features) => {
    if (!graphicsLayerRef.current || !modulesRef.current || !features?.length) {
      return;
    }

    const { Graphic, Point, Polygon, SimpleFillSymbol, SimpleLineSymbol } = modulesRef.current;

    // Clear existing graphics
    graphicsLayerRef.current.removeAll();

    // Result symbol
    const resultSymbol = new SimpleFillSymbol({
      color: [14, 165, 233, 0.3], // sky-500 with opacity
      outline: new SimpleLineSymbol({
        color: [14, 165, 233, 1],
        width: 2
      })
    });

    // Create graphics from features
    const graphics = features.map(feature => {
      let geometry = null;
      
      if (feature.geometry) {
        if (feature.geometry.rings) {
          geometry = new Polygon({
            rings: feature.geometry.rings,
            spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
          });
        } else if (feature.geometry.x !== undefined) {
          geometry = new Point({
            x: feature.geometry.x,
            y: feature.geometry.y,
            spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
          });
        }
      }

      if (!geometry) return null;

      return new Graphic({
        geometry,
        symbol: resultSymbol,
        attributes: feature.attributes
      });
    }).filter(Boolean);

    graphicsLayerRef.current.addMany(graphics);

    // Zoom to results
    if (graphics.length > 0 && viewRef.current) {
      viewRef.current.goTo(graphics, { duration: 500 }).catch(() => {});
    }
  }, []);

  /**
   * Highlight a specific feature
   */
  const highlightFeature = useCallback((attributes) => {
    if (!highlightLayerRef.current || !graphicsLayerRef.current || !modulesRef.current) {
      return;
    }

    const { SimpleFillSymbol, SimpleLineSymbol } = modulesRef.current;

    highlightLayerRef.current.removeAll();

    // Find the graphic with matching attributes
    const graphic = graphicsLayerRef.current.graphics.find(g => {
      const id = attributes.PARCELID || attributes.OBJECTID || attributes.id;
      const gId = g.attributes?.PARCELID || g.attributes?.OBJECTID || g.attributes?.id;
      return id && gId && id === gId;
    });

    if (!graphic) return;

    // Create highlight graphic
    const highlightSymbol = new SimpleFillSymbol({
      color: [234, 179, 8, 0.4], // yellow-500 with opacity
      outline: new SimpleLineSymbol({
        color: [234, 179, 8, 1],
        width: 3
      })
    });

    const highlightGraphic = graphic.clone();
    highlightGraphic.symbol = highlightSymbol;
    highlightLayerRef.current.add(highlightGraphic);
  }, []);

  /**
   * Zoom to a specific feature
   */
  const zoomToFeature = useCallback((feature) => {
    if (!viewRef.current || !feature?.geometry) return;

    const { Polygon, Point } = modulesRef.current;
    let geometry = null;

    if (feature.geometry.rings) {
      geometry = new Polygon({
        rings: feature.geometry.rings,
        spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
      });
    } else if (feature.geometry.x !== undefined) {
      geometry = new Point({
        x: feature.geometry.x,
        y: feature.geometry.y,
        spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
      });
    }

    if (geometry) {
      viewRef.current.goTo({
        target: geometry,
        zoom: 18
      }, { duration: 500 });
    }

    highlightFeature(feature.attributes);
    setSelectedFeature(feature.attributes);
    setShowSidePanel(true);
  }, [highlightFeature]);

  /**
   * Clear all results
   */
  const clearResults = useCallback(() => {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.removeAll();
    }
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAll();
    }
    setSelectedFeature(null);
    setShowSidePanel(false);
  }, []);

  /**
   * Change basemap
   */
  const changeBasemap = useCallback((basemapConfig) => {
    if (!mapRef.current || !modulesRef.current) return;

    const { Basemap, TileLayer, WMSLayer } = modulesRef.current;

    try {
      if (basemapConfig.type === 'esri') {
        // Standard Esri basemap
        mapRef.current.basemap = basemapConfig.id;
      } else if (basemapConfig.type === 'arcgis') {
        // ArcGIS MapServer
        const tileLayer = new TileLayer({ url: basemapConfig.url });
        mapRef.current.basemap = new Basemap({ baseLayers: [tileLayer] });
      } else if (basemapConfig.type === 'wms') {
        // WMS layer
        const wmsLayer = new WMSLayer({
          url: basemapConfig.url,
          sublayers: basemapConfig.wmsLayers?.map(name => ({ name })) || []
        });
        mapRef.current.basemap = new Basemap({ baseLayers: [wmsLayer] });
      }

      setActiveBasemap(basemapConfig.id);
      setShowBasemapPicker(false);
    } catch (err) {
      console.error('[MapView] Basemap change error:', err);
    }
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    renderResults,
    highlightFeature,
    zoomToFeature,
    clearResults,
    view: viewRef.current,
    map: mapRef.current
  }), [renderResults, highlightFeature, zoomToFeature, clearResults]);

  // Initialize map on mount
  useEffect(() => {
    initializeMap();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [initializeMap]);

  // Update results when searchResults change
  useEffect(() => {
    if (searchResults?.features) {
      renderResults(searchResults.features);
    }
  }, [searchResults, renderResults]);

  const themeColor = config?.ui?.themeColor || 'sky';
  const basemaps = config?.basemaps || [];

  return (
    <div className={`relative w-full h-full ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-2" />
            <p className="text-slate-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
          <div className="text-center max-w-md p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Map Error</h3>
            <p className="text-slate-600">{error}</p>
          </div>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        {/* Zoom Controls */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => viewRef.current?.goTo({ zoom: viewRef.current.zoom + 1 })}
            className="p-2 hover:bg-slate-100 border-b border-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => viewRef.current?.goTo({ zoom: viewRef.current.zoom - 1 })}
            className="p-2 hover:bg-slate-100 border-b border-slate-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => {
              const home = viewRef.current?.ui?.find('home');
              if (home) home.go();
            }}
            className="p-2 hover:bg-slate-100"
            title="Home"
          >
            <Home className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Basemap Picker */}
        {basemaps.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowBasemapPicker(!showBasemapPicker)}
              className="p-2 bg-white rounded-lg shadow-lg hover:bg-slate-100"
              title="Change Basemap"
            >
              <Layers className="w-5 h-5 text-slate-600" />
            </button>

            {showBasemapPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 max-h-80 overflow-y-auto">
                {basemaps.map((bm) => (
                  <button
                    key={bm.id}
                    onClick={() => changeBasemap(bm)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 ${
                      activeBasemap === bm.id ? `bg-${themeColor}-50 text-${themeColor}-700` : 'text-slate-700'
                    }`}
                  >
                    {bm.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 bg-white rounded-lg shadow-lg hover:bg-slate-100"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 text-slate-600" />
          ) : (
            <Maximize2 className="w-5 h-5 text-slate-600" />
          )}
        </button>
      </div>

      {/* Results Count Badge */}
      {searchResults?.features?.length > 0 && (
        <div className={`absolute top-4 left-4 bg-${themeColor}-600 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg z-20`}>
          {searchResults.features.length} result{searchResults.features.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Searching Indicator */}
      {isSearching && (
        <div className="absolute top-4 left-4 bg-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg z-20 flex items-center gap-2">
          <Loader2 className={`w-4 h-4 text-${themeColor}-600 animate-spin`} />
          Searching...
        </div>
      )}

      {/* Side Panel for Feature Details */}
      {showSidePanel && selectedFeature && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-xl z-30 flex flex-col">
          <div className={`bg-${themeColor}-700 text-white p-4 flex justify-between items-center`}>
            <h3 className="font-semibold">Property Details</h3>
            <button
              onClick={() => {
                setShowSidePanel(false);
                setSelectedFeature(null);
                highlightLayerRef.current?.removeAll();
              }}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <FeatureDetails attributes={selectedFeature} config={activeMap} />
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Feature Details Component
 */
function FeatureDetails({ attributes, config }) {
  if (!attributes) return null;

  // Get display fields from config or show all
  const displayFields = config?.tableColumns || 
    Object.keys(attributes).map(field => ({ field, label: field }));

  return (
    <div className="space-y-3">
      {displayFields.map(({ field, label }) => {
        const value = attributes[field];
        if (value === null || value === undefined || value === '') return null;

        // Format value
        let displayValue = value;
        if (typeof value === 'number') {
          // Check if it looks like a date timestamp
          if (value > 1000000000000) {
            displayValue = new Date(value).toLocaleDateString();
          } else if (field.toLowerCase().includes('amount') || field.toLowerCase().includes('price')) {
            displayValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
          } else {
            displayValue = value.toLocaleString();
          }
        }

        return (
          <div key={field} className="border-b border-slate-100 pb-2">
            <dt className="text-xs text-slate-500 font-medium uppercase">{label}</dt>
            <dd className="text-sm text-slate-800 mt-0.5">{displayValue}</dd>
          </div>
        );
      })}
    </div>
  );
}

export default MapView;
