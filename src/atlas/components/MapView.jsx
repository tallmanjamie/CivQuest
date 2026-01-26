// src/atlas/components/MapView.jsx
// CivQuest Atlas - Map View Component
// ArcGIS WebMap integration with results layer and tools
// Uses @arcgis/core ES modules (same pattern as SpatialFilter.jsx)

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Home, 
  Layers, 
  Maximize2, 
  Minimize2,
  X,
  Loader2
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';

// ArcGIS ES Modules - Import directly from @arcgis/core
import WebMap from '@arcgis/core/WebMap';
import EsriMapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';
import WMSLayer from '@arcgis/core/layers/WMSLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Extent from '@arcgis/core/geometry/Extent';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Basemap from '@arcgis/core/Basemap';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';

// Layer IDs
const RESULTS_LAYER_ID = 'atlas-results-layer';
const HIGHLIGHT_LAYER_ID = 'atlas-highlight-layer';

/**
 * MapView Component
 * Renders ArcGIS WebMap with search results overlay
 * All controls are positioned on the map itself
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
  const graphicsLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const mountedRef = useRef(true);
  const initStartedRef = useRef(false);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  /**
   * Get storage key for persisting map extent
   */
  const getExtentStorageKey = useCallback(() => {
    return `atlas_extent_${config?.id || 'default'}`;
  }, [config?.id]);

  /**
   * Initialize ArcGIS Map
   */
  useEffect(() => {
    // Skip if no container or no webmap config
    if (!containerRef.current || !activeMap?.webMap?.itemId) {
      return;
    }

    // Prevent double initialization in StrictMode
    if (initStartedRef.current) {
      return;
    }

    // Check if a view already exists
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

        // Check if still mounted
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

        graphicsLayerRef.current = graphicsLayer;
        highlightLayerRef.current = highlightLayer;

        // Check if still mounted
        if (!mountedRef.current || !containerRef.current) {
          console.log('[MapView] Component unmounted before view creation');
          return;
        }

        console.log('[MapView] Creating MapView...');

        // Create MapView
        const view = new EsriMapView({
          container: containerRef.current,
          map: webMap,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          ui: {
            components: ['attribution']
          },
          popup: {
            dockEnabled: true,
            dockOptions: {
              buttonEnabled: false,
              breakpoint: false,
              position: 'bottom-right'
            }
          }
        });

        viewRef.current = view;

        // Wait for map to load
        console.log('[MapView] Waiting for map to load...');
        await view.when();

        // Check if still mounted
        if (!mountedRef.current) {
          console.log('[MapView] Component unmounted after view.when()');
          view.destroy();
          return;
        }

        console.log('[MapView] Map loaded, adding layers...');

        // Add graphics layers after map loads
        webMap.addMany([graphicsLayer, highlightLayer]);

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

        console.log('[MapView] Map initialization complete');
        setMapReady(true);
        setIsLoading(false);

      } catch (err) {
        console.error('[MapView] Initialization error:', err);
        if (mountedRef.current) {
          setError(err.message || 'Failed to load map');
          setIsLoading(false);
        }
      }
    };

    initializeMap();

    // Cleanup function
    return () => {
      console.log('[MapView] Cleanup running...');
      mountedRef.current = false;
      
      if (viewRef.current) {
        try {
          viewRef.current.destroy();
        } catch (e) {
          console.warn('[MapView] Error destroying view:', e);
        }
        viewRef.current = null;
        mapRef.current = null;
        graphicsLayerRef.current = null;
        highlightLayerRef.current = null;
      }
      
      initStartedRef.current = false;
      setMapReady(false);
    };
  }, [activeMap?.webMap?.itemId, activeMap?.webMap?.portalUrl, getExtentStorageKey]);

  /**
   * Render search results on map
   */
  const renderResults = useCallback((features) => {
    if (!graphicsLayerRef.current || !mapReady) return;

    const themeColor = config?.ui?.themeColor || 'sky';
    
    // Color mapping for Tailwind colors
    const colorMap = {
      sky: [14, 165, 233],
      blue: [59, 130, 246],
      indigo: [99, 102, 241],
      emerald: [16, 185, 129],
      green: [34, 197, 94],
      amber: [245, 158, 11],
      red: [239, 68, 68]
    };
    
    const [r, g, b] = colorMap[themeColor] || colorMap.sky;

    graphicsLayerRef.current.removeAll();

    const graphics = features.map((feature, idx) => {
      let geometry;
      
      if (feature.geometry?.rings) {
        geometry = new Polygon({
          rings: feature.geometry.rings,
          spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
        });
      } else if (feature.geometry?.x !== undefined) {
        geometry = new Point({
          x: feature.geometry.x,
          y: feature.geometry.y,
          spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
        });
      } else {
        return null;
      }

      const symbol = feature.geometry?.rings
        ? new SimpleFillSymbol({
            color: [r, g, b, 0.2],
            outline: new SimpleLineSymbol({
              color: [r, g, b],
              width: 2
            })
          })
        : new SimpleMarkerSymbol({
            color: [r, g, b],
            size: 12,
            outline: {
              color: [255, 255, 255],
              width: 2
            }
          });

      return new Graphic({
        geometry,
        symbol,
        attributes: { ...feature.attributes, _index: idx },
        popupTemplate: {
          title: feature.attributes?.PROPERTYADDRESS || feature.attributes?.ADDRESS || 'Property',
          content: [
            {
              type: 'fields',
              fieldInfos: Object.keys(feature.attributes || {})
                .filter(k => !k.startsWith('_') && feature.attributes[k] != null)
                .slice(0, 10)
                .map(k => ({ fieldName: k, label: k }))
            }
          ]
        }
      });
    }).filter(Boolean);

    graphicsLayerRef.current.addMany(graphics);

    // Zoom to results
    if (viewRef.current && graphics.length > 0) {
      viewRef.current.goTo(graphics, { padding: 50 });
    }
  }, [config?.ui?.themeColor, mapReady]);

  /**
   * Highlight a single feature
   */
  const highlightFeature = useCallback((feature) => {
    if (!highlightLayerRef.current || !mapReady) return;

    highlightLayerRef.current.removeAll();

    if (!feature) return;

    let geometry;
    if (feature.geometry?.rings) {
      geometry = new Polygon({
        rings: feature.geometry.rings,
        spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
      });
    } else if (feature.geometry?.x !== undefined) {
      geometry = new Point({
        x: feature.geometry.x,
        y: feature.geometry.y,
        spatialReference: feature.geometry.spatialReference || { wkid: 4326 }
      });
    }

    if (!geometry) return;

    const symbol = feature.geometry?.rings
      ? new SimpleFillSymbol({
          color: [255, 255, 0, 0.3],
          outline: new SimpleLineSymbol({
            color: [255, 200, 0],
            width: 3
          })
        })
      : new SimpleMarkerSymbol({
          color: [255, 200, 0],
          size: 16,
          outline: {
            color: [255, 255, 255],
            width: 3
          }
        });

    highlightLayerRef.current.add(new Graphic({ geometry, symbol }));
  }, [mapReady]);

  /**
   * Zoom to a specific feature
   */
  const zoomToFeature = useCallback((feature) => {
    if (!viewRef.current || !feature || !mapReady) return;

    highlightFeature(feature);

    if (feature.geometry) {
      viewRef.current.goTo(
        {
          target: feature.geometry,
          zoom: feature.geometry.rings ? undefined : 18
        },
        { duration: 500 }
      );
    }
  }, [highlightFeature, mapReady]);

  /**
   * Clear results
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
    if (!mapRef.current || !mapReady) return;

    try {
      if (basemapConfig.type === 'esri') {
        mapRef.current.basemap = basemapConfig.id;
      } else if (basemapConfig.type === 'arcgis') {
        const tileLayer = new TileLayer({ url: basemapConfig.url });
        mapRef.current.basemap = new Basemap({ baseLayers: [tileLayer] });
      } else if (basemapConfig.type === 'wms') {
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

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    renderResults,
    highlightFeature,
    zoomToFeature,
    clearResults,
    get view() { return viewRef.current; },
    get map() { return mapRef.current; }
  }), [renderResults, highlightFeature, zoomToFeature, clearResults]);

  // Update results when searchResults change
  useEffect(() => {
    if (searchResults?.features && mapReady) {
      renderResults(searchResults.features);
    }
  }, [searchResults, renderResults, mapReady]);

  const themeColor = config?.ui?.themeColor || 'sky';
  const basemaps = config?.basemaps || [];

  return (
    <div className={`relative w-full h-full ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-20">
          <div className="text-center">
            <Loader2 className={`w-8 h-8 text-${themeColor}-600 animate-spin mx-auto mb-2`} />
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

      {/* Map Controls - All on the map */}
      {mapReady && !isLoading && !error && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
          {/* Zoom Controls */}
          <div className="flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={zoomIn}
              className="p-2 hover:bg-slate-100 border-b border-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={zoomOut}
              className="p-2 hover:bg-slate-100 border-b border-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={goHome}
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
                className={`p-2 bg-white rounded-lg shadow-lg hover:bg-slate-100 transition ${
                  showBasemapPicker ? 'ring-2 ring-sky-500' : ''
                }`}
                title="Change Basemap"
              >
                <Layers className="w-5 h-5 text-slate-600" />
              </button>

              {showBasemapPicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowBasemapPicker(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-1 max-h-80 overflow-y-auto z-40">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Basemaps</span>
                    </div>
                    {basemaps.map((bm) => (
                      <button
                        key={bm.id}
                        onClick={() => changeBasemap(bm)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2 ${
                          activeBasemap === bm.id ? 'bg-sky-50 text-sky-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        {activeBasemap === bm.id && (
                          <div className="w-2 h-2 rounded-full bg-sky-500" />
                        )}
                        <span className={activeBasemap === bm.id ? '' : 'ml-4'}>{bm.label}</span>
                      </button>
                    ))}
                  </div>
                </>
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
      )}

      {/* Results Count Badge */}
      {searchResults?.features?.length > 0 && mapReady && !isLoading && (
        <div className={`absolute top-4 left-4 bg-${themeColor}-600 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg z-20`}>
          {searchResults.features.length} result{searchResults.features.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Clear Results Button */}
      {searchResults?.features?.length > 0 && mapReady && !isLoading && (
        <button
          onClick={clearResults}
          className="absolute top-4 left-32 bg-white text-slate-600 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg z-20 hover:bg-slate-100 flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}

      {/* Feature Side Panel */}
      {showSidePanel && selectedFeature && (
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-xl z-30 overflow-y-auto">
          <div className={`p-4 bg-${themeColor}-600 text-white flex justify-between items-start`}>
            <div>
              <h3 className="font-semibold">
                {selectedFeature.attributes?.PROPERTYADDRESS || 'Property Details'}
              </h3>
              <p className="text-sm opacity-90">
                {selectedFeature.attributes?.GPIN || selectedFeature.attributes?.PARCELID || ''}
              </p>
            </div>
            <button
              onClick={() => { setShowSidePanel(false); setSelectedFeature(null); }}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <dl className="space-y-2">
              {Object.entries(selectedFeature.attributes || {})
                .filter(([k, v]) => !k.startsWith('_') && v != null)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs font-medium text-slate-500 uppercase">{key}</dt>
                    <dd className="text-sm text-slate-800">{String(value)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      )}

      {/* Searching Indicator */}
      {isSearching && mapReady && !isLoading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-2">
          <Loader2 className={`w-4 h-4 text-${themeColor}-600 animate-spin`} />
          <span className="text-sm text-slate-600">Searching...</span>
        </div>
      )}
    </div>
  );
});

export default MapView;
