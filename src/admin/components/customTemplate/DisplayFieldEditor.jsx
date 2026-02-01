// src/admin/components/customTemplate/DisplayFieldEditor.jsx
// Modal for editing display field formatting options

import React, { useState } from 'react';
import {
  X,
  Check
} from 'lucide-react';
import {
  FORMAT_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  DATE_FORMAT_PRESETS,
  DECIMAL_OPTIONS
} from './constants';

/**
 * DisplayFieldEditor Component
 *
 * Modal for editing display field formatting options
 *
 * Props:
 * @param {object} field - The display field to edit
 * @param {function} onSave - Called with updated field
 * @param {function} onCancel - Called when cancelled
 */
export default function DisplayFieldEditor({ field, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    field: field.field || field,
    label: field.label || (typeof field === 'string' ? field : field.field),
    format: field.format || 'auto',
    decimals: field.decimals ?? 2,
    prefix: field.prefix || '',
    suffix: field.suffix || '',
    dateFormat: field.dateFormat || 'MM/DD/YYYY',
    currency: field.currency || 'USD'
  });

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Only include relevant formatting options based on format type
    const result = {
      field: formData.field,
      label: formData.label
    };

    if (formData.format !== 'auto') {
      result.format = formData.format;
    }

    if (['number', 'currency', 'percent'].includes(formData.format)) {
      if (formData.decimals !== undefined) result.decimals = formData.decimals;
      if (formData.prefix) result.prefix = formData.prefix;
      if (formData.suffix) result.suffix = formData.suffix;
      if (formData.format === 'currency') result.currency = formData.currency;
    }

    if (formData.format === 'date') {
      result.dateFormat = formData.dateFormat;
    }

    onSave(result);
  };

  // Generate preview value
  const getPreview = () => {
    const sampleValues = {
      number: 1234567.89,
      currency: 450000,
      percent: 0.156,
      date: new Date('2025-01-15'),
      text: 'Sample Text'
    };

    const value = sampleValues[formData.format] || sampleValues.text;

    try {
      if (formData.format === 'currency') {
        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: formData.currency,
          minimumFractionDigits: formData.decimals,
          maximumFractionDigits: formData.decimals
        }).format(value);
        return formData.prefix + formatted + formData.suffix;
      }

      if (formData.format === 'number') {
        const formatted = value.toLocaleString('en-US', {
          minimumFractionDigits: formData.decimals,
          maximumFractionDigits: formData.decimals
        });
        return formData.prefix + formatted + formData.suffix;
      }

      if (formData.format === 'percent') {
        const formatted = (value * 100).toFixed(formData.decimals) + '%';
        return formData.prefix + formatted + formData.suffix;
      }

      if (formData.format === 'date') {
        // Simple date format preview
        const datePresets = DATE_FORMAT_PRESETS.find(p => p.value === formData.dateFormat);
        return datePresets?.example || '01/15/2025';
      }

      return String(value);
    } catch {
      return String(value);
    }
  };

  const showNumberOptions = ['number', 'currency', 'percent'].includes(formData.format);
  const showDateOptions = formData.format === 'date';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-slate-800">Edit Display Field</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Field and Label */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Field *
              </label>
              <input
                value={formData.field}
                disabled
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-slate-50 text-slate-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Display Label *
              </label>
              <input
                value={formData.label}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="Column Header"
                className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
              />
            </div>
          </div>

          {/* Format Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Format Type
            </label>
            <select
              value={formData.format}
              onChange={(e) => handleChange('format', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded text-sm"
            >
              {FORMAT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Number/Currency/Percent Options */}
          {showNumberOptions && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
              <h4 className="text-xs font-medium text-slate-500">Number Options</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Decimal Places
                  </label>
                  <select
                    value={formData.decimals}
                    onChange={(e) => handleChange('decimals', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                  >
                    {DECIMAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.value}</option>
                    ))}
                  </select>
                </div>

                {formData.format === 'currency' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => handleChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                    >
                      {CURRENCY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Prefix
                  </label>
                  <input
                    value={formData.prefix}
                    onChange={(e) => handleChange('prefix', e.target.value)}
                    placeholder="e.g., $"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Suffix
                  </label>
                  <input
                    value={formData.suffix}
                    onChange={(e) => handleChange('suffix', e.target.value)}
                    placeholder="e.g., units"
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date Options */}
          {showDateOptions && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
              <h4 className="text-xs font-medium text-slate-500">Date Options</h4>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date Format
                </label>
                <select
                  value={formData.dateFormat}
                  onChange={(e) => handleChange('dateFormat', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                >
                  {DATE_FORMAT_PRESETS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.example})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-500">
                <p className="font-medium mb-1">Common formats:</p>
                <ul className="space-y-0.5">
                  <li>• MM/DD/YYYY → 01/15/2025</li>
                  <li>• MMMM D, YYYY → January 15, 2025</li>
                  <li>• MMM YYYY → Jan 2025</li>
                </ul>
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg">
            <p className="text-xs font-medium text-slate-500 mb-1">Preview:</p>
            <p className="text-lg font-semibold text-slate-800">{getPreview()}</p>
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
            className="px-4 py-2 bg-[#004E7C] text-white rounded text-sm font-medium flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Field
          </button>
        </div>
      </div>
    </div>
  );
}
