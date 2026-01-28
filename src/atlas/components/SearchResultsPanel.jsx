// src/atlas/components/SearchResultsPanel.jsx
// CivQuest Atlas - Search Results Panel Component
// Expandable panel showing search results in a list
//
// Displays results from searches, allows clicking to zoom/highlight

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search,
  X,
  ChevronRight,
  Trash2,
  Maximize2,
  Settings2,
  ArrowUpAZ,
  ArrowDownAZ,
  Check,
  Filter
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
  onZoomToAll,
  searchFields = [],
  className = ''
}) {
  const {
    config: atlasConfig,
    searchResults,
    updateSearchResults,
    highlightFeature,
    zoomToFeature,
    activeMap
  } = useAtlas();

  const themeColor = config?.ui?.themeColor || atlasConfig?.ui?.themeColor || 'sky';
  const colors = getThemeColors(themeColor);

  // Get search fields from props or activeMap
  const availableSearchFields = searchFields.length > 0 ? searchFields : (activeMap?.searchFields || []);

  // State
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [displayField, setDisplayField] = useState(''); // Empty means auto-detect
  const [filterText, setFilterText] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // Refs
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const configRef = useRef(null);
  const filterInputRef = useRef(null);

  // Get features from search results
  const rawFeatures = searchResults?.features || [];
  const resultCount = rawFeatures.length;

  // Close config popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (configRef.current && !configRef.current.contains(e.target)) {
        setShowConfig(false);
      }
    };
    if (showConfig) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConfig]);


  /**
   * Get the value for sorting/display from a feature
   */
  const getFieldValue = useCallback((feature, fieldName) => {
    if (!feature?.attributes || !fieldName) return '';
    // Try exact match first, then case-insensitive
    if (feature.attributes[fieldName] !== undefined) {
      return feature.attributes[fieldName];
    }
    const lowerField = fieldName.toLowerCase();
    for (const key of Object.keys(feature.attributes)) {
      if (key.toLowerCase() === lowerField) {
        return feature.attributes[key];
      }
    }
    return '';
  }, []);

  /**
   * Sorted and processed features
   */
  const features = useMemo(() => {
    if (!rawFeatures.length) return [];

    let processedFeatures = [...rawFeatures];

    // Filter features if filter text is provided
    if (filterText.trim()) {
      const searchTerm = filterText.trim().toLowerCase();
      processedFeatures = processedFeatures.filter(feature => {
        if (!feature?.attributes) return false;

        // If a display field is selected, search only in that field
        if (displayField) {
          const value = getFieldValue(feature, displayField);
          return String(value || '').toLowerCase().includes(searchTerm);
        }

        // Otherwise, search across all attributes
        return Object.values(feature.attributes).some(value =>
          String(value || '').toLowerCase().includes(searchTerm)
        );
      });
    }

    // If no display field selected, return filtered features without sorting
    if (!displayField) return processedFeatures;

    // Sort features by the display field
    const sorted = processedFeatures.sort((a, b) => {
      const valA = getFieldValue(a, displayField);
      const valB = getFieldValue(b, displayField);

      // Handle numeric comparison
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      // String comparison
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      if (sortOrder === 'asc') {
        return strA.localeCompare(strB);
      }
      return strB.localeCompare(strA);
    });

    return sorted;
  }, [rawFeatures, displayField, sortOrder, filterText, getFieldValue]);

  /**
   * Get display title for a feature
   */
  const getFeatureTitle = useCallback((feature, index) => {
    if (!feature?.attributes) return `Result ${index + 1}`;

    // If a display field is selected, use it
    if (displayField) {
      const value = getFieldValue(feature, displayField);
      if (value !== '' && value !== null && value !== undefined) {
        return String(value);
      }
    }

    const attrs = feature.attributes;
    // Try common title fields
    return attrs.title || attrs.TITLE || attrs.name || attrs.NAME ||
           attrs.ADDRESS || attrs.address || attrs.PARCELID ||
           attrs.GPIN || attrs.PIN || attrs.ID || `Result ${index + 1}`;
  }, [displayField, getFieldValue]);

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
    console.log('[SearchResultsPanel] handleFeatureClick:', {
      index,
      featureSourceLayerId: feature?.sourceLayerId,
      featureAttributeKeys: Object.keys(feature?.attributes || {}),
      hasGeometry: !!feature?.geometry,
      customFeatureInfoLayerId: activeMap?.customFeatureInfo?.layerId
    });

    setSelectedIndex(index);

    if (onFeatureSelect) {
      console.log('[SearchResultsPanel] Calling onFeatureSelect');
      // Enrich feature with displayName based on current display field setting
      const enrichedFeature = {
        ...feature,
        attributes: {
          ...feature?.attributes,
          displayName: getFeatureTitle(feature, index)
        }
      };
      onFeatureSelect(enrichedFeature);
    }

    // Zoom to feature
    if (zoomToFeature) {
      zoomToFeature(feature);
    }
  }, [onFeatureSelect, zoomToFeature, activeMap?.customFeatureInfo?.layerId, getFeatureTitle]);

  /**
   * Handle feature hover
   */
  const handleFeatureHover = useCallback((feature, index, isEntering) => {
    setHoveredIndex(isEntering ? index : null);

    if (onFeatureHover) {
      onFeatureHover(isEntering ? feature : null);
    }

    // Highlight feature on map (or clear highlight when leaving)
    if (highlightFeature) {
      highlightFeature(isEntering ? feature : null);
    }
  }, [onFeatureHover, highlightFeature]);

  /**
   * Handle clear results
   */
  const handleClear = useCallback(() => {
    setSelectedIndex(null);
    setHoveredIndex(null);
    setFilterText('');

    if (onClearResults) {
      onClearResults();
    } else if (updateSearchResults) {
      updateSearchResults({ features: [] });
    }
  }, [onClearResults, updateSearchResults]);

  /**
   * Handle zoom to all results
   */
  const handleZoomToAll = useCallback(() => {
    if (onZoomToAll) {
      onZoomToAll();
    }
  }, [onZoomToAll]);

  /**
   * Toggle sort order
   */
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  /**
   * Select display field
   */
  const handleDisplayFieldChange = useCallback((field) => {
    setDisplayField(field);
  }, []);

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

  /**
   * Auto-select single result
   */
  useEffect(() => {
    if (rawFeatures.length === 1) {
      setSelectedIndex(0);
    } else {
      // Reset selection when results change to multiple or zero
      setSelectedIndex(null);
    }
  }, [rawFeatures]);

  // Collapsed button
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2 py-1.5 bg-white rounded-lg shadow-lg border border-slate-200
                   hover:bg-slate-50 transition-colors ${className}`}
        title="Search Results"
      >
        <Search className="w-4 h-4" style={{ color: colors.bg600 }} />
        <span className="text-sm font-medium text-slate-700">Results</span>
        {resultCount > 0 && (
          <span
            className="px-1.5 py-0.5 text-xs rounded-full text-white"
            style={{ backgroundColor: colors.bg500 }}
          >
            {resultCount}
          </span>
        )}
        {filterText && (
          <Filter className="w-3.5 h-3.5" style={{ color: colors.text600 }} />
        )}
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
            <>
              {/* Zoom to All Results */}
              <button
                onClick={handleZoomToAll}
                className="p-1 hover:bg-slate-200 rounded transition"
                title="Zoom to All Results"
              >
                <Maximize2 className="w-4 h-4 text-slate-600" />
              </button>


              {/* Filter Toggle Button */}
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`p-1 rounded transition ${showFilter ? 'bg-slate-200' : 'hover:bg-slate-200'}`}
                title={showFilter ? "Hide Filter" : "Show Filter"}
              >
                <Filter className="w-4 h-4" style={{ color: showFilter ? colors.text600 : 'rgb(71 85 105)' }} />
              </button>

              {/* Config Button */}
              <div className="relative" ref={configRef}>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-1 rounded transition ${showConfig ? 'bg-slate-200' : 'hover:bg-slate-200'}`}
                  title="Result Settings"
                >
                  <Settings2 className="w-4 h-4 text-slate-600" />
                </button>

                {/* Config Popup */}
                {showConfig && (
                  <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 w-56 z-50">
                    {/* Sort Order Section */}
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Sort Order</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setSortOrder('asc'); setShowConfig(false); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-sm transition ${
                            sortOrder === 'asc'
                              ? 'text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          style={sortOrder === 'asc' ? { backgroundColor: colors.bg500 } : {}}
                        >
                          <ArrowUpAZ className="w-3.5 h-3.5" />
                          Asc
                        </button>
                        <button
                          onClick={() => { setSortOrder('desc'); setShowConfig(false); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-sm transition ${
                            sortOrder === 'desc'
                              ? 'text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          style={sortOrder === 'desc' ? { backgroundColor: colors.bg500 } : {}}
                        >
                          <ArrowDownAZ className="w-3.5 h-3.5" />
                          Desc
                        </button>
                      </div>
                    </div>

                    {/* Display Field Section */}
                    <div className="p-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Display Field</p>
                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {/* Auto option */}
                        <button
                          onClick={() => { handleDisplayFieldChange(''); setShowConfig(false); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition ${
                            !displayField ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          {!displayField && <Check className="w-3.5 h-3.5" style={{ color: colors.text600 }} />}
                          {displayField && <span className="w-3.5" />}
                          <span className="text-slate-600">Auto-detect</span>
                        </button>

                        {/* Available search fields */}
                        {availableSearchFields.map((field) => (
                          <button
                            key={field.field}
                            onClick={() => { handleDisplayFieldChange(field.field); setShowConfig(false); }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition ${
                              displayField === field.field ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'
                            }`}
                          >
                            {displayField === field.field && (
                              <Check className="w-3.5 h-3.5" style={{ color: colors.text600 }} />
                            )}
                            {displayField !== field.field && <span className="w-3.5" />}
                            <span className="text-slate-600">{field.label || field.field}</span>
                          </button>
                        ))}

                        {availableSearchFields.length === 0 && (
                          <p className="text-xs text-slate-400 px-2 py-1">No search fields configured</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Clear Results */}
              <button
                onClick={handleClear}
                className="p-1 hover:bg-red-100 rounded transition"
                title="Clear Results"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </>
          )}
          <button
            onClick={onToggle}
            className="p-1 hover:bg-white/50 rounded transition"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Inline Filter Input - shown when filter toggle is active */}
      {resultCount > 0 && showFilter && (
        <div className="px-3 py-2 border-b border-slate-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Find:</label>
            <div className="relative flex-1">
              <input
                ref={filterInputRef}
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={displayField
                  ? `Search in ${availableSearchFields.find(f => f.field === displayField)?.label || displayField}...`
                  : "Type to filter results..."
                }
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': colors.bg500 }}
              />
              {filterText && (
                <button
                  onClick={() => setFilterText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
                  title="Clear filter"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>
          </div>
          {filterText && (
            <p className="text-xs text-slate-500 mt-1.5 text-right">
              Showing {features.length} of {resultCount}
            </p>
          )}
        </div>
      )}

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
        ) : features.length === 0 && filterText ? (
          <div className="p-6 text-center">
            <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No matching results</p>
            <p className="text-xs text-slate-400 mt-1">
              Try a different filter term
            </p>
            <button
              onClick={() => setFilterText('')}
              className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition hover:opacity-90"
              style={{ backgroundColor: colors.bg500 }}
            >
              Clear Filter
            </button>
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
