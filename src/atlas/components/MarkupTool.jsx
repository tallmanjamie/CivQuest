// src/atlas/components/MarkupTool.jsx
// CivQuest Atlas - Enhanced Markup Tool Component
// Drawing tools with per-type settings and markup management
//
// FIXED: Uses isExpanded prop (matching MapView), inline layout

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Pencil,
  Circle,
  Minus,
  Square,
  Type,
  X,
  Trash2,
  ZoomIn,
  MessageSquare
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

// Color palette
const COLORS = [
  { name: 'Green', value: '#22c55e', dark: '#15803d' },
  { name: 'Blue', value: '#3b82f6', dark: '#1d4ed8' },
  { name: 'Red', value: '#ef4444', dark: '#b91c1c' },
  { name: 'Orange', value: '#f97316', dark: '#c2410c' },
  { name: 'Yellow', value: '#eab308', dark: '#a16207' },
  { name: 'Purple', value: '#8b5cf6', dark: '#6d28d9' },
  { name: 'Pink', value: '#ec4899', dark: '#be185d' },
  { name: 'Cyan', value: '#06b6d4', dark: '#0891b2' },
  { name: 'Black', value: '#1e293b', dark: '#0f172a' },
  { name: 'White', value: '#ffffff', dark: '#e2e8f0' }
];

// Point marker types
const POINT_TYPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'cross', label: 'Cross' },
  { id: 'x', label: 'X' }
];

// Line style types
const LINE_TYPES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dash', label: 'Dash' },
  { id: 'dot', label: 'Dot' },
  { id: 'dash-dot', label: 'Dash-Dot' }
];

// Font families
const FONT_FAMILIES = [
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'Arial', label: 'Arial' },
  { id: 'Georgia', label: 'Georgia' }
];

// Measurement units for points (coordinates)
const POINT_UNITS = [
  { id: 'dms', label: 'DMS' },
  { id: 'dd', label: 'DD' },
  { id: 'latlon', label: 'Lat / Lon' }
];

// Measurement units for lines (length)
const LINE_UNITS = [
  { id: 'feet', label: 'Feet' },
  { id: 'meters', label: 'Meters' },
  { id: 'miles', label: 'Miles' },
  { id: 'kilometers', label: 'Kilometers' }
];

// Measurement units for polygons (area)
const POLYGON_UNITS = [
  { id: 'acres', label: 'Acres' },
  { id: 'sqfeet', label: 'Sq Feet' },
  { id: 'sqmeters', label: 'Sq Meters' }
];

// Helper to convert hex to RGB array
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

// Helper to format coordinates based on unit type
const formatCoordinates = (geometry, unit) => {
  if (!geometry || geometry.type !== 'point') return '';

  const lon = geometry.longitude || geometry.x;
  const lat = geometry.latitude || geometry.y;

  if (unit === 'dd') {
    return `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
  }

  if (unit === 'latlon') {
    return `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`;
  }

  if (unit === 'dms') {
    const toDMS = (coord, isLat) => {
      const absolute = Math.abs(coord);
      const degrees = Math.floor(absolute);
      const minutesNotTruncated = (absolute - degrees) * 60;
      const minutes = Math.floor(minutesNotTruncated);
      const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
      const direction = isLat
        ? (coord >= 0 ? 'N' : 'S')
        : (coord >= 0 ? 'E' : 'W');
      return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
    };
    return `${toDMS(lat, true)}, ${toDMS(lon, false)}`;
  }

  return '';
};

/**
 * Color picker component
 */
function ColorPicker({ value, onChange, label }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-1">
        {COLORS.map(color => (
          <button
            key={color.value}
            onClick={() => onChange(color)}
            className={`w-5 h-5 rounded-full border-2 transition
                       ${value.value === color.value
                         ? 'border-slate-800 scale-110'
                         : 'border-transparent hover:scale-105'}`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Slider component
 */
function Slider({ value, onChange, min, max, step = 1, label, suffix = '' }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">
        {label}: {typeof value === 'number' && value < 1 && step < 1
          ? Math.round(value * 100) + '%'
          : value}{suffix}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

/**
 * Select dropdown component
 */
function Select({ value, onChange, options, label }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
      >
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Checkbox component
 */
function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
      />
      <span className="text-xs text-slate-600">{label}</span>
    </label>
  );
}

/**
 * Settings panel for each tool type
 */
function ToolSettings({ type, settings, onChange }) {
  const updateSetting = (key, value) => {
    onChange({ ...settings, [key]: value });
  };

  if (type === 'point') {
    return (
      <div className="space-y-3 p-3 bg-slate-50 rounded text-xs">
        <Select
          label="Type"
          value={settings.pointType}
          onChange={(v) => updateSetting('pointType', v)}
          options={POINT_TYPES}
        />
        <ColorPicker
          label="Color"
          value={settings.pointColor}
          onChange={(v) => updateSetting('pointColor', v)}
        />
        <Slider
          label="Size"
          value={settings.pointSize}
          onChange={(v) => updateSetting('pointSize', v)}
          min={4} max={24}
        />
        <Slider
          label="Opacity"
          value={settings.pointOpacity}
          onChange={(v) => updateSetting('pointOpacity', v)}
          min={0} max={1} step={0.1}
        />
        <div className="border-t border-slate-200 pt-2 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Select
              label="Measurements"
              value={settings.pointMeasurementUnit}
              onChange={(v) => updateSetting('pointMeasurementUnit', v)}
              options={POINT_UNITS}
            />
          </div>
          <Checkbox
            checked={settings.pointShowLabel}
            onChange={(v) => updateSetting('pointShowLabel', v)}
            label="Label"
          />
        </div>
      </div>
    );
  }

  if (type === 'polyline') {
    return (
      <div className="space-y-3 p-3 bg-slate-50 rounded text-xs">
        <Select
          label="Type"
          value={settings.lineType}
          onChange={(v) => updateSetting('lineType', v)}
          options={LINE_TYPES}
        />
        <ColorPicker
          label="Color"
          value={settings.lineColor}
          onChange={(v) => updateSetting('lineColor', v)}
        />
        <Slider
          label="Size"
          value={settings.lineWidth}
          onChange={(v) => updateSetting('lineWidth', v)}
          min={1} max={10}
        />
        <Slider
          label="Opacity"
          value={settings.lineOpacity}
          onChange={(v) => updateSetting('lineOpacity', v)}
          min={0} max={1} step={0.1}
        />
        <div className="border-t border-slate-200 pt-2 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Select
              label="Measurements"
              value={settings.lineMeasurementUnit}
              onChange={(v) => updateSetting('lineMeasurementUnit', v)}
              options={LINE_UNITS}
            />
          </div>
          <Checkbox
            checked={settings.lineShowLabel}
            onChange={(v) => updateSetting('lineShowLabel', v)}
            label="Label"
          />
        </div>
      </div>
    );
  }

  if (type === 'polygon') {
    return (
      <div className="space-y-3 p-3 bg-slate-50 rounded text-xs">
        <ColorPicker
          label="Line Color"
          value={settings.polygonLineColor}
          onChange={(v) => updateSetting('polygonLineColor', v)}
        />
        <ColorPicker
          label="Fill Color"
          value={settings.polygonFillColor}
          onChange={(v) => updateSetting('polygonFillColor', v)}
        />
        <Slider
          label="Line Size"
          value={settings.polygonLineWidth}
          onChange={(v) => updateSetting('polygonLineWidth', v)}
          min={1} max={10}
        />
        <Slider
          label="Opacity"
          value={settings.polygonOpacity}
          onChange={(v) => updateSetting('polygonOpacity', v)}
          min={0} max={1} step={0.1}
        />
        <div className="border-t border-slate-200 pt-2 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Select
              label="Measurements"
              value={settings.polygonMeasurementUnit}
              onChange={(v) => updateSetting('polygonMeasurementUnit', v)}
              options={POLYGON_UNITS}
            />
          </div>
          <Checkbox
            checked={settings.polygonShowLabel}
            onChange={(v) => updateSetting('polygonShowLabel', v)}
            label="Label"
          />
        </div>
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className="space-y-3 p-3 bg-slate-50 rounded text-xs">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Text</label>
          <input
            type="text"
            value={settings.textContent}
            onChange={(e) => updateSetting('textContent', e.target.value)}
            placeholder="Enter text..."
            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded bg-white text-slate-700"
          />
        </div>
        <Select
          label="Font"
          value={settings.textFont}
          onChange={(v) => updateSetting('textFont', v)}
          options={FONT_FAMILIES}
        />
        <ColorPicker
          label="Color"
          value={settings.textColor}
          onChange={(v) => updateSetting('textColor', v)}
        />
        <Slider
          label="Size"
          value={settings.textSize}
          onChange={(v) => updateSetting('textSize', v)}
          min={8} max={32}
        />
        <Slider
          label="Opacity"
          value={settings.textOpacity}
          onChange={(v) => updateSetting('textOpacity', v)}
          min={0} max={1} step={0.1}
        />
      </div>
    );
  }

  return null;
}

/**
 * MarkupTool Component
 * Enhanced drawing tool with per-type settings
 *
 * Props match what MapView passes:
 * - isExpanded (not isOpen)
 * - onToggle
 */
export default function MarkupTool({
  view,
  graphicsLayer,
  config,
  mapId,
  isExpanded = false,
  onToggle,
  onFeatureClick,
  className = ''
}) {
  const { config: atlasConfig } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTool, setActiveTool] = useState(null);
  const [expandedSettings, setExpandedSettings] = useState(null);
  const [markups, setMarkups] = useState([]);

  // Per-type settings
  const [settings, setSettings] = useState({
    // Point settings
    pointType: 'circle',
    pointColor: COLORS[0],
    pointSize: 10,
    pointOpacity: 0.8,
    pointMeasurementUnit: 'dms',
    pointShowLabel: false,
    // Line settings
    lineType: 'solid',
    lineColor: COLORS[1],
    lineWidth: 2,
    lineOpacity: 1,
    lineMeasurementUnit: 'feet',
    lineShowLabel: false,
    // Polygon settings
    polygonLineColor: COLORS[2],
    polygonFillColor: COLORS[2],
    polygonLineWidth: 2,
    polygonOpacity: 0.4,
    polygonMeasurementUnit: 'acres',
    polygonShowLabel: false,
    // Text settings
    textContent: '',
    textFont: 'sans-serif',
    textColor: COLORS[8],
    textSize: 14,
    textOpacity: 1
  });

  // Refs
  const sketchVMRef = useRef(null);
  const markupLayerRef = useRef(null);
  const panelRef = useRef(null);

  /**
   * Initialize sketch tools
   */
  useEffect(() => {
    if (!view) return;

    // Use provided graphics layer or create one
    let layer = graphicsLayer;
    if (!layer) {
      layer = new GraphicsLayer({
        title: 'Markup Layer',
        listMode: 'hide'
      });
      view.map.add(layer);
    }
    markupLayerRef.current = layer;

    // Create SketchViewModel
    const sketchVM = new SketchViewModel({
      view: view,
      layer: layer,
      updateOnGraphicClick: false,
      defaultCreateOptions: { hasZ: false }
    });

    sketchVMRef.current = sketchVM;

    // Handle draw complete
    sketchVM.on('create', (event) => {
      if (event.state === 'complete') {
        handleDrawComplete(event);
      }
    });

    return () => {
      sketchVM.destroy();
      if (!graphicsLayer) {
        view.map.remove(layer);
      }
    };
  }, [view, graphicsLayer]);

  /**
   * Get symbol for current settings
   */
  const getSymbol = useCallback((type) => {
    if (type === 'point') {
      const rgb = hexToRgb(settings.pointColor.value);
      return {
        type: 'simple-marker',
        style: settings.pointType,
        color: [...rgb, settings.pointOpacity],
        size: settings.pointSize,
        outline: {
          color: hexToRgb(settings.pointColor.dark),
          width: 2
        }
      };
    }

    if (type === 'polyline') {
      const rgb = hexToRgb(settings.lineColor.value);
      return {
        type: 'simple-line',
        style: settings.lineType,
        color: [...rgb, settings.lineOpacity],
        width: settings.lineWidth
      };
    }

    if (type === 'polygon') {
      const lineRgb = hexToRgb(settings.polygonLineColor.value);
      const fillRgb = hexToRgb(settings.polygonFillColor.value);
      return {
        type: 'simple-fill',
        style: 'solid',
        color: [...fillRgb, settings.polygonOpacity],
        outline: {
          color: [...lineRgb, 1],
          style: 'solid',
          width: settings.polygonLineWidth
        }
      };
    }

    if (type === 'text') {
      const rgb = hexToRgb(settings.textColor.value);
      return {
        type: 'text',
        color: [...rgb, settings.textOpacity],
        text: 'Text',
        font: {
          size: settings.textSize,
          weight: 'bold',
          family: settings.textFont
        },
        haloColor: [255, 255, 255, 1],
        haloSize: 2
      };
    }

    return null;
  }, [settings]);

  /**
   * Start drawing
   */
  const startDrawing = (tool) => {
    if (!sketchVMRef.current) return;

    sketchVMRef.current.cancel();

    if (activeTool === tool) {
      setActiveTool(null);
      return;
    }

    setActiveTool(tool);

    // Configure symbol
    const symbol = getSymbol(tool);

    if (tool === 'point') {
      sketchVMRef.current.pointSymbol = symbol;
    } else if (tool === 'polyline') {
      sketchVMRef.current.polylineSymbol = symbol;
    } else if (tool === 'polygon') {
      sketchVMRef.current.polygonSymbol = symbol;
    }

    // Start create
    const createType = tool === 'text' ? 'point' : tool;
    sketchVMRef.current.create(createType);
  };

  /**
   * Handle draw complete
   */
  const handleDrawComplete = (event) => {
    const geometry = event.graphic.geometry;
    const id = `markup_${Date.now()}`;
    const currentTool = activeTool;

    // Calculate measurement based on selected units
    let measurement = '';
    let showLabel = false;

    if (geometry.type === 'point' && currentTool !== 'text') {
      measurement = formatCoordinates(geometry, settings.pointMeasurementUnit);
      showLabel = settings.pointShowLabel;
    } else if (geometry.type === 'polygon') {
      const unit = settings.polygonMeasurementUnit;
      if (unit === 'acres') {
        const area = geometryEngine.geodesicArea(geometry, 'acres');
        measurement = `${area.toFixed(2)} acres`;
      } else if (unit === 'sqfeet') {
        const area = geometryEngine.geodesicArea(geometry, 'square-feet');
        measurement = `${area.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq ft`;
      } else if (unit === 'sqmeters') {
        const area = geometryEngine.geodesicArea(geometry, 'square-meters');
        measurement = `${area.toLocaleString(undefined, { maximumFractionDigits: 0 })} sq m`;
      }
      showLabel = settings.polygonShowLabel;
    } else if (geometry.type === 'polyline') {
      const unit = settings.lineMeasurementUnit;
      if (unit === 'feet') {
        const length = geometryEngine.geodesicLength(geometry, 'feet');
        measurement = `${length.toLocaleString(undefined, { maximumFractionDigits: 0 })} ft`;
      } else if (unit === 'meters') {
        const length = geometryEngine.geodesicLength(geometry, 'meters');
        measurement = `${length.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`;
      } else if (unit === 'miles') {
        const length = geometryEngine.geodesicLength(geometry, 'miles');
        measurement = `${length.toFixed(2)} mi`;
      } else if (unit === 'kilometers') {
        const length = geometryEngine.geodesicLength(geometry, 'kilometers');
        measurement = `${length.toFixed(2)} km`;
      }
      showLabel = settings.lineShowLabel;
    }

    // Determine color for display
    let displayColor = settings.pointColor.value;
    if (currentTool === 'polyline') displayColor = settings.lineColor.value;
    if (currentTool === 'polygon') displayColor = settings.polygonFillColor.value;
    if (currentTool === 'text') displayColor = settings.textColor.value;

    // Create attributes
    const attributes = {
      id,
      title: 'New Markup',
      tool: currentTool,
      color: displayColor,
      metric: measurement,
      createdAt: Date.now()
    };

    event.graphic.attributes = attributes;

    // Handle text tool - use textContent from settings
    if (currentTool === 'text') {
      const textContent = settings.textContent || 'Label';
      const rgb = hexToRgb(settings.textColor.value);
      event.graphic.symbol = {
        type: 'text',
        color: [...rgb, settings.textOpacity],
        text: textContent,
        font: {
          size: settings.textSize,
          weight: 'bold',
          family: settings.textFont
        },
        haloColor: [255, 255, 255, 1],
        haloSize: 2
      };
      event.graphic.attributes.text = textContent;
      event.graphic.attributes.title = textContent;
    }

    // Update list
    setMarkups(prev => [...prev, event.graphic]);

    // Add measurement label graphic if showLabel is enabled
    if (showLabel && measurement && markupLayerRef.current) {
      let labelPoint;
      if (geometry.type === 'point') {
        labelPoint = geometry;
      } else if (geometry.type === 'polygon') {
        labelPoint = geometry.centroid;
      } else if (geometry.type === 'polyline') {
        // Get midpoint of polyline
        const paths = geometry.paths[0];
        const midIndex = Math.floor(paths.length / 2);
        labelPoint = {
          type: 'point',
          x: paths[midIndex][0],
          y: paths[midIndex][1],
          spatialReference: geometry.spatialReference
        };
      }

      if (labelPoint) {
        const labelGraphic = new Graphic({
          geometry: labelPoint,
          symbol: {
            type: 'text',
            color: [30, 41, 59, 1],
            text: measurement,
            font: {
              size: 11,
              weight: 'bold',
              family: 'sans-serif'
            },
            haloColor: [255, 255, 255, 1],
            haloSize: 2
          },
          attributes: {
            id: `${id}_label`,
            parentId: id,
            isLabel: true
          }
        });
        markupLayerRef.current.add(labelGraphic);
      }
    }

    // Continue drawing the same tool type
    if (currentTool && sketchVMRef.current) {
      setTimeout(() => {
        const symbol = getSymbol(currentTool);
        if (currentTool === 'point') {
          sketchVMRef.current.pointSymbol = symbol;
        } else if (currentTool === 'polyline') {
          sketchVMRef.current.polylineSymbol = symbol;
        } else if (currentTool === 'polygon') {
          sketchVMRef.current.polygonSymbol = symbol;
        }
        const createType = currentTool === 'text' ? 'point' : currentTool;
        sketchVMRef.current.create(createType);
      }, 50);
    }
  };

  /**
   * Zoom to markup
   */
  const zoomToMarkup = (graphic) => {
    if (!view || !graphic.geometry) return;

    const geometry = graphic.geometry;
    if (geometry.type === 'point') {
      view.goTo({
        target: geometry,
        zoom: 18
      }, { duration: 500 });
    } else {
      view.goTo({
        target: geometry.extent.expand(1.5)
      }, { duration: 500 });
    }
  };

  /**
   * Open popup for markup
   */
  const openMarkupPopup = (graphic) => {
    if (!view || !graphic.geometry) return;

    const attrs = graphic.attributes || {};

    view.popup.open({
      title: attrs.title || 'Markup',
      content: `
        <div style="font-size: 13px; line-height: 1.5;">
          ${attrs.text ? `<p><strong>Text:</strong> ${attrs.text}</p>` : ''}
          ${attrs.metric ? `<p><strong>Measurement:</strong> ${attrs.metric}</p>` : ''}
          <p><strong>Type:</strong> ${attrs.tool || 'unknown'}</p>
          <p><strong>Created:</strong> ${attrs.createdAt ? new Date(attrs.createdAt).toLocaleString() : 'unknown'}</p>
        </div>
      `,
      location: graphic.geometry.type === 'point'
        ? graphic.geometry
        : graphic.geometry.extent?.center
    });
  };

  /**
   * Delete markup
   */
  const deleteMarkup = (graphic) => {
    if (!markupLayerRef.current) return;
    // Also remove any associated label graphic
    const parentId = graphic.attributes?.id;
    if (parentId) {
      const labelGraphic = markupLayerRef.current.graphics.find(
        g => g.attributes?.parentId === parentId
      );
      if (labelGraphic) {
        markupLayerRef.current.remove(labelGraphic);
      }
    }
    markupLayerRef.current.remove(graphic);
    setMarkups(prev => prev.filter(m => m !== graphic));
  };

  /**
   * Clear all markups
   */
  const clearAllMarkups = () => {
    if (!markupLayerRef.current) return;
    if (!confirm('Delete all markups?')) return;
    markupLayerRef.current.removeAll();
    setMarkups([]);
  };

  // Tool definitions
  const tools = [
    { id: 'point', icon: Circle, label: 'Point' },
    { id: 'polyline', icon: Minus, label: 'Line' },
    { id: 'polygon', icon: Square, label: 'Polygon' },
    { id: 'text', icon: Type, label: 'Text' }
  ];

  // Collapsed button
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200
                   hover:bg-slate-50 transition-colors ${className}`}
        title="Markup Tools"
      >
        <Pencil className="w-4 h-4" style={{ color: colors.bg600 }} />
        <span className="text-sm font-medium text-slate-700">Markup</span>
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      ref={panelRef}
      className={`bg-white rounded-lg shadow-xl border border-slate-200 w-72
                 flex flex-col max-h-[70vh] ${className}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4" style={{ color: colors.text600 }} />
          <span className="text-sm font-semibold text-slate-700">Markup</span>
        </div>
        <button onClick={onToggle} className="p-1 hover:bg-slate-100 rounded">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Drawing Tools - Horizontal Toolbar */}
      <div className="p-2 border-b border-slate-200">
        {/* Tool Icon Buttons */}
        <div className="flex items-center justify-center gap-1">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => {
                startDrawing(tool.id);
                setExpandedSettings(activeTool === tool.id ? null : tool.id);
              }}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded transition
                         ${activeTool === tool.id || expandedSettings === tool.id
                           ? 'ring-2 ring-offset-1'
                           : 'hover:bg-slate-100 border border-slate-200'}`}
              style={activeTool === tool.id || expandedSettings === tool.id ? {
                backgroundColor: colors.bg50,
                ringColor: colors.bg500
              } : {}}
              title={`Draw ${tool.label}`}
            >
              <tool.icon
                className="w-5 h-5"
                style={{ color: activeTool === tool.id || expandedSettings === tool.id ? colors.text600 : '#64748b' }}
              />
              <span className="text-xs text-slate-600">{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Panel - Shown below toolbar for selected tool */}
        {expandedSettings && (
          <div className="mt-2">
            <ToolSettings
              type={expandedSettings}
              settings={settings}
              onChange={setSettings}
            />
          </div>
        )}
      </div>

      {/* Markup List */}
      <div className="flex-1 overflow-y-auto p-2">
        {markups.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No markups yet. Use the tools above to draw.
          </div>
        ) : (
          <div className="space-y-1">
            {markups.map((markup, idx) => (
              <div
                key={markup.attributes?.id || idx}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 group"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: markup.attributes?.color || '#3b82f6' }}
                />
                <span className="flex-1 text-xs text-slate-700 truncate">
                  {markup.attributes?.title || 'Markup'}
                </span>
                {markup.attributes?.metric && (
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    {markup.attributes.metric}
                  </span>
                )}
                {/* Action buttons */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => zoomToMarkup(markup)}
                    className="p-1 hover:bg-blue-100 rounded transition"
                    title="Zoom to"
                  >
                    <ZoomIn className="w-3 h-3 text-blue-500" />
                  </button>
                  <button
                    onClick={() => openMarkupPopup(markup)}
                    className="p-1 hover:bg-green-100 rounded transition"
                    title="Open popup"
                  >
                    <MessageSquare className="w-3 h-3 text-green-500" />
                  </button>
                  <button
                    onClick={() => deleteMarkup(markup)}
                    className="p-1 hover:bg-red-100 rounded transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {markups.length > 0 && (
        <div className="border-t border-slate-200 px-3 py-2 flex-shrink-0">
          <button
            onClick={clearAllMarkups}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3" />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
