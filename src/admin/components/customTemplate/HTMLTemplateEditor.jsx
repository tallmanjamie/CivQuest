// src/admin/components/customTemplate/HTMLTemplateEditor.jsx
// HTML template editor with syntax highlighting simulation and placeholder support

import React, { useState, useRef, useCallback } from 'react';
import {
  Code,
  Plus,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
  Wand2
} from 'lucide-react';
import { PLACEHOLDER_SECTIONS, DEFAULT_CUSTOM_TEMPLATE_HTML } from './constants';
import { validateHTMLTemplate, getValidPlaceholderNames } from './validation';

/**
 * PlaceholderReference - Collapsible reference panel for placeholders
 */
function PlaceholderReference({ statistics = [], onInsert }) {
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);

  const toggleSection = (title) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleCopy = async (name) => {
    const placeholder = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopiedKey(name);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Add dynamic statistic placeholders
  const dynamicStatPlaceholders = statistics.flatMap(stat => [
    { name: `stat_${stat.id}`, description: `Formatted value for "${stat.label}"`, example: '$1,234,567' },
    { name: `stat_${stat.id}_value`, description: `Raw numeric value`, example: '1234567' },
    { name: `stat_${stat.id}_label`, description: `Display label`, example: stat.label }
  ]);

  const allSections = PLACEHOLDER_SECTIONS.map(section => {
    if (section.dynamic && section.title === 'Statistics') {
      return {
        ...section,
        placeholders: [...section.placeholders, ...dynamicStatPlaceholders]
      };
    }
    return section;
  });

  return (
    <div className="space-y-1">
      <h5 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
        <Code className="w-3 h-3" />
        Available Placeholders
      </h5>

      {allSections.map((section) => (
        <div key={section.title} className="border border-slate-200 rounded overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection(section.title)}
            className="w-full px-2 py-1.5 flex items-center justify-between bg-slate-50 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <span className="flex items-center gap-1">
              {section.title}
              {section.dynamic && (
                <span className="px-1 py-0.5 bg-blue-100 text-blue-600 text-[9px] rounded">
                  {statistics.length}
                </span>
              )}
            </span>
            {expandedSections[section.title] ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {expandedSections[section.title] && (
            <div className="p-2 space-y-1 bg-white">
              {section.placeholders.map((placeholder) => (
                <div
                  key={placeholder.name}
                  className="flex items-center justify-between group p-1.5 rounded hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono text-slate-700 block">
                      {`{{${placeholder.name}}}`}
                    </code>
                    <p className="text-[10px] text-slate-400 truncate">
                      {placeholder.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleCopy(placeholder.name)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                      title="Copy to clipboard"
                    >
                      {copiedKey === placeholder.name ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onInsert(placeholder.name)}
                      className="p-1 text-slate-400 hover:text-[#004E7C] hover:bg-blue-50 rounded"
                      title="Insert at cursor"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {section.dynamic && section.placeholders.length === 1 && statistics.length === 0 && (
                <p className="text-[10px] text-slate-400 italic py-2 text-center">
                  Add statistics to see their placeholders here
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * HTMLTemplateEditor Component
 *
 * Code editor for the custom HTML template with placeholder support
 *
 * Props:
 * @param {string} value - Current HTML content
 * @param {function} onChange - Called with updated HTML
 * @param {array} statistics - Statistics definitions for dynamic placeholders
 * @param {function} onValidate - Called to validate the template
 * @param {string} height - Editor height (default: '400px')
 */
export default function HTMLTemplateEditor({
  value = '',
  onChange,
  statistics = [],
  onValidate,
  height = '400px'
}) {
  const [showReference, setShowReference] = useState(true);
  const [validationResult, setValidationResult] = useState(null);
  const editorRef = useRef(null);

  // Insert placeholder at cursor position
  const insertPlaceholder = useCallback((name) => {
    const editor = editorRef.current;
    if (!editor) return;

    const placeholder = `{{${name}}}`;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const newValue = value.substring(0, start) + placeholder + value.substring(end);

    onChange(newValue);

    // Restore cursor position after the inserted placeholder
    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  }, [value, onChange]);

  // Validate template
  const handleValidate = () => {
    const validPlaceholders = getValidPlaceholderNames(statistics);
    const result = validateHTMLTemplate(value, validPlaceholders);
    setValidationResult(result);
    onValidate?.(result);
  };

  // Format HTML (basic indentation)
  const handleFormat = () => {
    try {
      // Very basic HTML formatting
      let formatted = value
        .replace(/>\s*</g, '>\n<')
        .replace(/\n\s*\n/g, '\n');

      // Simple indentation
      let indent = 0;
      const lines = formatted.split('\n');
      formatted = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('</')) {
          indent = Math.max(0, indent - 1);
        }
        const result = '  '.repeat(indent) + trimmed;
        if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!') &&
            !trimmed.endsWith('/>') && !trimmed.includes('</')) {
          indent++;
        }
        return result;
      }).join('\n');

      onChange(formatted);
    } catch (err) {
      console.error('Format error:', err);
    }
  };

  // Reset to default template
  const handleReset = () => {
    if (window.confirm('Reset to the default template? This will overwrite your current template.')) {
      onChange(DEFAULT_CUSTOM_TEMPLATE_HTML);
      setValidationResult(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with toolbar */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <Code className="w-4 h-4" />
          HTML Template
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReference(!showReference)}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              showReference
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Code className="w-3 h-3" />
            Placeholders
          </button>
          <button
            type="button"
            onClick={handleFormat}
            className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 rounded flex items-center gap-1"
            title="Format HTML"
          >
            <Wand2 className="w-3 h-3" />
            Format
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 rounded flex items-center gap-1"
            title="Validate template"
          >
            <Check className="w-3 h-3" />
            Validate
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 rounded flex items-center gap-1"
            title="Reset to default"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Editor and Reference Panel */}
      <div className="flex gap-3">
        {/* Editor */}
        <div className="flex-1">
          <div
            className="border border-slate-200 rounded-lg overflow-hidden"
            style={{ height }}
          >
            <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">template.html</span>
              <span className="text-[10px] text-slate-400">
                {value.length.toLocaleString()} characters
              </span>
            </div>
            <textarea
              ref={editorRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setValidationResult(null);
              }}
              placeholder="<div>Your email HTML here...</div>"
              className="w-full h-[calc(100%-32px)] px-3 py-2 text-xs font-mono resize-none focus:outline-none"
              style={{
                tabSize: 2,
                lineHeight: 1.5
              }}
              spellCheck={false}
            />
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div className="mt-2 space-y-2">
              {validationResult.errors.length > 0 && (
                <div className="p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Errors
                  </p>
                  <ul className="text-xs text-red-600 space-y-0.5">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.warnings.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Warnings
                  </p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {validationResult.warnings.map((warn, i) => (
                      <li key={i}>• {warn}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
                <div className="p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700">Template is valid</span>
                </div>
              )}
            </div>
          )}

          {/* Help Text */}
          <p className="mt-2 text-xs text-slate-400">
            Use inline CSS styles for best email client compatibility. Tables are recommended for complex layouts.
          </p>
        </div>

        {/* Placeholder Reference Panel */}
        {showReference && (
          <div className="w-64 shrink-0 max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg p-2">
            <PlaceholderReference
              statistics={statistics}
              onInsert={insertPlaceholder}
            />
          </div>
        )}
      </div>
    </div>
  );
}
