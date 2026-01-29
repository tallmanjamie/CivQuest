// src/atlas/components/ChatMiniMap.jsx
// Mini map component for displaying search results in chat view
// Shows features with basemap and zoom controls only

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
 * ChatMiniMap - A lightweight map component for displaying search results
 * Features: basemap, zoom controls, feature display
 */
export default function ChatMiniMap({
  features,
  themeColor = 'sky',
  height = 250,
  basemapId = 'streets-navigation-vector'
}) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const mapRef = useRef(null);
  const graphicsLayerRef = useRef(null);
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
    };
  }, [basemapId]);

  // Update features when they change
  useEffect(() => {
    if (viewRef.current && graphicsLayerRef.current && features) {
      renderFeatures(features);
    }
  }, [features]);

  /**
   * Render features on the map
   */
  const renderFeatures = useCallback((featuresToRender) => {
    if (!graphicsLayerRef.current || !viewRef.current) return;

    graphicsLayerRef.current.removeAll();

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

    const graphics = featuresToRender.map((feature, idx) => {
      if (!feature.geometry) return null;

      let geometry;
      const geom = feature.geometry;

      if (geom.rings) {
        geometry = new Polygon({
          rings: geom.rings,
          spatialReference: geom.spatialReference || { wkid: 4326 }
        });
      } else if (geom.paths) {
        geometry = new Polyline({
          paths: geom.paths,
          spatialReference: geom.spatialReference || { wkid: 4326 }
        });
      } else if (geom.x !== undefined) {
        geometry = new Point({
          x: geom.x,
          y: geom.y,
          spatialReference: geom.spatialReference || { wkid: 4326 }
        });
      }

      if (!geometry) return null;

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

      return new Graphic({
        geometry,
        symbol,
        attributes: { _index: idx }
      });
    }).filter(Boolean);

    graphicsLayerRef.current.addMany(graphics);

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
}
