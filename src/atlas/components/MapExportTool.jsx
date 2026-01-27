// src/atlas/components/MapExportTool.jsx
// Map Export Tool - Generates map exports using ArcGIS print service + client-side composition
//
// Architecture:
// 1. Use ArcGIS print service (org-configured) to generate high-quality map image
// 2. Compose final layout client-side using Canvas + jsPDF based on selected template
// 3. Export to PDF, PNG, or JPG format
//
// REQUIRED PACKAGES: npm install jspdf

import React, { useState, useMemo, useCallback, useRef } from 'react';
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
  Move,
  ZoomIn,
  Info,
  RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useExportArea } from '../hooks/useExportArea';

// ==================== CONSTANTS ====================

const DEFAULT_PRINT_SERVICE_URL = 'https://maps.civ.quest/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task';

// Page dimensions in inches
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

const OUTPUT_FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'png', label: 'PNG', icon: FileImage },
  { id: 'jpg', label: 'JPG', icon: FileImage }
];

const PRESET_SCALES = [
  { value: null, label: 'Auto (fit to view)' },
  { value: 50, label: '1" = 50\'' },
  { value: 100, label: '1" = 100\'' },
  { value: 200, label: '1" = 200\'' },
  { value: 500, label: '1" = 500\'' },
  { value: 1000, label: '1" = 1,000\'' },
  { value: 2000, label: '1" = 2,000\'' },
  { value: 5000, label: '1" = 5,000\'' },
  { value: 10000, label: '1" = 10,000\'' },
  { value: 'custom', label: 'Custom...' }
];

// Export resolution (DPI)
const EXPORT_DPI = 150;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Load an image from URL and return as HTMLImageElement
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
 * Convert hex color to RGB object
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// ==================== CANVAS DRAWING FUNCTIONS ====================

/**
 * Draw north arrow on canvas
 */
function drawNorthArrow(ctx, x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const size = Math.min(width, height) * 0.8;

  ctx.save();
  ctx.translate(centerX, centerY);

  // North half (black filled)
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(size / 6, size / 3);
  ctx.lineTo(0, size / 6);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();

  // South half (white with black outline)
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

  // "N" label
  ctx.fillStyle = '#000000';
  const fontSize = Math.max(size / 4, 10);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, -size / 2 - 2);

  ctx.restore();
}

/**
 * Draw scale bar on canvas
 */
function drawScaleBar(ctx, x, y, width, height, scale, units = 'feet') {
  const padding = 4;
  const barHeight = Math.min(height * 0.25, 10);
  const barY = y + height - padding - barHeight - 16;

  // Calculate scale bar length
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

  // Draw alternating segments
  const segments = 4;
  const segWidth = barWidth / segments;

  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
    ctx.fillRect(barX + i * segWidth, barY, segWidth, barHeight);
  }

  // Draw border
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
  ctx.font = `${fontSize}px Arial, sans-serif`;
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
  ctx.textAlign = 'left';
  ctx.fillText('0', barX, barY + barHeight + 4);
}

/**
 * Draw legend on canvas
 */
function drawLegend(ctx, x, y, width, height, legendItems, element) {
  const padding = 8;

  // Background
  ctx.fillStyle = element.content?.backgroundColor || '#ffffff';
  ctx.fillRect(x, y, width, height);

  // Border
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  let currentY = y + padding;

  // Title
  if (element.content?.showTitle !== false) {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(element.content?.title || 'Legend', x + padding, currentY);
    currentY += 20;
  }

  // Legend items
  ctx.font = '11px Arial, sans-serif';
  legendItems.forEach((item) => {
    if (currentY + 20 > y + height - padding) return;

    // Draw symbol
    if (item.symbol) {
      ctx.fillStyle = item.symbol.color || '#666666';
      if (item.symbol.type === 'line') {
        ctx.strokeStyle = item.symbol.color || '#666666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + padding, currentY + 8);
        ctx.lineTo(x + padding + 20, currentY + 8);
        ctx.stroke();
      } else {
        ctx.fillRect(x + padding, currentY + 2, 16, 12);
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + padding, currentY + 2, 16, 12);
      }
    } else {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x + padding, currentY + 2, 16, 12);
    }

    // Draw label
    ctx.fillStyle = '#333333';
    ctx.fillText(item.label, x + padding + 24, currentY + 4);

    currentY += 20;
  });
}

/**
 * Draw text element with word wrapping
 */
function drawTextElement(ctx, element, x, y, width, height, customText = null) {
  const padding = 5;
  const text = customText || element.content?.text || '';

  // Background
  if (element.content?.backgroundColor) {
    ctx.fillStyle = element.content.backgroundColor;
    ctx.fillRect(x, y, width, height);
  }

  // Text
  ctx.fillStyle = element.content?.color || '#000000';
  const fontSize = (element.content?.fontSize || 12) * (EXPORT_DPI / 96);
  const fontWeight = element.content?.fontWeight || 'normal';
  ctx.font = `${fontWeight} ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = element.content?.align || 'left';
  ctx.textBaseline = 'top';

  const textX = element.content?.align === 'center' ? x + width / 2 :
                element.content?.align === 'right' ? x + width - padding : x + padding;

  // Word wrap
  const words = text.split(' ');
  let line = '';
  let lineY = y + padding;
  const lineHeight = fontSize * 1.2;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > width - padding * 2 && line !== '') {
      ctx.fillText(line.trim(), textX, lineY);
      line = word + ' ';
      lineY += lineHeight;
      if (lineY > y + height - padding) break;
    } else {
      line = testLine;
    }
  }
  if (lineY <= y + height - padding) {
    ctx.fillText(line.trim(), textX, lineY);
  }
}

/**
 * Draw title element
 */
function drawTitleElement(ctx, element, x, y, width, height, titleText) {
  // Background
  if (element.content?.backgroundColor) {
    ctx.fillStyle = element.content.backgroundColor;
    ctx.fillRect(x, y, width, height);
  }

  // Text
  ctx.fillStyle = element.content?.color || '#000000';
  const fontSize = (element.content?.fontSize || 24) * (EXPORT_DPI / 96);
  const fontWeight = element.content?.fontWeight || 'bold';
  ctx.font = `${fontWeight} ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = element.content?.align || 'center';
  ctx.textBaseline = 'middle';

  const textX = element.content?.align === 'left' ? x + 10 :
                element.content?.align === 'right' ? x + width - 10 :
                x + width / 2;

  ctx.fillText(titleText, textX, y + height / 2);
}

// ==================== ARCGIS PRINT SERVICE ====================

/**
 * Build the Web Map JSON for the ArcGIS print service
 * This creates a map-only export (no layout elements)
 */
function buildWebMapJson(mapView, exportArea, mapWidthPx, mapHeightPx) {
  if (!exportArea || !mapView) return null;

  // Collect basemap layer IDs to exclude from operational layers
  const basemapLayerIds = new Set();
  mapView.map.basemap?.baseLayers?.forEach(layer => basemapLayerIds.add(layer.id));
  mapView.map.basemap?.referenceLayers?.forEach(layer => basemapLayerIds.add(layer.id));

  // Build operational layers
  const operationalLayers = [];
  mapView.map.allLayers.forEach(layer => {
    // Skip invisible, graphics, and system layers
    if (!layer.visible || layer.type === 'graphics' || layer.id === 'export-area-layer') return;
    if (layer.id.startsWith('atlas-')) return;
    if (basemapLayerIds.has(layer.id)) return;

    // Skip vector tile layers (not supported in operationalLayers)
    if (layer.type === 'vector-tile') {
      console.log('[MapExport] Skipping vector tile layer:', layer.title);
      return;
    }

    if (!layer.url) return;

    let layerUrl = layer.url;

    // Feature layers must include layer index
    if (layer.type === 'feature') {
      const hasLayerIndex = /\/\d+\/?$/.test(layerUrl);
      if (!hasLayerIndex) {
        const layerId = layer.layerId ?? 0;
        if (layerUrl.includes('FeatureServer') || layerUrl.includes('MapServer')) {
          layerUrl = `${layerUrl.replace(/\/$/, '')}/${layerId}`;
        }
      }

      operationalLayers.push({
        id: layer.id,
        title: layer.title || layer.id,
        url: layerUrl,
        visibility: true,
        opacity: layer.opacity ?? 1
      });
      return;
    }

    // Map image layers with visible sublayers
    if (layer.type === 'map-image') {
      const layerDef = {
        id: layer.id,
        title: layer.title || layer.id,
        url: layerUrl,
        visibility: true,
        opacity: layer.opacity ?? 1
      };

      if (layer.sublayers) {
        const visibleIds = [];
        layer.sublayers.forEach(sub => {
          if (sub.visible) visibleIds.push(sub.id);
        });
        if (visibleIds.length > 0) {
          layerDef.visibleLayers = visibleIds;
        }
      }

      operationalLayers.push(layerDef);
      return;
    }

    // Tile layers and other types
    operationalLayers.push({
      id: layer.id,
      title: layer.title || layer.id,
      url: layerUrl,
      visibility: true,
      opacity: layer.opacity ?? 1
    });
  });

  // Build basemap layers
  const baseMapLayers = [];
  if (mapView.map.basemap?.baseLayers) {
    mapView.map.basemap.baseLayers.forEach(layer => {
      if (layer.type === 'vector-tile') {
        // Vector tile basemaps need special handling (only works with ArcGIS Pro services)
        const styleUrl = layer.styleUrl || (layer.url ? `${layer.url}/resources/styles/root.json` : null);
        if (styleUrl) {
          console.log('[MapExport] Warning: Vector tile basemaps may not work with all print services');
          baseMapLayers.push({
            id: layer.id,
            type: 'VectorTileLayer',
            layerType: 'VectorTileLayer',
            title: layer.title || layer.id,
            styleUrl: styleUrl,
            visibility: true,
            opacity: layer.opacity ?? 1
          });
        }
      } else if (layer.url) {
        baseMapLayers.push({
          id: layer.id,
          title: layer.title || layer.id,
          url: layer.url,
          visibility: true,
          opacity: layer.opacity ?? 1
        });
      }
    });
  }

  // Calculate map scale (feet per inch * 12 = scale denominator)
  const mapScale = exportArea.scale * 12;

  const webMapJson = {
    mapOptions: {
      extent: {
        xmin: exportArea.xmin,
        ymin: exportArea.ymin,
        xmax: exportArea.xmax,
        ymax: exportArea.ymax,
        spatialReference: mapView.spatialReference.toJSON()
      },
      scale: mapScale
    },
    operationalLayers,
    exportOptions: {
      dpi: 96,
      outputSize: [mapWidthPx, mapHeightPx]
    }
  };

  if (baseMapLayers.length > 0) {
    webMapJson.baseMap = {
      title: mapView.map.basemap?.title || 'Basemap',
      baseMapLayers
    };
  }

  return webMapJson;
}

/**
 * Call the ArcGIS print service to generate a map image
 */
async function fetchMapFromPrintService(printServiceUrl, webMapJson) {
  console.log('[MapExport] Calling print service:', printServiceUrl);
  console.log('[MapExport] Web Map JSON:', JSON.stringify(webMapJson, null, 2));

  const params = new URLSearchParams();
  params.append('Web_Map_as_JSON', JSON.stringify(webMapJson));
  params.append('Format', 'PNG32');
  params.append('Layout_Template', 'MAP_ONLY');
  params.append('f', 'json');

  const response = await fetch(`${printServiceUrl}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Print service returned HTTP ${response.status}`);
  }

  const result = await response.json();
  console.log('[MapExport] Print service response:', result);

  if (result.error) {
    const details = result.error.details?.join('; ') || '';
    throw new Error(`Print service error: ${result.error.message}${details ? ` - ${details}` : ''}`);
  }

  // Extract result URL from various response formats
  let resultUrl = result.results?.[0]?.value?.url ||
                  result.value?.url ||
                  result.url ||
                  (typeof result.results?.[0]?.value === 'string' ? result.results[0].value : null);

  if (!resultUrl) {
    throw new Error('No output URL in print service response');
  }

  console.log('[MapExport] Map image URL:', resultUrl);
  return resultUrl;
}

// ==================== LEGEND EXTRACTION ====================

/**
 * Extract legend items from the map view
 */
function extractLegendItems(mapView) {
  if (!mapView?.map) return [];

  const items = [];

  mapView.map.allLayers.forEach(layer => {
    if (!layer.visible || layer.listMode === 'hide') return;
    if (layer.type === 'graphics' || layer.id.startsWith('atlas-')) return;
    if (!layer.title) return;

    let symbol = null;
    if (layer.renderer?.symbol) {
      const s = layer.renderer.symbol;
      symbol = {
        type: s.type?.includes('line') ? 'line' : 'fill',
        color: s.color ? `rgba(${s.color.r},${s.color.g},${s.color.b},${s.color.a})` : '#666666'
      };
    }

    items.push({ label: layer.title, symbol });
  });

  return items;
}

// ==================== EXPORT COMPOSITION ====================

/**
 * Compose the final export using Canvas
 * Draws the map image and all template elements
 */
async function composeExport(template, mapImage, legendItems, mapTitle, exportArea, pageDimensions) {
  const pageWidthPx = Math.round(pageDimensions.width * EXPORT_DPI);
  const pageHeightPx = Math.round(pageDimensions.height * EXPORT_DPI);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = pageWidthPx;
  canvas.height = pageHeightPx;
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = template.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);

  // Draw each element
  for (const element of (template.elements || [])) {
    if (element.visible === false) continue;

    // Calculate element position/size in pixels
    const ex = (element.x / 100) * pageWidthPx;
    const ey = (element.y / 100) * pageHeightPx;
    const ew = (element.width / 100) * pageWidthPx;
    const eh = (element.height / 100) * pageHeightPx;

    switch (element.type) {
      case 'map':
        // Draw the map image
        ctx.drawImage(mapImage, ex, ey, ew, eh);
        // Draw border
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(ex, ey, ew, eh);
        break;

      case 'title':
        drawTitleElement(ctx, element, ex, ey, ew, eh, mapTitle);
        break;

      case 'text':
        drawTextElement(ctx, element, ex, ey, ew, eh);
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
            // Aspect-fit the image
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
            console.warn('[MapExport] Failed to load image:', element.content.url);
          }
        }
        break;
    }
  }

  return canvas;
}

/**
 * Generate the final output file (PDF, PNG, or JPG)
 */
function generateOutput(canvas, format, pageDimensions, filename) {
  if (format === 'pdf') {
    const orientation = pageDimensions.width > pageDimensions.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: [pageDimensions.width, pageDimensions.height]
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, pageDimensions.width, pageDimensions.height);
    pdf.save(`${filename}.pdf`);
  } else if (format === 'png') {
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } else if (format === 'jpg') {
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  }
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
  // Get print service URL from config
  const printServiceUrl = atlasConfig?.printServiceUrl || DEFAULT_PRINT_SERVICE_URL;

  // Filter available templates for this map
  const availableTemplates = useMemo(() => {
    const allTemplates = atlasConfig?.exportTemplates || [];
    const enabledTemplateIds = mapConfig?.exportTemplates || [];

    return allTemplates.filter(t =>
      t.enabled !== false && enabledTemplateIds.includes(t.id)
    );
  }, [atlasConfig, mapConfig]);

  // Component state
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    availableTemplates.length > 0 ? availableTemplates[0].id : null
  );
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [showExportArea, setShowExportArea] = useState(true);
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

  // Calculate effective scale
  const effectiveScale = useMemo(() => {
    if (scaleMode === 'custom') {
      const parsed = parseFloat(customScale);
      return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return scaleMode;
  }, [scaleMode, customScale]);

  // Use export area hook
  const { exportArea, zoomToExportArea } = useExportArea(
    mapView,
    selectedTemplate,
    effectiveScale,
    showExportArea,
    accentColor
  );

  // Get page dimensions for template
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
      return `Custom (${template.customWidth}"x${template.customHeight}")`;
    }
    return PAGE_DIMENSIONS[template.pageSize]?.label || template.pageSize;
  }, []);

  // Format scale for display
  const formatScale = useCallback((scale) => {
    if (!scale) return 'Auto';
    if (scale >= 1000) {
      return `1" = ${(scale / 1000).toFixed(1).replace(/\.0$/, '')}k'`;
    }
    return `1" = ${Math.round(scale).toLocaleString()}'`;
  }, []);

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
      console.log('[MapExport] Starting export with template:', selectedTemplate.name);

      // Get page dimensions
      const pageDims = getPageDimensions(selectedTemplate);
      const pageWidthPx = Math.round(pageDims.width * EXPORT_DPI);
      const pageHeightPx = Math.round(pageDims.height * EXPORT_DPI);

      // Find map element in template
      const mapElement = selectedTemplate.elements?.find(e => e.type === 'map' && e.visible !== false);
      if (!mapElement) {
        throw new Error('Template has no map element');
      }

      // Calculate map element size in pixels
      const mapWidthPx = Math.round((mapElement.width / 100) * pageWidthPx);
      const mapHeightPx = Math.round((mapElement.height / 100) * pageHeightPx);

      console.log('[MapExport] Page:', pageDims.width, 'x', pageDims.height, 'inches');
      console.log('[MapExport] Map element:', mapWidthPx, 'x', mapHeightPx, 'px');

      // Step 1: Build web map JSON
      setExportProgress('Building map request...');
      const webMapJson = buildWebMapJson(mapView, exportArea, mapWidthPx, mapHeightPx);
      if (!webMapJson) {
        throw new Error('Failed to build map data');
      }

      // Step 2: Call print service
      setExportProgress('Generating map image...');
      const mapImageUrl = await fetchMapFromPrintService(printServiceUrl, webMapJson);

      // Step 3: Load map image
      setExportProgress('Loading map image...');
      const mapImage = await loadImage(mapImageUrl);
      console.log('[MapExport] Map image loaded:', mapImage.width, 'x', mapImage.height);

      // Step 4: Extract legend items
      setExportProgress('Preparing layout...');
      const legendItems = extractLegendItems(mapView);

      // Step 5: Compose the final export
      setExportProgress('Composing layout...');
      const canvas = await composeExport(
        selectedTemplate,
        mapImage,
        legendItems,
        mapTitle,
        exportArea,
        pageDims
      );

      // Step 6: Generate output file
      setExportProgress('Generating file...');
      const filename = `${mapTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}`;
      generateOutput(canvas, outputFormat, pageDims, filename);

      console.log('[MapExport] Export complete!');
      setExportSuccess(true);
      setExportProgress('');
      setTimeout(() => setExportSuccess(false), 5000);

    } catch (error) {
      console.error('[MapExport] Export failed:', error);
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
        className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        title="Export Map"
      >
        <Printer className="w-5 h-5" style={{ color: accentColor }} />
        <span className="text-sm font-medium text-slate-700">Export</span>
      </button>
    );
  }

  // No templates available
  if (availableTemplates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5" style={{ color: accentColor }} />
            <h3 className="font-semibold text-slate-800">Export Map</h3>
          </div>
          <button
            onClick={onClose || onToggle}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h4 className="font-medium text-slate-700 mb-2">No Export Templates</h4>
          <p className="text-sm text-slate-500">
            No export templates have been configured for this map.
          </p>
        </div>
      </div>
    );
  }

  // Main export panel
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5" style={{ color: accentColor }} />
          <h3 className="font-semibold text-slate-800">Export Map</h3>
        </div>
        <button
          onClick={onClose || onToggle}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Template</label>
          <div className="relative">
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg appearance-none bg-white pr-10 text-sm"
            >
              {availableTemplates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({getPageSizeLabel(t)})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Map Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Map Title</label>
          <input
            type="text"
            value={mapTitle}
            onChange={(e) => setMapTitle(e.target.value)}
            placeholder="Enter map title..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {/* Output Format */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Output Format</label>
          <div className="flex gap-2">
            {OUTPUT_FORMATS.map(format => {
              const Icon = format.icon;
              const isSelected = outputFormat === format.id;
              return (
                <button
                  key={format.id}
                  onClick={() => setOutputFormat(format.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                    ${isSelected ? 'border-transparent text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  style={isSelected ? { backgroundColor: accentColor } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {format.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Scale */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Ruler className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Map Scale
          </label>
          <div className="relative">
            <select
              value={scaleMode === 'custom' ? 'custom' : (scaleMode ?? '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') setScaleMode('custom');
                else if (val === '') setScaleMode(null);
                else setScaleMode(parseInt(val, 10));
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg appearance-none bg-white pr-10 text-sm"
            >
              {PRESET_SCALES.map(p => (
                <option key={String(p.value)} value={p.value ?? ''}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {scaleMode === 'custom' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-600">1" =</span>
              <input
                type="number"
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                placeholder="500"
                min="1"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
              <span className="text-sm text-slate-600">feet</span>
            </div>
          )}

          {exportArea && (
            <p className="text-xs text-slate-500 mt-1.5">
              Effective: {formatScale(exportArea.scale)}
            </p>
          )}
        </div>

        {/* Export Area Toggle */}
        <div className="flex items-center justify-between py-1">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Move className="w-3.5 h-3.5" />
            Show Export Area
          </label>
          <button
            onClick={() => setShowExportArea(!showExportArea)}
            className={`relative w-11 h-6 rounded-full transition-colors ${showExportArea ? '' : 'bg-slate-200'}`}
            style={showExportArea ? { backgroundColor: accentColor } : {}}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${showExportArea ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        {/* Zoom to Export Area */}
        {showExportArea && exportArea && (
          <button
            onClick={zoomToExportArea}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <ZoomIn className="w-4 h-4" />
            Zoom to Export Area
          </button>
        )}

        {/* Export Area Info */}
        {exportArea && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
              <Info className="w-3.5 h-3.5" />
              Export Details
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-slate-400">Map Size:</span>
                <div className="text-slate-700">{exportArea.widthInches?.toFixed(1)}" x {exportArea.heightInches?.toFixed(1)}"</div>
              </div>
              <div>
                <span className="text-slate-400">Ground Area:</span>
                <div className="text-slate-700">{Math.round(exportArea.widthFeet || 0).toLocaleString()}' x {Math.round(exportArea.heightFeet || 0).toLocaleString()}'</div>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {exportProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <p className="text-sm text-blue-700">{exportProgress}</p>
          </div>
        )}

        {/* Error */}
        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">Export Failed</p>
              <p className="text-xs text-red-600 mt-0.5 break-words">{exportError}</p>
            </div>
            <button onClick={() => setExportError(null)} className="p-1 hover:bg-red-100 rounded text-red-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success */}
        {exportSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <p className="text-sm text-green-700">Export complete! Check your downloads.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
        <button
          onClick={handleExport}
          disabled={isExporting || !selectedTemplate || !exportArea}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
 * Export Tool Button - Standalone button to trigger the export tool
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
