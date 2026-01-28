// src/atlas/components/AdvancedSearchModal.jsx
// Advanced Search Modal Component
// Provides field-based filtering with operators specific to each field type
//
// Field Types:
// - text: contains, does not contain, is exactly, is not exactly, starts with, ends with, is empty, is not empty
// - number: equals, not equals, less than, greater than, between, is empty, is not empty
// - date: before, after, between, is exactly, is empty, is not empty
// - single-select: dropdown list of unique values
// - multi-select: select multiple values from a list

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Search,
  Plus,
  Trash2,
  Loader2,
  Filter,
  ChevronDown,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAtlas } from '../AtlasApp';
import { getThemeColors } from '../utils/themeColors';

// Operators for each field type
const OPERATORS = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Is exactly' },
    { value: 'not_equals', label: 'Is not exactly' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  date: [
    { value: 'equals', label: 'Is exactly' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  'single-select': [
    { value: 'equals', label: 'Is' },
    { value: 'not_equals', label: 'Is not' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  'multi-select': [
    { value: 'in', label: 'Is any of' },
    { value: 'not_in', label: 'Is none of' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ]
};

// Get default operator for field type
function getDefaultOperator(fieldType) {
  switch (fieldType) {
    case 'text': return 'contains';
    case 'number': return 'equals';
    case 'date': return 'equals';
    case 'single-select': return 'equals';
    case 'multi-select': return 'in';
    default: return 'contains';
  }
}

// Check if operator needs value input
function operatorNeedsValue(operator) {
  return !['is_empty', 'is_not_empty'].includes(operator);
}

// Check if operator needs two values (between)
function operatorNeedsTwoValues(operator) {
  return operator === 'between';
}

/**
 * SingleSelectInput - Dropdown for selecting a single value
 */
function SingleSelectInput({
  field,
  value,
  onChange,
  endpoint,
  colors,
  disabled
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
          resultRecordCount: '500'
        });

        const response = await fetch(`${endpoint}/query?${params}`);
        const data = await response.json();

        if (data.features) {
          const uniqueValues = data.features
            .map(f => f.attributes[field])
            .filter(v => v !== null && v !== undefined && v !== '')
            .sort((a, b) => String(a).localeCompare(String(b)));
          setOptions(uniqueValues);
        }
      } catch (err) {
        console.error('[SingleSelectInput] Error fetching options:', err);
        setError('Failed to load options');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [endpoint, field]);

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
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg text-left flex items-center justify-between transition-colors ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-white border-slate-300 hover:border-slate-400'
        }`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value || 'Select a value...'}
        </span>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': colors.bg500 }}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
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
 * MultiSelectInput - Select multiple values from a list
 */
function MultiSelectInput({
  field,
  value = [],
  onChange,
  endpoint,
  colors,
  disabled
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : [];

  // Fetch unique values for the field
  useEffect(() => {
    if (!endpoint || !field) return;

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
          resultRecordCount: '500'
        });

        const response = await fetch(`${endpoint}/query?${params}`);
        const data = await response.json();

        if (data.features) {
          const uniqueValues = data.features
            .map(f => f.attributes[field])
            .filter(v => v !== null && v !== undefined && v !== '')
            .sort((a, b) => String(a).localeCompare(String(b)));
          setOptions(uniqueValues);
        }
      } catch (err) {
        console.error('[MultiSelectInput] Error fetching options:', err);
        setError('Failed to load options');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [endpoint, field]);

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

  const toggleOption = (opt) => {
    const strOpt = String(opt);
    if (selectedValues.includes(strOpt)) {
      onChange(selectedValues.filter(v => v !== strOpt));
    } else {
      onChange([...selectedValues, strOpt]);
    }
  };

  const removeValue = (val) => {
    onChange(selectedValues.filter(v => v !== val));
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[38px] px-2 py-1.5 border rounded-lg flex flex-wrap items-center gap-1 cursor-pointer transition-colors ${
          disabled
            ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
            : 'bg-white border-slate-300 hover:border-slate-400'
        }`}
      >
        {selectedValues.length === 0 ? (
          <span className="text-sm text-slate-400 px-1">Select values...</span>
        ) : (
          selectedValues.map((val, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
              style={{ backgroundColor: colors.bg100, color: colors.text700 }}
            >
              {val}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeValue(val);
                  }}
                  className="hover:bg-white/50 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        )}
        <div className="ml-auto flex-shrink-0">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': colors.bg500 }}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
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
              filteredOptions.map((opt, idx) => {
                const isSelected = selectedValues.includes(String(opt));
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleOption(opt)}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 ${
                      isSelected ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-current' : 'border-slate-300'
                      }`}
                      style={isSelected ? { borderColor: colors.text600, backgroundColor: colors.bg600 } : {}}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="truncate">{String(opt)}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Selection summary */}
          {selectedValues.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              {selectedValues.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * FilterConditionRow - A single filter condition row
 */
function FilterConditionRow({
  condition,
  index,
  searchFields,
  endpoint,
  colors,
  onChange,
  onRemove,
  canRemove
}) {
  const selectedField = searchFields.find(f => f.field === condition.field);
  const fieldType = selectedField?.type || 'text';
  const operators = OPERATORS[fieldType] || OPERATORS.text;

  const handleFieldChange = (newField) => {
    const newSelectedField = searchFields.find(f => f.field === newField);
    const newFieldType = newSelectedField?.type || 'text';
    const newOperator = getDefaultOperator(newFieldType);
    onChange(index, {
      ...condition,
      field: newField,
      operator: newOperator,
      value: newFieldType === 'multi-select' ? [] : '',
      value2: ''
    });
  };

  const handleOperatorChange = (newOperator) => {
    onChange(index, {
      ...condition,
      operator: newOperator,
      // Reset value when changing to/from between
      value: condition.field && fieldType === 'multi-select' ? [] : '',
      value2: ''
    });
  };

  const needsValue = operatorNeedsValue(condition.operator);
  const needsTwoValues = operatorNeedsTwoValues(condition.operator);

  return (
    <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
        style={{ '--tw-ring-color': colors.bg500 }}
      >
        <option value="">Select field...</option>
        {searchFields.map((field) => (
          <option key={field.field} value={field.field}>
            {field.label || field.field}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value)}
        disabled={!condition.field}
        className="w-36 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
        style={{ '--tw-ring-color': colors.bg500 }}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input - varies by field type */}
      {needsValue && condition.field && (
        <>
          {fieldType === 'single-select' ? (
            <SingleSelectInput
              field={condition.field}
              value={condition.value}
              onChange={(val) => onChange(index, { ...condition, value: val })}
              endpoint={endpoint}
              colors={colors}
              disabled={!condition.field}
            />
          ) : fieldType === 'multi-select' ? (
            <MultiSelectInput
              field={condition.field}
              value={condition.value}
              onChange={(val) => onChange(index, { ...condition, value: val })}
              endpoint={endpoint}
              colors={colors}
              disabled={!condition.field}
            />
          ) : fieldType === 'date' ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="date"
                value={condition.value}
                onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ '--tw-ring-color': colors.bg500 }}
              />
              {needsTwoValues && (
                <>
                  <span className="text-sm text-slate-500">and</span>
                  <input
                    type="date"
                    value={condition.value2 || ''}
                    onChange={(e) => onChange(index, { ...condition, value2: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ '--tw-ring-color': colors.bg500 }}
                  />
                </>
              )}
            </div>
          ) : fieldType === 'number' ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="number"
                value={condition.value}
                onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
                placeholder="Enter value..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ '--tw-ring-color': colors.bg500 }}
              />
              {needsTwoValues && (
                <>
                  <span className="text-sm text-slate-500">and</span>
                  <input
                    type="number"
                    value={condition.value2 || ''}
                    onChange={(e) => onChange(index, { ...condition, value2: e.target.value })}
                    placeholder="Enter value..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ '--tw-ring-color': colors.bg500 }}
                  />
                </>
              )}
            </div>
          ) : (
            // Text input (default)
            <input
              type="text"
              value={condition.value}
              onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
              placeholder="Enter value..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': colors.bg500 }}
            />
          )}
        </>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        className={`p-2 rounded-lg transition-colors ${
          canRemove
            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            : 'text-slate-200 cursor-not-allowed'
        }`}
        title={canRemove ? 'Remove condition' : 'At least one condition is required'}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Build ArcGIS WHERE clause from filter conditions
 */
function buildWhereClause(conditions, searchFields) {
  const clauses = conditions
    .filter(c => c.field) // Only process conditions with a field selected
    .map(condition => {
      const field = condition.field;
      const selectedField = searchFields.find(f => f.field === field);
      const fieldType = selectedField?.type || 'text';
      const operator = condition.operator;
      const value = condition.value;
      const value2 = condition.value2;

      // Handle empty/not empty operators
      if (operator === 'is_empty') {
        return `(${field} IS NULL OR ${field} = '')`;
      }
      if (operator === 'is_not_empty') {
        return `(${field} IS NOT NULL AND ${field} <> '')`;
      }

      // Skip if no value provided (for operators that need values)
      if (!value && value !== 0) return null;

      // Build clause based on field type and operator
      switch (fieldType) {
        case 'text':
          switch (operator) {
            case 'contains':
              return `UPPER(${field}) LIKE '%${String(value).toUpperCase().replace(/'/g, "''")}%'`;
            case 'not_contains':
              return `UPPER(${field}) NOT LIKE '%${String(value).toUpperCase().replace(/'/g, "''")}%'`;
            case 'equals':
              return `UPPER(${field}) = '${String(value).toUpperCase().replace(/'/g, "''")}'`;
            case 'not_equals':
              return `UPPER(${field}) <> '${String(value).toUpperCase().replace(/'/g, "''")}'`;
            case 'starts_with':
              return `UPPER(${field}) LIKE '${String(value).toUpperCase().replace(/'/g, "''")}%'`;
            case 'ends_with':
              return `UPPER(${field}) LIKE '%${String(value).toUpperCase().replace(/'/g, "''")}'`;
            default:
              return null;
          }

        case 'number':
          const numVal = parseFloat(value);
          const numVal2 = parseFloat(value2);
          if (isNaN(numVal)) return null;

          switch (operator) {
            case 'equals':
              return `${field} = ${numVal}`;
            case 'not_equals':
              return `${field} <> ${numVal}`;
            case 'less_than':
              return `${field} < ${numVal}`;
            case 'greater_than':
              return `${field} > ${numVal}`;
            case 'between':
              if (isNaN(numVal2)) return null;
              return `${field} >= ${Math.min(numVal, numVal2)} AND ${field} <= ${Math.max(numVal, numVal2)}`;
            default:
              return null;
          }

        case 'date':
          switch (operator) {
            case 'equals':
              return `${field} = DATE '${value}'`;
            case 'before':
              return `${field} < DATE '${value}'`;
            case 'after':
              return `${field} > DATE '${value}'`;
            case 'between':
              if (!value2) return null;
              return `${field} >= DATE '${value}' AND ${field} <= DATE '${value2}'`;
            default:
              return null;
          }

        case 'single-select':
          switch (operator) {
            case 'equals':
              return `${field} = '${String(value).replace(/'/g, "''")}'`;
            case 'not_equals':
              return `${field} <> '${String(value).replace(/'/g, "''")}'`;
            default:
              return null;
          }

        case 'multi-select':
          if (!Array.isArray(value) || value.length === 0) return null;
          const escapedValues = value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          switch (operator) {
            case 'in':
              return `${field} IN (${escapedValues})`;
            case 'not_in':
              return `${field} NOT IN (${escapedValues})`;
            default:
              return null;
          }

        default:
          return null;
      }
    })
    .filter(Boolean);

  return clauses.length > 0 ? clauses.join(' AND ') : '1=1';
}

/**
 * AdvancedSearchModal Component
 */
export default function AdvancedSearchModal({
  isOpen,
  onClose,
  onSearch
}) {
  const { config, activeMap, updateSearchResults, setIsSearching, colors: contextColors } = useAtlas();

  const themeColor = config?.ui?.themeColor || 'sky';
  const colors = contextColors || getThemeColors(themeColor);

  const searchFields = activeMap?.searchFields || [];
  const endpoint = activeMap?.endpoint;

  const [conditions, setConditions] = useState([
    { field: '', operator: 'contains', value: '', value2: '' }
  ]);
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [error, setError] = useState(null);

  // Reset conditions when modal opens
  useEffect(() => {
    if (isOpen) {
      setConditions([{ field: '', operator: 'contains', value: '', value2: '' }]);
      setError(null);
    }
  }, [isOpen]);

  const handleConditionChange = (index, newCondition) => {
    setConditions(prev => prev.map((c, i) => i === index ? newCondition : c));
  };

  const handleAddCondition = () => {
    setConditions(prev => [
      ...prev,
      { field: '', operator: 'contains', value: '', value2: '' }
    ]);
  };

  const handleRemoveCondition = (index) => {
    if (conditions.length > 1) {
      setConditions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSearch = async () => {
    if (!endpoint) {
      setError('No endpoint configured');
      return;
    }

    // Validate that at least one condition has a field selected
    const validConditions = conditions.filter(c => c.field);
    if (validConditions.length === 0) {
      setError('Please select at least one field to filter by');
      return;
    }

    setIsSearchingLocal(true);
    setIsSearching?.(true);
    setError(null);

    try {
      const whereClause = buildWhereClause(conditions, searchFields);
      console.log('[AdvancedSearch] WHERE clause:', whereClause);

      const params = new URLSearchParams({
        f: 'json',
        where: whereClause,
        outFields: '*',
        returnGeometry: 'true',
        resultRecordCount: '1000'
      });

      const response = await fetch(`${endpoint}/query?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'Query failed');
      }

      const features = data.features || [];
      console.log(`[AdvancedSearch] Found ${features.length} features`);

      // Update results in context
      updateSearchResults?.(features);

      // Call onSearch callback if provided
      onSearch?.(features, whereClause);

      // Close modal on successful search
      onClose?.();

    } catch (err) {
      console.error('[AdvancedSearch] Error:', err);
      setError(err.message || 'Search failed');
    } finally {
      setIsSearchingLocal(false);
      setIsSearching?.(false);
    }
  };

  const handleClear = () => {
    setConditions([{ field: '', operator: 'contains', value: '', value2: '' }]);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.bg100 }}
            >
              <Filter className="w-5 h-5" style={{ color: colors.text600 }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Advanced Search</h2>
              <p className="text-sm text-slate-500">Filter records by specific field criteria</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {searchFields.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
              <h3 className="text-lg font-medium text-slate-800 mb-1">No Search Fields Configured</h3>
              <p className="text-sm text-slate-500">
                Configure search fields in the map editor to enable advanced search.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-600 mb-4">
                Add conditions to filter your search results. All conditions must match (AND logic).
              </div>

              {/* Filter conditions */}
              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <FilterConditionRow
                    key={index}
                    condition={condition}
                    index={index}
                    searchFields={searchFields}
                    endpoint={endpoint}
                    colors={colors}
                    onChange={handleConditionChange}
                    onRemove={handleRemoveCondition}
                    canRemove={conditions.length > 1}
                  />
                ))}
              </div>

              {/* Add condition button */}
              <button
                type="button"
                onClick={handleAddCondition}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ color: colors.text600 }}
              >
                <Plus className="w-4 h-4" />
                Add Condition
              </button>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Clear All
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearchingLocal || searchFields.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}
