// src/atlas/components/BasemapPicker.jsx
// CivQuest Atlas - Enhanced Basemap Picker Component
// Dropdown basemap selector with integrated swipe tool
//
// Migrated from legacy layers.js basemap/swipe functionality

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  ChevronDown,
  X,
  Columns,
  Check,
  Image,
  Globe,
  Map as MapIcon
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// ArcGIS imports
import Basemap from '@arcgis/core/Basemap';
import TileLayer from '@arcgis/core/layers/TileLayer';
import WMSLayer from '@arcgis/core/layers/WMSLayer';
import Swipe from '@arcgis/core/widgets/Swipe';

// Storage key
const getStorageKey = (mapId) => `atlas_basemap_state_${mapId || 'default'}`;

/**
 * BasemapPicker Component
 * Enhanced basemap dropdown with swipe tool integration
 */
export default function BasemapPicker({
  view,
  basemaps = [],
  position = 'top-left',
  className = ''
}) {
  const { config, activeMap } = useAtlas();
  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [activeBasemapId, setActiveBasemapId] = useState('default');
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeBasemapId, setSwipeBasemapId] = useState(null);
  const [showSwipePanel, setShowSwipePanel] = useState(false);

  // Refs
  const swipeWidgetRef = useRef(null);
  const swipeLayersRef = useRef([]);
  const originalBasemapRef = useRef(null);
  const panelRef = useRef(null);

  // Get map ID for storage
  const mapId = view?.map?.portalItem?.id;

  // Use basemaps from config if not provided
  const basemapOptions = basemaps.length > 0 ? basemaps : (config?.basemaps || [
    { label: 'Default', id: 'default', type: 'esri' }
  ]);

  /**
   * Create basemap instance from config
   */
  const createBasemapInstance = useCallback((basemapConfig) => {
    if (!basemapConfig) return null;

    try {
      // Default Esri basemap
      if (basemapConfig.type === 'esri' || basemapConfig.id === 'default') {
        return originalBasemapRef.current || 'streets-vector';
      }

      // ArcGIS tiled service
      if (basemapConfig.type === 'arcgis' && basemapConfig.url) {
        const tileLayer = new TileLayer({ url: basemapConfig.url });
        return new Basemap({
          baseLayers: [tileLayer],
          title: basemapConfig.label,
          id: basemapConfig.id,
          thumbnailUrl: basemapConfig.thumbnailUrl || null
        });
      }

      // WMS service
      if (basemapConfig.type === 'wms' && basemapConfig.url) {
        const wmsProps = {
          url: basemapConfig.url,
          spatialReference: view?.spatialReference || { wkid: 3857 },
          version: '1.1.1',
          imageFormat: 'image/png',
          customParameters: { transparent: 'true' }
        };

        if (basemapConfig.wmsLayers && Array.isArray(basemapConfig.wmsLayers)) {
          wmsProps.sublayers = basemapConfig.wmsLayers.map(name => ({ name }));
        }

        const wmsLayer = new WMSLayer(wmsProps);
        return new Basemap({
          baseLayers: [wmsLayer],
          title: basemapConfig.label,
          id: basemapConfig.id
        });
      }

      // Esri named basemap
      if (basemapConfig.id) {
        return basemapConfig.id;
      }
    } catch (err) {
      console.error('[BasemapPicker] Error creating basemap:', err);
    }

    return null;
  }, [view]);

  /**
   * Apply basemap to view
   */
  const applyBasemap = useCallback((basemapConfig) => {
    if (!view?.map) return;

    try {
      const basemap = createBasemapInstance(basemapConfig);
      if (basemap) {
        view.map.basemap = basemap;
        setActiveBasemapId(basemapConfig.id);
        saveState();
      }
    } catch (err) {
      console.error('[BasemapPicker] Error applying basemap:', err);
    }
  }, [view, createBasemapInstance]);

  /**
   * Initialize - capture original basemap
   */
  useEffect(() => {
    if (view?.map?.basemap && !originalBasemapRef.current) {
      originalBasemapRef.current = view.map.basemap;
    }
  }, [view]);

  /**
   * Restore saved state
   */
  useEffect(() => {
    if (!mapId) return;

    try {
      const saved = localStorage.getItem(getStorageKey(mapId));
      if (saved) {
        const state = JSON.parse(saved);
        
        if (state.basemapId) {
          const config = basemapOptions.find(b => b.id === state.basemapId);
          if (config) {
            applyBasemap(config);
          }
        }

        if (state.swipeActive && state.swipeId) {
          setSwipeBasemapId(state.swipeId);
          setIsSwipeActive(true);
        }
      }
    } catch (e) {
      console.warn('[BasemapPicker] Failed to restore state:', e);
    }
  }, [mapId, basemapOptions]);

  /**
   * Save state
   */
  const saveState = useCallback(() => {
    if (!mapId) return;

    try {
      localStorage.setItem(getStorageKey(mapId), JSON.stringify({
        basemapId: activeBasemapId,
        swipeActive: isSwipeActive,
        swipeId: swipeBasemapId,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[BasemapPicker] Failed to save state:', e);
    }
  }, [mapId, activeBasemapId, isSwipeActive, swipeBasemapId]);

  /**
   * Activate swipe tool
   */
  const activateSwipe = useCallback(async (swipeConfig) => {
    if (!view || !swipeConfig) return;

    try {
      // Deactivate existing swipe if any
      deactivateSwipe();

      // Create basemap for swipe
      const swipeBasemap = createBasemapInstance(swipeConfig);
      if (!swipeBasemap) return;

      // Load basemap if needed
      if (swipeBasemap.load) {
        await swipeBasemap.load();
      }

      // Get layers from basemap
      let layers = [];
      if (typeof swipeBasemap === 'object' && swipeBasemap.baseLayers) {
        layers = [...swipeBasemap.baseLayers.toArray()];
        if (swipeBasemap.referenceLayers) {
          layers.push(...swipeBasemap.referenceLayers.toArray());
        }
      }

      if (layers.length === 0) {
        console.warn('[BasemapPicker] No layers for swipe');
        return;
      }

      // Add layers to map (hidden from layer list)
      layers.forEach(l => { l.listMode = 'hide'; });
      swipeLayersRef.current = layers;
      view.map.addMany(layers, 0);

      // Create swipe widget
      const swipe = new Swipe({
        view: view,
        leadingLayers: [],
        trailingLayers: layers,
        direction: 'horizontal',
        position: 50
      });

      view.ui.add(swipe);
      swipeWidgetRef.current = swipe;
      
      setSwipeBasemapId(swipeConfig.id);
      setIsSwipeActive(true);
      saveState();

    } catch (err) {
      console.error('[BasemapPicker] Swipe activation error:', err);
    }
  }, [view, createBasemapInstance, saveState]);

  /**
   * Deactivate swipe tool
   */
  const deactivateSwipe = useCallback(() => {
    if (swipeWidgetRef.current) {
      view?.ui.remove(swipeWidgetRef.current);
      swipeWidgetRef.current.destroy();
      swipeWidgetRef.current = null;
    }

    if (swipeLayersRef.current.length > 0) {
      view?.map.removeMany(swipeLayersRef.current);
      swipeLayersRef.current = [];
    }

    setIsSwipeActive(false);
    setSwipeBasemapId(null);
    saveState();
  }, [view, saveState]);

  /**
   * Toggle swipe
   */
  const toggleSwipe = useCallback(() => {
    if (isSwipeActive) {
      deactivateSwipe();
    } else {
      // Find a basemap different from active one
      const availableSwipe = basemapOptions.find(b => b.id !== activeBasemapId);
      if (availableSwipe) {
        activateSwipe(availableSwipe);
      }
    }
  }, [isSwipeActive, activeBasemapId, basemapOptions, activateSwipe, deactivateSwipe]);

  /**
   * Handle basemap selection
   */
  const handleSelectBasemap = (basemapConfig) => {
    applyBasemap(basemapConfig);
    setIsOpen(false);

    // If swipe is active and same basemap selected, change swipe basemap
    if (isSwipeActive && basemapConfig.id === swipeBasemapId) {
      const alt = basemapOptions.find(b => b.id !== basemapConfig.id);
      if (alt) {
        activateSwipe(alt);
      }
    }
  };

  /**
   * Handle swipe basemap selection
   */
  const handleSelectSwipeBasemap = (basemapConfig) => {
    activateSwipe(basemapConfig);
    setShowSwipePanel(false);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowSwipePanel(false);
      }
    };

    if (isOpen || showSwipePanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, showSwipePanel]);

  // Get active basemap config
  const activeBasemapConfig = basemapOptions.find(b => b.id === activeBasemapId) || basemapOptions[0];

  // Position styles
  const positionClasses = position === 'top-right' 
    ? 'right-4 left-auto' 
    : 'left-4';

  // Get icon for basemap type
  const getBasemapIcon = (config) => {
    if (config?.type === 'wms' || config?.label?.toLowerCase().includes('aerial')) {
      return Image;
    }
    return MapIcon;
  };

  return (
    <div 
      ref={panelRef}
      className={`relative ${className}`}
    >
      {/* Basemap Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setShowSwipePanel(false); }}
        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg 
                   hover:bg-slate-50 transition text-sm font-medium text-slate-700
                   ${isOpen ? 'ring-2' : ''}`}
        style={isOpen ? { ringColor: colors.bg500 } : {}}
      >
        <Layers className="w-4 h-4 text-slate-500" />
        <span className="hidden sm:inline truncate max-w-[100px]">
          {activeBasemapConfig?.label || 'Basemap'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Basemaps
            </span>
            <button
              onClick={toggleSwipe}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition
                         ${isSwipeActive 
                           ? 'bg-blue-500 text-white' 
                           : 'border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
            >
              <Columns className="w-3 h-3" />
              Swipe
            </button>
          </div>

          {/* Basemap List */}
          <div className="max-h-64 overflow-y-auto">
            {basemapOptions.map((bm) => {
              const Icon = getBasemapIcon(bm);
              const isActive = activeBasemapId === bm.id;
              const isSwipeBasemap = isSwipeActive && swipeBasemapId === bm.id;

              return (
                <button
                  key={bm.id}
                  onClick={() => handleSelectBasemap(bm)}
                  disabled={isSwipeBasemap}
                  className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-3
                             ${isActive 
                               ? 'font-medium' 
                               : 'text-slate-700 hover:bg-slate-50'}
                             ${isSwipeBasemap ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={isActive ? { backgroundColor: colors.bg50, color: colors.text700 } : {}}
                >
                  {/* Thumbnail or Icon */}
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                    {bm.thumbnailUrl ? (
                      <img 
                        src={bm.thumbnailUrl} 
                        alt={bm.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Icon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{bm.label}</span>
                    {isSwipeBasemap && (
                      <span className="text-xs text-blue-500">Active Swipe</span>
                    )}
                  </div>

                  {/* Check mark */}
                  {isActive && (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.text600 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Swipe Controls (when active) */}
          {isSwipeActive && (
            <div className="border-t border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Compare with:</span>
                <button
                  onClick={deactivateSwipe}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Stop Swipe
                </button>
              </div>
              <select
                value={swipeBasemapId || ''}
                onChange={(e) => {
                  const config = basemapOptions.find(b => b.id === e.target.value);
                  if (config) activateSwipe(config);
                }}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md
                          focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {basemapOptions
                  .filter(b => b.id !== activeBasemapId)
                  .map(bm => (
                    <option key={bm.id} value={bm.id}>
                      {bm.label}
                    </option>
                  ))
                }
              </select>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Drag the swipe bar on the map to compare
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
