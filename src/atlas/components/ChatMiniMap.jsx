// src/atlas/components/ChatMiniMap.jsx
// Mini map component for displaying search results in chat view
// Shows features with basemap, zoom controls, and pushpin markers for visibility when zoomed out

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

// ArcGIS ES Modules
import EsriMapView from '@arcgis/core/views/MapView';
import EsriMap from '@arcgis/core/Map';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import Extent from '@arcgis/core/geometry/Extent';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import Basemap from '@arcgis/core/Basemap';

import { getThemeColors, COLOR_PALETTE } from '../utils/themeColors';

/**
 * Get center point from ArcGIS geometry
 */
function getGeometryCenter(geometry) {
  if (!geometry) return null;

  // Point geometry - return directly
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { x: geometry.x, y: geometry.y };
  }

  // Polygon geometry - calculate centroid from first ring
  if (geometry.rings && geometry.rings.length > 0) {
    const ring = geometry.rings[0];
    let sumX = 0, sumY = 0;
    for (const point of ring) {
      sumX += point[0];
      sumY += point[1];
    }
    return { x: sumX / ring.length, y: sumY / ring.length };
  }

  // Polyline geometry - use midpoint of first path
  if (geometry.paths && geometry.paths.length > 0) {
    const path = geometry.paths[0];
    const midIndex = Math.floor(path.length / 2);
    return { x: path[midIndex][0], y: path[midIndex][1] };
  }

  return null;
}

/**
 * ChatMiniMap - A lightweight map component for displaying search results
 * Features: basemap, zoom controls, feature display, zoom to specific feature
 */
const ChatMiniMap = React.forwardRef(function ChatMiniMap({
  features,
  themeColor = 'sky',
  height = 250,
  basemapId = 'streets-navigation-vector'
}, ref) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const mapRef = useRef(null);
  const graphicsLayerRef = useRef(null);
  const pushpinLayerRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const colors = getThemeColors(themeColor);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const initMap = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Create a simple map with basemap
        const map = new EsriMap({
          basemap: basemapId
        });

        mapRef.current = map;

        // Create graphics layer for features
        const graphicsLayer = new GraphicsLayer({
          id: 'chat-mini-map-results'
        });
        graphicsLayerRef.current = graphicsLayer;
        map.add(graphicsLayer);

        // Create pushpin layer (on top of features)
        const pushpinLayer = new GraphicsLayer({
          id: 'chat-mini-map-pushpins'
        });
        pushpinLayerRef.current = pushpinLayer;
        map.add(pushpinLayer);

        // Create highlight layer (on top of pushpins for selected feature)
        const highlightLayer = new GraphicsLayer({
          id: 'chat-mini-map-highlight'
        });
        highlightLayerRef.current = highlightLayer;
        map.add(highlightLayer);

        // Create map view
        const view = new EsriMapView({
          container: containerRef.current,
          map: map,
          ui: {
            components: [] // No default UI components
          },
          constraints: {
            rotationEnabled: false
          },
          popup: {
            autoOpenEnabled: false
          }
        });

        viewRef.current = view;

        await view.when();
        setIsLoading(false);

        // Render features if provided
        if (features && features.length > 0) {
          renderFeatures(features);
        }
      } catch (err) {
        console.error('[ChatMiniMap] Initialization error:', err);
        setError('Failed to load map');
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      mapRef.current = null;
      graphicsLayerRef.current = null;
      pushpinLayerRef.current = null;
      highlightLayerRef.current = null;
    };
  }, [basemapId]);

  // Update features when they change
  useEffect(() => {
    if (viewRef.current && graphicsLayerRef.current && features) {
      renderFeatures(features);
    }
  }, [features]);

  /**
   * Render features on the map with pushpin markers for visibility when zoomed out
   */
  const renderFeatures = useCallback((featuresToRender) => {
    if (!graphicsLayerRef.current || !viewRef.current) return;

    graphicsLayerRef.current.removeAll();
    if (pushpinLayerRef.current) {
      pushpinLayerRef.current.removeAll();
    }

    if (!featuresToRender || featuresToRender.length === 0) return;

    // Get theme color for symbols
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

    const graphics = [];
    const pushpins = [];
    const hasMultipleFeatures = featuresToRender.length > 1;

    featuresToRender.forEach((feature, idx) => {
      if (!feature.geometry) return;

      let geometry;
      const geom = feature.geometry;
      const spatialRef = geom.spatialReference || { wkid: 4326 };

      if (geom.rings) {
        geometry = new Polygon({
          rings: geom.rings,
          spatialReference: spatialRef
        });
      } else if (geom.paths) {
        geometry = new Polyline({
          paths: geom.paths,
          spatialReference: spatialRef
        });
      } else if (geom.x !== undefined) {
        geometry = new Point({
          x: geom.x,
          y: geom.y,
          spatialReference: spatialRef
        });
      }

      if (!geometry) return;

      let symbol;
      if (geom.rings) {
        symbol = new SimpleFillSymbol({
          color: [r, g, b, 0.25],
          outline: new SimpleLineSymbol({
            color: [r, g, b],
            width: 2
          })
        });
      } else if (geom.paths) {
        symbol = new SimpleLineSymbol({
          color: [r, g, b],
          width: 3
        });
      } else {
        symbol = new SimpleMarkerSymbol({
          color: [r, g, b],
          size: 12,
          outline: { color: [255, 255, 255], width: 2 }
        });
      }

      graphics.push(new Graphic({
        geometry,
        symbol,
        attributes: { _index: idx }
      }));

      // Add pushpin marker at center for multiple results (helps visibility when zoomed out)
      if (hasMultipleFeatures) {
        const center = getGeometryCenter(geom);
        if (center) {
          const pushpinGeometry = new Point({
            x: center.x,
            y: center.y,
            spatialReference: spatialRef
          });

          const pushpinSymbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: [r, g, b],
            size: 14,
            outline: { color: [255, 255, 255], width: 2 }
          });

          pushpins.push(new Graphic({
            geometry: pushpinGeometry,
            symbol: pushpinSymbol,
            attributes: { _index: idx }
          }));
        }
      }
    });

    graphicsLayerRef.current.addMany(graphics);

    // Add pushpins on top layer for visibility
    if (pushpinLayerRef.current && pushpins.length > 0) {
      pushpinLayerRef.current.addMany(pushpins);
    }

    // Zoom to features
    if (graphics.length > 0) {
      viewRef.current.goTo(graphics, { padding: 40, duration: 300 });
    }
  }, [themeColor]);

  /**
   * Zoom controls
   */
  const zoomIn = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.goTo({ zoom: viewRef.current.zoom + 1 }, { duration: 200 });
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.goTo({ zoom: viewRef.current.zoom - 1 }, { duration: 200 });
    }
  }, []);

  /**
   * Zoom to a specific feature and highlight it
   */
  const zoomToFeature = useCallback((feature) => {
    if (!viewRef.current || !feature?.geometry) return;

    const geom = feature.geometry;
    const spatialRef = geom.spatialReference || { wkid: 4326 };

    // Create ArcGIS geometry from feature
    let geometry;
    if (geom.rings) {
      geometry = new Polygon({
        rings: geom.rings,
        spatialReference: spatialRef
      });
    } else if (geom.paths) {
      geometry = new Polyline({
        paths: geom.paths,
        spatialReference: spatialRef
      });
    } else if (geom.x !== undefined) {
      geometry = new Point({
        x: geom.x,
        y: geom.y,
        spatialReference: spatialRef
      });
    }

    if (!geometry) return;

    // Clear previous highlight
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAll();
    }

    // Get theme color for highlight symbol (use a contrasting color - orange/red)
    const highlightColor = [255, 100, 0]; // Orange highlight

    // Create highlight symbol based on geometry type
    let highlightSymbol;
    if (geom.rings) {
      highlightSymbol = new SimpleFillSymbol({
        color: [highlightColor[0], highlightColor[1], highlightColor[2], 0.4],
        outline: new SimpleLineSymbol({
          color: highlightColor,
          width: 3
        })
      });
    } else if (geom.paths) {
      highlightSymbol = new SimpleLineSymbol({
        color: highlightColor,
        width: 4
      });
    } else {
      highlightSymbol = new SimpleMarkerSymbol({
        color: highlightColor,
        size: 16,
        outline: { color: [255, 255, 255], width: 3 }
      });
    }

    // Add highlight graphic
    const highlightGraphic = new Graphic({
      geometry,
      symbol: highlightSymbol
    });
    highlightLayerRef.current?.addMany([highlightGraphic]);

    // Zoom to feature with appropriate zoom level
    const zoomOptions = geom.x !== undefined
      ? { target: geometry, zoom: 18 } // Point: zoom to level 18
      : { target: geometry }; // Polygon/line: fit to extent

    viewRef.current.goTo(zoomOptions, { duration: 300 });
  }, []);

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    zoomToFeature
  }), [zoomToFeature]);

  // Handle height as number or percentage string
  const containerStyle = typeof height === 'number'
    ? { height }
    : { height, minHeight: 200 };

  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-200" style={containerStyle}>
      {/* Map Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-1" style={{ color: colors.text600 }} />
            <span className="text-xs text-slate-500">Loading map...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
          <span className="text-xs text-red-500">{error}</span>
        </div>
      )}

      {/* Zoom Controls */}
      {!isLoading && !error && (
        <div className="absolute bottom-2 right-2 flex flex-col bg-white rounded-lg shadow-md overflow-hidden">
          <button
            onClick={zoomIn}
            className="p-1.5 hover:bg-slate-100 border-b border-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" style={{ color: colors.bg600 }} />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 hover:bg-slate-100"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" style={{ color: colors.bg600 }} />
          </button>
        </div>
      )}
    </div>
  );
});

export default ChatMiniMap;
