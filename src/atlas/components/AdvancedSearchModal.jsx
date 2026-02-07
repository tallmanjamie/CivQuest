// src/atlas/components/AdvancedSearchModal.jsx
// Advanced Search Modal Component - Pre-built fields layout
// All configured search fields are displayed with their own row
// State persists when modal is closed and reopened
//
// Field Types:
// - text: contains, does not contain, is exactly, is not exactly, starts with, ends with
// - number: equals, not equals, less than, greater than, between
// - date: before, after, between, is exactly
// - single-select: dropdown list of unique values
// - multi-select: select multiple values from a list (tags)

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X,
  Search,
  Loader2,
  Filter,
  ChevronDown,
  Check,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';
import { applyDataExclusions } from '../utils/dataExclusion';

// Module-level cache for filter state persistence across modal open/close
// Keyed by endpoint to handle different maps
const filterStateCache = new Map();

// Cache for unique values to avoid re-fetching
const uniqueValueCache = new Map();

// Operators for each field type
const OPERATORS = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'equals', label: 'Is (Exact)' },
    { value: 'not_equals', label: 'Is Not (Exact)' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' }
  ],
  number: [
    { value: 'between', label: 'Between' },
    { value: 'greater_than', label: 'Greater Than (>)' },
    { value: 'less_than', label: 'Less Than (<)' },
    { value: 'equals', label: 'Equals (=)' }
  ],
  date: [
    { value: 'between', label: 'Between' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' }
  ],
  'single-select': [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is Not' }
  ],
  'multi-select': [
    { value: 'in', label: 'Is Any Of' },
    { value: 'not_in', label: 'Is None Of' }
  ]
};

// Get default operator for field type
function getDefaultOperator(fieldType) {
  switch (fieldType) {
    case 'text': return 'contains';
    case 'number': return 'between';
    case 'date': return 'between';
    case 'single-select': return 'equals';
    case 'multi-select': return 'in';
    default: return 'contains';
  }
}

/**
 * SingleSelectDropdown - Dropdown for selecting a single value with search
 */
function SingleSelectDropdown({
  field,
  value,
  onChange,
  endpoint,
  colors,
  disabled,
  maxRecordCount = 1000
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Fetch unique values for the field
  useEffect(() => {
    if (!endpoint || !field) return;

    const cacheKey = `${endpoint}:${field}`;
    if (uniqueValueCache.has(cacheKey)) {
      setOptions(uniqueValueCache.get(cacheKey));
      return;
    }

    const fetchOptions = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          f: 'json',
          where: '1=1',
          outFields: field,
          returnGeometry: 'false',
          returnDistinctValues: 'true',
          orderByFields: field,
          resultRecordCount: String(maxRecordCount)
        });

        const response = await fetch(`${endpoint}/query?${params}`);
        const data = await response.json();

        if (data.features) {
          const uniqueValues = data.features
            .map(f => f.attributes[field])
            .filter(v => v !== null && v !== undefined && v !== '')
            .sort((a, b) => String(a).localeCompare(String(b)));
          setOptions(uniqueValues);
          uniqueValueCache.set(cacheKey, uniqueValues);
        }
      } catch (err) {
        console.error('[SingleSelectDropdown] Error fetching options:', err);
        setError('Failed to load options');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [endpoint, field, maxRecordCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    String(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between transition-colors ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value || 'Select...'}
        </span>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {/* Clear option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 text-slate-400 italic"
            >
              Clear selection
            </button>

            {error ? (
              <div className="p-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">
                {loading ? 'Loading...' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(String(opt));
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between ${
                    value === String(opt) ? 'bg-slate-50' : ''
                  }`}
                >
                  <span className="truncate">{String(opt)}</span>
                  {value === String(opt) && (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: colors.text600 }} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MultiSelectTags - Multi-select with tag display
 */
function MultiSelectTags({
  field,
  value = [],
  onChange,
  endpoint,
  colors,
  disabled,
  maxRecordCount = 1000
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedValues = Array.isArray(value) ? value : [];

  // Fetch unique values
  useEffect(() => {
    if (!endpoint || !field) return;

    const cacheKey = `${endpoint}:${field}`;
    if (uniqueValueCache.has(cacheKey)) {
      setOptions(uniqueValueCache.get(cacheKey));
      return;
    }

    const fetchOptions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          f: 'json',
          where: '1=1',
          outFields: field,
          returnGeometry: 'false',
          returnDistinctValues: 'true',
          orderByFields: field,
          resultRecordCount: String(maxRecordCount)
        });

        const response = await fetch(`${endpoint}/query?${params}`);
        const data = await response.json();

        if (data.features) {
          const uniqueValues = data.features
            .map(f => f.attributes[field])
            .filter(v => v !== null && v !== undefined && v !== '')
            .sort((a, b) => String(a).localeCompare(String(b)));
          setOptions(uniqueValues);
          uniqueValueCache.set(cacheKey, uniqueValues);
        }
      } catch (err) {
        console.error('[MultiSelectTags] Error fetching options:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [endpoint, field, maxRecordCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addValue = (val) => {
    const strVal = String(val);
    if (!selectedValues.includes(strVal)) {
      onChange([...selectedValues, strVal]);
    }
  };

  const removeValue = (val) => {
    onChange(selectedValues.filter(v => v !== val));
  };

  const availableOptions = options.filter(opt => !selectedValues.includes(String(opt)));

  return (
    <div className="w-full space-y-2">
      {/* Dropdown to add values */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between transition-colors ${
            disabled
              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-slate-400">Select to add...</span>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isOpen && !disabled && availableOptions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {availableOptions.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  addValue(opt);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50"
              >
                {String(opt)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected tags */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedValues.map((val, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border animate-in fade-in zoom-in duration-200"
              style={{ backgroundColor: colors.bg100, color: colors.text700, borderColor: colors.bg200 }}
            >
              {val}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeValue(val)}
                  className="hover:bg-white/50 rounded-full p-0.5 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * FieldRow - A single pre-built field row
 */
function FieldRow({
  fieldConfig,
  filterState,
  onChange,
  endpoint,
  colors,
  maxRecordCount = 1000
}) {
  const { field, label, type } = fieldConfig;
  const operators = OPERATORS[type] || OPERATORS.text;
  const currentOperator = filterState?.operator || getDefaultOperator(type);
  const needsTwoValues = currentOperator === 'between';

  const handleOperatorChange = (newOp) => {
    onChange(field, {
      ...filterState,
      operator: newOp,
      // Reset value2 if switching away from between
      value2: newOp === 'between' ? filterState?.value2 : ''
    });
  };

  const handleValueChange = (newValue) => {
    onChange(field, { ...filterState, value: newValue });
  };

  const handleValue2Change = (newValue) => {
    onChange(field, { ...filterState, value2: newValue });
  };

  // Common input styles
  const inputClass = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
  const selectClass = 'px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium text-slate-700 h-8 shadow-sm';

  return (
    <div className="group space-y-1.5 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
      {/* Header row: Label + Operator */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {label || field}
        </label>

        <select
          value={currentOperator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className={selectClass}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </div>

      {/* Value inputs based on type */}
      {type === 'text' && (
        <input
          type="text"
          value={filterState?.value || ''}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder="Value..."
          className={inputClass}
        />
      )}

      {type === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filterState?.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={needsTwoValues ? 'Min' : 'Value'}
            className={inputClass}
          />
          {needsTwoValues && (
            <>
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="number"
                value={filterState?.value2 || ''}
                onChange={(e) => handleValue2Change(e.target.value)}
                placeholder="Max"
                className={inputClass}
              />
            </>
          )}
        </div>
      )}

      {type === 'date' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterState?.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            className={inputClass}
          />
          {needsTwoValues && (
            <>
              <span className="text-slate-400 text-xs uppercase font-bold">and</span>
              <input
                type="date"
                value={filterState?.value2 || ''}
                onChange={(e) => handleValue2Change(e.target.value)}
                className={inputClass}
              />
            </>
          )}
        </div>
      )}

      {type === 'single-select' && (
        <SingleSelectDropdown
          field={field}
          value={filterState?.value || ''}
          onChange={handleValueChange}
          endpoint={endpoint}
          colors={colors}
          maxRecordCount={maxRecordCount}
        />
      )}

      {type === 'multi-select' && (
        <MultiSelectTags
          field={field}
          value={filterState?.value || []}
          onChange={handleValueChange}
          endpoint={endpoint}
          colors={colors}
          maxRecordCount={maxRecordCount}
        />
      )}
    </div>
  );
}

/**
 * Build ArcGIS WHERE clause from filter states
 */
function buildWhereClause(filterStates, searchFields) {
  const clauses = [];
  const descriptions = [];

  searchFields.forEach(fieldConfig => {
    const { field, label, type } = fieldConfig;
    const state = filterStates[field];
    if (!state) return;

    const { operator, value, value2 } = state;
    const displayLabel = label || field;

    // Skip if no value
    if (type === 'multi-select') {
      if (!Array.isArray(value) || value.length === 0) return;
    } else {
      if (!value && value !== 0) return;
    }

    switch (type) {
      case 'text': {
        const escapedValue = String(value).toUpperCase().replace(/'/g, "''");
        switch (operator) {
          case 'contains':
            clauses.push(`UPPER(${field}) LIKE '%${escapedValue}%'`);
            descriptions.push(`${displayLabel} contains "${value}"`);
            break;
          case 'not_contains':
            clauses.push(`UPPER(${field}) NOT LIKE '%${escapedValue}%'`);
            descriptions.push(`${displayLabel} does not contain "${value}"`);
            break;
          case 'equals':
            clauses.push(`UPPER(${field}) = '${escapedValue}'`);
            descriptions.push(`${displayLabel} is "${value}"`);
            break;
          case 'not_equals':
            clauses.push(`UPPER(${field}) <> '${escapedValue}'`);
            descriptions.push(`${displayLabel} is not "${value}"`);
            break;
          case 'starts_with':
            clauses.push(`UPPER(${field}) LIKE '${escapedValue}%'`);
            descriptions.push(`${displayLabel} starts with "${value}"`);
            break;
          case 'ends_with':
            clauses.push(`UPPER(${field}) LIKE '%${escapedValue}'`);
            descriptions.push(`${displayLabel} ends with "${value}"`);
            break;
        }
        break;
      }

      case 'number': {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return;

        switch (operator) {
          case 'equals':
            clauses.push(`${field} = ${numVal}`);
            descriptions.push(`${displayLabel} = ${numVal}`);
            break;
          case 'greater_than':
            clauses.push(`${field} > ${numVal}`);
            descriptions.push(`${displayLabel} > ${numVal}`);
            break;
          case 'less_than':
            clauses.push(`${field} < ${numVal}`);
            descriptions.push(`${displayLabel} < ${numVal}`);
            break;
          case 'between': {
            const numVal2 = parseFloat(value2);
            if (!isNaN(numVal2)) {
              const min = Math.min(numVal, numVal2);
              const max = Math.max(numVal, numVal2);
              clauses.push(`${field} >= ${min} AND ${field} <= ${max}`);
              descriptions.push(`${displayLabel} between ${min} and ${max}`);
            }
            break;
          }
        }
        break;
      }

      case 'date': {
        switch (operator) {
          case 'before':
            clauses.push(`${field} < DATE '${value}'`);
            descriptions.push(`${displayLabel} before ${value}`);
            break;
          case 'after':
            clauses.push(`${field} > DATE '${value}'`);
            descriptions.push(`${displayLabel} after ${value}`);
            break;
          case 'between':
            if (value2) {
              clauses.push(`${field} >= DATE '${value}' AND ${field} <= DATE '${value2}'`);
              descriptions.push(`${displayLabel} between ${value} and ${value2}`);
            }
            break;
        }
        break;
      }

      case 'single-select': {
        const escapedValue = String(value).replace(/'/g, "''");
        switch (operator) {
          case 'equals':
            clauses.push(`${field} = '${escapedValue}'`);
            descriptions.push(`${displayLabel} is "${value}"`);
            break;
          case 'not_equals':
            clauses.push(`${field} <> '${escapedValue}'`);
            descriptions.push(`${displayLabel} is not "${value}"`);
            break;
        }
        break;
      }

      case 'multi-select': {
        const escapedValues = value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
        switch (operator) {
          case 'in':
            clauses.push(`${field} IN (${escapedValues})`);
            descriptions.push(`${displayLabel} in [${value.join(', ')}]`);
            break;
          case 'not_in':
            clauses.push(`${field} NOT IN (${escapedValues})`);
            descriptions.push(`${displayLabel} not in [${value.join(', ')}]`);
            break;
        }
        break;
      }
    }
  });

  return {
    whereClause: clauses.length > 0 ? clauses.join(' AND ') : null,
    description: descriptions.join(', ')
  };
}

/**
 * AdvancedSearchModal Component
 */
export default function AdvancedSearchModal({
  isOpen,
  onClose,
  onSearch,
  position = 'top' // 'top' or 'bottom' - matches search bar position
}) {
  const {
    config,
    activeMap,
    updateSearchResults,
    setIsSearching,
    colors: contextColors,
    mapViewRef,
    enabledModes,
    chatViewRef,
    saveToHistory
  } = useAtlas();

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = contextColors || getThemeColors(themeColor);

  const searchFields = activeMap?.searchFields || [];
  const endpoint = activeMap?.endpoint;

  // Generate a cache key for this map
  const cacheKey = endpoint || 'default';

  // Initialize filter states from cache or create empty state
  const [filterStates, setFilterStates] = useState(() => {
    if (filterStateCache.has(cacheKey)) {
      return filterStateCache.get(cacheKey);
    }
    // Initialize with default operators for each field
    const initial = {};
    searchFields.forEach(field => {
      initial[field.field] = {
        operator: getDefaultOperator(field.type),
        value: field.type === 'multi-select' ? [] : '',
        value2: ''
      };
    });
    return initial;
  });

  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [error, setError] = useState(null);

  // Ref to track if we've initialized for current endpoint
  const initializedRef = useRef(null);

  // Update filter states when searchFields change (different map)
  useEffect(() => {
    if (!endpoint || initializedRef.current === endpoint) return;

    initializedRef.current = endpoint;

    // Check cache first
    if (filterStateCache.has(endpoint)) {
      setFilterStates(filterStateCache.get(endpoint));
      return;
    }

    // Initialize fresh state for new endpoint
    const initial = {};
    searchFields.forEach(field => {
      initial[field.field] = {
        operator: getDefaultOperator(field.type),
        value: field.type === 'multi-select' ? [] : '',
        value2: ''
      };
    });
    setFilterStates(initial);
    filterStateCache.set(endpoint, initial);
  }, [endpoint, searchFields]);

  // Save to cache whenever filterStates changes
  useEffect(() => {
    if (endpoint && Object.keys(filterStates).length > 0) {
      filterStateCache.set(endpoint, filterStates);
    }
  }, [filterStates, endpoint]);

  // Handle field state change
  const handleFieldChange = useCallback((fieldName, newState) => {
    setFilterStates(prev => ({
      ...prev,
      [fieldName]: newState
    }));
  }, []);

  // Reset all fields
  const handleReset = useCallback(() => {
    const initial = {};
    searchFields.forEach(field => {
      initial[field.field] = {
        operator: getDefaultOperator(field.type),
        value: field.type === 'multi-select' ? [] : '',
        value2: ''
      };
    });
    setFilterStates(initial);
    filterStateCache.set(endpoint, initial);
    setError(null);
  }, [searchFields, endpoint]);

  // Execute search
  const handleSearch = useCallback(async () => {
    if (!endpoint) {
      setError('No endpoint configured');
      return;
    }

    const { whereClause, description } = buildWhereClause(filterStates, searchFields);

    if (!whereClause) {
      setError('Please enter at least one filter criteria');
      return;
    }

    setIsSearchingLocal(true);
    setIsSearching?.(true);
    setError(null);

    // Close modal immediately so user sees chat
    onClose?.();

    // Add search to chat as user message
    const searchLabel = `Advanced Search: ${description}`;
    if (chatViewRef?.current?.addMessage) {
      chatViewRef.current.addMessage('user', searchLabel);
      chatViewRef.current.addMessage('system', 'Searching with advanced filters...');
    }

    try {
      console.log('[AdvancedSearch] WHERE clause:', whereClause);

      // Use maxRecordCount from organization's Atlas configuration
      const maxRecordCount = config?.data?.maxRecordCount || 1000;

      const params = new URLSearchParams({
        f: 'json',
        where: whereClause,
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326', // Request geometry in WGS84 (lat/lon) for consistent handling
        resultRecordCount: String(maxRecordCount)
      });

      const response = await fetch(`${endpoint}/query?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Query failed');
      }

      // Get spatial reference from response (applies to all features)
      const responseSR = data.spatialReference || { wkid: 4326 };

      // Ensure each feature's geometry has the spatial reference
      const features = (data.features || []).map(feature => {
        if (feature.geometry && !feature.geometry.spatialReference) {
          feature.geometry.spatialReference = responseSR;
        }
        return feature;
      });
      console.log(`[AdvancedSearch] Found ${features.length} features with SR:`, responseSR);

      // Apply data exclusion rules to redact fields for matching records
      const redactedFeatures = applyDataExclusions(features, activeMap);

      // Update results in context
      updateSearchResults?.({ features: redactedFeatures });

      // Save to history
      saveToHistory?.(searchLabel);

      // Add results to chat (uses redacted features)
      if (chatViewRef?.current?.addMessage) {
        if (redactedFeatures.length === 0) {
          chatViewRef.current.addMessage('ai', 'No records found matching your filter criteria.');
        } else if (redactedFeatures.length === 1) {
          const feature = redactedFeatures[0];
          chatViewRef.current.addMessage('ai', `I found **${description}**. Here are the details:`, {
            feature,
            showDetails: true
          });

          // Zoom to single result
          if (mapViewRef?.current && enabledModes?.includes('map')) {
            mapViewRef.current.zoomToFeature?.(feature);
            mapViewRef.current.selectFeature?.(feature);
          }
        } else {
          chatViewRef.current.addMessage('ai', `I found **${redactedFeatures.length}** records matching your filter criteria.`, {
            features: redactedFeatures,
            showResultActions: true
          });

          // Render results on map
          if (mapViewRef?.current?.renderResults) {
            mapViewRef.current.renderResults(redactedFeatures);
          }
        }
      }

      // Call onSearch callback if provided
      onSearch?.(redactedFeatures, whereClause);

    } catch (err) {
      console.error('[AdvancedSearch] Error:', err);
      setError(err.message || 'Search failed');

      if (chatViewRef?.current?.addMessage) {
        chatViewRef.current.addMessage('error', `Search failed: ${err.message}`);
      }
    } finally {
      setIsSearchingLocal(false);
      setIsSearching?.(false);
    }
  }, [
    endpoint, filterStates, searchFields, onClose, onSearch,
    updateSearchResults, setIsSearching, chatViewRef, saveToHistory,
    mapViewRef, enabledModes, activeMap
  ]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    searchFields.forEach(field => {
      const state = filterStates[field.field];
      if (!state) return;
      if (field.type === 'multi-select') {
        if (Array.isArray(state.value) && state.value.length > 0) count++;
      } else {
        if (state.value) count++;
      }
    });
    return count;
  }, [filterStates, searchFields]);

  if (!isOpen) return null;

  const isBottom = position === 'bottom';

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel - positioned near the search bar's plus button */}
      <div
        className={`absolute ${isBottom ? 'bottom-16 left-3' : 'top-28 left-3'} bg-white rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-96 max-h-[70vh] flex flex-col animate-in fade-in ${isBottom ? 'slide-in-from-bottom-4' : 'slide-in-from-top-4'} duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Filter className="h-5 w-5" style={{ color: colors.text600 }} />
            Advanced Search
            {activeFilterCount > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.bg100, color: colors.text700 }}
              >
                {activeFilterCount} active
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {searchFields.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
              <h3 className="text-lg font-medium text-slate-800 mb-1">No Search Fields Configured</h3>
              <p className="text-sm text-slate-500">
                Configure search fields in the map editor to enable advanced search.
              </p>
            </div>
          ) : (
            searchFields.map((fieldConfig) => (
              <FieldRow
                key={fieldConfig.field}
                fieldConfig={fieldConfig}
                filterState={filterStates[fieldConfig.field]}
                onChange={handleFieldChange}
                endpoint={endpoint}
                colors={colors}
                maxRecordCount={config?.data?.maxRecordCount || 1000}
              />
            ))
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearchingLocal || searchFields.length === 0}
            className="px-6 py-2 text-white text-sm font-bold rounded-lg shadow-sm transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: colors.bg600 }}
          >
            {isSearchingLocal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
