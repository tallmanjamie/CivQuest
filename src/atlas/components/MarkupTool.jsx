// src/atlas/components/MarkupTool.jsx
// CivQuest Atlas - Enhanced Markup Tool Component
// Drawing tools with color, style, and folder management
//
// Migrated and enhanced from legacy markup.js functionality

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pencil,
  Circle,
  Minus,
  Square,
  Type,
  X,
  Trash2,
  FolderPlus,
  Folder,
  ChevronDown,
  ChevronRight,
  Edit3,
  MapPin,
  Move,
  RotateCcw,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Palette,
  Settings,
  Ruler
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

// Storage keys
const MARKUP_STORAGE_KEY = 'atlas_markup_data';
const FOLDER_STORAGE_KEY = 'atlas_markup_folders';

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

// Line styles
const LINE_STYLES = [
  { name: 'Solid', value: 'solid' },
  { name: 'Dashed', value: 'dash' },
  { name: 'Dotted', value: 'dot' },
  { name: 'Dash-Dot', value: 'dash-dot' }
];

// Point styles
const POINT_STYLES = [
  { name: 'Circle', value: 'circle' },
  { name: 'Square', value: 'square' },
  { name: 'Diamond', value: 'diamond' },
  { name: 'Cross', value: 'cross' },
  { name: 'X', value: 'x' }
];

// Fill styles
const FILL_STYLES = [
  { name: 'Solid', value: 'solid' },
  { name: 'None', value: 'none' },
  { name: 'Diagonal', value: 'diagonal-cross' },
  { name: 'Horizontal', value: 'horizontal' },
  { name: 'Vertical', value: 'vertical' }
];

// Measurement units
const UNITS = {
  point: [
    { label: 'Lat / Lon', value: 'lat-lon' },
    { label: 'X / Y', value: 'x-y' }
  ],
  polyline: [
    { label: 'Feet', value: 'feet' },
    { label: 'Meters', value: 'meters' },
    { label: 'Miles', value: 'miles' },
    { label: 'Kilometers', value: 'kilometers' }
  ],
  polygon: [
    { label: 'Acres', value: 'acres' },
    { label: 'Sq Feet', value: 'square-feet' },
    { label: 'Sq Meters', value: 'square-meters' },
    { label: 'Hectares', value: 'hectares' }
  ]
};

/**
 * MarkupTool Component
 * Enhanced drawing tool with styling options
 */
export default function MarkupTool({
  view,
  isOpen,
  onToggle,
  onFeatureClick,
  className = ''
}) {
  const { config } = useAtlas();
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTool, setActiveTool] = useState(null);
  const [markups, setMarkups] = useState([]);
  const [folders, setFolders] = useState([{ id: 'default', name: 'My Markup' }]);
  const [activeFolder, setActiveFolder] = useState('default');
  const [showSettings, setShowSettings] = useState(false);
  const [editingMarkup, setEditingMarkup] = useState(null);

  // Style settings
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [lineStyle, setLineStyle] = useState('solid');
  const [pointStyle, setPointStyle] = useState('circle');
  const [fillStyle, setFillStyle] = useState('solid');
  const [lineWidth, setLineWidth] = useState(2);
  const [pointSize, setPointSize] = useState(10);
  const [fillOpacity, setFillOpacity] = useState(0.4);
  const [showLabels, setShowLabels] = useState(true);
  const [measurementUnit, setMeasurementUnit] = useState('feet');
  const [textSize, setTextSize] = useState(14);

  // Refs
  const sketchVMRef = useRef(null);
  const markupLayerRef = useRef(null);
  const panelRef = useRef(null);

  /**
   * Initialize sketch tools
   */
  useEffect(() => {
    if (!view) return;

    // Create markup layer
    const layer = new GraphicsLayer({
      title: 'Markup Layer',
      listMode: 'hide'
    });
    view.map.add(layer);
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
    sketchVM.on('create', handleDrawComplete);

    // Load saved data
    loadFolders();
    loadMarkups();

    return () => {
      sketchVM.destroy();
      view.map.remove(layer);
    };
  }, [view]);

  /**
   * Load folders from storage
   */
  const loadFolders = () => {
    try {
      const data = localStorage.getItem(FOLDER_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.find(f => f.id === 'default')) {
          parsed.unshift({ id: 'default', name: 'My Markup' });
        }
        setFolders(parsed);
      }
    } catch (e) {
      console.warn('[MarkupTool] Failed to load folders:', e);
    }
  };

  /**
   * Save folders to storage
   */
  const saveFolders = (newFolders) => {
    try {
      localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(newFolders));
      setFolders(newFolders);
    } catch (e) {
      console.warn('[MarkupTool] Failed to save folders:', e);
    }
  };

  /**
   * Load markups from storage
   */
  const loadMarkups = () => {
    if (!markupLayerRef.current) return;

    try {
      const data = localStorage.getItem(MARKUP_STORAGE_KEY);
      if (data) {
        const items = JSON.parse(data);
        const graphics = items.map(item => {
          const g = Graphic.fromJSON(item);
          if (item.visible !== undefined) g.visible = item.visible;
          if (g.attributes && !g.attributes.folderId) {
            g.attributes.folderId = 'default';
          }
          return g;
        }).filter(Boolean);

        markupLayerRef.current.addMany(graphics);
        setMarkups(graphics.filter(g => g.attributes?.id && !g.attributes?.parentId));
      }
    } catch (e) {
      console.warn('[MarkupTool] Failed to load markups:', e);
    }
  };

  /**
   * Save markups to storage
   */
  const saveMarkups = useCallback(() => {
    if (!markupLayerRef.current) return;

    try {
      const items = markupLayerRef.current.graphics.map(g => {
        const json = g.toJSON();
        json.visible = g.visible;
        return json;
      });
      localStorage.setItem(MARKUP_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[MarkupTool] Failed to save markups:', e);
    }
  }, []);

  /**
   * Update markups list
   */
  const updateMarkupsList = useCallback(() => {
    if (!markupLayerRef.current) return;
    
    const items = markupLayerRef.current.graphics
      .filter(g => g.attributes?.id && !g.attributes?.parentId)
      .toArray();
    setMarkups(items);
  }, []);

  /**
   * Get symbol for current settings
   */
  const getSymbol = useCallback((type) => {
    const rgb = hexToRgb(currentColor.value);

    if (type === 'point') {
      return {
        type: 'simple-marker',
        style: pointStyle,
        color: [...rgb, 0.8],
        size: pointSize,
        outline: {
          color: hexToRgb(currentColor.dark),
          width: 2
        }
      };
    }

    if (type === 'polyline') {
      return {
        type: 'simple-line',
        style: lineStyle,
        color: [...rgb, 1],
        width: lineWidth
      };
    }

    if (type === 'polygon') {
      return {
        type: 'simple-fill',
        style: fillStyle,
        color: [...rgb, fillOpacity],
        outline: {
          color: [...rgb, 1],
          style: lineStyle,
          width: lineWidth
        }
      };
    }

    if (type === 'text') {
      return {
        type: 'text',
        color: [...rgb, 1],
        text: 'Text',
        font: {
          size: textSize,
          weight: 'bold',
          family: 'sans-serif'
        },
        haloColor: [255, 255, 255, 1],
        haloSize: 2
      };
    }

    return null;
  }, [currentColor, pointStyle, pointSize, lineStyle, lineWidth, fillStyle, fillOpacity, textSize]);

  /**
   * Start drawing
   */
  const startDrawing = (tool) => {
    if (!sketchVMRef.current) return;

    // Cancel any current operation
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
  const handleDrawComplete = useCallback((event) => {
    if (event.state !== 'complete') return;

    const geometry = event.graphic.geometry;
    const id = `markup_${Date.now()}`;
    
    // Calculate measurement
    const measurement = calculateMeasurement(geometry, measurementUnit);

    // Prompt for title
    const title = prompt('Enter a name for this markup:', 'New Markup') || 'New Markup';

    // Create attributes
    const attributes = {
      id,
      title,
      tool: activeTool,
      color: currentColor.value,
      folderId: activeFolder,
      metric: measurement.value,
      rawLabel: measurement.label,
      unit: measurementUnit,
      showLabel: showLabels,
      createdAt: Date.now()
    };

    // Update graphic
    event.graphic.attributes = attributes;

    // Handle text tool
    if (activeTool === 'text') {
      const textInput = prompt('Enter text:', 'Label');
      if (textInput) {
        event.graphic.symbol = {
          type: 'text',
          color: hexToRgb(currentColor.value),
          text: textInput,
          font: { size: textSize, weight: 'bold', family: 'sans-serif' },
          haloColor: [255, 255, 255, 1],
          haloSize: 2
        };
        event.graphic.attributes.text = textInput;
      }
    }

    // Add label graphic if enabled
    if (showLabels && activeTool !== 'text' && measurement.label) {
      const labelPoint = geometry.type === 'point' 
        ? geometry 
        : geometry.extent?.center;

      if (labelPoint) {
        const labelGraphic = new Graphic({
          geometry: labelPoint,
          attributes: { parentId: id },
          symbol: {
            type: 'text',
            color: [0, 0, 0, 1],
            haloColor: [255, 255, 255, 1],
            haloSize: 2,
            text: measurement.label,
            yoffset: geometry.type === 'point' ? -20 : 0,
            font: { size: 10, weight: 'bold', family: 'sans-serif' }
          }
        });
        markupLayerRef.current.add(labelGraphic);
      }
    }

    updateMarkupsList();
    saveMarkups();
    setActiveTool(null);
  }, [activeTool, currentColor, measurementUnit, showLabels, activeFolder, textSize, saveMarkups, updateMarkupsList]);

  /**
   * Calculate measurement for geometry
   */
  const calculateMeasurement = (geometry, unit) => {
    if (!geometry) return { value: '', label: '' };

    try {
      if (geometry.type === 'point') {
        if (unit === 'lat-lon') {
          return {
            value: `${geometry.latitude?.toFixed(6)}, ${geometry.longitude?.toFixed(6)}`,
            label: `${geometry.latitude?.toFixed(4)}, ${geometry.longitude?.toFixed(4)}`
          };
        }
        return {
          value: `${geometry.x?.toFixed(2)}, ${geometry.y?.toFixed(2)}`,
          label: `X: ${geometry.x?.toFixed(0)}, Y: ${geometry.y?.toFixed(0)}`
        };
      }

      if (geometry.type === 'polyline') {
        const length = geometryEngine.geodesicLength(geometry, unit);
        const formatted = length.toFixed(2);
        return {
          value: `${formatted} ${unit}`,
          label: `${formatted} ${unit}`
        };
      }

      if (geometry.type === 'polygon') {
        const area = geometryEngine.geodesicArea(geometry, unit);
        const formatted = Math.abs(area).toFixed(2);
        return {
          value: `${formatted} ${unit.replace('-', ' ')}`,
          label: `${formatted} ${unit.replace(/-/g, ' ')}`
        };
      }
    } catch (e) {
      console.warn('[MarkupTool] Measurement error:', e);
    }

    return { value: '', label: '' };
  };

  /**
   * Delete markup
   */
  const deleteMarkup = (markup) => {
    if (!markupLayerRef.current || !markup?.attributes?.id) return;

    // Remove main graphic
    markupLayerRef.current.remove(markup);

    // Remove associated label
    const label = markupLayerRef.current.graphics.find(
      g => g.attributes?.parentId === markup.attributes.id
    );
    if (label) {
      markupLayerRef.current.remove(label);
    }

    updateMarkupsList();
    saveMarkups();
  };

  /**
   * Zoom to markup
   */
  const zoomToMarkup = (markup) => {
    if (!view || !markup?.geometry) return;
    view.goTo(markup.geometry).catch(() => {});
    
    if (onFeatureClick) {
      onFeatureClick(markup);
    }
  };

  /**
   * Toggle markup visibility
   */
  const toggleMarkupVisibility = (markup) => {
    if (!markup) return;
    markup.visible = !markup.visible;

    // Also toggle label
    const label = markupLayerRef.current?.graphics.find(
      g => g.attributes?.parentId === markup.attributes.id
    );
    if (label) {
      label.visible = markup.visible;
    }

    updateMarkupsList();
    saveMarkups();
  };

  /**
   * Create new folder
   */
  const createFolder = () => {
    const name = prompt('Enter folder name:', 'New Folder');
    if (name) {
      const newFolder = { id: `folder_${Date.now()}`, name };
      saveFolders([...folders, newFolder]);
    }
  };

  /**
   * Delete folder
   */
  const deleteFolder = (folderId) => {
    if (folderId === 'default') return;
    
    // Move items to default folder
    markupLayerRef.current?.graphics.forEach(g => {
      if (g.attributes?.folderId === folderId) {
        g.attributes.folderId = 'default';
      }
    });

    saveFolders(folders.filter(f => f.id !== folderId));
    if (activeFolder === folderId) {
      setActiveFolder('default');
    }
    saveMarkups();
    updateMarkupsList();
  };

  // Filter markups by active folder
  const folderMarkups = markups.filter(
    m => (m.attributes?.folderId || 'default') === activeFolder
  );

  // Tool definitions
  const tools = [
    { id: 'point', icon: Circle, label: 'Point' },
    { id: 'polyline', icon: Minus, label: 'Line' },
    { id: 'polygon', icon: Square, label: 'Polygon' },
    { id: 'text', icon: Type, label: 'Text' }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center justify-center w-10 h-10 bg-white rounded-lg shadow-lg 
                   hover:bg-slate-50 transition z-20 ${className}`}
        title="Markup Tools"
      >
        <Pencil className="w-5 h-5 text-slate-600" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`bg-white rounded-lg shadow-xl border border-slate-200 w-72 z-20 
                 flex flex-col max-h-[80vh] ${className}`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4" style={{ color: colors.text600 }} />
          <span className="text-sm font-semibold text-slate-700">Markup Tools</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition ${showSettings ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
            title="Style Settings"
          >
            <Settings className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={onToggle} className="p-1.5 hover:bg-slate-100 rounded">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Drawing Tools */}
      <div className="p-3 border-b border-slate-200">
        <div className="grid grid-cols-4 gap-2">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => startDrawing(tool.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition
                         ${activeTool === tool.id 
                           ? 'ring-2' 
                           : 'hover:bg-slate-100 border border-slate-200'}`}
              style={activeTool === tool.id ? {
                backgroundColor: colors.bg50,
                ringColor: colors.bg500
              } : {}}
              title={tool.label}
            >
              <tool.icon 
                className="w-5 h-5" 
                style={{ color: activeTool === tool.id ? colors.text600 : '#64748b' }}
              />
              <span className="text-[10px] font-medium text-slate-500">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style Settings (collapsible) */}
      {showSettings && (
        <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-3">
          {/* Color Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(color => (
                <button
                  key={color.name}
                  onClick={() => setCurrentColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition
                             ${currentColor.name === color.name 
                               ? 'border-slate-800 scale-110' 
                               : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Line Width */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 flex justify-between">
              <span>Line Width</span>
              <span className="font-normal">{lineWidth}px</span>
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Line Style */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Line Style</label>
            <select
              value={lineStyle}
              onChange={(e) => setLineStyle(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            >
              {LINE_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Fill Opacity */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 flex justify-between">
              <span>Fill Opacity</span>
              <span className="font-normal">{Math.round(fillOpacity * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={fillOpacity}
              onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Show Labels Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-xs font-medium text-slate-600">Show measurement labels</span>
          </label>
        </div>
      )}

      {/* Folder Selector */}
      <div className="p-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <select
            value={activeFolder}
            onChange={(e) => setActiveFolder(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
          >
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={createFolder}
            className="p-1.5 hover:bg-slate-200 rounded"
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
          </button>
          {activeFolder !== 'default' && (
            <button
              onClick={() => deleteFolder(activeFolder)}
              className="p-1.5 hover:bg-red-100 rounded"
              title="Delete Folder"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Markup List */}
      <div className="flex-1 overflow-y-auto p-2">
        {folderMarkups.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No markups in this folder.<br />
            Select a tool above to start drawing.
          </div>
        ) : (
          <div className="space-y-1">
            {folderMarkups.map(markup => (
              <MarkupItem
                key={markup.attributes.id}
                markup={markup}
                colors={colors}
                onZoom={() => zoomToMarkup(markup)}
                onToggleVisibility={() => toggleMarkupVisibility(markup)}
                onDelete={() => deleteMarkup(markup)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-3 py-2 flex justify-between items-center">
        <span className="text-[10px] text-slate-400">
          {folderMarkups.length} item{folderMarkups.length !== 1 ? 's' : ''}
        </span>
        {folderMarkups.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Clear all markups in this folder?')) {
                folderMarkups.forEach(m => deleteMarkup(m));
              }
            }}
            className="text-[10px] text-red-500 hover:text-red-600"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Markup Item Component
 */
function MarkupItem({ markup, colors, onZoom, onToggleVisibility, onDelete }) {
  const attrs = markup.attributes || {};
  const isVisible = markup.visible !== false;

  // Get icon based on geometry type
  const getIcon = () => {
    if (attrs.tool === 'text') return Type;
    if (markup.geometry?.type === 'point') return MapPin;
    if (markup.geometry?.type === 'polyline') return Minus;
    return Square;
  };

  const Icon = getIcon();

  return (
    <div className={`group flex items-center gap-2 p-2 rounded-md transition
                    ${isVisible ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 opacity-60'}`}>
      {/* Color indicator & icon */}
      <div 
        className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${attrs.color || '#22c55e'}20` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: attrs.color || '#22c55e' }} />
      </div>

      {/* Title & metric */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onZoom}>
        <p className="text-xs font-medium text-slate-700 truncate">{attrs.title || 'Untitled'}</p>
        {attrs.metric && (
          <p className="text-[10px] text-slate-400 font-mono truncate">{attrs.metric}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={onToggleVisibility}
          className="p-1 hover:bg-slate-200 rounded"
          title={isVisible ? 'Hide' : 'Show'}
        >
          {isVisible ? (
            <Eye className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-100 rounded"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}
