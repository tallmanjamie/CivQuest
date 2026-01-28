// src/atlas/components/MapExportTool.jsx
// Map Export Tool - Screenshot-based approach:
// 1. Use ArcGIS MapView.takeScreenshot() to capture the map
// 2. Compose final layout client-side using canvas + jsPDF
//
// REQUIRED PACKAGES:
// npm install jspdf
//
// Features:
// - Template selection from available map templates
// - Output format selection (PDF, PNG, JPG)
// - Export area visualization on map
// - Custom map scale (1" = X feet)
// - Custom map title
// - Client-side layout rendering with title, legend, scalebar, north arrow, images
// - No external print service dependency - uses native screenshot capture

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  FileImage,
  FileText,
  ChevronDown,
  Loader2,
  AlertCircle,
  Check,
  Ruler,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useExportArea } from '../hooks/useExportArea';

// Page sizes in inches
const PAGE_DIMENSIONS = {
  'letter-landscape': { width: 11, height: 8.5, label: 'Letter Landscape' },
  'letter-portrait': { width: 8.5, height: 11, label: 'Letter Portrait' },
  'legal-landscape': { width: 14, height: 8.5, label: 'Legal Landscape' },
  'legal-portrait': { width: 8.5, height: 14, label: 'Legal Portrait' },
  'tabloid-landscape': { width: 17, height: 11, label: 'Tabloid Landscape' },
  'tabloid-portrait': { width: 11, height: 17, label: 'Tabloid Portrait' },
  'a4-landscape': { width: 11.69, height: 8.27, label: 'A4 Landscape' },
  'a4-portrait': { width: 8.27, height: 11.69, label: 'A4 Portrait' },
  'a3-landscape': { width: 16.54, height: 11.69, label: 'A3 Landscape' },
  'a3-portrait': { width: 11.69, height: 16.54, label: 'A3 Portrait' }
};

// Output format options
const OUTPUT_FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'png', label: 'PNG', icon: FileImage },
  { id: 'jpg', label: 'JPG', icon: FileImage }
];

// Common map scales (1 inch = X feet)
const PRESET_SCALES = [
  { value: null, label: 'Auto (fit to view)' },
  { value: 50, label: '1" = 50\'' },
  { value: 100, label: '1" = 100\'' },
  { value: 200, label: '1" = 200\'' },
  { value: 500, label: '1" = 500\'' },
  { value: 'custom', label: 'Custom...' }
];

// Export DPI for print quality
const EXPORT_DPI = 150;

// ==================== HELPER FUNCTIONS ====================

/**
 * Load an image and return a promise
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Draw a north arrow on canvas
 */
function drawNorthArrow(ctx, x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const size = Math.min(width, height) * 0.8;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
  // Draw filled arrow (north half black)
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(size / 6, size / 3);
  ctx.lineTo(0, size / 6);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
  
  // Draw outline arrow (south half white)
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(-size / 6, size / 3);
  ctx.lineTo(0, size / 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Draw "N" label
  ctx.fillStyle = '#000000';
  const fontSize = Math.max(size / 4, 10);
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, -size / 2 - 2);
  
  ctx.restore();
}

/**
 * Draw a scale bar on canvas
 */
function drawScaleBar(ctx, x, y, width, height, scale, units = 'feet') {
  const padding = 4;
  const barHeight = Math.min(height * 0.25, 10);
  const barY = y + height - padding - barHeight - 14; // Leave room for label
  
  // Calculate a nice round number for the scale bar
  const maxWidthInches = (width - padding * 2) / EXPORT_DPI;
  const maxFeet = scale * maxWidthInches;
  
  // Find a nice round number
  const niceNumbers = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];
  let scaleFeet = 100;
  for (const n of niceNumbers) {
    if (n <= maxFeet * 0.9) {
      scaleFeet = n;
    } else {
      break;
    }
  }
  
  // Calculate bar width in pixels
  const barWidthInches = scaleFeet / scale;
  const barWidth = barWidthInches * EXPORT_DPI;
  const barX = x + padding;
  
  // Draw alternating black/white segments
  const segments = 4;
  const segWidth = barWidth / segments;
  
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
    ctx.fillRect(barX + i * segWidth, barY, segWidth, barHeight);
  }
  
  // Draw border around entire bar
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  
  // Draw end ticks
  ctx.beginPath();
  ctx.moveTo(barX, barY - 3);
  ctx.lineTo(barX, barY + barHeight + 3);
  ctx.moveTo(barX + barWidth, barY - 3);
  ctx.lineTo(barX + barWidth, barY + barHeight + 3);
  ctx.stroke();
  
  // Draw label
  ctx.fillStyle = '#000000';
  const fontSize = Math.min(height * 0.3, 12);
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  let label = '';
  if (units === 'feet' || units === 'ft') {
    label = scaleFeet >= 5280 ? `${(scaleFeet / 5280).toFixed(1)} miles` : `${scaleFeet.toLocaleString()} feet`;
  } else if (units === 'meters' || units === 'm') {
    const meters = scaleFeet * 0.3048;
    label = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  } else {
    label = `${scaleFeet.toLocaleString()} ft`;
  }
  
  ctx.fillText(label, barX + barWidth / 2, barY + barHeight + 4);
  
  // Draw 0 label
  ctx.textAlign = 'left';
  ctx.fillText('0', barX, barY + barHeight + 4);
}

/**
 * Calculate optimal legend layout based on available space and number of items
 * Returns layout configuration with item sizing and column arrangement
 */
function calculateLegendLayout(ctx, width, height, legendItems, showTitle, titleHeight) {
  const padding = 10;
  const columnGap = 12;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2 - (showTitle ? titleHeight : 0);

  // Size ranges for legend items
  const minItemHeight = 16;
  const maxItemHeight = 28;
  const minFontSize = 9;
  const maxFontSize = 14;
  const minSymbolSize = 12;
  const maxSymbolSize = 22;

  // Calculate max label width to help determine column count
  let maxLabelWidth = 0;
  legendItems.forEach(item => {
    ctx.font = item.isHeader ? 'bold 12px Arial' : '11px Arial';
    const labelWidth = ctx.measureText(item.label).width;
    maxLabelWidth = Math.max(maxLabelWidth, labelWidth);
  });

  // Estimate minimum column width needed (symbol + gap + label + padding)
  const minColumnWidth = minSymbolSize + 8 + maxLabelWidth + 10;

  // Determine max columns that could fit
  const maxPossibleColumns = Math.max(1, Math.floor((availableWidth + columnGap) / (minColumnWidth + columnGap)));

  // Try different column counts to find optimal layout
  let bestLayout = null;

  for (let numColumns = 1; numColumns <= Math.min(maxPossibleColumns, 4); numColumns++) {
    const columnWidth = (availableWidth - (numColumns - 1) * columnGap) / numColumns;

    // Calculate how many items fit per column at various sizes
    for (let itemHeight = maxItemHeight; itemHeight >= minItemHeight; itemHeight -= 2) {
      const itemsPerColumn = Math.floor(availableHeight / itemHeight);
      const totalCapacity = itemsPerColumn * numColumns;

      if (totalCapacity >= legendItems.length) {
        // This layout works - calculate sizing
        const sizeRatio = (itemHeight - minItemHeight) / (maxItemHeight - minItemHeight);
        const fontSize = Math.round(minFontSize + sizeRatio * (maxFontSize - minFontSize));
        const symbolSize = Math.round(minSymbolSize + sizeRatio * (maxSymbolSize - minSymbolSize));

        // Check if labels fit in column width
        const symbolSpace = symbolSize + 8;
        const labelSpace = columnWidth - symbolSpace - 5;

        // Verify labels fit (use largest font for measurement)
        ctx.font = `bold ${fontSize}px Arial`;
        let labelsFit = true;
        legendItems.forEach(item => {
          const labelWidth = ctx.measureText(item.label).width;
          if (labelWidth > labelSpace && numColumns > 1) {
            labelsFit = false;
          }
        });

        if (labelsFit || numColumns === 1) {
          // Calculate actual items per column needed for even distribution
          const itemsNeeded = legendItems.length;
          const actualItemsPerColumn = Math.ceil(itemsNeeded / numColumns);

          // Recalculate item height to use available space efficiently
          const optimalItemHeight = Math.min(maxItemHeight, Math.floor(availableHeight / actualItemsPerColumn));
          const finalSizeRatio = (optimalItemHeight - minItemHeight) / (maxItemHeight - minItemHeight);
          const finalFontSize = Math.round(minFontSize + finalSizeRatio * (maxFontSize - minFontSize));
          const finalSymbolSize = Math.round(minSymbolSize + finalSizeRatio * (maxSymbolSize - minSymbolSize));

          bestLayout = {
            numColumns,
            columnWidth,
            itemHeight: optimalItemHeight,
            fontSize: finalFontSize,
            symbolSize: finalSymbolSize,
            itemsPerColumn: actualItemsPerColumn,
            padding,
            columnGap,
            subItemIndent: Math.round(finalSymbolSize * 0.6)
          };

          // Prefer fewer columns with larger items
          if (numColumns === 1 || legendItems.length > itemsPerColumn) {
            return bestLayout;
          }
        }
      }
    }

    // If we found a working layout with this column count, use it
    if (bestLayout && bestLayout.numColumns === numColumns) {
      return bestLayout;
    }
  }

  // Fallback layout if nothing fit perfectly
  if (!bestLayout) {
    const numColumns = Math.min(maxPossibleColumns, Math.ceil(legendItems.length / Math.floor(availableHeight / minItemHeight)));
    const columnWidth = (availableWidth - (numColumns - 1) * columnGap) / numColumns;
    bestLayout = {
      numColumns: Math.max(1, numColumns),
      columnWidth,
      itemHeight: minItemHeight,
      fontSize: minFontSize,
      symbolSize: minSymbolSize,
      itemsPerColumn: Math.ceil(legendItems.length / Math.max(1, numColumns)),
      padding,
      columnGap,
      subItemIndent: 8
    };
  }

  return bestLayout;
}

/**
 * Draw legend on canvas with dynamic sizing and multi-column support
 */
function drawLegend(ctx, x, y, width, height, legendItems, element) {
  const showTitle = element.content?.showTitle !== false;
  const titleHeight = 24;

  // Background
  ctx.fillStyle = element.content?.backgroundColor || '#ffffff';
  ctx.fillRect(x, y, width, height);

  // Border
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Calculate optimal layout
  const layout = calculateLegendLayout(ctx, width, height, legendItems, showTitle, titleHeight);

  let currentY = y + layout.padding;

  // Title
  if (showTitle) {
    ctx.fillStyle = '#000000';
    const titleFontSize = Math.max(12, layout.fontSize + 2);
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(element.content?.title || 'Legend', x + layout.padding, currentY);
    currentY += titleHeight;
  }

  const contentStartY = currentY;

  // Draw legend items in columns
  legendItems.forEach((item, index) => {
    // Calculate which column this item belongs to
    const columnIndex = Math.floor(index / layout.itemsPerColumn);
    const rowIndex = index % layout.itemsPerColumn;

    // Skip if we exceed column count (shouldn't happen with proper layout calculation)
    if (columnIndex >= layout.numColumns) return;

    // Calculate position
    const columnX = x + layout.padding + columnIndex * (layout.columnWidth + layout.columnGap);
    const itemY = contentStartY + rowIndex * layout.itemHeight;

    // Skip if item would exceed bounds
    if (itemY + layout.itemHeight > y + height - layout.padding) return;

    // Calculate x offset for sub-items
    const itemX = columnX + (item.isSubItem ? layout.subItemIndent : 0);
    const symbolSize = item.isSubItem ? Math.round(layout.symbolSize * 0.8) : layout.symbolSize;
    const symbolY = itemY + Math.round((layout.itemHeight - symbolSize + 4) / 2);

    // Set font based on item type
    const baseFontSize = layout.fontSize;
    if (item.isHeader) {
      ctx.font = `bold ${baseFontSize}px Arial`;
    } else if (item.isSubItem) {
      ctx.font = `${Math.round(baseFontSize * 0.9)}px Arial`;
    } else {
      ctx.font = `${baseFontSize}px Arial`;
    }

    // Draw symbol
    if (item.symbol) {
      if (item.symbol.type === 'line') {
        // Line symbol - draw as a horizontal line
        ctx.strokeStyle = item.symbol.color || '#888888';
        ctx.lineWidth = Math.max(2, symbolSize / 8);
        ctx.beginPath();
        const lineY = itemY + layout.itemHeight / 2;
        ctx.moveTo(itemX, lineY);
        ctx.lineTo(itemX + symbolSize + 4, lineY);
        ctx.stroke();
      } else if (item.symbol.hasTransparentFill && item.symbol.outlineColor) {
        // Polygon with transparent fill - draw outline only (no fill)
        ctx.strokeStyle = item.symbol.outlineColor;
        ctx.lineWidth = Math.max(2, symbolSize / 8);
        ctx.strokeRect(itemX, symbolY, symbolSize, symbolSize - 4);
      } else if (item.symbol.color) {
        // Filled polygon - draw filled rectangle with border
        ctx.fillStyle = item.symbol.color;
        ctx.fillRect(itemX, symbolY, symbolSize, symbolSize - 4);
        // Add border for better visibility
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(itemX, symbolY, symbolSize, symbolSize - 4);
      } else {
        // Fallback - draw gray square
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(itemX, symbolY, symbolSize, symbolSize - 4);
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(itemX, symbolY, symbolSize, symbolSize - 4);
      }
    } else if (!item.isHeader) {
      // Default gray square for items without symbol
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(itemX, symbolY, symbolSize, symbolSize - 4);
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(itemX, symbolY, symbolSize, symbolSize - 4);
    }

    // Draw label
    ctx.fillStyle = item.isHeader ? '#000000' : '#333333';
    const labelX = item.isHeader && !item.symbol ? itemX : itemX + symbolSize + 8;
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, labelX, itemY + layout.itemHeight / 2);
  });
}

// ==================== MAIN COMPONENT ====================

export default function MapExportTool({
  mapView,
  mapConfig,
  atlasConfig,
  isExpanded = false,
  onToggle,
  onClose,
  accentColor = '#004E7C'
}) {
  // Get available templates for this map
  const availableTemplates = useMemo(() => {
    console.group('🖨️ MapExportTool - Template Filtering');
    console.log('atlasConfig:', atlasConfig);
    console.log('atlasConfig keys:', atlasConfig ? Object.keys(atlasConfig) : 'null');
    console.log('atlasConfig.exportTemplates:', atlasConfig?.exportTemplates);
    console.log('mapConfig:', mapConfig);
    console.log('mapConfig.exportTemplates:', mapConfig?.exportTemplates);
    
    const allTemplates = atlasConfig?.exportTemplates || [];
    const enabledTemplateIds = mapConfig?.exportTemplates || [];
    
    console.log('All templates count:', allTemplates.length);
    console.log('Enabled IDs:', enabledTemplateIds);
    
    const filtered = allTemplates.filter(t => 
      t.enabled !== false && enabledTemplateIds.includes(t.id)
    );
    
    console.log('Filtered count:', filtered.length);
    console.groupEnd();
    
    return filtered;
  }, [atlasConfig, mapConfig]);

  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    availableTemplates.length > 0 ? availableTemplates[0].id : null
  );
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [showExportArea, setShowExportArea] = useState(false);
  const [scaleMode, setScaleMode] = useState(null);
  const [customScale, setCustomScale] = useState('');
  const [mapTitle, setMapTitle] = useState(mapConfig?.name || 'Map Export');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  // Get selected template
  const selectedTemplate = useMemo(() =>
    availableTemplates.find(t => t.id === selectedTemplateId),
    [availableTemplates, selectedTemplateId]
  );

  // Disable export area display when in auto mode
  useEffect(() => {
    if (scaleMode === null) {
      setShowExportArea(false);
    }
  }, [scaleMode]);

  // Get effective scale (feet per inch)
  const effectiveScale = useMemo(() => {
    if (scaleMode === 'custom') {
      const parsed = parseFloat(customScale);
      return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return scaleMode;
  }, [scaleMode, customScale]);

  // Use the export area hook
  const { exportArea } = useExportArea(
    mapView,
    selectedTemplate,
    effectiveScale,
    showExportArea,
    accentColor
  );

  // Get page dimensions
  const getPageDimensions = useCallback((template) => {
    if (!template) return { width: 11, height: 8.5 };
    if (template.pageSize === 'custom') {
      return {
        width: template.customWidth || 11,
        height: template.customHeight || 8.5
      };
    }
    return PAGE_DIMENSIONS[template.pageSize] || { width: 11, height: 8.5 };
  }, []);

  // Get page size label
  const getPageSizeLabel = useCallback((template) => {
    if (!template) return '';
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}"×${template.customHeight}")`;
    }
    return PAGE_DIMENSIONS[template.pageSize]?.label || template.pageSize;
  }, []);

  /**
   * Convert ArcGIS color to CSS color string
   */
  const colorToCss = useCallback((color) => {
    if (!color) return '#888888';

    // Handle Color object with r, g, b, a properties
    if (color.r !== undefined) {
      const alpha = color.a !== undefined ? color.a : 1;
      return `rgba(${color.r},${color.g},${color.b},${alpha})`;
    }

    // Handle RGBA array [r, g, b, a]
    if (Array.isArray(color)) {
      const [r, g, b, a = 1] = color;
      return `rgba(${r},${g},${b},${a})`;
    }

    // Handle hex string
    if (typeof color === 'string') {
      return color;
    }

    return '#888888';
  }, []);

  /**
   * Extract symbol info from an ArcGIS symbol
   */
  const extractSymbolInfo = useCallback((symbol) => {
    if (!symbol) return null;

    const symbolType = symbol.type || '';

    // Determine if line or fill based on symbol type
    const isLine = symbolType.includes('line') ||
                   symbolType === 'simple-line' ||
                   symbolType === 'esriSLS';

    // Get the fill/line color
    let symbolColor = symbol.color;
    let outlineColor = null;
    let hasTransparentFill = false;

    // For fill symbols, check if fill is transparent and capture outline separately
    if (!isLine && symbol.outline?.color) {
      const fillColor = symbol.color;
      // Check if fill is mostly transparent
      if (!fillColor ||
          (Array.isArray(fillColor) && (fillColor.length < 4 || fillColor[3] < 0.1)) ||
          (fillColor?.a !== undefined && fillColor.a < 0.1)) {
        hasTransparentFill = true;
        outlineColor = colorToCss(symbol.outline.color);
      }
    }

    return {
      type: isLine ? 'line' : 'fill',
      color: hasTransparentFill ? null : colorToCss(symbolColor),
      outlineColor: outlineColor,
      hasTransparentFill: hasTransparentFill
    };
  }, [colorToCss]);

  /**
   * Get legend items from the map
   */
  const getLegendItems = useCallback(() => {
    if (!mapView?.map) return [];

    const items = [];

    // Get basemap layer IDs to exclude them from the legend
    const basemapLayerIds = new Set();
    if (mapView.map.basemap) {
      mapView.map.basemap.baseLayers?.forEach(layer => {
        basemapLayerIds.add(layer.id);
      });
      mapView.map.basemap.referenceLayers?.forEach(layer => {
        basemapLayerIds.add(layer.id);
      });
    }

    mapView.map.allLayers.forEach(layer => {
      if (!layer.visible || layer.listMode === 'hide') return;
      if (layer.type === 'graphics' || layer.id.startsWith('atlas-')) return;
      if (layer.id === 'export-area-layer') return;
      if (!layer.title) return;
      // Exclude basemap layers from legend
      if (basemapLayerIds.has(layer.id)) return;

      const renderer = layer.renderer;

      if (!renderer) {
        // No renderer, add layer with default symbol
        items.push({
          label: layer.title,
          symbol: null
        });
        return;
      }

      // Handle different renderer types
      if (renderer.type === 'simple' || renderer.symbol) {
        // Simple renderer - single symbol for all features
        items.push({
          label: layer.title,
          symbol: extractSymbolInfo(renderer.symbol)
        });
      } else if (renderer.type === 'unique-value' && renderer.uniqueValueInfos) {
        // Unique value renderer - add header for layer, then each unique value
        items.push({
          label: layer.title,
          symbol: extractSymbolInfo(renderer.defaultSymbol),
          isHeader: true
        });

        // Show all unique values (no limit)
        renderer.uniqueValueInfos.forEach(info => {
          items.push({
            label: info.label || info.value || 'Value',
            symbol: extractSymbolInfo(info.symbol),
            isSubItem: true
          });
        });
      } else if (renderer.type === 'class-breaks' && renderer.classBreakInfos) {
        // Class breaks renderer - add header for layer, then each class
        items.push({
          label: layer.title,
          symbol: extractSymbolInfo(renderer.defaultSymbol),
          isHeader: true
        });

        // Show all class breaks (no limit)
        renderer.classBreakInfos.forEach(info => {
          items.push({
            label: info.label || `${info.minValue} - ${info.maxValue}`,
            symbol: extractSymbolInfo(info.symbol),
            isSubItem: true
          });
        });
      } else {
        // Unknown renderer type, just add with default
        items.push({
          label: layer.title,
          symbol: null
        });
      }
    });

    return items;
  }, [mapView, extractSymbolInfo]);

  /**
   * Capture map screenshot using ArcGIS MapView.takeScreenshot()
   *
   * This approach:
   * 1. Temporarily hides the export area graphic
   * 2. Zooms to the export extent
   * 3. Calculates exact screen coordinates for the export area
   * 4. Takes a high-quality screenshot of only that area
   * 5. Returns the captured image as an HTMLImageElement
   */
  const captureMapScreenshot = useCallback(async (mapWidthPx, mapHeightPx) => {
    if (!exportArea || !mapView) {
      throw new Error('Unable to capture map: missing export area or map view');
    }

    console.log('🖨️ Capturing map screenshot...');
    console.log('🖨️ Export area:', exportArea);
    console.log('🖨️ Target size:', mapWidthPx, 'x', mapHeightPx, 'px');

    // Find and hide the export area layer temporarily
    const exportAreaLayer = mapView.map.findLayerById('export-area-layer');
    const wasExportAreaVisible = exportAreaLayer?.visible;
    if (exportAreaLayer) {
      exportAreaLayer.visible = false;
    }

    // Save current view state
    const originalCenter = mapView.center.clone();
    const originalZoom = mapView.zoom;
    const originalExtent = mapView.extent.clone();

    try {
      // Import required modules
      const [Extent, Point] = await Promise.all([
        import('@arcgis/core/geometry/Extent').then(m => m.default),
        import('@arcgis/core/geometry/Point').then(m => m.default)
      ]);

      // Create extent for the export area
      const targetExtent = new Extent({
        xmin: exportArea.xmin,
        ymin: exportArea.ymin,
        xmax: exportArea.xmax,
        ymax: exportArea.ymax,
        spatialReference: mapView.spatialReference
      });

      console.log('🖨️ Zooming to export extent...');

      // Zoom to the export area extent (without animation for speed)
      await mapView.goTo(targetExtent, { animate: false });

      // Wait for the view to finish updating and tiles to load
      await mapView.whenLayerView(mapView.map.basemap?.baseLayers?.getItemAt(0)).catch(() => {});

      // Additional wait to ensure all tiles are loaded
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wait for any pending updates
      if (mapView.updating) {
        await new Promise(resolve => {
          const handle = mapView.watch('updating', (updating) => {
            if (!updating) {
              handle.remove();
              resolve();
            }
          });
          // Timeout after 5 seconds
          setTimeout(() => {
            handle.remove();
            resolve();
          }, 5000);
        });
      }

      console.log('🖨️ Taking screenshot...');

      // Calculate the screen coordinates of the export area corners
      // This accounts for any aspect ratio differences between the view and export area
      const topLeft = mapView.toScreen(new Point({
        x: exportArea.xmin,
        y: exportArea.ymax,
        spatialReference: mapView.spatialReference
      }));
      const bottomRight = mapView.toScreen(new Point({
        x: exportArea.xmax,
        y: exportArea.ymin,
        spatialReference: mapView.spatialReference
      }));

      // Calculate the screen area that corresponds exactly to the export extent
      const screenArea = {
        x: Math.round(topLeft.x),
        y: Math.round(topLeft.y),
        width: Math.round(bottomRight.x - topLeft.x),
        height: Math.round(bottomRight.y - topLeft.y)
      };

      console.log('🖨️ Export area screen coordinates:', screenArea);

      // Calculate the scale factor needed for the desired output resolution
      const scaleX = mapWidthPx / screenArea.width;
      const scaleY = mapHeightPx / screenArea.height;
      const scaleFactor = Math.max(scaleX, scaleY);

      // Take the screenshot with the area parameter to capture exactly the export extent
      // We capture just the area we need at higher resolution
      const screenshot = await mapView.takeScreenshot({
        area: screenArea,
        width: mapWidthPx,
        height: mapHeightPx,
        format: 'png'
      });

      console.log('🖨️ Screenshot captured:', screenshot.data.width, 'x', screenshot.data.height);

      // Create an image element from the screenshot
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load screenshot image'));
        img.src = screenshot.dataUrl;
      });

      return img;
    } finally {
      // Restore the export area layer visibility
      if (exportAreaLayer && wasExportAreaVisible) {
        exportAreaLayer.visible = true;
      }

      // Restore original view (without animation)
      try {
        await mapView.goTo(originalExtent, { animate: false });
      } catch (e) {
        console.warn('🖨️ Could not restore original view:', e);
      }
    }
  }, [exportArea, mapView]);

  /**
   * Main export handler
   */
  const handleExport = async () => {
    if (!selectedTemplate || !mapView || !exportArea) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);
    setExportProgress('Preparing export...');

    try {
      console.group('🖨️ MapExportTool - Starting Export');
      
      // Get page dimensions
      const pageDims = getPageDimensions(selectedTemplate);
      const pageWidthPx = Math.round(pageDims.width * EXPORT_DPI);
      const pageHeightPx = Math.round(pageDims.height * EXPORT_DPI);

      console.log('Page:', pageDims, '→', pageWidthPx, 'x', pageHeightPx, 'px');

      // Find map element
      const mapElement = selectedTemplate.elements?.find(e => e.type === 'map' && e.visible !== false);
      
      if (!mapElement) {
        throw new Error('Template has no map element');
      }

      // Calculate map element size in pixels
      const mapWidthPx = Math.round((mapElement.width / 100) * pageWidthPx);
      const mapHeightPx = Math.round((mapElement.height / 100) * pageHeightPx);

      console.log('Map element:', mapElement.width, '%', mapElement.height, '% →', mapWidthPx, 'x', mapHeightPx, 'px');

      // Step 1: Capture map screenshot
      setExportProgress('Capturing map screenshot...');
      const mapImage = await captureMapScreenshot(mapWidthPx, mapHeightPx);
      console.log('🖨️ Map screenshot captured:', mapImage.width, 'x', mapImage.height);

      // Step 2: Create canvas for layout composition
      setExportProgress('Composing layout...');
      const canvas = document.createElement('canvas');
      canvas.width = pageWidthPx;
      canvas.height = pageHeightPx;
      const ctx = canvas.getContext('2d');

      // Fill background
      ctx.fillStyle = selectedTemplate.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);

      // Get legend items for later
      const legendItems = getLegendItems();

      // Step 3: Draw each element
      for (const element of (selectedTemplate.elements || [])) {
        if (element.visible === false) continue;

        // Calculate element position/size in pixels
        const ex = (element.x / 100) * pageWidthPx;
        const ey = (element.y / 100) * pageHeightPx;
        const ew = (element.width / 100) * pageWidthPx;
        const eh = (element.height / 100) * pageHeightPx;

        switch (element.type) {
          case 'map':
            // Draw map image
            ctx.drawImage(mapImage, ex, ey, ew, eh);
            // Draw border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(ex, ey, ew, eh);
            break;

          case 'title':
            // Background
            if (element.content?.backgroundColor) {
              ctx.fillStyle = element.content.backgroundColor;
              ctx.fillRect(ex, ey, ew, eh);
            }
            // Text
            ctx.fillStyle = element.content?.color || '#000000';
            const titleFontSize = (element.content?.fontSize || 24) * (EXPORT_DPI / 96);
            ctx.font = `${element.content?.fontWeight || 'bold'} ${titleFontSize}px Arial`;
            ctx.textAlign = element.content?.align || 'center';
            ctx.textBaseline = 'middle';
            const titleX = element.content?.align === 'left' ? ex + 10 : 
                          element.content?.align === 'right' ? ex + ew - 10 : 
                          ex + ew / 2;
            ctx.fillText(mapTitle, titleX, ey + eh / 2);
            break;

          case 'text':
            // Background
            if (element.content?.backgroundColor) {
              ctx.fillStyle = element.content.backgroundColor;
              ctx.fillRect(ex, ey, ew, eh);
            }
            // Text
            ctx.fillStyle = element.content?.color || '#000000';
            const textFontSize = (element.content?.fontSize || 12) * (EXPORT_DPI / 96);
            ctx.font = `${element.content?.fontWeight || 'normal'} ${textFontSize}px Arial`;
            ctx.textAlign = element.content?.align || 'left';
            ctx.textBaseline = 'top';
            const textX = element.content?.align === 'center' ? ex + ew / 2 : 
                         element.content?.align === 'right' ? ex + ew - 5 : ex + 5;
            
            // Word wrap text
            const words = (element.content?.text || '').split(' ');
            let line = '';
            let lineY = ey + 5;
            const lineHeight = textFontSize * 1.2;
            
            for (const word of words) {
              const testLine = line + word + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > ew - 10 && line !== '') {
                ctx.fillText(line, textX, lineY);
                line = word + ' ';
                lineY += lineHeight;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, textX, lineY);
            break;

          case 'legend':
            drawLegend(ctx, ex, ey, ew, eh, legendItems, element);
            break;

          case 'scalebar':
            drawScaleBar(ctx, ex, ey, ew, eh, exportArea.scale, element.content?.units);
            break;

          case 'northArrow':
            drawNorthArrow(ctx, ex, ey, ew, eh);
            break;

          case 'logo':
          case 'image':
            if (element.content?.url) {
              try {
                const img = await loadImage(element.content.url);
                // Aspect-fit
                const imgAspect = img.width / img.height;
                const boxAspect = ew / eh;
                let drawW, drawH, drawX, drawY;
                if (imgAspect > boxAspect) {
                  drawW = ew;
                  drawH = ew / imgAspect;
                  drawX = ex;
                  drawY = ey + (eh - drawH) / 2;
                } else {
                  drawH = eh;
                  drawW = eh * imgAspect;
                  drawX = ex + (ew - drawW) / 2;
                  drawY = ey;
                }
                ctx.drawImage(img, drawX, drawY, drawW, drawH);
              } catch (e) {
                console.warn('Failed to load image:', element.content.url);
              }
            }
            break;
        }
      }

      // Step 4: Generate output
      setExportProgress('Generating file...');
      const filename = `${mapTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}`;

      if (outputFormat === 'pdf') {
        const orientation = pageDims.width > pageDims.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
          orientation,
          unit: 'in',
          format: [pageDims.width, pageDims.height]
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', 0, 0, pageDims.width, pageDims.height);
        pdf.save(`${filename}.pdf`);
      } else if (outputFormat === 'png') {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (outputFormat === 'jpg') {
        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();
      }

      console.log('🖨️ Export complete!');
      console.groupEnd();

      setExportSuccess(true);
      setExportProgress('');
      setTimeout(() => setExportSuccess(false), 5000);

    } catch (error) {
      console.error('🖨️ Export error:', error);
      console.groupEnd();
      setExportError(error.message || 'Export failed');
      setExportProgress('');
    } finally {
      setIsExporting(false);
    }
  };

  // ==================== RENDER ====================

  // Collapsed button state
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        title="Export Map"
      >
        <Printer className="w-4 h-4" style={{ color: accentColor }} />
        <span className="text-sm font-medium text-slate-700">Export</span>
      </button>
    );
  }

  // No templates available
  if (availableTemplates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-72">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="font-semibold text-sm text-slate-800">Export Map</h3>
          </div>
          <button
            onClick={onClose || onToggle}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
          <h4 className="font-medium text-sm text-slate-700 mb-1">No Export Templates</h4>
          <p className="text-xs text-slate-500">
            No export templates have been configured for this map.
          </p>
        </div>
      </div>
    );
  }

  // Main panel
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-72">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="font-semibold text-sm text-slate-800">Export Map</h3>
        </div>
        <button
          onClick={onClose || onToggle}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Template Selection */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Template</label>
          <div className="relative">
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg appearance-none bg-white pr-8 text-sm"
            >
              {availableTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({getPageSizeLabel(t)})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Map Title */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Map Title</label>
          <input
            type="text"
            value={mapTitle}
            onChange={(e) => setMapTitle(e.target.value)}
            placeholder="Enter map title..."
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* Output Format */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Format</label>
          <div className="flex gap-1.5">
            {OUTPUT_FORMATS.map(format => {
              const Icon = format.icon;
              const isSelected = outputFormat === format.id;
              return (
                <button
                  key={format.id}
                  onClick={() => setOutputFormat(format.id)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-sm font-medium transition-colors
                    ${isSelected ? 'border-transparent text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  style={isSelected ? { backgroundColor: accentColor } : {}}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {format.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Scale with Export Area Toggle */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            <Ruler className="w-3 h-3 inline mr-1 -mt-0.5" />
            Scale
          </label>
          <div className="flex items-center gap-2">
            {/* Scale dropdown - narrower */}
            <div className="relative flex-shrink-0" style={{ width: '120px' }}>
              <select
                value={scaleMode === 'custom' ? 'custom' : (scaleMode ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  const wasAuto = scaleMode === null;
                  if (val === 'custom') setScaleMode('custom');
                  else if (val === '') setScaleMode(null);
                  else setScaleMode(parseInt(val, 10));
                  // Auto-enable show area when switching from auto to a specific scale
                  if (wasAuto && val !== '') {
                    setShowExportArea(true);
                  }
                }}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg appearance-none bg-white pr-6 text-sm"
              >
                {PRESET_SCALES.map(p => (
                  <option key={String(p.value)} value={p.value ?? ''}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {/* Show Export Area toggle - only visible when not in auto mode */}
            {scaleMode !== null && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-slate-500 whitespace-nowrap">Show Area</span>
                <button
                  onClick={() => setShowExportArea(!showExportArea)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${showExportArea ? '' : 'bg-slate-200'}`}
                  style={showExportArea ? { backgroundColor: accentColor } : {}}
                >
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${showExportArea ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
            )}
          </div>

          {scaleMode === 'custom' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-xs text-slate-600">1" =</span>
              <input
                type="number"
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                placeholder="500"
                min="1"
                className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-xs text-slate-600">ft</span>
            </div>
          )}
        </div>

        {/* Progress */}
        {exportProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            <p className="text-xs text-blue-700">{exportProgress}</p>
          </div>
        )}

        {/* Error */}
        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-800">Export Failed</p>
              <p className="text-xs text-red-600 break-words">{exportError}</p>
            </div>
            <button onClick={() => setExportError(null)} className="p-0.5 hover:bg-red-100 rounded text-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Success */}
        {exportSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-green-500" />
            <p className="text-xs text-green-700">Export complete! Check downloads.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 rounded-b-xl">
        <button
          onClick={handleExport}
          disabled={isExporting || !selectedTemplate || !exportArea}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accentColor }}
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Map
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Export Tool Button - A simple button to toggle the export tool
 */
export function ExportToolButton({ onClick, accentColor = '#004E7C', disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
      title="Export Map"
    >
      <Printer className="w-4 h-4" style={{ color: accentColor }} />
      <span className="text-sm font-medium">Export</span>
    </button>
  );
}