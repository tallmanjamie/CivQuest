// src/atlas/components/LayersPanel.jsx
// CivQuest Atlas - Layers Panel Component
// Collapsible layers panel with table of contents
// Includes layer visibility, opacity controls, and legends
//
// Migrated from legacy layers.js functionality

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  X,
  RefreshCw,
  ChevronUp,
  Minus,
  Plus,
  Grip
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import Legend from '@arcgis/core/widgets/Legend';

// Storage key for layer state persistence
const getStorageKey = (mapId) => `atlas_layers_state_${mapId || 'default'}`;

/**
 * LayersPanel Component
 * Displays a collapsible layers panel with TOC functionality
 */
export default function LayersPanel({
  view,
  isOpen,
  onToggle,
  position = 'top-left', // 'top-left' or 'top-right'
  hiddenLayerIds = [],
  className = ''
}) {
  const { config, activeMap } = useAtlas();
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [layers, setLayers] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [layerOpacities, setLayerOpacities] = useState({});
  const [showLegends, setShowLegends] = useState(new Set());

  // Refs
  const legendWidgetsRef = useRef({});
  const panelRef = useRef(null);

  // Get map ID for storage
  const mapId = view?.map?.portalItem?.id;

  /**
   * Build layer tree from map
   */
  const buildLayerTree = useCallback(() => {
    if (!view?.map?.layers) return [];

    const processLayer = (layer, depth = 0) => {
      // Skip hidden layers
      if (hiddenLayerIds.includes(layer.id)) return null;
      if (layer.listMode === 'hide') return null;

      const layerData = {
        id: layer.id,
        title: layer.title || 'Untitled Layer',
        type: layer.type,
        visible: layer.visible,
        opacity: layer.opacity ?? 1,
        depth,
        minScale: layer.minScale || 0,
        maxScale: layer.maxScale || 0,
        layer // Keep reference to actual layer
      };

      // Handle group layers
      if (layer.type === 'group' && layer.layers) {
        layerData.isGroup = true;
        layerData.children = layer.layers
          .toArray()
          .reverse()
          .map(child => processLayer(child, depth + 1))
          .filter(Boolean);
      }

      // Handle map image layers with sublayers
      if ((layer.type === 'map-image' || layer.type === 'tile') && layer.sublayers) {
        const sublayers = layer.sublayers.toArray ? layer.sublayers.toArray() : Array.from(layer.sublayers);
        if (sublayers.length > 0) {
          layerData.isGroup = true;
          layerData.children = sublayers
            .reverse()
            .map(sub => ({
              id: `${layer.id}-${sub.id}`,
              title: sub.title || sub.name || `Sublayer ${sub.id}`,
              type: 'sublayer',
              visible: sub.visible,
              opacity: sub.opacity ?? 1,
              depth: depth + 1,
              parentLayer: layer,
              sublayer: sub
            }))
            .filter(Boolean);
        }
      }

      return layerData;
    };

    const layerTree = view.map.layers
      .toArray()
      .reverse()
      .map(layer => processLayer(layer))
      .filter(Boolean);

    return layerTree;
  }, [view, hiddenLayerIds]);

  /**
   * Initialize and update layer tree
   */
  useEffect(() => {
    if (!view?.map) return;

    const updateLayers = () => {
      const tree = buildLayerTree();
      setLayers(tree);
    };

    // Initial build
    updateLayers();

    // Watch for layer changes
    const handle = view.map.layers.on('change', updateLayers);

    // Watch for scale changes (for scale-dependent visibility)
    const scaleHandle = view.watch('scale', () => {
      setLayers(prev => [...prev]); // Force re-render
    });

    return () => {
      handle?.remove();
      scaleHandle?.remove();
    };
  }, [view, buildLayerTree]);

  /**
   * Restore saved layer state
   */
  useEffect(() => {
    if (!mapId || !view?.map) return;

    try {
      const saved = localStorage.getItem(getStorageKey(mapId));
      if (saved) {
        const state = JSON.parse(saved);
        
        // Restore layer visibility and opacity
        Object.entries(state.layers || {}).forEach(([layerId, layerState]) => {
          const layer = view.map.findLayerById(layerId);
          if (layer && !hiddenLayerIds.includes(layerId)) {
            if (layerState.visible !== undefined) layer.visible = layerState.visible;
            if (layerState.opacity !== undefined) layer.opacity = layerState.opacity;
          }
        });
      }
    } catch (e) {
      console.warn('[LayersPanel] Failed to restore state:', e);
    }
  }, [mapId, view, hiddenLayerIds]);

  /**
   * Save layer state
   */
  const saveState = useCallback(() => {
    if (!mapId || !view?.map) return;

    try {
      const layerStates = {};
      
      const processLayer = (layer) => {
        if (hiddenLayerIds.includes(layer.id)) return;
        if (layer.listMode !== 'hide') {
          layerStates[layer.id] = {
            visible: layer.visible,
            opacity: layer.opacity
          };
        }
        if (layer.layers) {
          layer.layers.forEach(processLayer);
        }
      };

      view.map.layers.forEach(processLayer);

      localStorage.setItem(getStorageKey(mapId), JSON.stringify({
        layers: layerStates,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[LayersPanel] Failed to save state:', e);
    }
  }, [mapId, view, hiddenLayerIds]);

  /**
   * Toggle layer visibility
   */
  const toggleLayerVisibility = useCallback((layerData) => {
    if (layerData.sublayer) {
      layerData.sublayer.visible = !layerData.sublayer.visible;
    } else if (layerData.layer) {
      layerData.layer.visible = !layerData.layer.visible;
    }
    setLayers(buildLayerTree());
    saveState();
  }, [buildLayerTree, saveState]);

  /**
   * Toggle group expansion
   */
  const toggleGroup = useCallback((layerId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle group visibility (collapse = off, expand = on)
   */
  const toggleGroupVisibility = useCallback((layerData) => {
    if (layerData.layer) {
      const newVisible = !layerData.layer.visible;
      layerData.layer.visible = newVisible;
      
      // Also toggle expansion state
      setExpandedGroups(prev => {
        const next = new Set(prev);
        if (newVisible) {
          next.add(layerData.id);
        } else {
          next.delete(layerData.id);
        }
        return next;
      });
      
      setLayers(buildLayerTree());
      saveState();
    }
  }, [buildLayerTree, saveState]);

  /**
   * Update layer opacity
   */
  const updateLayerOpacity = useCallback((layerData, opacity) => {
    if (layerData.sublayer) {
      layerData.sublayer.opacity = opacity;
    } else if (layerData.layer) {
      layerData.layer.opacity = opacity;
    }
    setLayerOpacities(prev => ({
      ...prev,
      [layerData.id]: opacity
    }));
    saveState();
  }, [saveState]);

  /**
   * Check if layer is visible at current scale
   */
  const isLayerInScale = useCallback((layerData) => {
    if (!view) return true;
    const scale = view.scale;
    const { minScale, maxScale } = layerData;
    
    const inMinScale = minScale === 0 || scale <= minScale;
    const inMaxScale = maxScale === 0 || scale >= maxScale;
    
    return inMinScale && inMaxScale;
  }, [view]);

  /**
   * Render a layer item
   */
  const renderLayerItem = (layerData, key) => {
    const isGroup = layerData.isGroup;
    const isExpanded = expandedGroups.has(layerData.id);
    const isVisible = layerData.sublayer ? layerData.sublayer.visible : layerData.visible;
    const inScale = isLayerInScale(layerData);
    const opacity = layerOpacities[layerData.id] ?? layerData.opacity;
    const showLegend = showLegends.has(layerData.id);

    return (
      <div key={key} className="layer-item-wrapper">
        <div
          className={`layer-item flex items-start gap-2 py-2 px-2 rounded-md transition
                     ${isVisible ? 'bg-white' : 'bg-slate-50'}
                     ${!inScale ? 'opacity-60' : ''}
                     hover:bg-slate-100 group`}
          style={{ paddingLeft: `${8 + layerData.depth * 16}px` }}
        >
          {/* Group Toggle / Checkbox */}
          {isGroup ? (
            <button
              onClick={() => toggleGroupVisibility(layerData)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center 
                        border border-slate-300 rounded bg-white hover:bg-slate-100 text-xs font-bold"
            >
              {isVisible ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
          ) : (
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => toggleLayerVisibility(layerData)}
              disabled={!inScale}
              className="flex-shrink-0 w-4 h-4 mt-0.5 rounded border-slate-300 
                        text-sky-600 focus:ring-sky-500 cursor-pointer
                        disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ accentColor: colors.bg500 }}
            />
          )}

          {/* Layer Name */}
          <div className="flex-1 min-w-0">
            <span 
              className={`text-xs font-medium truncate block ${
                isGroup ? 'uppercase tracking-wide text-slate-700' : 'text-slate-600'
              } ${!inScale ? 'italic' : ''}`}
              title={!inScale ? 'Layer not visible at this zoom level' : layerData.title}
            >
              {layerData.title}
            </span>
            
            {/* Opacity Slider (visible on hover for non-group layers) */}
            {!isGroup && isVisible && (
              <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => updateLayerOpacity(layerData, parseFloat(e.target.value))}
                  className="w-20 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    '--thumb-color': colors.bg500
                  }}
                />
                <span className="text-[10px] text-slate-400 w-7">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Group Expand/Collapse */}
          {isGroup && isVisible && (
            <button
              onClick={() => toggleGroup(layerData.id)}
              className="flex-shrink-0 p-1 hover:bg-slate-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
            </button>
          )}
        </div>

        {/* Group Children */}
        {isGroup && isExpanded && isVisible && layerData.children && (
          <div className="layer-group-children border-l-2 border-slate-200 ml-4">
            {layerData.children.map((child, idx) => renderLayerItem(child, `${layerData.id}-${idx}`))}
          </div>
        )}
      </div>
    );
  };

  // Position classes
  const positionClasses = position === 'top-right' 
    ? 'right-4 left-auto' 
    : 'left-4';

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`absolute ${positionClasses} top-4 flex items-center gap-2 px-3 py-2 
                   bg-white rounded-lg shadow-lg hover:bg-slate-50 transition 
                   text-sm font-medium text-slate-700 z-20 ${className}`}
      >
        <Layers className="w-4 h-4 text-slate-500" />
        <span>Layers</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`absolute ${positionClasses} top-4 w-72 bg-white rounded-lg shadow-xl 
                 border border-slate-200 z-20 flex flex-col max-h-[70vh] ${className}`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4" style={{ color: colors.text600 }} />
          <span className="text-sm font-semibold text-slate-700">Layers</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-white/50 rounded transition"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No layers available
          </div>
        ) : (
          <div className="space-y-0.5">
            {layers.map((layer, idx) => renderLayerItem(layer, idx))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 px-3 py-2 flex-shrink-0">
        <button
          onClick={() => {
            setLayers(buildLayerTree());
          }}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh Layers
        </button>
      </div>

      {/* Custom styles for range input */}
      <style>{`
        .layer-item input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--thumb-color, #0ea5e9);
          cursor: pointer;
        }
        .layer-item input[type="range"]::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--thumb-color, #0ea5e9);
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
