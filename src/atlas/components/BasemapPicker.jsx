// src/atlas/components/BasemapPicker.jsx
// CivQuest Atlas - Basemap Picker Component
// Expandable panel with swipe toggle and basemap selection
//
// Layout:
// - Swipe toggle button at top
// - Basemap dropdown
// - When swipe active: second dropdown for swipe layer

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe,
  ChevronDown,
  X,
  Columns
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
 * Expandable panel with swipe toggle and basemap dropdowns
 */
export default function BasemapPicker({
  view,
  map,
  basemaps = [],
  config,
  mapId,
  isExpanded = false,
  onToggle,
  className = '',
  justification = 'left'
}) {
  const { config: atlasConfig, activeMap } = useAtlas();
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [activeBasemapId, setActiveBasemapId] = useState('default');
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [swipeBasemapId, setSwipeBasemapId] = useState('');

  // Refs
  const swipeWidgetRef = useRef(null);
  const swipeLayersRef = useRef([]);
  const originalBasemapRef = useRef(null);
  const panelRef = useRef(null);

  // Default basemaps if none provided
  const defaultBasemaps = [
    { label: 'Streets', id: 'streets-vector', type: 'esri' },
    { label: 'Satellite', id: 'satellite', type: 'esri' },
    { label: 'Hybrid', id: 'hybrid', type: 'esri' },
    { label: 'Topographic', id: 'topo-vector', type: 'esri' },
    { label: 'Gray', id: 'gray-vector', type: 'esri' },
    { label: 'Dark Gray', id: 'dark-gray-vector', type: 'esri' },
    { label: 'Navigation', id: 'streets-navigation-vector', type: 'esri' },
    { label: 'OpenStreetMap', id: 'osm', type: 'esri' }
  ];

  const basemapOptions = basemaps.length > 0 
    ? basemaps 
    : (activeMap?.basemaps || atlasConfig?.basemaps || defaultBasemaps);

  /**
   * Store original basemap on init
   */
  useEffect(() => {
    if (view?.map?.basemap && !originalBasemapRef.current) {
      originalBasemapRef.current = view.map.basemap;
    }
  }, [view]);

  /**
   * Create basemap instance from config
   */
  const createBasemapInstance = useCallback((basemapConfig) => {
    if (!basemapConfig) return null;

    try {
      if (basemapConfig.id === 'default') {
        return originalBasemapRef.current || 'streets-vector';
      }

      if (basemapConfig.type === 'esri' || !basemapConfig.url) {
        return basemapConfig.id;
      }

      if (basemapConfig.type === 'arcgis' && basemapConfig.url) {
        const tileLayer = new TileLayer({ url: basemapConfig.url });
        return new Basemap({
          baseLayers: [tileLayer],
          title: basemapConfig.label,
          id: basemapConfig.id
        });
      }

      if (basemapConfig.type === 'wms' && basemapConfig.url) {
        const wmsLayer = new WMSLayer({
          url: basemapConfig.url,
          sublayers: basemapConfig.wmsLayers?.map(name => ({ name })) || []
        });
        return new Basemap({
          baseLayers: [wmsLayer],
          title: basemapConfig.label,
          id: basemapConfig.id
        });
      }

      return basemapConfig.id;
    } catch (err) {
      console.error('[BasemapPicker] Error creating basemap:', err);
      return null;
    }
  }, []);

  /**
   * Save state to localStorage
   */
  const saveState = useCallback((basemapId, swipeActive, swipeId) => {
    try {
      localStorage.setItem(getStorageKey(mapId), JSON.stringify({
        basemapId,
        swipeActive,
        swipeId,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }, [mapId]);

  /**
   * Handle basemap selection change
   */
  const handleBasemapChange = useCallback((e) => {
    const selectedId = e.target.value;
    if (!view?.map || !selectedId) return;

    const basemapConfig = basemapOptions.find(b => b.id === selectedId);
    if (!basemapConfig) return;

    try {
      const basemap = createBasemapInstance(basemapConfig);
      if (basemap) {
        view.map.basemap = basemap;
        setActiveBasemapId(selectedId);

        // If swipe is active and we selected the same basemap, switch swipe to different one
        if (isSwipeActive && selectedId === swipeBasemapId) {
          const alt = basemapOptions.find(b => b.id !== selectedId);
          if (alt) {
            setSwipeBasemapId(alt.id);
            const swipeConfig = basemapOptions.find(b => b.id === alt.id);
            if (swipeConfig) updateSwipeLayer(swipeConfig);
          }
        }

        saveState(selectedId, isSwipeActive, swipeBasemapId);
      }
    } catch (err) {
      console.error('[BasemapPicker] Error applying basemap:', err);
    }
  }, [view, basemapOptions, createBasemapInstance, isSwipeActive, swipeBasemapId, saveState]);

  /**
   * Setup swipe widget with layers
   */
  const setupSwipeWidget = useCallback((layers, position = 50) => {
    if (!view || layers.length === 0) return;

    layers.forEach(layer => {
      layer.listMode = 'hide';
    });
    view.map.addMany(layers, 0);
    swipeLayersRef.current = layers;

    const swipe = new Swipe({
      view: view,
      leadingLayers: [],
      trailingLayers: layers,
      direction: 'horizontal',
      position: position
    });

    view.ui.add(swipe);
    swipeWidgetRef.current = swipe;
  }, [view]);

  /**
   * Activate swipe with basemap
   */
  const activateSwipe = useCallback(async (swipeConfig) => {
    if (!view) return;

    // Clean up existing
    if (swipeWidgetRef.current) {
      view.ui.remove(swipeWidgetRef.current);
      swipeWidgetRef.current.destroy();
      swipeWidgetRef.current = null;
    }
    swipeLayersRef.current.forEach(layer => view.map.remove(layer));
    swipeLayersRef.current = [];

    try {
      const basemap = createBasemapInstance(swipeConfig);
      if (!basemap) return;

      if (typeof basemap === 'string') {
        const esriBasemap = Basemap.fromId(basemap);
        await esriBasemap.load();
        const layers = [...esriBasemap.baseLayers.toArray(), ...esriBasemap.referenceLayers.toArray()];
        setupSwipeWidget(layers);
      } else if (basemap.load) {
        await basemap.load();
        const layers = [...basemap.baseLayers.toArray(), ...(basemap.referenceLayers?.toArray() || [])];
        setupSwipeWidget(layers);
      }
    } catch (err) {
      console.error('[BasemapPicker] Swipe activation error:', err);
    }
  }, [view, createBasemapInstance, setupSwipeWidget]);

  /**
   * Update swipe layer
   */
  const updateSwipeLayer = useCallback(async (swipeConfig) => {
    if (!isSwipeActive || !view) return;

    const previousPosition = swipeWidgetRef.current?.position || 50;

    if (swipeWidgetRef.current) {
      view.ui.remove(swipeWidgetRef.current);
      swipeWidgetRef.current.destroy();
      swipeWidgetRef.current = null;
    }
    swipeLayersRef.current.forEach(layer => view.map.remove(layer));
    swipeLayersRef.current = [];

    try {
      const basemap = createBasemapInstance(swipeConfig);
      if (!basemap) return;

      if (typeof basemap === 'string') {
        const esriBasemap = Basemap.fromId(basemap);
        await esriBasemap.load();
        const layers = [...esriBasemap.baseLayers.toArray(), ...esriBasemap.referenceLayers.toArray()];
        setupSwipeWidget(layers, previousPosition);
      } else if (basemap.load) {
        await basemap.load();
        const layers = [...basemap.baseLayers.toArray(), ...(basemap.referenceLayers?.toArray() || [])];
        setupSwipeWidget(layers, previousPosition);
      }
    } catch (err) {
      console.error('[BasemapPicker] Swipe update error:', err);
    }
  }, [view, createBasemapInstance, isSwipeActive, setupSwipeWidget]);

  /**
   * Deactivate swipe
   */
  const deactivateSwipe = useCallback(() => {
    if (!view) return;

    if (swipeWidgetRef.current) {
      view.ui.remove(swipeWidgetRef.current);
      swipeWidgetRef.current.destroy();
      swipeWidgetRef.current = null;
    }

    swipeLayersRef.current.forEach(layer => view.map.remove(layer));
    swipeLayersRef.current = [];
  }, [view]);

  /**
   * Toggle swipe mode
   */
  const toggleSwipe = useCallback(() => {
    const newSwipeActive = !isSwipeActive;
    setIsSwipeActive(newSwipeActive);

    if (newSwipeActive) {
      let swipeId = swipeBasemapId;
      if (!swipeId || swipeId === activeBasemapId) {
        const alt = basemapOptions.find(b => b.id !== activeBasemapId);
        swipeId = alt?.id || 'hybrid';
        setSwipeBasemapId(swipeId);
      }
      const swipeConfig = basemapOptions.find(b => b.id === swipeId);
      if (swipeConfig) {
        activateSwipe(swipeConfig);
      }
    } else {
      deactivateSwipe();
    }

    saveState(activeBasemapId, newSwipeActive, swipeBasemapId);
  }, [isSwipeActive, swipeBasemapId, activeBasemapId, basemapOptions, activateSwipe, deactivateSwipe, saveState]);

  /**
   * Handle swipe basemap selection
   */
  const handleSwipeChange = useCallback((e) => {
    const selectedId = e.target.value;
    if (!selectedId || selectedId === activeBasemapId) return;

    setSwipeBasemapId(selectedId);
    const swipeConfig = basemapOptions.find(b => b.id === selectedId);
    if (swipeConfig) {
      updateSwipeLayer(swipeConfig);
    }
    saveState(activeBasemapId, isSwipeActive, selectedId);
  }, [activeBasemapId, basemapOptions, isSwipeActive, updateSwipeLayer, saveState]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (swipeWidgetRef.current) {
        swipeWidgetRef.current.destroy();
      }
    };
  }, []);

  // Collapsed button
  const justifyClass = justification === 'center' ? 'justify-center' : justification === 'right' ? 'justify-end' : 'justify-start';

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center ${justifyClass} gap-1.5 w-24 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200
                   hover:bg-slate-50 transition-colors ${className}
                   ${isSwipeActive ? 'ring-2 ring-blue-400' : ''}`}
        title="Basemaps"
      >
        <Globe className="w-4 h-4" style={{ color: colors.bg600 }} />
        <span className="text-sm font-medium text-slate-700">Base</span>
        {isSwipeActive && <Columns className="w-3 h-3 text-blue-500" />}
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      ref={panelRef}
      className={`w-64 bg-white rounded-lg shadow-xl border border-slate-200 
                 flex flex-col ${className}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" style={{ color: colors.text600 }} />
          <span className="text-sm font-semibold text-slate-700">Basemaps</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Swipe Toggle Button in Header */}
          <button
            onClick={toggleSwipe}
            className={`p-1.5 rounded transition ${
              isSwipeActive
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'hover:bg-white/50 text-slate-500 hover:text-slate-700'
            }`}
            title={isSwipeActive ? 'Swipe Compare: On' : 'Swipe Compare: Off'}
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-white/50 rounded transition"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Basemap Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Basemap
          </label>
          <select
            value={activeBasemapId}
            onChange={handleBasemapChange}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg 
                      bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 
                      focus:border-transparent cursor-pointer"
          >
            {basemapOptions.map(basemap => (
              <option 
                key={basemap.id} 
                value={basemap.id}
                disabled={isSwipeActive && basemap.id === swipeBasemapId}
              >
                {basemap.label}{isSwipeActive && basemap.id === swipeBasemapId ? ' (Swipe Layer)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Swipe Layer Select (only when swipe active) */}
        {isSwipeActive && (
          <div className="pt-2 border-t border-dashed border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Compare with (Swipe Layer)
            </label>
            <select
              value={swipeBasemapId}
              onChange={handleSwipeChange}
              className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg 
                        bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 
                        focus:border-transparent cursor-pointer"
            >
              {basemapOptions.map(basemap => (
                <option 
                  key={basemap.id} 
                  value={basemap.id}
                  disabled={basemap.id === activeBasemapId}
                >
                  {basemap.label}{basemap.id === activeBasemapId ? ' (Current Basemap)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-blue-600 mt-1.5">
              Drag the divider on the map to compare
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
