// src/admin/components/customTemplate/StatisticsBuilder.jsx
// Component for building and managing computed statistics

import React, { useState } from 'react';
import {
  BarChart3,
  Plus,
  GripVertical,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Check,
  Info
} from 'lucide-react';
import {
  STAT_OPERATIONS,
  FORMAT_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  DECIMAL_OPTIONS,
  MAX_STATISTICS
} from './constants';
import { validateStatisticId } from './validation';

/**
 * StatisticModal - Modal for adding/editing a statistic
 */
function StatisticModal({ statistic, existingIds, availableFields, onSave, onCancel, isEdit }) {
  // Debug logging for field selection issue
  console.log('[StatisticModal] Rendered with:', {
    availableFields,
    availableFieldsLength: availableFields?.length || 0,
    availableFieldsType: Array.isArray(availableFields) ? 'array' : typeof availableFields,
    isEdit,
    statistic
  });

  const [formData, setFormData] = useState({
    id: statistic?.id || '',
    field: statistic?.field || '',
    operation: statistic?.operation || 'sum',
    label: statistic?.label || '',
    format: {
      format: statistic?.format?.format || 'auto',
      decimals: statistic?.format?.decimals ?? 0,
      prefix: statistic?.format?.prefix || '',
      suffix: statistic?.format?.suffix || '',
      currency: statistic?.format?.currency || 'USD'
    }
  });
  const [errors, setErrors] = useState({});

  const selectedOperation = STAT_OPERATIONS.find(op => op.value === formData.operation);
  const selectedField = availableFields.find(f => f.field === formData.field || f === formData.field);
  const isNumericOperation = selectedOperation?.requiresNumeric;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleFormatChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      format: { ...prev.format, [field]: value }
    }));
  };

  const validate = () => {
    const newErrors = {};

    // Validate ID
    const otherIds = existingIds.filter(id => id !== statistic?.id);
    const idErrors = validateStatisticId(formData.id, otherIds);
    if (idErrors.length > 0) {
      newErrors.id = idErrors[0];
    }

    // Validate field
    if (!formData.field) {
      newErrors.field = 'Field is required';
    }

    // Validate operation
    if (!formData.operation) {
      newErrors.operation = 'Operation is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(formData);
  };

  // Generate preview value
  const getPreviewValue = () => {
    const sampleValue = formData.operation === 'count' ? 42 :
                        formData.operation === 'sum' ? 1234567 :
                        formData.operation === 'mean' ? 45678.90 :
                        formData.operation === 'min' ? 12000 :
                        formData.operation === 'max' ? 890000 :
                        formData.operation === 'median' ? 156000 :
                        formData.operation === 'distinct' ? 8 :
                        'Sample Value';

    const { format, decimals, prefix, suffix, currency } = formData.format;

    if (typeof sampleValue !== 'number') return sampleValue;

    let formatted;
    if (format === 'currency') {
      try {
        formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(sampleValue);
      } catch {
        formatted = `$${sampleValue.toLocaleString()}`;
      }
    } else if (format === 'percent') {
      formatted = `${(sampleValue * 100).toFixed(decimals)}%`;
    } else {
      formatted = sampleValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    return prefix + formatted + suffix;
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-slate-800">
            {isEdit ? 'Edit Statistic' : 'Add Statistic'}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* ID */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Statistic ID *
            </label>
            <input
              value={formData.id}
              onChange={(e) => handleChange('id', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="totalValue"
              className={`w-full px-3 py-2 border rounded text-sm ${
                errors.id ? 'border-red-300 bg-red-50' : 'border-slate-200'
              }`}
              disabled={isEdit}
            />
            <p className="text-xs text-slate-400 mt-1">
              Used in template as: <code className="bg-slate-100 px-1 rounded">{`{{stat_${formData.id || 'id'}}}`}</code>
            </p>
            {errors.id && <p className="text-xs text-red-500 mt-1">{errors.id}</p>}
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Display Label *
            </label>
            <input
              value={formData.label}
              onChange={(e) => handleChange('label', e.target.value)}
              placeholder="Total Value"
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
            />
          </div>

          {/* Field and Operation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Field *
              </label>
              <select
                value={formData.field}
                onChange={(e) => handleChange('field', e.target.value)}
                className={`w-full px-3 py-2 border rounded text-sm ${
                  errors.field ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              >
                <option value="">Select field...</option>
                {(!availableFields || availableFields.length === 0) && (
                  <option value="" disabled>No fields available - check console for details</option>
                )}
                {availableFields.map(f => {
                  const fieldName = typeof f === 'string' ? f : f.field;
                  const fieldLabel = typeof f === 'string' ? f : (f.label || f.field);
                  console.log('[StatisticModal] Rendering field option:', { f, fieldName, fieldLabel });
                  return (
                    <option key={fieldName} value={fieldName}>{fieldLabel}</option>
                  );
                })}
              </select>
              {(!availableFields || availableFields.length === 0) && (
                <p className="text-xs text-amber-600 mt-1">
                  No fields available. Ensure the data source is configured and live data is loaded.
                </p>
              )}
              {errors.field && <p className="text-xs text-red-500 mt-1">{errors.field}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Operation *
              </label>
              <select
                value={formData.operation}
                onChange={(e) => handleChange('operation', e.target.value)}
                className={`w-full px-3 py-2 border rounded text-sm ${
                  errors.operation ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              >
                {STAT_OPERATIONS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              {errors.operation && <p className="text-xs text-red-500 mt-1">{errors.operation}</p>}
            </div>
          </div>

          {/* Warning for numeric operations on non-numeric fields */}
          {isNumericOperation && selectedField && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {selectedOperation.label} requires numeric values. Ensure the selected field contains numbers.
              </span>
            </div>
          )}

          {/* Formatting Section */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1">
              Formatting (Optional)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Format Type
                </label>
                <select
                  value={formData.format.format}
                  onChange={(e) => handleFormatChange('format', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                >
                  {FORMAT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Decimal Places
                </label>
                <select
                  value={formData.format.decimals}
                  onChange={(e) => handleFormatChange('decimals', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                >
                  {DECIMAL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.format.format === 'currency' && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Currency
                </label>
                <select
                  value={formData.format.currency}
                  onChange={(e) => handleFormatChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                >
                  {CURRENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Prefix
                </label>
                <input
                  value={formData.format.prefix}
                  onChange={(e) => handleFormatChange('prefix', e.target.value)}
                  placeholder="e.g., $"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Suffix
                </label>
                <input
                  value={formData.format.suffix}
                  onChange={(e) => handleFormatChange('suffix', e.target.value)}
                  placeholder="e.g., units"
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded">
              <p className="text-xs text-slate-500 mb-1">Preview:</p>
              <p className="text-lg font-bold text-[#004E7C]">{getPreviewValue()}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-slate-200 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#004E7C] text-white rounded text-sm font-medium"
          >
            {isEdit ? 'Save Changes' : 'Add Statistic'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * StatisticsBuilder Component
 *
 * Allows users to define computed statistics from their query results
 *
 * Props:
 * @param {array} statistics - Current array of statistic definitions
 * @param {array} availableFields - Fields available from the notification source
 * @param {function} onChange - Called with updated statistics array
 * @param {number} maxStatistics - Maximum number of statistics allowed (default: 10)
 */
export default function StatisticsBuilder({
  statistics = [],
  availableFields = [],
  onChange,
  maxStatistics = MAX_STATISTICS
}) {
  // Debug logging for field selection issue
  console.log('[StatisticsBuilder] Rendered with props:', {
    statisticsCount: statistics?.length || 0,
    availableFields,
    availableFieldsLength: availableFields?.length || 0,
    availableFieldsType: Array.isArray(availableFields) ? 'array' : typeof availableFields,
    firstField: availableFields?.[0],
    maxStatistics
  });

  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const existingIds = statistics.map(s => s.id);

  const handleAdd = () => {
    console.log('[StatisticsBuilder] handleAdd called, availableFields at this point:', availableFields);
    setEditingIndex(null);
    setShowModal(true);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setShowModal(true);
  };

  const handleDelete = (index) => {
    if (window.confirm('Delete this statistic?')) {
      const updated = statistics.filter((_, i) => i !== index);
      onChange(updated);
    }
  };

  const handleSave = (statData) => {
    if (editingIndex !== null) {
      // Editing existing
      const updated = [...statistics];
      updated[editingIndex] = statData;
      onChange(updated);
    } else {
      // Adding new
      onChange([...statistics, statData]);
    }
    setShowModal(false);
    setEditingIndex(null);
  };

  // Drag and drop handlers
  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const updated = [...statistics];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(dragOverIndex, 0, moved);
      onChange(updated);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const getOperationLabel = (operation) => {
    return STAT_OPERATIONS.find(op => op.value === operation)?.label || operation;
  };

  const getFormatDescription = (format) => {
    if (!format) return '';
    const parts = [];
    if (format.format && format.format !== 'auto') {
      parts.push(format.format.charAt(0).toUpperCase() + format.format.slice(1));
    }
    if (format.decimals !== undefined) {
      parts.push(`${format.decimals} decimals`);
    }
    return parts.length > 0 ? `Format: ${parts.join(', ')}` : '';
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Statistics
        </h4>
        <button
          type="button"
          onClick={handleAdd}
          disabled={statistics.length >= maxStatistics}
          className="px-2 py-1 text-xs bg-[#004E7C] text-white rounded hover:bg-[#003d61] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Statistics List */}
      {statistics.length === 0 ? (
        <div className="p-6 border-2 border-dashed border-slate-200 rounded-lg text-center">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No statistics configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Add statistics to compute values like totals, averages, or counts from your data.
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-3 px-3 py-1.5 text-xs bg-[#004E7C] text-white rounded hover:bg-[#003d61]"
          >
            Add Your First Statistic
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {statistics.map((stat, index) => (
            <div
              key={stat.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 p-3 border rounded-lg bg-white transition-colors ${
                dragOverIndex === index ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Drag Handle */}
              <div className="cursor-grab text-slate-400 hover:text-slate-600">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-800">{stat.label}</span>
                  <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                    {`{{stat_${stat.id}}}`}
                  </code>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  <span className="uppercase font-medium">{getOperationLabel(stat.operation)}</span>
                  {' of '}
                  <span className="font-mono">{stat.field}</span>
                </div>
                {stat.format && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {getFormatDescription(stat.format)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <button
                type="button"
                onClick={() => handleEdit(index)}
                className="p-1.5 text-slate-400 hover:text-[#004E7C] hover:bg-slate-100 rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(index)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Limit Warning */}
      {statistics.length >= maxStatistics && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          <Info className="w-4 h-4 shrink-0" />
          <span>Maximum of {maxStatistics} statistics per notification.</span>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <StatisticModal
          statistic={editingIndex !== null ? statistics[editingIndex] : null}
          existingIds={existingIds}
          availableFields={availableFields}
          onSave={handleSave}
          onCancel={() => { setShowModal(false); setEditingIndex(null); }}
          isEdit={editingIndex !== null}
        />
      )}
    </div>
  );
}
