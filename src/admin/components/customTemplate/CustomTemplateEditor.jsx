// src/admin/components/customTemplate/CustomTemplateEditor.jsx
// Main container component for custom email template editing

import React, { useState, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  FileDown,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  Info
} from 'lucide-react';
import ThemeCustomizer from './ThemeCustomizer';
import StatisticsBuilder from './StatisticsBuilder';
import HTMLTemplateEditor from './HTMLTemplateEditor';
import TemplatePreview from './TemplatePreview';
import { DEFAULT_THEME, DEFAULT_CUSTOM_TEMPLATE_HTML } from './constants';
import { validateCustomTemplate } from './validation';

/**
 * CustomTemplateEditor Component
 *
 * Container for the full custom template editing experience
 *
 * Props:
 * @param {object} customTemplate - Current custom template configuration
 * @param {function} onChange - Called with updated custom template
 * @param {object} notification - Parent notification configuration
 * @param {object} locality - Organization/locality data
 * @param {function} onSendTest - Called to send a test email
 */
export default function CustomTemplateEditor({
  customTemplate = {},
  onChange,
  notification = {},
  locality = {},
  onSendTest
}) {
  const [showPreview, setShowPreview] = useState(true);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [expandedSections, setExpandedSections] = useState({
    theme: true,
    statistics: true,
    template: true
  });

  // Ensure default values
  const template = {
    html: customTemplate.html || DEFAULT_CUSTOM_TEMPLATE_HTML,
    includeCSV: customTemplate.includeCSV !== false,
    theme: { ...DEFAULT_THEME, ...(customTemplate.theme || {}) },
    statistics: customTemplate.statistics || [],
    ...customTemplate
  };

  // Update handler with defaults
  const handleUpdate = useCallback((updates) => {
    onChange({
      ...template,
      ...updates
    });
  }, [template, onChange]);

  // Theme update handler
  const handleThemeChange = useCallback((theme) => {
    handleUpdate({ theme });
  }, [handleUpdate]);

  // Statistics update handler
  const handleStatisticsChange = useCallback((statistics) => {
    handleUpdate({ statistics });
  }, [handleUpdate]);

  // HTML update handler
  const handleHtmlChange = useCallback((html) => {
    handleUpdate({ html });
  }, [handleUpdate]);

  // CSV toggle handler
  const handleCSVToggle = useCallback((includeCSV) => {
    handleUpdate({ includeCSV });
  }, [handleUpdate]);

  // Section toggle
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get available fields for statistics
  const availableFields = notification.source?.displayFields || [];

  // Validate template
  const validationResult = validateCustomTemplate(template, notification);

  return (
    <div className="flex h-full">
      {/* Left Panel - Editor */}
      <div className={`flex flex-col ${showPreview ? 'w-1/2' : 'w-full'} overflow-hidden`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Custom Template</span>
            {!validationResult.isValid && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {validationResult.errors.length} error(s)
              </span>
            )}
            {validationResult.isValid && validationResult.warnings.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <Info className="w-3 h-3" />
                {validationResult.warnings.length} warning(s)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
              showPreview
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* CSV Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={template.includeCSV}
                onChange={(e) => handleCSVToggle(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700 flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-slate-500" />
                Include CSV attachment in emails
              </span>
            </label>
            {!template.includeCSV && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Download button hidden
              </span>
            )}
          </div>

          {/* Theme Section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('theme')}
              className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span>Theme Customization</span>
              {expandedSections.theme ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedSections.theme && (
              <div className="p-4 bg-white">
                <ThemeCustomizer
                  theme={template.theme}
                  onChange={handleThemeChange}
                  onReset={() => handleThemeChange(DEFAULT_THEME)}
                />
              </div>
            )}
          </div>

          {/* Statistics Section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('statistics')}
              className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span className="flex items-center gap-2">
                Statistics
                {template.statistics.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#004E7C] text-white text-[10px] rounded-full">
                    {template.statistics.length}
                  </span>
                )}
              </span>
              {expandedSections.statistics ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedSections.statistics && (
              <div className="p-4 bg-white">
                <StatisticsBuilder
                  statistics={template.statistics}
                  availableFields={availableFields}
                  onChange={handleStatisticsChange}
                />
              </div>
            )}
          </div>

          {/* Template Section */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('template')}
              className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span>HTML Template</span>
              {expandedSections.template ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedSections.template && (
              <div className="p-4 bg-white">
                <HTMLTemplateEditor
                  value={template.html}
                  onChange={handleHtmlChange}
                  statistics={template.statistics}
                  height="350px"
                />
              </div>
            )}
          </div>

          {/* Validation Summary */}
          {!validationResult.isValid && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Template Errors
              </p>
              <ul className="text-xs text-red-600 space-y-1">
                {validationResult.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-red-400">•</span>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.isValid && validationResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
                <Info className="w-4 h-4" />
                Warnings
              </p>
              <ul className="text-xs text-amber-600 space-y-1">
                {validationResult.warnings.map((warn, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-amber-400">•</span>
                    {warn}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview */}
      {showPreview && (
        <div className="w-1/2 border-l border-slate-200 bg-slate-100">
          <TemplatePreview
            template={template}
            notification={notification}
            locality={locality}
            mode={previewMode}
            onModeChange={setPreviewMode}
            onSendTest={onSendTest}
          />
        </div>
      )}
    </div>
  );
}
