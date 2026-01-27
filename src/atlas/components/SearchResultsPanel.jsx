// src/atlas/components/SearchResultsPanel.jsx
// CivQuest Atlas - Search Results Panel Component
// Expandable panel showing search results in a list
//
// Displays results from searches, allows clicking to zoom/highlight

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  ChevronDown,
  X,
  MapPin,
  ChevronRight,
  Trash2,
  Eye,
  ExternalLink
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

/**
 * SearchResultsPanel Component
 * Displays search results in an expandable list
 */
export default function SearchResultsPanel({
  view,
  config,
  isExpanded = false,
  onToggle,
  onFeatureSelect,
  onFeatureHover,
  onClearResults,
  className = ''
}) {
  const { 
    config: atlasConfig, 
    searchResults, 
    updateSearchResults,
    highlightFeature,
    zoomToFeature 
  } = useAtlas();
  
  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // State
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Refs
  const panelRef = useRef(null);
  const listRef = useRef(null);

  // Get features from search results
  const features = searchResults?.features || [];
  const resultCount = features.length;

  /**
   * Get display title for a feature
   */
  const getFeatureTitle = useCallback((feature, index) => {
    if (!feature?.attributes) return `Result ${index + 1}`;
    
    const attrs = feature.attributes;
    // Try common title fields
    return attrs.title || attrs.TITLE || attrs.name || attrs.NAME || 
           attrs.ADDRESS || attrs.address || attrs.PARCELID || 
           attrs.GPIN || attrs.PIN || attrs.ID || `Result ${index + 1}`;
  }, []);

  /**
   * Get subtitle/description for a feature
   */
  const getFeatureSubtitle = useCallback((feature) => {
    if (!feature?.attributes) return null;
    
    const attrs = feature.attributes;
    // Try common subtitle fields
    if (attrs.ADDRESS && attrs.title !== attrs.ADDRESS) return attrs.ADDRESS;
    if (attrs.address && attrs.title !== attrs.address) return attrs.address;
    if (attrs.OWNER) return attrs.OWNER;
    if (attrs.owner) return attrs.owner;
    if (attrs.TYPE) return attrs.TYPE;
    if (attrs.type) return attrs.type;
    return null;
  }, []);

  /**
   * Handle feature click
   */
  const handleFeatureClick = useCallback((feature, index) => {
    setSelectedIndex(index);
    
    if (onFeatureSelect) {
      onFeatureSelect(feature);
    }
    
    // Zoom to feature
    if (zoomToFeature) {
      zoomToFeature(feature);
    }
  }, [onFeatureSelect, zoomToFeature]);

  /**
   * Handle feature hover
   */
  const handleFeatureHover = useCallback((feature, index, isEntering) => {
    setHoveredIndex(isEntering ? index : null);
    
    if (onFeatureHover) {
      onFeatureHover(isEntering ? feature : null);
    }
    
    // Highlight feature on map
    if (highlightFeature && isEntering) {
      highlightFeature(feature);
    }
  }, [onFeatureHover, highlightFeature]);

  /**
   * Handle clear results
   */
  const handleClear = useCallback(() => {
    setSelectedIndex(null);
    setHoveredIndex(null);
    
    if (onClearResults) {
      onClearResults();
    } else if (updateSearchResults) {
      updateSearchResults({ features: [] });
    }
  }, [onClearResults, updateSearchResults]);

  /**
   * Scroll selected item into view
   */
  useEffect(() => {
    if (selectedIndex !== null && listRef.current) {
      const items = listRef.current.querySelectorAll('.result-item');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Collapsed button
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg 
                   hover:bg-slate-50 transition text-sm font-medium text-slate-700 
                   min-w-[140px] ${className}`}
      >
        <Search className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-left">Results</span>
        {resultCount > 0 && (
          <span 
            className="px-1.5 py-0.5 text-xs rounded-full text-white"
            style={{ backgroundColor: colors.bg500 }}
          >
            {resultCount}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  // Expanded panel
  return (
    <div
      ref={panelRef}
      className={`w-80 bg-white rounded-lg shadow-xl border border-slate-200 
                 flex flex-col max-h-[60vh] ${className}`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-slate-200 flex-shrink-0"
        style={{ backgroundColor: colors.bg50 }}
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" style={{ color: colors.text600 }} />
          <span className="text-sm font-semibold text-slate-700">Search Results</span>
          {resultCount > 0 && (
            <span 
              className="px-1.5 py-0.5 text-xs rounded-full text-white"
              style={{ backgroundColor: colors.bg500 }}
            >
              {resultCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {resultCount > 0 && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-red-100 rounded transition"
              title="Clear Results"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 hover:bg-white/50 rounded transition"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Results List */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {resultCount === 0 ? (
          <div className="p-6 text-center">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No search results</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the search bar to find features
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {features.map((feature, index) => {
              const title = getFeatureTitle(feature, index);
              const subtitle = getFeatureSubtitle(feature);
              const isSelected = selectedIndex === index;
              const isHovered = hoveredIndex === index;

              return (
                <div
                  key={feature.attributes?._index ?? index}
                  className={`result-item flex items-start gap-2 p-3 cursor-pointer transition
                             ${isSelected ? 'bg-slate-100' : isHovered ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                  style={isSelected ? { 
                    backgroundColor: colors.bg50,
                    borderLeft: `3px solid ${colors.bg500}`
                  } : {}}
                  onClick={() => handleFeatureClick(feature, index)}
                  onMouseEnter={() => handleFeatureHover(feature, index, true)}
                  onMouseLeave={() => handleFeatureHover(feature, index, false)}
                >
                  {/* Index Badge */}
                  <div 
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: isSelected ? colors.bg600 : colors.bg400 }}
                  >
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'} text-slate-800`}>
                      {title}
                    </p>
                    {subtitle && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 transition
                                           ${isSelected || isHovered ? 'text-slate-600' : 'text-slate-300'}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {resultCount > 0 && (
        <div className="border-t border-slate-200 px-3 py-2 flex-shrink-0 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Click a result to zoom • Hover to highlight
          </p>
        </div>
      )}
    </div>
  );
}
