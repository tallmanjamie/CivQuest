// src/admin/components/MapExportSettings.jsx
// Map-level export settings for selecting which templates are available
// This component is embedded within the MapEditor modal
//
// USAGE: When editing a map, admins can select which export templates
// from the organization's template library should be available for that map

import React from 'react';
import {
  Printer,
  Check,
  AlertCircle,
  FileImage,
  ChevronRight,
  Info
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
 * MapExportSettings Component
 * 
 * Allows selecting which export templates are available for a specific map
 * 
 * Props:
 * @param {array} availableTemplates - All templates from the organization
 * @param {array} selectedTemplateIds - Currently selected template IDs for this map
 * @param {function} onChange - Called with updated array of selected template IDs
 * @param {string} [accentColor] - Theme accent color
 */
export default function MapExportSettings({
  availableTemplates = [],
  selectedTemplateIds = [],
  onChange,
  accentColor = '#004E7C'
}) {
  // Filter to only enabled templates
  const enabledTemplates = availableTemplates.filter(t => t.enabled !== false);

  // Toggle template selection
  const handleToggleTemplate = (templateId) => {
    if (selectedTemplateIds.includes(templateId)) {
      onChange(selectedTemplateIds.filter(id => id !== templateId));
    } else {
      onChange([...selectedTemplateIds, templateId]);
    }
  };

  // Select all templates
  const handleSelectAll = () => {
    onChange(enabledTemplates.map(t => t.id));
  };

  // Clear all selections
  const handleClearAll = () => {
    onChange([]);
  };

  // Get page size display
  const getPageSizeDisplay = (template) => {
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}×${template.customHeight}")`;
    }
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  // No templates available
  if (enabledTemplates.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800">No Export Templates Available</h4>
            <p className="text-sm text-amber-700 mt-1">
              Your organization hasn't created any export templates yet. 
              Go to Atlas Settings → Export Templates to create templates first.
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
            {selectedTemplateIds.length} of {enabledTemplates.length} templates selected
          </span>
          {selectedTemplateIds.length === 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              No templates = no export option
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-slate-600 hover:text-slate-800 underline"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-slate-600 hover:text-slate-800 underline"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Selected templates will be available in this map's export tool. 
          Users can choose from these templates when exporting the map.
          {selectedTemplateIds.length === 0 && (
            <strong className="text-amber-600"> Select at least one template to enable exports.</strong>
          )}
        </p>
      </div>

      {/* Template list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {enabledTemplates.map(template => {
          const isSelected = selectedTemplateIds.includes(template.id);
          
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
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleTemplate(template.id)}
                className="sr-only"
              />
              
              <div 
                className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
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
                <Printer className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h5 className={`font-medium truncate ${isSelected ? 'text-slate-800' : 'text-slate-700'}`}>
                  {template.name}
                </h5>
                <p className="text-xs text-slate-500 truncate">
                  {getPageSizeDisplay(template)} • {template.elements?.length || 0} elements
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Selected summary */}
      {selectedTemplateIds.length > 0 && (
        <div className="pt-3 border-t border-slate-200">
          <span className="text-xs text-slate-500 uppercase font-medium">Selected Templates</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedTemplateIds.map(id => {
              const template = enabledTemplates.find(t => t.id === id);
              if (!template) return null;
              
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                >
                  <Printer className="w-3 h-3" />
                  {template.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MapExportSettingsCompact Component
 * 
 * A more compact version for display in map cards/lists
 * 
 * Props:
 * @param {array} availableTemplates - All templates from the organization
 * @param {array} selectedTemplateIds - Currently selected template IDs for this map
 */
export function MapExportSettingsCompact({
  availableTemplates = [],
  selectedTemplateIds = []
}) {
  const enabledTemplates = availableTemplates.filter(t => t.enabled !== false);
  const selectedCount = selectedTemplateIds.filter(id => 
    enabledTemplates.some(t => t.id === id)
  ).length;

  if (enabledTemplates.length === 0) {
    return (
      <span className="text-xs text-slate-400">No templates</span>
    );
  }

  if (selectedCount === 0) {
    return (
      <span className="text-xs text-amber-600">Export disabled</span>
    );
  }

  return (
    <span className="text-xs text-slate-600">
      {selectedCount} export template{selectedCount !== 1 ? 's' : ''}
    </span>
  );
}
