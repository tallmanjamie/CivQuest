// src/atlas/hooks/useExportArea.js
// Hook for managing export area visualization on an ArcGIS MapView
// Handles creating, updating, and removing the export area rectangle

import { useCallback, useRef, useEffect, useState } from 'react';

// Page sizes in inches
const PAGE_DIMENSIONS = {
  'letter-landscape': { width: 11, height: 8.5 },
  'letter-portrait': { width: 8.5, height: 11 },
  'legal-landscape': { width: 14, height: 8.5 },
  'legal-portrait': { width: 8.5, height: 14 },
  'tabloid-landscape': { width: 17, height: 11 },
  'tabloid-portrait': { width: 11, height: 17 },
  'a4-landscape': { width: 11.69, height: 8.27 },
  'a4-portrait': { width: 8.27, height: 11.69 },
  'a3-landscape': { width: 16.54, height: 11.69 },
  'a3-portrait': { width: 11.69, height: 16.54 },
  'custom': { width: 11, height: 8.5 }
};

/**
 * useExportArea Hook
 * 
 * Manages the export area rectangle displayed on the map
 * 
 * @param {object} mapView - ArcGIS MapView instance
 * @param {object} template - Selected export template
 * @param {number|null} scale - Scale in feet per inch (null for auto)
 * @param {boolean} visible - Whether to show the export area
 * @param {string} accentColor - Color for the export area outline
 * 
 * @returns {object} { exportArea, zoomToExportArea, updateCenter }
 */
export function useExportArea(mapView, template, scale, visible, accentColor = '#004E7C') {
  const graphicsLayerRef = useRef(null);
  const exportAreaGraphicRef = useRef(null);
  const [exportArea, setExportArea] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Calculate export area dimensions
  const calculateExportArea = useCallback(() => {
    if (!template || !mapView) return null;

    // Get page dimensions
    let pageDims = PAGE_DIMENSIONS[template.pageSize];
    if (template.pageSize === 'custom') {
      pageDims = {
        width: template.customWidth || 11,
        height: template.customHeight || 8.5
      };
    }

    // Find the map element in the template
    const mapElement = template.elements?.find(e => e.type === 'map');
    if (!mapElement) return null;

    // Calculate map area in inches
    const mapWidthInches = (mapElement.width / 100) * pageDims.width;
    const mapHeightInches = (mapElement.height / 100) * pageDims.height;

    // Get map center
    const center = mapView.center;

    if (scale) {
      // Fixed scale: calculate extent based on scale
      const mapWidthFeet = mapWidthInches * scale;
      const mapHeightFeet = mapHeightInches * scale;

      return {
        widthFeet: mapWidthFeet,
        heightFeet: mapHeightFeet,
        widthInches: mapWidthInches,
        heightInches: mapHeightInches,
        scale: scale,
        center: center,
        xmin: center.x - mapWidthFeet / 2,
        ymin: center.y - mapHeightFeet / 2,
        xmax: center.x + mapWidthFeet / 2,
        ymax: center.y + mapHeightFeet / 2
      };
    } else {
      // Auto scale: use current view extent
      const extent = mapView.extent;
      const viewWidthFeet = extent.width;
      const viewHeightFeet = extent.height;

      // Calculate the scale that fits the current view
      const scaleX = viewWidthFeet / mapWidthInches;
      const scaleY = viewHeightFeet / mapHeightInches;
      const autoScale = Math.max(scaleX, scaleY);

      const adjustedWidthFeet = mapWidthInches * autoScale;
      const adjustedHeightFeet = mapHeightInches * autoScale;

      return {
        widthFeet: adjustedWidthFeet,
        heightFeet: adjustedHeightFeet,
        widthInches: mapWidthInches,
        heightInches: mapHeightInches,
        scale: autoScale,
        center: center,
        xmin: center.x - adjustedWidthFeet / 2,
        ymin: center.y - adjustedHeightFeet / 2,
        xmax: center.x + adjustedWidthFeet / 2,
        ymax: center.y + adjustedHeightFeet / 2,
        isAuto: true
      };
    }
  }, [template, mapView, scale]);

  // Update the export area graphic
  const updateGraphic = useCallback(async () => {
    if (!mapView) return;

    // Always calculate export area (needed for export even when not visible)
    const area = calculateExportArea();
    setExportArea(area);

    // Remove existing graphic if not visible
    if (!visible || !template) {
      if (exportAreaGraphicRef.current && graphicsLayerRef.current) {
        graphicsLayerRef.current.remove(exportAreaGraphicRef.current);
        exportAreaGraphicRef.current = null;
      }
      return;
    }

    if (!area) return;

    try {
      // Dynamically import ArcGIS modules
      const [Graphic, GraphicsLayer, Polygon] = await Promise.all([
        import('@arcgis/core/Graphic').then(m => m.default),
        import('@arcgis/core/layers/GraphicsLayer').then(m => m.default),
        import('@arcgis/core/geometry/Polygon').then(m => m.default)
      ]);

      // Create graphics layer if needed
      if (!graphicsLayerRef.current) {
        graphicsLayerRef.current = new GraphicsLayer({
          id: 'export-area-layer',
          title: 'Export Area',
          listMode: 'hide'
        });
        mapView.map.add(graphicsLayerRef.current, mapView.map.layers.length);
      }

      // Remove existing graphic
      if (exportAreaGraphicRef.current) {
        graphicsLayerRef.current.remove(exportAreaGraphicRef.current);
      }

      // Parse accent color to RGB
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 78, b: 124 };
      };

      const rgb = hexToRgb(accentColor);

      // Create polygon for export area
      const polygon = new Polygon({
        rings: [[
          [area.xmin, area.ymin],
          [area.xmin, area.ymax],
          [area.xmax, area.ymax],
          [area.xmax, area.ymin],
          [area.xmin, area.ymin]
        ]],
        spatialReference: mapView.spatialReference
      });

      // Create graphic with styling
      const graphic = new Graphic({
        geometry: polygon,
        symbol: {
          type: 'simple-fill',
          color: [rgb.r, rgb.g, rgb.b, 0.1],
          outline: {
            color: [rgb.r, rgb.g, rgb.b, 0.8],
            width: 2,
            style: 'dash'
          }
        },
        attributes: {
          type: 'export-area'
        }
      });

      graphicsLayerRef.current.add(graphic);
      exportAreaGraphicRef.current = graphic;
      setIsLoaded(true);
    } catch (error) {
      console.error('Error updating export area graphic:', error);
    }
  }, [mapView, template, visible, accentColor, calculateExportArea]);

  // Update when dependencies change
  useEffect(() => {
    updateGraphic();
  }, [updateGraphic]);

  // Also update when map view changes (pan/zoom) - for auto scale mode
  useEffect(() => {
    if (!mapView || scale) return; // Only for auto scale (scale is null)

    const handle = mapView.watch('extent', () => {
      updateGraphic();
    });

    return () => handle.remove();
  }, [mapView, scale, updateGraphic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (graphicsLayerRef.current && mapView?.map) {
        mapView.map.remove(graphicsLayerRef.current);
        graphicsLayerRef.current = null;
      }
    };
  }, [mapView]);

  // Zoom to export area
  const zoomToExportArea = useCallback(() => {
    if (!exportArea || !mapView) return;

    mapView.goTo({
      target: {
        xmin: exportArea.xmin,
        ymin: exportArea.ymin,
        xmax: exportArea.xmax,
        ymax: exportArea.ymax,
        spatialReference: mapView.spatialReference
      }
    }, { duration: 500 });
  }, [mapView, exportArea]);

  // Update center (for dragging the export area)
  const updateCenter = useCallback((newCenter) => {
    if (!mapView) return;
    mapView.goTo({ center: newCenter }, { duration: 0 });
  }, [mapView]);

  return {
    exportArea,
    zoomToExportArea,
    updateCenter,
    isLoaded
  };
}

export default useExportArea;
