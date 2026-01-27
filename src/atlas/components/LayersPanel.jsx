// src/atlas/components/LayersPanel.jsx
// CivQuest Atlas - Layers Panel Component
// Collapsible layers panel with table of contents and legends
// Includes map picker dropdown at top when multiple maps available
//
// Features:
// - Layer visibility toggle
// - Opacity slider on hover
// - Legend display for visible layers
// - Map picker when multiple maps exist

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  X,
  Minus,
  Plus,
  Map as MapIcon,
  Check,
  List
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import Legend from '@arcgis/core/widgets/Legend';

// Storage key for layer state persistence
const getStorageKey = (mapId) => `atlas_layers_state_${mapId || 'default'}`;

/**
 * LayersPanel Component
 * Displays a collapsible layers panel with TOC and legends
 */
export default function LayersPanel({
  view,
  map,
  config,
  mapId,
  hiddenLayers = [],
  isExpanded = false,
  onToggle,
  className = ''
}) {
  const { 
    config: atlasConfig, 
    activeMap, 
    activeMapIndex,
    setActiveMap, 
    availableMaps 
  } = useAtlas();
  
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [layers, setLayers] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [layerOpacities, setLayerOpacities] = useState({});
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [expandedLegends, setExpandedLegends] = useState(new Set());

  // Refs
  const panelRef = useRef(null);
  const mapPickerRef = useRef(null);
  const legendContainersRef = useRef({});
  const legendWidgetsRef = useRef({});

  // Memoize hiddenLayers to prevent unnecessary rebuilds
  const hiddenLayerIdsKey = useMemo(() => JSON.stringify(hiddenLayers), [hiddenLayers]);

  // Close map picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mapPickerRef.current && !mapPickerRef.current.contains(e.target)) {
        setShowMapPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Build layer tree from map
   */
  const buildLayerTreeRef = useRef(null);
  
  buildLayerTreeRef.current = useCallback(() => {
    if (!view?.map?.layers) return [];

    const hiddenIds = JSON.parse(hiddenLayerIdsKey);

    const processLayer = (layer, depth = 0) => {
      if (hiddenIds.includes(layer.id)) return null;
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
        layer,
        hasLegend: ['feature', 'map-image', 'tile', 'wms', 'imagery'].includes(layer.type)
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
        const sublayers = layer.sublayers.toArray ? 
          layer.sublayers.toArray() : Array.from(layer.sublayers);
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
              sublayer: sub,
              hasLegend: true
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
  }, [view, hiddenLayerIdsKey]);

  /**
   * Initialize and update layer tree
   */
  useEffect(() => {
    if (!view?.map) return;

    const updateLayers = () => {
      const tree = buildLayerTreeRef.current ? buildLayerTreeRef.current() : [];
      setLayers(tree);
    };

    updateLayers();

    const handle = view.map.layers.on('change', updateLayers);

    return () => {
      handle?.remove();
      // Clean up legend widgets
      Object.values(legendWidgetsRef.current).forEach(widget => {
        if (widget?.destroy) widget.destroy();
      });
      legendWidgetsRef.current = {};
    };
  }, [view, hiddenLayerIdsKey]);

  /**
   * Create legend for a layer
   */
  const createLegend = useCallback((layerData, containerEl) => {
    if (!view || !containerEl || !layerData.layer) return;

    // Destroy existing legend
    if (legendWidgetsRef.current[layerData.id]) {
      legendWidgetsRef.current[layerData.id].destroy();
    }

    try {
      const legend = new Legend({
        view: view,
        container: containerEl,
        layerInfos: [{
          layer: layerData.layer,
          title: ''
        }],
        style: 'classic'
      });
      legendWidgetsRef.current[layerData.id] = legend;
    } catch (e) {
      console.warn('[LayersPanel] Failed to create legend:', e);
    }
  }, [view]);

  /**
   * Toggle legend visibility
   */
  const toggleLegend = useCallback((layerId) => {
    setExpandedLegends(prev => {
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
   * Save layer state
   */
  const saveState = useCallback(() => {
    if (!mapId || !view?.map) return;

    const hiddenIds = JSON.parse(hiddenLayerIdsKey);

    try {
      const layerStates = {};
      
      const processLayer = (layer) => {
        if (hiddenIds.includes(layer.id)) return;
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
  }, [mapId, view, hiddenLayerIdsKey]);

  /**
   * Toggle layer visibility
   */
  const toggleLayerVisibility = useCallback((layerData) => {
    if (layerData.sublayer) {
      layerData.sublayer.visible = !layerData.sublayer.visible;
    } else if (layerData.layer) {
      layerData.layer.visible = !layerData.layer.visible;
    }
    setLayers(buildLayerTreeRef.current ? buildLayerTreeRef.current() : []);
    saveState();
  }, [saveState]);

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
   * Toggle group visibility
   */
  const toggleGroupVisibility = useCallback((layerData) => {
    if (layerData.layer) {
      const newVisible = !layerData.layer.visible;
      layerData.layer.visible = newVisible;
      
      setExpandedGroups(prev => {
        const next = new Set(prev);
        if (newVisible) {
          next.add(layerData.id);
        } else {
          next.delete(layerData.id);
        }
        return next;
      });
      
      setLayers(buildLayerTreeRef.current ? buildLayerTreeRef.current() : []);
      saveState();
    }
  }, [saveState]);

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
   * Handle map selection
   */
  const handleMapSelect = useCallback((index) => {
    setActiveMap(index);
    setShowMapPicker(false);
  }, [setActiveMap]);

  /**
   * Render a layer item
   */
  const renderLayerItem = (layerData, key) => {
    const isGroup = layerData.isGroup;
    const isGroupExpanded = expandedGroups.has(layerData.id);
    const isVisible = layerData.sublayer ? layerData.sublayer.visible : layerData.visible;
    const inScale = isLayerInScale(layerData);
    const opacity = layerOpacities[layerData.id] ?? layerData.opacity;
    const showLegend = expandedLegends.has(layerData.id) && isVisible && layerData.hasLegend;

    return (
      <div key={key} className="layer-item-wrapper">
        <div
          className={`layer-item flex items-start gap-2 py-1.5 px-2 rounded transition
                     ${isVisible ? 'bg-white' : 'bg-slate-50'}
                     ${!inScale ? 'opacity-60' : ''}
                     hover:bg-slate-100 group`}
          style={{ paddingLeft: `${8 + layerData.depth * 16}px` }}
        >
          {/* Checkbox / Group Toggle */}
          {isGroup ? (
            <button
              onClick={() => toggleGroupVisibility(layerData)}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center 
                        border border-slate-300 rounded bg-white hover:bg-slate-100 text-xs"
            >
              {isVisible ? (
                <Minus className="w-2.5 h-2.5 text-slate-600" />
              ) : (
                <Plus className="w-2.5 h-2.5 text-slate-400" />
              )}
            </button>
          ) : (
            <button
              onClick={() => toggleLayerVisibility(layerData)}
              className={`flex-shrink-0 w-4 h-4 flex items-center justify-center 
                         border rounded transition
                         ${isVisible 
                           ? 'border-slate-400 bg-slate-600' 
                           : 'border-slate-300 bg-white hover:bg-slate-100'}`}
            >
              {isVisible && <Eye className="w-2.5 h-2.5 text-white" />}
            </button>
          )}

          {/* Layer Title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className={`text-xs truncate ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                {layerData.title}
              </span>
              
              {/* Legend Toggle Button */}
              {isVisible && layerData.hasLegend && !isGroup && (
                <button
                  onClick={() => toggleLegend(layerData.id)}
                  className={`p-0.5 rounded transition opacity-0 group-hover:opacity-100
                             ${showLegend ? 'bg-slate-200' : 'hover:bg-slate-200'}`}
                  title={showLegend ? 'Hide Legend' : 'Show Legend'}
                >
                  <List className="w-3 h-3 text-slate-500" />
                </button>
              )}
            </div>
            
            {/* Opacity slider on hover */}
            {isVisible && !isGroup && (
              <div className="mt-1 opacity-0 group-hover:opacity-100 transition">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={opacity}
                  onChange={(e) => updateLayerOpacity(layerData, parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  style={{ '--thumb-color': colors.bg500 }}
                />
              </div>
            )}
          </div>

          {/* Group Expand/Collapse */}
          {isGroup && isVisible && layerData.children?.length > 0 && (
            <button
              onClick={() => toggleGroup(layerData.id)}
              className="flex-shrink-0 p-0.5 hover:bg-slate-200 rounded"
            >
              {isGroupExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-400" />
              )}
            </button>
          )}
        </div>

        {/* Legend (for visible non-group layers) */}
        {showLegend && (
          <div 
            className="layer-legend ml-6 mb-2 p-2 bg-slate-50 rounded border border-slate-200"
            ref={(el) => {
              if (el && layerData.layer) {
                legendContainersRef.current[layerData.id] = el;
                createLegend(layerData, el);
              }
            }}
          />
        )}

        {/* Group Children */}
        {isGroup && isGroupExpanded && isVisible && layerData.children && (
          <div className="layer-group-children border-l border-slate-200 ml-3">
            {layerData.children.map((child, idx) => renderLayerItem(child, `${layerData.id}-${idx}`))}
          </div>
        )}
      </div>
    );
  };

  // Check if we have multiple maps
  const hasMultipleMaps = availableMaps && availableMaps.length > 1;

  // Collapsed button
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg 
                   hover:bg-slate-50 transition text-sm font-medium text-slate-700 
                   min-w-[140px] ${className}`}
      >
        <Layers className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-left">Layers</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      ref={panelRef}
      className={`w-72 bg-white rounded-lg shadow-xl border border-slate-200 
                 flex flex-col max-h-[60vh] ${className}`}
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

      {/* Map Picker (if multiple maps) */}
      {hasMultipleMaps && (
        <div ref={mapPickerRef} className="relative border-b border-slate-200">
          <button
            onClick={() => setShowMapPicker(!showMapPicker)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition"
          >
            <MapIcon className="w-4 h-4 text-slate-500" />
            <span className="flex-1 text-left text-sm font-medium text-slate-700 truncate">
              {activeMap?.name || 'Select Map'}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMapPicker ? 'rotate-180' : ''}`} />
          </button>

          {/* Map Picker Dropdown */}
          {showMapPicker && (
            <div className="absolute left-0 right-0 top-full bg-white border border-slate-200 
                           rounded-b-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {availableMaps.map((mapOption, idx) => (
                <button
                  key={idx}
                  onClick={() => handleMapSelect(idx)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left 
                             hover:bg-slate-50 transition
                             ${activeMapIndex === idx ? 'bg-slate-50' : ''}`}
                >
                  {activeMapIndex === idx ? (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.text600 }} />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                  <span className={activeMapIndex === idx ? 'font-medium' : ''}>
                    {mapOption.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No layers available
          </div>
        ) : (
          <div className="space-y-0.5">
            {layers.map((layer, idx) => renderLayerItem(layer, idx))}
          </div>
        )}
      </div>

      {/* Styles */}
      <style>{`
        .layer-item input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--thumb-color, #0ea5e9);
          cursor: pointer;
        }
        .layer-item input[type="range"]::-moz-range-thumb {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--thumb-color, #0ea5e9);
          cursor: pointer;
          border: none;
        }
        .layer-legend .esri-widget {
          box-shadow: none !important;
          background: transparent !important;
          font-size: 11px !important;
        }
        .layer-legend .esri-legend__service {
          padding: 0 !important;
          border-bottom: none !important;
        }
        .layer-legend .esri-legend__layer-caption {
          display: none !important;
        }
        .layer-legend .esri-legend__message {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
