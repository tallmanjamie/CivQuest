// src/admin/components/FeatureExportSettings.jsx
// Map-level feature export settings for selecting which template to use
// This component is embedded within the MapEditor modal
//
// USAGE: When editing a map, admins can select ONE feature export template
// from the organization's template library for that map
// Note: Unlike map export templates, only ONE feature export template can be assigned per map

import React from 'react';
import {
  FileOutput,
  Check,
  AlertCircle,
  Info,
  Map,
  Table2
} from 'lucide-react';

// Page size display helper
const PAGE_SIZES = {
  'letter-landscape': 'Letter Landscape (11×8.5")',
  'letter-portrait': 'Letter Portrait (8.5×11")',
  'legal-landscape': 'Legal Landscape (14×8.5")',
  'legal-portrait': 'Legal Portrait (8.5×14")',
  'tabloid-landscape': 'Tabloid Landscape (17×11")',
  'tabloid-portrait': 'Tabloid Portrait (11×17")',
  'a4-landscape': 'A4 Landscape',
  'a4-portrait': 'A4 Portrait',
  'a3-landscape': 'A3 Landscape',
  'a3-portrait': 'A3 Portrait',
  'custom': 'Custom'
};

/**
 * FeatureExportSettings Component
 *
 * Allows selecting a single feature export template for a specific map
 *
 * Props:
 * @param {array} availableTemplates - All feature export templates from the organization
 * @param {array} mapExportTemplates - Map export templates for reference display
 * @param {string} selectedTemplateId - Currently selected template ID for this map (or null)
 * @param {function} onChange - Called with updated template ID (or null to clear)
 * @param {number} [scaleRatio] - Scale ratio for PDF export (default 1.0)
 * @param {function} [onScaleRatioChange] - Called with updated scale ratio value
 * @param {string} [accentColor] - Theme accent color
 */
export default function FeatureExportSettings({
  availableTemplates = [],
  mapExportTemplates = [],
  selectedTemplateId = null,
  onChange,
  scaleRatio = 1.0,
  onScaleRatioChange,
  accentColor = '#004E7C'
}) {
  // Filter to only enabled templates
  const enabledTemplates = availableTemplates.filter(t => t.enabled !== false);

  // Handle template selection
  const handleSelectTemplate = (templateId) => {
    // Toggle off if already selected, otherwise select new one
    if (selectedTemplateId === templateId) {
      onChange(null);
    } else {
      onChange(templateId);
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    onChange(null);
  };

  // Get page size display
  const getPageSizeDisplay = (template) => {
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}×${template.customHeight}")`;
    }
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  // Get linked map export template name
  const getMapExportTemplateName = (mapTemplateId) => {
    if (!mapTemplateId) return null;
    const mapTemplate = mapExportTemplates.find(t => t.id === mapTemplateId);
    return mapTemplate?.name || 'Unknown Template';
  };

  // Get selected template for summary
  const selectedTemplate = enabledTemplates.find(t => t.id === selectedTemplateId);

  // No templates available
  if (enabledTemplates.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">No Feature Export Templates Available</h4>
            <p className="text-sm text-amber-700 mt-1">
              Your organization hasn't created any feature export templates yet.
              Go to Atlas Settings → Feature Export Templates to create templates first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with selection info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">
            {selectedTemplateId ? '1 template selected' : 'No template selected'}
          </span>
          {!selectedTemplateId && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Feature export disabled
            </span>
          )}
        </div>
        {selectedTemplateId && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-xs text-slate-600 hover:text-slate-800 underline"
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Select a feature export template for this map. Users will be able to export feature data
          as PDF reports using this template.
          {!selectedTemplateId && (
            <strong className="text-amber-600"> Select a template to enable feature exports.</strong>
          )}
        </p>
      </div>

      {/* Template list - radio-style single selection */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {enabledTemplates.map(template => {
          const isSelected = selectedTemplateId === template.id;
          const linkedMapTemplate = getMapExportTemplateName(template.mapExportTemplateId);

          return (
            <label
              key={template.id}
              className={`
                flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                ${isSelected
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}
              `}
            >
              <input
                type="radio"
                name="featureExportTemplate"
                checked={isSelected}
                onChange={() => handleSelectTemplate(template.id)}
                className="sr-only"
              />

              <div
                className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-slate-300 bg-white'}
                `}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              <div
                className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: isSelected ? accentColor : '#e2e8f0',
                  color: isSelected ? '#ffffff' : '#64748b'
                }}
              >
                <FileOutput className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <h5 className={`font-medium truncate ${isSelected ? 'text-slate-800' : 'text-slate-700'}`}>
                  {template.name}
                </h5>
                <p className="text-xs text-slate-500 truncate flex items-center gap-2">
                  <span>{getPageSizeDisplay(template)}</span>
                  <span>•</span>
                  <span>{template.elements?.length || 0} elements</span>
                  {linkedMapTemplate && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-blue-600">
                        <Map className="w-3 h-3" />
                        {linkedMapTemplate}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Selected summary */}
      {selectedTemplate && (
        <div className="pt-3 border-t border-slate-200">
          <span className="text-xs text-slate-500 uppercase font-medium">Selected Template</span>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <FileOutput className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <h5 className="font-medium text-slate-800">{selectedTemplate.name}</h5>
                <p className="text-xs text-slate-600">
                  {getPageSizeDisplay(selectedTemplate)} • {selectedTemplate.elements?.length || 0} elements
                </p>
              </div>
            </div>

            {/* Show what's included in this template */}
            <div className="mt-2 pt-2 border-t border-blue-200">
              <span className="text-xs text-slate-500">Includes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedTemplate.elements?.map(el => (
                  <span
                    key={el.id}
                    className="px-2 py-0.5 text-xs bg-white border border-blue-200 text-slate-600 rounded flex items-center gap-1"
                  >
                    {el.type === 'attributeData' && <Table2 className="w-3 h-3" />}
                    {el.type.charAt(0).toUpperCase() + el.type.slice(1)}
                  </span>
                ))}
                {selectedTemplate.mapExportTemplateId && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                    <Map className="w-3 h-3" />
                    Map Export
                  </span>
                )}
              </div>
            </div>

            {/* Scale Ratio */}
            {onScaleRatioChange && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <label className="block text-xs text-slate-500 mb-1">Scale Ratio</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="2"
                    value={scaleRatio}
                    onChange={(e) => onScaleRatioChange(parseFloat(e.target.value) || 1.0)}
                    className="w-24 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 bg-white"
                  />
                  <span className="text-xs text-slate-400">
                    {scaleRatio === 1.0 ? '100% (default)' : `${Math.round(scaleRatio * 100)}%`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Adjusts text and table sizing in the exported PDF (e.g., 0.8 = 80%, 1.2 = 120%)
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FeatureExportSettingsCompact Component
 *
 * A more compact version for display in map cards/lists
 *
 * Props:
 * @param {array} availableTemplates - All feature export templates from the organization
 * @param {string} selectedTemplateId - Currently selected template ID for this map
 */
export function FeatureExportSettingsCompact({
  availableTemplates = [],
  selectedTemplateId = null
}) {
  const enabledTemplates = availableTemplates.filter(t => t.enabled !== false);

  if (enabledTemplates.length === 0) {
    return (
      <span className="text-xs text-slate-400">No templates</span>
    );
  }

  if (!selectedTemplateId) {
    return (
      <span className="text-xs text-amber-600">Feature export disabled</span>
    );
  }

  const selectedTemplate = enabledTemplates.find(t => t.id === selectedTemplateId);
  if (!selectedTemplate) {
    return (
      <span className="text-xs text-amber-600">Template not found</span>
    );
  }

  return (
    <span className="text-xs text-slate-600 flex items-center gap-1">
      <FileOutput className="w-3 h-3" />
      {selectedTemplate.name}
    </span>
  );
}
