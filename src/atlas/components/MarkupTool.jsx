// src/atlas/components/MarkupTool.jsx
// CivQuest Atlas - Enhanced Markup Tool Component
// Drawing tools with color, style, and folder management
//
// FIXED: Uses isExpanded prop (matching MapView), inline layout

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

// Helper to convert hex to RGB array
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

/**
 * MarkupTool Component
 * Enhanced drawing tool with styling options
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
  isExpanded = false,  // MapView passes isExpanded
  onToggle,
  onFeatureClick,
  className = ''
}) {
  const { config: atlasConfig } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeTool, setActiveTool] = useState(null);
  const [markups, setMarkups] = useState([]);
  const [folders, setFolders] = useState([{ id: 'default', name: 'My Markup' }]);
  const [activeFolder, setActiveFolder] = useState('default');
  const [showSettings, setShowSettings] = useState(false);

  // Style settings
  const [currentColor, setCurrentColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(2);
  const [pointSize, setPointSize] = useState(10);
  const [fillOpacity, setFillOpacity] = useState(0.4);

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

    // Load saved data
    loadMarkups();

    return () => {
      sketchVM.destroy();
      if (!graphicsLayer) {
        view.map.remove(layer);
      }
    };
  }, [view, graphicsLayer]);

  /**
   * Load markups from storage
   */
  const loadMarkups = () => {
    if (!markupLayerRef.current) return;

    try {
      const key = `${MARKUP_STORAGE_KEY}_${mapId || 'default'}`;
      const data = localStorage.getItem(key);
      if (data) {
        const items = JSON.parse(data);
        const graphics = items.map(item => {
          try {
            const g = Graphic.fromJSON(item);
            if (item.visible !== undefined) g.visible = item.visible;
            return g;
          } catch (e) {
            return null;
          }
        }).filter(Boolean);

        markupLayerRef.current.addMany(graphics);
        setMarkups(graphics.filter(g => g.attributes?.id));
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
      const key = `${MARKUP_STORAGE_KEY}_${mapId || 'default'}`;
      const items = markupLayerRef.current.graphics.map(g => {
        const json = g.toJSON();
        json.visible = g.visible;
        return json;
      }).toArray();
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.warn('[MarkupTool] Failed to save markups:', e);
    }
  }, [mapId]);

  /**
   * Get symbol for current settings
   */
  const getSymbol = useCallback((type) => {
    const rgb = hexToRgb(currentColor.value);

    if (type === 'point') {
      return {
        type: 'simple-marker',
        style: 'circle',
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
        style: 'solid',
        color: [...rgb, 1],
        width: lineWidth
      };
    }

    if (type === 'polygon') {
      return {
        type: 'simple-fill',
        style: 'solid',
        color: [...rgb, fillOpacity],
        outline: {
          color: [...rgb, 1],
          style: 'solid',
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
          size: 14,
          weight: 'bold',
          family: 'sans-serif'
        },
        haloColor: [255, 255, 255, 1],
        haloSize: 2
      };
    }

    return null;
  }, [currentColor, pointSize, lineWidth, fillOpacity]);

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

    // Calculate measurement
    let measurement = '';
    if (geometry.type === 'polygon') {
      const area = geometryEngine.geodesicArea(geometry, 'acres');
      measurement = `${area.toFixed(2)} acres`;
    } else if (geometry.type === 'polyline') {
      const length = geometryEngine.geodesicLength(geometry, 'feet');
      measurement = `${length.toFixed(0)} ft`;
    }

    // Create attributes
    const attributes = {
      id,
      title: 'New Markup',
      tool: activeTool,
      color: currentColor.value,
      folderId: activeFolder,
      metric: measurement,
      createdAt: Date.now()
    };

    event.graphic.attributes = attributes;

    // Handle text tool
    if (activeTool === 'text') {
      const textInput = prompt('Enter text:', 'Label');
      if (textInput) {
        event.graphic.symbol = {
          type: 'text',
          color: hexToRgb(currentColor.value),
          text: textInput,
          font: { size: 14, weight: 'bold', family: 'sans-serif' },
          haloColor: [255, 255, 255, 1],
          haloSize: 2
        };
        event.graphic.attributes.text = textInput;
      }
    }

    // Update list
    setMarkups(prev => [...prev, event.graphic]);
    saveMarkups();
    setActiveTool(null);
  };

  /**
   * Delete markup
   */
  const deleteMarkup = (graphic) => {
    if (!markupLayerRef.current) return;
    markupLayerRef.current.remove(graphic);
    setMarkups(prev => prev.filter(m => m !== graphic));
    saveMarkups();
  };

  /**
   * Clear all markups
   */
  const clearAllMarkups = () => {
    if (!markupLayerRef.current) return;
    if (!confirm('Delete all markups?')) return;
    markupLayerRef.current.removeAll();
    setMarkups([]);
    saveMarkups();
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
        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg 
                   hover:bg-slate-50 transition text-sm font-medium text-slate-700 
                   min-w-[140px] ${className}`}
        title="Markup Tools"
      >
        <Pencil className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-left">Markup</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
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
                           ? 'ring-2 ring-offset-1' 
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
              <span className="text-xs text-slate-600">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 border-b border-slate-200 space-y-3">
          {/* Color Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Color</label>
            <div className="flex flex-wrap gap-1">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setCurrentColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition
                             ${currentColor.value === color.value 
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
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Line Width: {lineWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Fill Opacity */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Fill Opacity: {Math.round(fillOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={fillOpacity}
              onChange={(e) => setFillOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

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
                className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 group"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: markup.attributes?.color || '#3b82f6' }}
                />
                <span className="flex-1 text-xs text-slate-700 truncate">
                  {markup.attributes?.title || 'Markup'}
                </span>
                {markup.attributes?.metric && (
                  <span className="text-xs text-slate-400">
                    {markup.attributes.metric}
                  </span>
                )}
                <button
                  onClick={() => deleteMarkup(markup)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
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
