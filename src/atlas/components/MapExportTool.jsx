// src/atlas/components/MapExportTool.jsx
// Map Export Tool - Allows users to export maps using configured templates
// Integrates with ArcGIS MapView to show export area and generate exports
//
// Features:
// - Template selection from available map templates
// - Output format selection (PDF, PNG, GIF)
// - Export area visualization on map
// - Custom map scale (1" = X feet)
// - Custom map title
// - Passes map, legend, scalebar, north arrow, title to print service

import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Printer,
  Download,
  FileImage,
  FileText,
  ChevronDown,
  Type,
  Loader2,
  AlertCircle,
  Check,
  Ruler,
  Move,
  ZoomIn,
  Info
} from 'lucide-react';
import { useExportArea } from '../hooks/useExportArea';

// Default print service URL
const DEFAULT_PRINT_SERVICE_URL = 'https://maps.civ.quest/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task';

// Page sizes in inches
const PAGE_DIMENSIONS = {
  'letter-landscape': { width: 11, height: 8.5, label: 'Letter Landscape' },
  'letter-portrait': { width: 8.5, height: 11, label: 'Letter Portrait' },
  'legal-landscape': { width: 14, height: 8.5, label: 'Legal Landscape' },
  'legal-portrait': { width: 8.5, height: 14, label: 'Legal Portrait' },
  'tabloid-landscape': { width: 17, height: 11, label: 'Tabloid Landscape' },
  'tabloid-portrait': { width: 11, height: 17, label: 'Tabloid Portrait' },
  'a4-landscape': { width: 11.69, height: 8.27, label: 'A4 Landscape' },
  'a4-portrait': { width: 8.27, height: 11.69, label: 'A4 Portrait' },
  'a3-landscape': { width: 16.54, height: 11.69, label: 'A3 Landscape' },
  'a3-portrait': { width: 11.69, height: 16.54, label: 'A3 Portrait' }
};

// Output format options
const OUTPUT_FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'png32', label: 'PNG', icon: FileImage },
  { id: 'gif', label: 'GIF', icon: FileImage }
];

// Common map scales (1 inch = X feet)
const PRESET_SCALES = [
  { value: null, label: 'Auto (fit to view)' },
  { value: 50, label: '1" = 50\'' },
  { value: 100, label: '1" = 100\'' },
  { value: 200, label: '1" = 200\'' },
  { value: 500, label: '1" = 500\'' },
  { value: 1000, label: '1" = 1,000\'' },
  { value: 2000, label: '1" = 2,000\'' },
  { value: 5000, label: '1" = 5,000\'' },
  { value: 10000, label: '1" = 10,000\'' },
  { value: 'custom', label: 'Custom...' }
];

/**
 * MapExportTool Component
 * 
 * Provides map export functionality for Atlas users
 * 
 * Props:
 * @param {object} mapView - ArcGIS MapView instance
 * @param {object} mapConfig - Map configuration (contains exportTemplates array of template IDs)
 * @param {object} atlasConfig - Atlas/org configuration (contains full template definitions and printServiceUrl)
 * @param {function} onClose - Callback when tool is closed
 * @param {string} [accentColor] - Theme accent color
 */
export default function MapExportTool({
  mapView,
  mapConfig,
  atlasConfig,
  onClose,
  accentColor = '#004E7C'
}) {
  // Get available templates for this map
  const availableTemplates = useMemo(() => {
    const allTemplates = atlasConfig?.exportTemplates || [];
    const enabledTemplateIds = mapConfig?.exportTemplates || [];
    return allTemplates.filter(t => 
      t.enabled !== false && enabledTemplateIds.includes(t.id)
    );
  }, [atlasConfig, mapConfig]);

  // Print service URL
  const printServiceUrl = atlasConfig?.printServiceUrl || DEFAULT_PRINT_SERVICE_URL;

  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    availableTemplates.length > 0 ? availableTemplates[0].id : null
  );
  const [outputFormat, setOutputFormat] = useState('pdf');
  const [showExportArea, setShowExportArea] = useState(true);
  const [scaleMode, setScaleMode] = useState(null); // null = auto, number = feet per inch, 'custom' = show input
  const [customScale, setCustomScale] = useState('');
  const [mapTitle, setMapTitle] = useState(mapConfig?.name || 'Map Export');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Get selected template
  const selectedTemplate = useMemo(() => 
    availableTemplates.find(t => t.id === selectedTemplateId),
    [availableTemplates, selectedTemplateId]
  );

  // Get effective scale (feet per inch)
  const effectiveScale = useMemo(() => {
    if (scaleMode === 'custom') {
      const parsed = parseFloat(customScale);
      return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return scaleMode;
  }, [scaleMode, customScale]);

  // Use the export area hook
  const { exportArea, zoomToExportArea } = useExportArea(
    mapView,
    selectedTemplate,
    effectiveScale,
    showExportArea,
    accentColor
  );

  // Get page size label
  const getPageSizeLabel = useCallback((template) => {
    if (!template) return '';
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}"×${template.customHeight}")`;
    }
    return PAGE_DIMENSIONS[template.pageSize]?.label || template.pageSize;
  }, []);

  // Format scale for display
  const formatScale = useCallback((scale) => {
    if (!scale) return 'Auto';
    if (scale >= 1000) {
      return `1" = ${(scale / 1000).toFixed(1).replace(/\.0$/, '')}k'`;
    }
    return `1" = ${Math.round(scale).toLocaleString()}'`;
  }, []);

  // Build web map JSON for print service
  const buildWebMapJson = useCallback(() => {
    if (!exportArea || !mapView) return null;

    // Get operational layers
    const operationalLayers = [];
    mapView.map.allLayers.forEach(layer => {
      if (layer.visible && layer.id !== 'export-area-layer' && layer.type !== 'graphics') {
        const layerJson = {
          id: layer.id,
          title: layer.title || layer.id,
          visibility: true,
          opacity: layer.opacity ?? 1
        };

        // Add URL for supported layer types
        if (layer.url) {
          layerJson.url = layer.url;
        } else if (layer.type === 'feature' && layer.source) {
          // Handle client-side feature layers
          layerJson.featureCollection = {
            layers: [{
              layerDefinition: {
                geometryType: layer.geometryType,
                fields: layer.fields?.map(f => f.toJSON()) || []
              },
              featureSet: {
                features: layer.source.toArray().map(f => f.toJSON()),
                geometryType: layer.geometryType
              }
            }]
          };
        }

        operationalLayers.push(layerJson);
      }
    });

    // Get basemap layers
    const baseMapLayers = [];
    if (mapView.map.basemap?.baseLayers) {
      mapView.map.basemap.baseLayers.forEach(layer => {
        if (layer.url) {
          baseMapLayers.push({
            id: layer.id,
            title: layer.title || layer.id,
            url: layer.url,
            visibility: true,
            opacity: layer.opacity ?? 1
          });
        }
      });
    }

    // Calculate map scale (convert feet per inch to actual map scale)
    // Map scale = 1 : (feet per inch * 12 inches per foot)
    const mapScale = exportArea.scale * 12;

    return {
      mapOptions: {
        extent: {
          xmin: exportArea.xmin,
          ymin: exportArea.ymin,
          xmax: exportArea.xmax,
          ymax: exportArea.ymax,
          spatialReference: mapView.spatialReference.toJSON()
        },
        scale: mapScale
      },
      operationalLayers,
      baseMap: {
        title: mapView.map.basemap?.title || 'Basemap',
        baseMapLayers
      },
      exportOptions: {
        dpi: 300,
        outputSize: [
          Math.round(exportArea.widthInches * 300),
          Math.round(exportArea.heightInches * 300)
        ]
      }
    };
  }, [exportArea, mapView]);

  // Build layout options for print service
  const buildLayoutOptions = useCallback(() => {
    if (!selectedTemplate || !exportArea) return null;

    // Get page dimensions
    let pageDims = PAGE_DIMENSIONS[selectedTemplate.pageSize];
    if (selectedTemplate.pageSize === 'custom') {
      pageDims = {
        width: selectedTemplate.customWidth || 11,
        height: selectedTemplate.customHeight || 8.5
      };
    }

    // Build layout elements array
    const layoutElements = [];

    selectedTemplate.elements?.forEach(element => {
      if (!element.visible) return;

      // Convert percentage positions to inches
      const x = (element.x / 100) * pageDims.width;
      const y = (element.y / 100) * pageDims.height;
      const width = (element.width / 100) * pageDims.width;
      const height = (element.height / 100) * pageDims.height;

      const baseElement = { x, y, width, height };

      switch (element.type) {
        case 'map':
          layoutElements.push({
            ...baseElement,
            type: 'map'
          });
          break;

        case 'title':
          layoutElements.push({
            ...baseElement,
            type: 'text',
            text: mapTitle, // Use user-provided title
            font: {
              family: 'Arial',
              size: element.content?.fontSize || 24,
              weight: element.content?.fontWeight || 'bold'
            },
            color: element.content?.color || '#000000',
            backgroundColor: element.content?.backgroundColor,
            horizontalAlignment: element.content?.align || 'center',
            verticalAlignment: 'middle'
          });
          break;

        case 'text':
          layoutElements.push({
            ...baseElement,
            type: 'text',
            text: element.content?.text || '',
            font: {
              family: 'Arial',
              size: element.content?.fontSize || 12,
              weight: element.content?.fontWeight || 'normal'
            },
            color: element.content?.color || '#000000',
            backgroundColor: element.content?.backgroundColor,
            horizontalAlignment: element.content?.align || 'left'
          });
          break;

        case 'legend':
          layoutElements.push({
            ...baseElement,
            type: 'legend',
            showTitle: element.content?.showTitle !== false,
            title: element.content?.title || 'Legend'
          });
          break;

        case 'scalebar':
          layoutElements.push({
            ...baseElement,
            type: 'scalebar',
            style: element.content?.style || 'line',
            units: element.content?.units || 'feet',
            barColor: element.content?.color || '#000000'
          });
          break;

        case 'northArrow':
          layoutElements.push({
            ...baseElement,
            type: 'northArrow',
            style: element.content?.style || 'default'
          });
          break;

        case 'logo':
        case 'image':
          if (element.content?.url) {
            layoutElements.push({
              ...baseElement,
              type: 'image',
              url: element.content.url
            });
          }
          break;
          
        default:
          break;
      }
    });

    return {
      pageSize: {
        width: pageDims.width,
        height: pageDims.height
      },
      backgroundColor: selectedTemplate.backgroundColor || '#ffffff',
      elements: layoutElements
    };
  }, [selectedTemplate, exportArea, mapTitle]);

  // Handle export
  const handleExport = async () => {
    if (!selectedTemplate || !mapView || !exportArea) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const webMapJson = buildWebMapJson();
      const layoutOptions = buildLayoutOptions();

      if (!webMapJson) {
        throw new Error('Unable to build map data');
      }

      // Prepare the print request
      const params = new URLSearchParams();
      params.append('Web_Map_as_JSON', JSON.stringify(webMapJson));
      params.append('Format', outputFormat.toUpperCase() === 'PNG32' ? 'PNG32' : outputFormat.toUpperCase());
      params.append('f', 'json');

      // Add layout template info if we have custom layout
      if (layoutOptions) {
        // For custom layouts, we use MAP_ONLY and handle layout on the server
        // Or send layout info as additional parameters
        params.append('Layout_Template', 'MAP_ONLY');
        params.append('Layout_Options', JSON.stringify(layoutOptions));
      }

      // Call the print service
      const response = await fetch(`${printServiceUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Print service returned ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || result.error.details?.[0] || 'Print service error');
      }

      // Extract result URL from various response formats
      let resultUrl = null;
      if (result.results?.[0]?.value?.url) {
        resultUrl = result.results[0].value.url;
      } else if (result.value?.url) {
        resultUrl = result.value.url;
      } else if (result.url) {
        resultUrl = result.url;
      } else if (typeof result.results?.[0]?.value === 'string') {
        resultUrl = result.results[0].value;
      }

      if (!resultUrl) {
        console.error('Print service response:', result);
        throw new Error('No output URL in response');
      }

      // Open the result
      window.open(resultUrl, '_blank');
      setExportSuccess(true);

      // Clear success message after a delay
      setTimeout(() => setExportSuccess(false), 5000);

    } catch (error) {
      console.error('Export error:', error);
      setExportError(error.message || 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // No templates available
  if (availableTemplates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5" style={{ color: accentColor }} />
            <h3 className="font-semibold text-slate-800">Export Map</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h4 className="font-medium text-slate-700 mb-2">No Export Templates</h4>
          <p className="text-sm text-slate-500">
            No export templates have been configured for this map. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5" style={{ color: accentColor }} />
          <h3 className="font-semibold text-slate-800">Export Map</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Template
          </label>
          <div className="relative">
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50 pr-10 text-sm"
              style={{ '--tw-ring-color': accentColor }}
            >
              {availableTemplates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {selectedTemplate && (
            <p className="text-xs text-slate-500 mt-1">
              {getPageSizeLabel(selectedTemplate)}
            </p>
          )}
        </div>

        {/* Map Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Type className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Map Title
          </label>
          <input
            type="text"
            value={mapTitle}
            onChange={(e) => setMapTitle(e.target.value)}
            placeholder="Enter map title..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm"
            style={{ '--tw-ring-color': accentColor }}
          />
        </div>

        {/* Output Format */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Output Format
          </label>
          <div className="flex gap-2">
            {OUTPUT_FORMATS.map(format => {
              const Icon = format.icon;
              const isSelected = outputFormat === format.id;
              return (
                <button
                  key={format.id}
                  onClick={() => setOutputFormat(format.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                    ${isSelected
                      ? 'border-transparent text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }
                  `}
                  style={isSelected ? { backgroundColor: accentColor } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {format.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Scale */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Ruler className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Map Scale
          </label>
          <div className="relative">
            <select
              value={scaleMode === 'custom' ? 'custom' : (scaleMode ?? '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') {
                  setScaleMode('custom');
                } else if (val === '') {
                  setScaleMode(null);
                } else {
                  setScaleMode(parseInt(val, 10));
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-opacity-50 pr-10 text-sm"
              style={{ '--tw-ring-color': accentColor }}
            >
              {PRESET_SCALES.map(preset => (
                <option key={String(preset.value)} value={preset.value ?? ''}>
                  {preset.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          
          {scaleMode === 'custom' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-600 whitespace-nowrap">1" =</span>
              <input
                type="number"
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                placeholder="500"
                min="1"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ '--tw-ring-color': accentColor }}
              />
              <span className="text-sm text-slate-600">feet</span>
            </div>
          )}

          {exportArea && (
            <p className="text-xs text-slate-500 mt-1.5">
              Effective: {formatScale(exportArea.scale)}
              {exportArea.isAuto && ' (auto)'}
            </p>
          )}
        </div>

        {/* Export Area Toggle */}
        <div className="flex items-center justify-between py-1">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Move className="w-3.5 h-3.5" />
            Show Export Area
          </label>
          <button
            onClick={() => setShowExportArea(!showExportArea)}
            className={`
              relative w-11 h-6 rounded-full transition-colors
              ${showExportArea ? '' : 'bg-slate-200'}
            `}
            style={showExportArea ? { backgroundColor: accentColor } : {}}
            role="switch"
            aria-checked={showExportArea}
          >
            <span
              className={`
                absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${showExportArea ? 'left-6' : 'left-1'}
              `}
            />
          </button>
        </div>

        {/* Zoom to Export Area */}
        {showExportArea && exportArea && (
          <button
            onClick={zoomToExportArea}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
            Zoom to Export Area
          </button>
        )}

        {/* Export Area Info */}
        {exportArea && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
              <Info className="w-3.5 h-3.5" />
              Export Details
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-slate-400">Map Size:</span>
                <div className="text-slate-700">
                  {exportArea.widthInches.toFixed(1)}" × {exportArea.heightInches.toFixed(1)}"
                </div>
              </div>
              <div>
                <span className="text-slate-400">Ground Area:</span>
                <div className="text-slate-700">
                  {Math.round(exportArea.widthFeet).toLocaleString()}' × {Math.round(exportArea.heightFeet).toLocaleString()}'
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">Export Failed</p>
              <p className="text-xs text-red-600 mt-0.5 break-words">{exportError}</p>
            </div>
            <button
              onClick={() => setExportError(null)}
              className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success Message */}
        {exportSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">Export complete! Check your downloads.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
        <button
          onClick={handleExport}
          disabled={isExporting || !selectedTemplate || !exportArea}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: accentColor }}
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Export...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Map
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Export Tool Button - A simple button to toggle the export tool
 */
export function ExportToolButton({ onClick, accentColor = '#004E7C', disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      title="Export Map"
    >
      <Printer className="w-4 h-4" style={{ color: accentColor }} />
      <span className="text-sm font-medium">Export</span>
    </button>
  );
}
