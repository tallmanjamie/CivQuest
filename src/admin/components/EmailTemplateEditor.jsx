// src/admin/components/EmailTemplateEditor.jsx
// Modal editor for creating and editing email templates
// Provides live preview, placeholder documentation, and template categories
//
// Templates support custom HTML with {{placeholders}} for dynamic content

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Save,
  Eye,
  EyeOff,
  Code,
  FileText,
  Info,
  Copy,
  Check,
  Sparkles,
  LayoutTemplate,
  AlertCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

// Available placeholder documentation
const PLACEHOLDERS = [
  { key: 'organizationName', desc: 'Name of the organization', example: 'One South Realty' },
  { key: 'organizationId', desc: 'ID of the organization', example: 'one_south_realty' },
  { key: 'notificationName', desc: 'Name of the notification', example: 'Daily Market Report' },
  { key: 'notificationId', desc: 'ID of the notification', example: 'daily_market_report' },
  { key: 'recordCount', desc: 'Number of records found', example: '1686' },
  { key: 'dateRangeStart', desc: 'Start date (MM/DD/YYYY)', example: '01/01/2026' },
  { key: 'dateRangeEnd', desc: 'End date (MM/DD/YYYY)', example: '01/31/2026' },
  { key: 'dateRangeStartTime', desc: 'Start date with time', example: '01/01/2026 00:00' },
  { key: 'dateRangeEndTime', desc: 'End date with time', example: '01/31/2026 23:59' },
  { key: 'dataTable', desc: 'Pre-built HTML table of records (first 10)', example: '<table>...</table>' },
  { key: 'downloadButton', desc: 'Pre-built download button HTML', example: '<a href="#">Download</a>' },
  { key: 'downloadUrl', desc: 'Raw URL to CSV download', example: 'https://storage.googleapis.com/...' },
  { key: 'moreRecordsMessage', desc: 'Message if more records exist', example: 'Showing first 10 of 100 records' },
  { key: 'emailIntro', desc: 'Custom intro text from notification config', example: 'Here is your report...' },
  { key: 'emailZeroStateMessage', desc: 'Message when no records found', example: 'No records match your criteria' }
];

// Template categories
const CATEGORIES = [
  { id: 'general', label: 'General', desc: 'Generic notification template' },
  { id: 'real-estate', label: 'Real Estate', desc: 'Property and market reports' },
  { id: 'public-safety', label: 'Public Safety', desc: 'Incident and safety alerts' },
  { id: 'permits', label: 'Permits & Planning', desc: 'Permit and development notifications' },
  { id: 'utilities', label: 'Utilities', desc: 'Service and utility updates' },
  { id: 'statistics', label: 'Statistics', desc: 'Data summaries and analytics' }
];

// Starter templates
const STARTER_TEMPLATES = {
  basic: {
    name: 'Basic',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #004E7C; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">{{organizationName}}</h1>
    <h2 style="margin: 5px 0 0 0; font-weight: normal; font-size: 16px;">{{notificationName}}</h2>
  </div>

  <div style="padding: 20px;">
    <p style="color: #666; margin: 0 0 15px 0;">
      <strong>Period:</strong> {{dateRangeStart}} to {{dateRangeEnd}}<br>
      <strong>Records:</strong> {{recordCount}}
    </p>

    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 15px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #888;">
    You are receiving this because you subscribed at CivQuest Notify.
  </div>
</div>`
  },
  statistics: {
    name: 'Statistics Report',
    html: `<div style="font-family: Georgia, serif; max-width: 650px; margin: 0 auto; background-color: #ffffff;">
  <!-- Header -->
  <div style="background-color: #1a1a2e; color: white; padding: 25px; text-align: center;">
    <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">{{notificationName}}</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.8;">{{organizationName}} | {{dateRangeEnd}}</p>
  </div>

  <!-- Statistics Grid -->
  <div style="padding: 20px; background-color: #f8f9fa;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; padding: 10px; text-align: center; vertical-align: top;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Total Records</p>
            <p style="margin: 5px 0 0 0; font-size: 36px; font-weight: bold; color: #004E7C;">{{recordCount}}</p>
          </div>
        </td>
        <td style="width: 50%; padding: 10px; text-align: center; vertical-align: top;">
          <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase;">Reporting Period</p>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #333;">{{dateRangeStart}} - {{dateRangeEnd}}</p>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Content Section -->
  <div style="padding: 25px;">
    <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #333; border-bottom: 2px solid #004E7C; padding-bottom: 10px;">Summary</h2>

    {{emailIntro}}

    {{downloadButton}}

    <h3 style="margin: 25px 0 15px 0; font-size: 16px; color: #666;">Recent Records</h3>
    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <!-- Footer -->
  <div style="padding: 20px; background-color: #1a1a2e; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.6);">
      Delivered by CivQuest Notify | {{organizationName}}
    </p>
  </div>
</div>`
  },
  marketReport: {
    name: 'Market Report',
    html: `<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #004E7C 0%, #002d4a 100%); color: white; padding: 20px;">
    <table style="width: 100%;">
      <tr>
        <td style="vertical-align: middle;">
          <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8;">Daily Market Report</p>
          <h1 style="margin: 5px 0 0 0; font-size: 24px;">{{organizationName}}</h1>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">{{dateRangeEnd}}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Key Metrics -->
  <div style="padding: 20px; background-color: #f5f7fa;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-radius: 8px 0 0 8px;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">New Listings</p>
          <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #004E7C;">{{recordCount}}</p>
        </td>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-left: 1px solid #eee; border-right: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">Period</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #333;">{{dateRangeStart}}</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold; color: #333;">{{dateRangeEnd}}</p>
        </td>
        <td style="width: 33%; padding: 15px; text-align: center; background: white; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #666; font-size: 11px; text-transform: uppercase;">Status</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #27ae60;">Active</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Content -->
  <div style="padding: 25px;">
    {{emailIntro}}

    <div style="margin: 20px 0;">
      {{downloadButton}}
    </div>

    <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">
      Latest Entries
    </h3>

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <!-- Footer -->
  <div style="padding: 15px 25px; background-color: #f5f7fa; border-top: 1px solid #e0e0e0;">
    <table style="width: 100%;">
      <tr>
        <td style="font-size: 11px; color: #888;">
          {{organizationName}} | Powered by CivQuest Notify
        </td>
        <td style="text-align: right; font-size: 11px; color: #888;">
          Report ID: {{notificationId}}
        </td>
      </tr>
    </table>
  </div>
</div>`
  },
  minimal: {
    name: 'Minimal',
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="padding: 30px 20px; border-bottom: 3px solid #004E7C;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 600;">{{notificationName}}</h1>
    <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">{{organizationName}} &bull; {{dateRangeStart}} - {{dateRangeEnd}}</p>
  </div>

  <div style="padding: 30px 20px;">
    <p style="margin: 0 0 20px 0; font-size: 32px; font-weight: 700; color: #004E7C;">{{recordCount}} <span style="font-size: 16px; font-weight: 400; color: #666;">records</span></p>

    {{emailIntro}}

    {{downloadButton}}

    {{dataTable}}

    {{moreRecordsMessage}}
  </div>

  <div style="padding: 20px; background: #f9f9f9; font-size: 12px; color: #888; text-align: center;">
    CivQuest Notify
  </div>
</div>`
  }
};

/**
 * EmailTemplateEditor Component
 *
 * Modal for editing email template HTML with live preview
 *
 * Props:
 * @param {object} template - The template object to edit
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated template when saved
 * @param {string} accentColor - Theme accent color
 */
export default function EmailTemplateEditor({
  template,
  onClose,
  onSave,
  accentColor = '#004E7C'
}) {
  const [formData, setFormData] = useState({
    ...template,
    html: template.html || STARTER_TEMPLATES.basic.html
  });
  const [showPreview, setShowPreview] = useState(true);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState(null);
  const [errors, setErrors] = useState({});

  // Sample data for preview
  const sampleData = {
    organizationName: 'One South Realty',
    organizationId: 'one_south_realty',
    notificationName: 'Daily Market Report',
    notificationId: 'daily_market_report',
    recordCount: '1686',
    dateRangeStart: '01/01/2026',
    dateRangeEnd: '01/31/2026',
    dateRangeStartTime: '01/01/2026 00:00',
    dateRangeEndTime: '01/31/2026 23:59',
    emailIntro: '<p style="margin: 0 0 15px 0; color: #444;">Here is your daily market summary with the latest property listings and statistics for your area.</p>',
    emailZeroStateMessage: 'No new records found for this period.',
    downloadButton: `<div style="margin: 20px 0;"><a href="#" style="display: inline-block; background-color: ${accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Full CSV Report</a></div>`,
    downloadUrl: 'https://storage.googleapis.com/reports/sample.csv',
    dataTable: `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Address</th>
          <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Price</th>
          <th style="text-align: left; padding: 10px 8px; background-color: #f2f2f2; border-bottom: 2px solid #ddd;">Date</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">123 Main Street</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$450,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/15/2026</td></tr>
        <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">456 Oak Avenue</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$325,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/14/2026</td></tr>
        <tr><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">789 Elm Drive</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">$550,000</td><td style="padding: 10px 8px; border-bottom: 1px solid #eee;">01/13/2026</td></tr>
      </tbody>
    </table>`,
    moreRecordsMessage: '<p style="font-style: italic; color: #666; margin-top: 15px; font-size: 13px;">Showing first 3 of 1686 records. Download the CSV to see all data.</p>'
  };

  // Process template HTML with sample data
  const processedHtml = formData.html?.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return sampleData[key] || match;
  }) || '';

  // Handle form changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Copy placeholder to clipboard
  const copyPlaceholder = async (key) => {
    const placeholder = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopiedPlaceholder(key);
      setTimeout(() => setCopiedPlaceholder(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Insert placeholder at cursor position in textarea
  const insertPlaceholder = (key) => {
    const textarea = document.getElementById('html-editor');
    if (!textarea) return;

    const placeholder = `{{${key}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newHtml = formData.html.substring(0, start) + placeholder + formData.html.substring(end);

    handleChange('html', newHtml);

    // Restore cursor position after the inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  // Apply starter template
  const applyStarterTemplate = (templateKey) => {
    const starter = STARTER_TEMPLATES[templateKey];
    if (starter) {
      handleChange('html', starter.html);
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};
    if (!formData.name?.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (!formData.html?.trim()) {
      newErrors.html = 'Template HTML is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <LayoutTemplate className="w-5 h-5" style={{ color: accentColor }} />
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {template.isNew ? 'New Email Template' : 'Edit Email Template'}
              </h3>
              <p className="text-sm text-slate-500">Design custom email layouts with placeholders</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showPreview
                  ? 'bg-slate-100 border-slate-300 text-slate-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Editor */}
          <div className={`flex flex-col ${showPreview ? 'w-1/2' : 'w-full'} border-r border-slate-200`}>
            {/* Basic Info */}
            <div className="p-4 border-b border-slate-200 space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Template Name *
                  </label>
                  <input
                    value={formData.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Daily Market Report"
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category || 'general'}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <input
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Custom email template for daily market reports"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              {/* Starter Templates */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Start from Template
                </label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(STARTER_TEMPLATES).map(([key, starter]) => (
                    <button
                      key={key}
                      onClick={() => applyStarterTemplate(key)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 inline mr-1.5" style={{ color: accentColor }} />
                      {starter.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive !== false}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-700">Template is active and available for use</span>
              </label>
            </div>

            {/* Placeholder Reference (Collapsible) */}
            <div className="border-b border-slate-200 shrink-0">
              <button
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <Code className="w-4 h-4" style={{ color: accentColor }} />
                  Placeholders Reference
                </span>
                {showPlaceholders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {showPlaceholders && (
                <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1">
                    {PLACEHOLDERS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => insertPlaceholder(p.key)}
                        className="flex items-center justify-between px-2 py-1.5 text-xs text-left bg-slate-50 hover:bg-slate-100 rounded transition-colors group"
                        title={`${p.desc}\nExample: ${p.example}`}
                      >
                        <span className="font-mono text-slate-700">{`{{${p.key}}}`}</span>
                        <span className="text-slate-400 group-hover:text-slate-600">
                          {copiedPlaceholder === p.key ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Click a placeholder to insert it at cursor position
                  </p>
                </div>
              )}
            </div>

            {/* HTML Editor */}
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                HTML Template *
              </label>
              <textarea
                id="html-editor"
                value={formData.html || ''}
                onChange={(e) => handleChange('html', e.target.value)}
                placeholder="<div>Your email HTML here...</div>"
                className={`flex-1 w-full px-3 py-2 border rounded-lg text-xs font-mono resize-none ${
                  errors.html ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
                style={{ minHeight: '200px' }}
              />
              {errors.html && (
                <p className="text-xs text-red-500 mt-1">{errors.html}</p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                Use inline CSS styles for email compatibility. Tables are recommended for complex layouts.
              </p>
            </div>
          </div>

          {/* Right Panel - Preview */}
          {showPreview && (
            <div className="w-1/2 flex flex-col bg-slate-100">
              <div className="p-3 border-b border-slate-200 bg-white shrink-0">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </h4>
                <p className="text-xs text-slate-400">Rendered with sample data</p>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="max-w-xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                  <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center shrink-0 bg-white">
          <p className="text-xs text-slate-400">
            Template ID: <code className="font-mono">{formData.id}</code>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
