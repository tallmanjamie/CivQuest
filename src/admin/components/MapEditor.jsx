// src/admin/components/MapEditor.jsx
// Modal for editing individual Atlas map configurations
// Handles webmap settings, endpoint, columns, search fields, geocoder, and export templates
//
// LICENSE ENFORCEMENT: Enforces public/private visibility based on organization license
// - Professional: Private only (no public maps allowed)
// - Organization: Public or private allowed
//
// UPDATED:
// - Added Export Templates tab for selecting which export templates are available for this map
// - Added Feature Export Template selection (one per map)

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Save,
  Map,
  Globe,
  Layers,
  Table2,
  Search,
  MessageSquare,
  MapPin,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  AlertCircle,
  ExternalLink,
  Lock,
  Eye,
  Link2,
  Settings,
  HelpCircle,
  Check,
  Shield,
  Printer,
  Info,
  LayoutList,
  FileOutput,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw
} from 'lucide-react';
import {
  canHavePublicMaps,
  getProductLicenseLimits,
  PRODUCTS,
  LICENSE_TYPES
} from '../../shared/services/licenses';
import FeatureExportSettings from './FeatureExportSettings';

// Configuration for the Proxy Service (for fetching feature service fields)
const PROXY_BASE_URL = window.ARCGIS_PROXY_URL || 'https://api.civ.quest';

// Page size display helper for export templates
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
 * MapEditor Modal
 * 
 * Edits an individual map configuration within Atlas:
 * - Basic settings (name, access, modes)
 * - WebMap configuration (portal, item ID)
 * - Feature service endpoint
 * - Search fields configuration
 * - Table columns configuration
 * - Geocoder settings
 * - Export template selection
 * 
 * Props:
 * @param {object} data - The map configuration object to edit
 * @param {object} orgData - Organization data for license checking and export templates
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated map config when saved
 * @param {string} [accentColor] - Theme accent color
 * @param {function} [onOpenServiceFinder] - Optional callback to open ServiceFinder
 */
export default function MapEditor({ 
  data, 
  orgData,
  onClose, 
  onSave,
  accentColor = '#004E7C',
  onOpenServiceFinder
}) {
  // Check license constraints
  // IMPORTANT: Default to restrictive (false) when orgData is missing
  // This ensures super admins can't accidentally bypass license limits
  const canBePublic = orgData ? canHavePublicMaps(orgData) : false;
  const licenseLimits = orgData ? getProductLicenseLimits(orgData, PRODUCTS.ATLAS) : null;

  // Get available export templates from org config
  const availableExportTemplates =
    orgData?.atlasConfigDraft?.exportTemplates ||
    orgData?.atlasConfig?.exportTemplates ||
    [];

  // Filter to only enabled templates
  const enabledExportTemplates = availableExportTemplates.filter(t => t.enabled !== false);

  // Get available feature export templates from org config
  const availableFeatureExportTemplates =
    orgData?.atlasConfigDraft?.featureExportTemplates ||
    orgData?.atlasConfig?.featureExportTemplates ||
    [];

  // Filter to only enabled feature export templates
  const enabledFeatureExportTemplates = availableFeatureExportTemplates.filter(t => t.enabled !== false);

  // Clone the data to avoid mutating props
  const [mapConfig, setMapConfig] = useState(() => ({
    name: '',
    searchPlaceholder: 'Search for properties...',
    enabledModes: ['chat', 'map', 'table'],
    defaultMode: 'chat',
    // If can't be public, force private
    access: canBePublic ? (data?.access || 'public') : 'private',
    webMap: {
      portalUrl: 'https://www.arcgis.com',
      itemId: ''
    },
    endpoint: '',
    autocomplete: [],
    searchFields: [],
    tableColumns: [],
    geocoder: {
      enabled: false,
      url: ''
    },
    // Export templates - array of selected template IDs (for map export)
    exportTemplates: [],
    // Feature export template - single template ID (for feature/attribute export)
    featureExportTemplateId: null,
    // Custom feature info - per-map configuration for feature popup tabs
    customFeatureInfo: {
      layerId: '',
      tabs: [],
      export: {
        scaleRatio: 1.0,
        elements: []
      },
      ...data?.customFeatureInfo
    },
    ...data,
    // Override access if license doesn't allow public
    ...((!canBePublic && data?.access === 'public') ? { access: 'private' } : {})
  }));

  // Active tab
  const [activeTab, setActiveTab] = useState('basic');

  // Validation errors
  const [errors, setErrors] = useState({});

  // Show license warning if map was public but license changed
  const [showLicenseWarning, setShowLicenseWarning] = useState(
    !canBePublic && data?.access === 'public'
  );

  // Feature service fields state
  const [availableFields, setAvailableFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState(null);
  const [lastFetchedEndpoint, setLastFetchedEndpoint] = useState('');

  // Fetch fields from feature service endpoint
  const fetchServiceFields = useCallback(async (endpointUrl) => {
    if (!endpointUrl || !endpointUrl.trim()) {
      setAvailableFields([]);
      setFieldsError(null);
      return;
    }

    // Don't refetch if we already have fields for this endpoint
    if (endpointUrl === lastFetchedEndpoint && availableFields.length > 0) {
      return;
    }

    setFieldsLoading(true);
    setFieldsError(null);

    try {
      // First try direct fetch (works for public services)
      const fetchUrl = endpointUrl.includes('?')
        ? `${endpointUrl}&f=json`
        : `${endpointUrl}?f=json`;

      let json;
      let response = await fetch(fetchUrl);

      if (response.ok) {
        json = await response.json();
      } else {
        // If direct fetch fails, try through proxy (for secured services)
        const proxyResponse = await fetch(`${PROXY_BASE_URL}/arcgis/json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: endpointUrl })
        });

        if (!proxyResponse.ok) {
          throw new Error(`Failed to fetch service info: ${proxyResponse.status}`);
        }

        json = await proxyResponse.json();
      }

      if (json.error) {
        throw new Error(json.error.message || 'Error fetching service information');
      }

      if (json.fields && Array.isArray(json.fields)) {
        // Sort fields alphabetically by name for easier selection
        const sortedFields = [...json.fields].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        setAvailableFields(sortedFields);
        setLastFetchedEndpoint(endpointUrl);
        setFieldsError(null);
      } else {
        setAvailableFields([]);
        setFieldsError('No fields found in service response');
      }
    } catch (err) {
      console.error('Error fetching service fields:', err);
      setFieldsError(err.message || 'Failed to fetch service fields');
      setAvailableFields([]);
    } finally {
      setFieldsLoading(false);
    }
  }, [lastFetchedEndpoint, availableFields.length]);

  // Fetch fields when endpoint changes or on initial load
  useEffect(() => {
    if (mapConfig.endpoint && mapConfig.endpoint !== lastFetchedEndpoint) {
      fetchServiceFields(mapConfig.endpoint);
    }
  }, [mapConfig.endpoint, lastFetchedEndpoint, fetchServiceFields]);

  // Update field
  const updateField = (field, value) => {
    // Prevent setting access to public if license doesn't allow
    if (field === 'access' && value === 'public' && !canBePublic) {
      return; // Silently ignore - button should be disabled anyway
    }
    
    setMapConfig(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Update nested field
  const updateNestedField = (parent, field, value) => {
    setMapConfig(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  };

  // Toggle mode
  const toggleMode = (modeId) => {
    setMapConfig(prev => {
      const modes = prev.enabledModes || [];
      if (modes.includes(modeId)) {
        // Can't remove if it's the only mode or if it's the default
        if (modes.length === 1 || prev.defaultMode === modeId) return prev;
        return { ...prev, enabledModes: modes.filter(m => m !== modeId) };
      } else {
        return { ...prev, enabledModes: [...modes, modeId] };
      }
    });
  };

  // Search fields management
  const addSearchField = () => {
    setMapConfig(prev => ({
      ...prev,
      searchFields: [
        ...(prev.searchFields || []),
        { field: '', label: '', type: 'text' }
      ]
    }));
  };

  const updateSearchField = (index, field, value) => {
    setMapConfig(prev => ({
      ...prev,
      searchFields: prev.searchFields.map((sf, i) => 
        i === index ? { ...sf, [field]: value } : sf
      )
    }));
  };

  const removeSearchField = (index) => {
    setMapConfig(prev => ({
      ...prev,
      searchFields: prev.searchFields.filter((_, i) => i !== index)
    }));
  };

  // Table columns management
  const addTableColumn = () => {
    setMapConfig(prev => ({
      ...prev,
      tableColumns: [
        ...(prev.tableColumns || []),
        { field: '', headerName: '', width: 150, sortable: true, filter: true, chatResults: false }
      ]
    }));
  };

  const updateTableColumn = (index, field, value) => {
    setMapConfig(prev => ({
      ...prev,
      tableColumns: prev.tableColumns.map((col, i) => 
        i === index ? { ...col, [field]: value } : col
      )
    }));
  };

  const removeTableColumn = (index) => {
    setMapConfig(prev => ({
      ...prev,
      tableColumns: prev.tableColumns.filter((_, i) => i !== index)
    }));
  };

  const moveTableColumn = (index, direction) => {
    const columns = [...(mapConfig.tableColumns || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= columns.length) return;
    [columns[index], columns[newIndex]] = [columns[newIndex], columns[index]];
    setMapConfig(prev => ({
      ...prev,
      tableColumns: columns
    }));
  };

  // Autocomplete management
  const addAutocomplete = () => {
    setMapConfig(prev => ({
      ...prev,
      autocomplete: [
        ...(prev.autocomplete || []),
        {
          type: '',
          field: '',
          label: '',
          icon: '',
          pattern: '',
          description: '',
          maxSuggestions: 10
        }
      ]
    }));
  };

  const updateAutocomplete = (index, field, value) => {
    setMapConfig(prev => ({
      ...prev,
      autocomplete: prev.autocomplete.map((ac, i) => 
        i === index ? { ...ac, [field]: value } : ac
      )
    }));
  };

  const removeAutocomplete = (index) => {
    setMapConfig(prev => ({
      ...prev,
      autocomplete: prev.autocomplete.filter((_, i) => i !== index)
    }));
  };

  // Export template selection
  const toggleExportTemplate = (templateId) => {
    setMapConfig(prev => {
      const currentIds = prev.exportTemplates || [];
      if (currentIds.includes(templateId)) {
        return { ...prev, exportTemplates: currentIds.filter(id => id !== templateId) };
      } else {
        return { ...prev, exportTemplates: [...currentIds, templateId] };
      }
    });
  };

  const selectAllExportTemplates = () => {
    setMapConfig(prev => ({
      ...prev,
      exportTemplates: enabledExportTemplates.map(t => t.id)
    }));
  };

  const clearAllExportTemplates = () => {
    setMapConfig(prev => ({
      ...prev,
      exportTemplates: []
    }));
  };

  // Feature export template selection (single template per map)
  const setFeatureExportTemplate = (templateId) => {
    setMapConfig(prev => ({
      ...prev,
      featureExportTemplateId: templateId
    }));
  };

  // Custom Feature Info management
  const updateCustomFeatureInfo = (field, value) => {
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, [field]: value }
    }));
  };

  // Tab management for custom feature info
  const addFeatureInfoTab = () => {
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        tabs: [...(prev.customFeatureInfo?.tabs || []), { name: '', elements: [] }]
      }
    }));
  };

  const updateFeatureInfoTab = (index, field, value) => {
    const updated = [...(mapConfig.customFeatureInfo?.tabs || [])];
    updated[index] = { ...updated[index], [field]: value };
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const removeFeatureInfoTab = (index) => {
    const updated = (mapConfig.customFeatureInfo?.tabs || []).filter((_, i) => i !== index);
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const moveFeatureInfoTab = (index, direction) => {
    const tabs = [...(mapConfig.customFeatureInfo?.tabs || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tabs.length) return;
    [tabs[index], tabs[newIndex]] = [tabs[newIndex], tabs[index]];
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs }
    }));
  };

  // Tab element management for custom feature info
  const addFeatureInfoTabElement = (tabIndex) => {
    const updated = [...(mapConfig.customFeatureInfo?.tabs || [])];
    updated[tabIndex] = {
      ...updated[tabIndex],
      elements: [...(updated[tabIndex].elements || []), '']
    };
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const updateFeatureInfoTabElement = (tabIndex, elementIndex, value) => {
    const updated = [...(mapConfig.customFeatureInfo?.tabs || [])];
    const elements = [...updated[tabIndex].elements];
    elements[elementIndex] = value;
    updated[tabIndex] = { ...updated[tabIndex], elements };
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const removeFeatureInfoTabElement = (tabIndex, elementIndex) => {
    const updated = [...(mapConfig.customFeatureInfo?.tabs || [])];
    updated[tabIndex] = {
      ...updated[tabIndex],
      elements: updated[tabIndex].elements.filter((_, i) => i !== elementIndex)
    };
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  // Export settings management for custom feature info
  const updateFeatureInfoExportSetting = (field, value) => {
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo?.export, [field]: value }
      }
    }));
  };

  const addFeatureInfoExportElement = () => {
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: {
          ...prev.customFeatureInfo?.export,
          elements: [...(prev.customFeatureInfo?.export?.elements || []), '']
        }
      }
    }));
  };

  const updateFeatureInfoExportElement = (index, value) => {
    const updated = [...(mapConfig.customFeatureInfo?.export?.elements || [])];
    updated[index] = value;
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo?.export, elements: updated }
      }
    }));
  };

  const removeFeatureInfoExportElement = (index) => {
    const updated = (mapConfig.customFeatureInfo?.export?.elements || []).filter((_, i) => i !== index);
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo?.export, elements: updated }
      }
    }));
  };

  const moveFeatureInfoExportElement = (index, direction) => {
    const elements = [...(mapConfig.customFeatureInfo?.export?.elements || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= elements.length) return;
    [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
    setMapConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo?.export, elements }
      }
    }));
  };

  // Get page size display
  const getPageSizeDisplay = (template) => {
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}×${template.customHeight}")`;
    }
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  // Validate and save
  const handleSave = () => {
    const newErrors = {};
    
    if (!mapConfig.name?.trim()) {
      newErrors.name = 'Map name is required';
    }
    
    if (!mapConfig.endpoint?.trim()) {
      newErrors.endpoint = 'Feature service endpoint is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Switch to the tab with the first error
      if (newErrors.name) setActiveTab('basic');
      else if (newErrors.endpoint) setActiveTab('data');
      return;
    }
    
    onSave(mapConfig);
  };

  // Tab definitions - now includes Feature Info and Export tabs
  const tabs = [
    { id: 'basic', label: 'Basic', icon: Settings },
    { id: 'data', label: 'Data Source', icon: Link2 },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'table', label: 'Table', icon: Table2 },
    { id: 'geocoder', label: 'Geocoder', icon: MapPin },
    { id: 'featureInfo', label: 'Feature Info', icon: Layers },
    { id: 'export', label: 'Export', icon: Printer }
  ];

  // Mode options
  const modeOptions = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'table', label: 'Table', icon: Table2 }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Layers className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {data?.name ? 'Edit Map' : 'Add Map'}
              </h2>
              <p className="text-sm text-slate-500">Configure map settings and data source</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* License Warning Banner */}
        {showLicenseWarning && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Map Access Changed</p>
              <p className="text-xs text-amber-700 mt-1">
                This map was previously set to public, but your {licenseLimits?.label || 'Professional'} license 
                only allows private maps. The access level has been changed to private.
              </p>
            </div>
            <button 
              onClick={() => setShowLicenseWarning(false)}
              className="p-1 hover:bg-amber-100 rounded text-amber-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 shrink-0">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-current text-slate-800'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                  style={activeTab === tab.id ? { color: accentColor } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Basic Settings Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Map Name *
                  </label>
                  <input
                    type="text"
                    value={mapConfig.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g., Public Property Map"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 ${
                      errors.name ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-sky-500'
                    }`}
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Search Placeholder
                  </label>
                  <input
                    type="text"
                    value={mapConfig.searchPlaceholder}
                    onChange={(e) => updateField('searchPlaceholder', e.target.value)}
                    placeholder="Search for properties..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Access Level
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateField('access', 'public')}
                      disabled={!canBePublic}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        !canBePublic
                          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : mapConfig.access === 'public'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={!canBePublic ? 'Public maps require Organization license' : ''}
                    >
                      {!canBePublic && <Lock className="w-4 h-4" />}
                      <Eye className="w-4 h-4" />
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('access', 'private')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        mapConfig.access === 'private'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      Private
                    </button>
                  </div>
                  
                  {/* License info message */}
                  {!canBePublic ? (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">
                        <span className="font-medium">{licenseLimits?.label || 'Professional'} License:</span> Only private maps are allowed. 
                        Upgrade to Organization license for public maps.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      {mapConfig.access === 'private' 
                        ? 'Requires ArcGIS authentication to access'
                        : 'Accessible without login'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default View Mode
                  </label>
                  <select
                    value={mapConfig.defaultMode}
                    onChange={(e) => updateField('defaultMode', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  >
                    {modeOptions.filter(m => mapConfig.enabledModes?.includes(m.id)).map(mode => (
                      <option key={mode.id} value={mode.id}>{mode.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Enabled View Modes
                </label>
                <div className="flex gap-2">
                  {modeOptions.map(mode => {
                    const Icon = mode.icon;
                    const isEnabled = mapConfig.enabledModes?.includes(mode.id);
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => toggleMode(mode.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                          isEnabled
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Data Source Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Feature Service Endpoint *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={mapConfig.endpoint}
                    onChange={(e) => updateField('endpoint', e.target.value)}
                    placeholder="https://services.arcgis.com/.../FeatureServer/0"
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 ${
                      errors.endpoint ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-sky-500'
                    }`}
                  />
                  {onOpenServiceFinder && (
                    <button
                      type="button"
                      onClick={onOpenServiceFinder}
                      className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {errors.endpoint && <p className="text-xs text-red-500 mt-1">{errors.endpoint}</p>}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  WebMap Configuration (Optional)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Portal URL
                    </label>
                    <input
                      type="url"
                      value={mapConfig.webMap?.portalUrl || ''}
                      onChange={(e) => updateNestedField('webMap', 'portalUrl', e.target.value)}
                      placeholder="https://www.arcgis.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      WebMap Item ID
                    </label>
                    <input
                      type="text"
                      value={mapConfig.webMap?.itemId || ''}
                      onChange={(e) => updateNestedField('webMap', 'itemId', e.target.value)}
                      placeholder="abc123..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Autocomplete */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Autocomplete Fields
                  </label>
                  <div className="flex items-center gap-2">
                    {fieldsLoading && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading fields...
                      </span>
                    )}
                    {!fieldsLoading && availableFields.length > 0 && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {availableFields.length} fields available
                      </span>
                    )}
                    {!fieldsLoading && mapConfig.endpoint && availableFields.length === 0 && !fieldsError && (
                      <button
                        type="button"
                        onClick={() => fetchServiceFields(mapConfig.endpoint)}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Load fields
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addAutocomplete}
                      className="text-sm flex items-center gap-1 hover:underline"
                      style={{ color: accentColor }}
                    >
                      <Plus className="w-4 h-4" /> Add Field
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Configure autocomplete suggestions that appear as users type in the search bar.
                  Use patterns to match specific input formats (e.g., parcel IDs, addresses).
                  {availableFields.length > 0 && ' Select from available service fields or enter custom field names.'}
                </p>
                {fieldsError && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-amber-700">{fieldsError}</p>
                      <p className="text-xs text-amber-600 mt-1">You can still type field names manually.</p>
                    </div>
                  </div>
                )}
                {(mapConfig.autocomplete || []).length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No autocomplete fields configured</p>
                ) : (
                  <div className="space-y-3">
                    {mapConfig.autocomplete.map((ac, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        {/* Row 1: Type, Icon, Label */}
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={ac.type || ''}
                            onChange={(e) => updateAutocomplete(idx, 'type', e.target.value)}
                            placeholder="type"
                            title="Unique identifier for this autocomplete type (e.g., 'parcel', 'address')"
                            className="w-24 px-2 py-1 text-sm border border-slate-300 rounded font-mono"
                          />
                          <input
                            type="text"
                            value={ac.icon || ''}
                            onChange={(e) => updateAutocomplete(idx, 'icon', e.target.value)}
                            placeholder="Icon"
                            title="Emoji or icon to display (e.g., '&#x1F3E0;' for house)"
                            className="w-16 px-2 py-1 text-sm border border-slate-300 rounded text-center"
                          />
                          <input
                            type="text"
                            value={ac.label || ''}
                            onChange={(e) => updateAutocomplete(idx, 'label', e.target.value)}
                            placeholder="Display Label"
                            title="Human-readable label shown in autocomplete dropdown"
                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeAutocomplete(idx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                            title="Remove this autocomplete field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Row 2: Field, Max Suggestions */}
                        <div className="flex items-center gap-2 mb-2">
                          {availableFields.length > 0 ? (
                            <select
                              value={ac.field || ''}
                              onChange={(e) => {
                                const selectedField = availableFields.find(f => f.name === e.target.value);
                                updateAutocomplete(idx, 'field', e.target.value);
                                // Auto-populate label with alias if available and label is empty
                                if (selectedField && !ac.label) {
                                  updateAutocomplete(idx, 'label', selectedField.alias || selectedField.name);
                                }
                              }}
                              title="Feature service field to query for suggestions"
                              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded font-mono bg-white"
                            >
                              <option value="">-- Select Field --</option>
                              {availableFields.map(field => (
                                <option key={field.name} value={field.name}>
                                  {field.name} {field.alias && field.alias !== field.name ? `(${field.alias})` : ''}
                                </option>
                              ))}
                              {ac.field && !availableFields.find(f => f.name === ac.field) && (
                                <option value={ac.field}>{ac.field} (custom)</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={ac.field || ''}
                              onChange={(e) => updateAutocomplete(idx, 'field', e.target.value)}
                              placeholder="FIELD_NAME"
                              title="Feature service field to query for suggestions"
                              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded font-mono"
                            />
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Max:</span>
                            <input
                              type="number"
                              value={ac.maxSuggestions || 10}
                              onChange={(e) => updateAutocomplete(idx, 'maxSuggestions', parseInt(e.target.value) || 10)}
                              title="Maximum number of suggestions to show"
                              className="w-16 px-2 py-1 text-sm border border-slate-300 rounded"
                              min="1"
                              max="50"
                            />
                          </div>
                        </div>
                        {/* Row 3: Pattern */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-slate-500 w-14">Pattern:</span>
                          <input
                            type="text"
                            value={ac.pattern || ''}
                            onChange={(e) => updateAutocomplete(idx, 'pattern', e.target.value)}
                            placeholder="(\\d{5,})$ — regex to match input"
                            title="Regular expression pattern to match user input. Use $ for end of string."
                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded font-mono text-xs"
                          />
                        </div>
                        {/* Row 4: Description */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-14">Desc:</span>
                          <input
                            type="text"
                            value={ac.description || ''}
                            onChange={(e) => updateAutocomplete(idx, 'description', e.target.value)}
                            placeholder="Description shown to users"
                            title="Help text describing what this autocomplete matches"
                            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Search Fields
                  </label>
                  <div className="flex items-center gap-2">
                    {fieldsLoading && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading fields...
                      </span>
                    )}
                    {!fieldsLoading && availableFields.length > 0 && (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {availableFields.length} fields available
                      </span>
                    )}
                    {!fieldsLoading && mapConfig.endpoint && availableFields.length === 0 && !fieldsError && (
                      <button
                        type="button"
                        onClick={() => fetchServiceFields(mapConfig.endpoint)}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Load fields
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addSearchField}
                      className="text-sm flex items-center gap-1 hover:underline"
                      style={{ color: accentColor }}
                    >
                      <Plus className="w-4 h-4" /> Add Field
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Configure fields available for advanced search.
                  {availableFields.length > 0 && ' Select from available service fields or enter custom field names.'}
                </p>
                {fieldsError && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-amber-700">{fieldsError}</p>
                      <p className="text-xs text-amber-600 mt-1">You can still type field names manually.</p>
                    </div>
                  </div>
                )}
                {(mapConfig.searchFields || []).length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No search fields configured</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-2">
                      <div className="col-span-4">Field</div>
                      <div className="col-span-4">Label</div>
                      <div className="col-span-3">Type</div>
                      <div className="col-span-1"></div>
                    </div>
                    {mapConfig.searchFields.map((sf, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-lg">
                        <div className="col-span-4">
                          {availableFields.length > 0 ? (
                            <select
                              value={sf.field}
                              onChange={(e) => {
                                const selectedField = availableFields.find(f => f.name === e.target.value);
                                updateSearchField(idx, 'field', e.target.value);
                                // Auto-populate label with alias if available and label is empty
                                if (selectedField && !sf.label) {
                                  updateSearchField(idx, 'label', selectedField.alias || selectedField.name);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono bg-white"
                            >
                              <option value="">-- Select Field --</option>
                              {availableFields.map(field => (
                                <option key={field.name} value={field.name}>
                                  {field.name} {field.alias && field.alias !== field.name ? `(${field.alias})` : ''}
                                </option>
                              ))}
                              {sf.field && !availableFields.find(f => f.name === sf.field) && (
                                <option value={sf.field}>{sf.field} (custom)</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={sf.field}
                              onChange={(e) => updateSearchField(idx, 'field', e.target.value)}
                              placeholder="FIELD"
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono"
                            />
                          )}
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={sf.label}
                            onChange={(e) => updateSearchField(idx, 'label', e.target.value)}
                            placeholder="Label"
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={sf.type || 'text'}
                            onChange={(e) => updateSearchField(idx, 'type', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="single-select">Single Select</option>
                            <option value="multi-select">Multi Select</option>
                          </select>
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => removeSearchField(idx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Tab */}
          {activeTab === 'table' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Table Columns
                </label>
                <div className="flex items-center gap-2">
                  {fieldsLoading && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading fields...
                    </span>
                  )}
                  {!fieldsLoading && availableFields.length > 0 && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {availableFields.length} fields available
                    </span>
                  )}
                  {!fieldsLoading && mapConfig.endpoint && availableFields.length === 0 && !fieldsError && (
                    <button
                      type="button"
                      onClick={() => fetchServiceFields(mapConfig.endpoint)}
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Load fields
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addTableColumn}
                    className="text-sm flex items-center gap-1 hover:underline"
                    style={{ color: accentColor }}
                  >
                    <Plus className="w-4 h-4" /> Add Column
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-3">
                Configure columns displayed in the table view. Enable "Chat Results" to include the column in chat response displays.
                {availableFields.length > 0 && ' Select from available service fields or enter custom field names.'}
              </p>

              {fieldsError && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-amber-700">{fieldsError}</p>
                    <p className="text-xs text-amber-600 mt-1">You can still type field names manually.</p>
                  </div>
                </div>
              )}

              {(mapConfig.tableColumns || []).length === 0 ? (
                <p className="text-sm text-slate-500 italic">No table columns configured</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2 text-xs font-medium text-slate-500 px-2">
                    <div className="w-8"></div>
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <div className="col-span-3">Field</div>
                      <div className="col-span-3">Header</div>
                      <div className="col-span-1">Width</div>
                      <div className="col-span-1 text-center">Sort</div>
                      <div className="col-span-1 text-center">Filter</div>
                      <div className="col-span-2 text-center">Chat Results</div>
                      <div className="col-span-1"></div>
                    </div>
                  </div>
                  {mapConfig.tableColumns.map((col, idx) => (
                    <div key={idx} className="flex gap-2 items-center p-2 bg-slate-50 rounded-lg">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveTableColumn(idx, -1)}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTableColumn(idx, 1)}
                          disabled={idx === (mapConfig.tableColumns || []).length - 1}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          {availableFields.length > 0 ? (
                            <select
                              value={col.field}
                              onChange={(e) => {
                                const selectedField = availableFields.find(f => f.name === e.target.value);
                                updateTableColumn(idx, 'field', e.target.value);
                                // Auto-populate header with alias if available and header is empty
                                if (selectedField && !col.headerName) {
                                  updateTableColumn(idx, 'headerName', selectedField.alias || selectedField.name);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono bg-white"
                            >
                              <option value="">-- Select Field --</option>
                              {availableFields.map(field => (
                                <option key={field.name} value={field.name}>
                                  {field.name} {field.alias && field.alias !== field.name ? `(${field.alias})` : ''}
                                </option>
                              ))}
                              {col.field && !availableFields.find(f => f.name === col.field) && (
                                <option value={col.field}>{col.field} (custom)</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={col.field}
                              onChange={(e) => updateTableColumn(idx, 'field', e.target.value)}
                              placeholder="FIELD"
                              className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono"
                            />
                          )}
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            value={col.headerName}
                            onChange={(e) => updateTableColumn(idx, 'headerName', e.target.value)}
                            placeholder="Column Header"
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          />
                        </div>
                        <div className="col-span-1">
                          <input
                            type="number"
                            value={col.width || 150}
                            onChange={(e) => updateTableColumn(idx, 'width', parseInt(e.target.value))}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <input
                            type="checkbox"
                            checked={col.sortable !== false}
                            onChange={(e) => updateTableColumn(idx, 'sortable', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <input
                            type="checkbox"
                            checked={col.filter !== false}
                            onChange={(e) => updateTableColumn(idx, 'filter', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </div>
                        <div className="col-span-2 text-center">
                          <input
                            type="checkbox"
                            checked={col.chatResults === true}
                            onChange={(e) => updateTableColumn(idx, 'chatResults', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            title="Include this column in chat result displays"
                          />
                        </div>
                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => removeTableColumn(idx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Geocoder Tab */}
          {activeTab === 'geocoder' && (
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapConfig.geocoder?.enabled || false}
                    onChange={(e) => updateNestedField('geocoder', 'enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Enable Geocoding</span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-7">
                  Allow users to search by address using a geocoding service
                </p>
              </div>

              {mapConfig.geocoder?.enabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Geocoder URL
                  </label>
                  <input
                    type="url"
                    value={mapConfig.geocoder?.url || ''}
                    onChange={(e) => updateNestedField('geocoder', 'url', e.target.value)}
                    placeholder="https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Feature Info Tab */}
          {activeTab === 'featureInfo' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-slate-800">
                <Layers className="w-5 h-5" />
                <h3 className="font-semibold">Custom Feature Info</h3>
              </div>

              <p className="text-sm text-slate-600">
                Configure custom tabs and elements for the feature info popup when users click on features in this map.
              </p>

              {/* Layer ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Layer ID
                </label>
                <input
                  type="text"
                  value={mapConfig.customFeatureInfo?.layerId || ''}
                  onChange={(e) => updateCustomFeatureInfo('layerId', e.target.value)}
                  placeholder="e.g., 194f67ad7e3-layer-42"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-slate-400">
                  The layer ID for features that should display custom tabs
                </p>
              </div>

              {/* Tabs Configuration */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                    <LayoutList className="w-4 h-4 text-slate-400" />
                    Feature Info Tabs
                  </label>
                  <button
                    type="button"
                    onClick={addFeatureInfoTab}
                    className="text-sm flex items-center gap-1 hover:underline"
                    style={{ color: accentColor }}
                  >
                    <Plus className="w-4 h-4" /> Add Tab
                  </button>
                </div>

                {(mapConfig.customFeatureInfo?.tabs || []).length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4 text-center bg-slate-50 rounded-lg">
                    No tabs configured. Add a tab to organize feature popup elements.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(mapConfig.customFeatureInfo?.tabs || []).map((tab, tabIdx) => (
                      <div key={tabIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Tab Header */}
                        <div className="flex items-center gap-2 p-3 bg-slate-50">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveFeatureInfoTab(tabIdx, -1)}
                              disabled={tabIdx === 0}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveFeatureInfoTab(tabIdx, 1)}
                              disabled={tabIdx === (mapConfig.customFeatureInfo?.tabs || []).length - 1}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={tab.name}
                            onChange={(e) => updateFeatureInfoTab(tabIdx, 'name', e.target.value)}
                            placeholder="Tab Name"
                            className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => removeFeatureInfoTab(tabIdx)}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                            title="Remove tab"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Tab Elements */}
                        <div className="p-3 space-y-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1">
                            Elements (popup sections to show in this tab)
                          </label>
                          {(tab.elements || []).length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No elements added</p>
                          ) : (
                            <div className="space-y-1.5">
                              {(tab.elements || []).map((element, elIdx) => (
                                <div key={elIdx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={element}
                                    onChange={(e) => updateFeatureInfoTabElement(tabIdx, elIdx, e.target.value)}
                                    placeholder="Element name"
                                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeFeatureInfoTabElement(tabIdx, elIdx)}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => addFeatureInfoTabElement(tabIdx)}
                            className="text-xs flex items-center gap-1 mt-2"
                            style={{ color: accentColor }}
                          >
                            <Plus className="w-3 h-3" /> Add Element
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Export Configuration */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <FileOutput className="w-5 h-5 text-slate-400" />
                  <h4 className="text-sm font-medium text-slate-700">PDF Export Settings</h4>
                </div>

                <div className="space-y-4">
                  {/* Scale Ratio */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Scale Ratio
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="2"
                      value={mapConfig.customFeatureInfo?.export?.scaleRatio || 1.0}
                      onChange={(e) => updateFeatureInfoExportSetting('scaleRatio', parseFloat(e.target.value) || 1.0)}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Scale ratio for PDF export (e.g., 0.8 = 80%)
                    </p>
                  </div>

                  {/* Export Elements */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Export Elements (in print order)
                      </label>
                      <button
                        type="button"
                        onClick={addFeatureInfoExportElement}
                        className="text-sm flex items-center gap-1 hover:underline"
                        style={{ color: accentColor }}
                      >
                        <Plus className="w-4 h-4" /> Add Element
                      </button>
                    </div>

                    {(mapConfig.customFeatureInfo?.export?.elements || []).length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-3 text-center bg-slate-50 rounded-lg">
                        No export elements configured
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {(mapConfig.customFeatureInfo?.export?.elements || []).map((element, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveFeatureInfoExportElement(idx, -1)}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveFeatureInfoExportElement(idx, 1)}
                                disabled={idx === (mapConfig.customFeatureInfo?.export?.elements || []).length - 1}
                                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="w-6 text-center text-xs text-slate-400 font-medium">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={element}
                              onChange={(e) => updateFeatureInfoExportElement(idx, e.target.value)}
                              placeholder="Element name"
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeFeatureInfoExportElement(idx)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export Templates Tab */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Printer className="w-5 h-5" />
                <h3 className="font-semibold">Export Templates</h3>
              </div>
              
              <p className="text-sm text-slate-600">
                Select which export templates users can choose from when exporting this map.
                Templates are configured at the organization level in Atlas Settings → Export Templates.
              </p>

              {/* No templates available */}
              {enabledExportTemplates.length === 0 ? (
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
              ) : (
                <>
                  {/* Header with selection info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {(mapConfig.exportTemplates || []).length} of {enabledExportTemplates.length} templates selected
                      </span>
                      {(mapConfig.exportTemplates || []).length === 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          No templates = no export option
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllExportTemplates}
                        className="text-xs text-slate-600 hover:text-slate-800 underline"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={clearAllExportTemplates}
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
                      {(mapConfig.exportTemplates || []).length === 0 && (
                        <strong className="text-amber-600"> Select at least one template to enable exports.</strong>
                      )}
                    </p>
                  </div>

                  {/* Template list */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {enabledExportTemplates.map(template => {
                      const isSelected = (mapConfig.exportTemplates || []).includes(template.id);
                      
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
                            onChange={() => toggleExportTemplate(template.id)}
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
                  {(mapConfig.exportTemplates || []).length > 0 && (
                    <div className="pt-3 border-t border-slate-200">
                      <span className="text-xs text-slate-500 uppercase font-medium">Selected Templates</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(mapConfig.exportTemplates || []).map(id => {
                          const template = enabledExportTemplates.find(t => t.id === id);
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
                </>
              )}

              {/* Feature Export Template Section */}
              <div className="pt-6 mt-6 border-t border-slate-200">
                <div className="flex items-center gap-2 text-slate-800 mb-4">
                  <FileOutput className="w-5 h-5" />
                  <h3 className="font-semibold">Feature Export Template</h3>
                </div>

                <p className="text-sm text-slate-600 mb-4">
                  Select a feature export template for exporting feature data as PDF reports.
                  This allows users to export attribute data for selected features.
                </p>

                <FeatureExportSettings
                  availableTemplates={enabledFeatureExportTemplates}
                  mapExportTemplates={enabledExportTemplates}
                  selectedTemplateId={mapConfig.featureExportTemplateId}
                  onChange={setFeatureExportTemplate}
                  accentColor={accentColor}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
            style={{ backgroundColor: accentColor }}
          >
            <Save className="w-4 h-4" />
            Save Map
          </button>
        </div>
      </div>
    </div>
  );
}
