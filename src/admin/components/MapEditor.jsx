// src/admin/components/MapEditor.jsx
// Modal for editing individual Atlas map configurations
// Handles webmap settings, endpoint, columns, search fields, geocoder

import React, { useState, useEffect } from 'react';
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
  Check
} from 'lucide-react';

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
 * 
 * Props:
 * @param {object} data - The map configuration object to edit
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated map config when saved
 * @param {string} [accentColor] - Theme accent color
 * @param {function} [onOpenServiceFinder] - Optional callback to open ServiceFinder
 */
export default function MapEditor({ 
  data, 
  onClose, 
  onSave,
  accentColor = '#004E7C',
  onOpenServiceFinder
}) {
  // Clone the data to avoid mutating props
  const [mapConfig, setMapConfig] = useState(() => ({
    name: '',
    searchPlaceholder: 'Search for properties...',
    enabledModes: ['chat', 'map', 'table'],
    defaultMode: 'chat',
    access: 'public',
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
    ...data
  }));

  // Active tab
  const [activeTab, setActiveTab] = useState('basic');

  // Validation errors
  const [errors, setErrors] = useState({});

  // Update field
  const updateField = (field, value) => {
    setMapConfig(prev => ({ ...prev, [field]: value }));
  };

  // Update nested field
  const updateNestedField = (parent, field, value) => {
    setMapConfig(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  // Toggle mode
  const toggleMode = (mode) => {
    const current = mapConfig.enabledModes || [];
    if (current.includes(mode)) {
      // Remove mode (but keep at least one)
      if (current.length > 1) {
        updateField('enabledModes', current.filter(m => m !== mode));
      }
    } else {
      updateField('enabledModes', [...current, mode]);
    }
  };

  // Search Fields Management
  const addSearchField = () => {
    setMapConfig(prev => ({
      ...prev,
      searchFields: [...(prev.searchFields || []), { 
        field: '', 
        label: '', 
        type: 'text',
        searchable: true 
      }]
    }));
  };

  const updateSearchField = (index, key, value) => {
    const updated = [...(mapConfig.searchFields || [])];
    updated[index] = { ...updated[index], [key]: value };
    updateField('searchFields', updated);
  };

  const removeSearchField = (index) => {
    updateField('searchFields', mapConfig.searchFields.filter((_, i) => i !== index));
  };

  // Table Columns Management
  const addTableColumn = () => {
    setMapConfig(prev => ({
      ...prev,
      tableColumns: [...(prev.tableColumns || []), { 
        field: '', 
        headerName: '', 
        width: 150,
        sortable: true,
        filter: true
      }]
    }));
  };

  const updateTableColumn = (index, key, value) => {
    const updated = [...(mapConfig.tableColumns || [])];
    updated[index] = { ...updated[index], [key]: value };
    updateField('tableColumns', updated);
  };

  const removeTableColumn = (index) => {
    updateField('tableColumns', mapConfig.tableColumns.filter((_, i) => i !== index));
  };

  // Autocomplete Management
  const addAutocompleteField = () => {
    setMapConfig(prev => ({
      ...prev,
      autocomplete: [...(prev.autocomplete || []), { 
        field: '', 
        label: '',
        maxSuggestions: 10 
      }]
    }));
  };

  const updateAutocompleteField = (index, key, value) => {
    const updated = [...(mapConfig.autocomplete || [])];
    updated[index] = { ...updated[index], [key]: value };
    updateField('autocomplete', updated);
  };

  const removeAutocompleteField = (index) => {
    updateField('autocomplete', mapConfig.autocomplete.filter((_, i) => i !== index));
  };

  // Validate form
  const validate = () => {
    const newErrors = {};
    
    if (!mapConfig.name?.trim()) {
      newErrors.name = 'Map name is required';
    }
    
    if (!mapConfig.webMap?.itemId?.trim() && !mapConfig.endpoint?.trim()) {
      newErrors.source = 'Either a WebMap ID or Feature Service endpoint is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;
    onSave(mapConfig);
  };

  // Tab configuration
  const tabs = [
    { id: 'basic', label: 'Basic', icon: Settings },
    { id: 'source', label: 'Data Source', icon: Layers },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'table', label: 'Table', icon: Table2 },
    { id: 'geocoder', label: 'Geocoder', icon: MapPin }
  ];

  // Mode options
  const modeOptions = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'table', label: 'Table', icon: Table2 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {data?.name ? `Edit Map: ${data.name}` : 'New Map'}
            </h2>
            <p className="text-sm text-slate-500">Configure map settings and data sources</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-4">
          <div className="flex gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-4">
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
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        mapConfig.access === 'public'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
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
                  <p className="text-xs text-slate-500 mt-1">
                    {mapConfig.access === 'private' 
                      ? 'Requires ArcGIS authentication to access'
                      : 'Accessible without login'}
                  </p>
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
                            : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {mode.label}
                        {isEnabled && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Data Source Tab */}
          {activeTab === 'source' && (
            <div className="space-y-6">
              {errors.source && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errors.source}
                </div>
              )}

              {/* WebMap Configuration */}
              <div className="p-4 border border-slate-200 rounded-lg">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Map className="w-5 h-5" style={{ color: accentColor }} />
                  WebMap Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Portal URL
                    </label>
                    <input
                      type="url"
                      value={mapConfig.webMap?.portalUrl || ''}
                      onChange={(e) => updateNestedField('webMap', 'portalUrl', e.target.value)}
                      placeholder="https://www.arcgis.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      WebMap Item ID
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={mapConfig.webMap?.itemId || ''}
                        onChange={(e) => updateNestedField('webMap', 'itemId', e.target.value)}
                        placeholder="abc123def456..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                      />
                      {onOpenServiceFinder && (
                        <button
                          type="button"
                          onClick={() => onOpenServiceFinder('webmap')}
                          className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                          title="Browse ArcGIS"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {mapConfig.webMap?.itemId && (
                  <a
                    href={`${mapConfig.webMap.portalUrl || 'https://www.arcgis.com'}/home/item.html?id=${mapConfig.webMap.itemId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm text-sky-600 hover:text-sky-800"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View in ArcGIS Online
                  </a>
                )}
              </div>

              {/* Feature Service Endpoint */}
              <div className="p-4 border border-slate-200 rounded-lg">
                <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <Layers className="w-5 h-5" style={{ color: accentColor }} />
                  Feature Service Endpoint
                </h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Query Endpoint URL
                    <span className="text-slate-400 font-normal ml-2">(for search and table)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={mapConfig.endpoint || ''}
                      onChange={(e) => updateField('endpoint', e.target.value)}
                      placeholder="https://services.arcgis.com/.../FeatureServer/0"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                    />
                    {onOpenServiceFinder && (
                      <button
                        type="button"
                        onClick={() => onOpenServiceFinder('layer')}
                        className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Browse Services"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Autocomplete Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-800">Autocomplete Fields</h3>
                  <button
                    type="button"
                    onClick={addAutocompleteField}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                  >
                    <Plus className="w-4 h-4" /> Add Field
                  </button>
                </div>
                <p className="text-sm text-slate-500 mb-3">
                  Fields used for typeahead suggestions while typing
                </p>
                
                {(mapConfig.autocomplete || []).length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    No autocomplete fields configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mapConfig.autocomplete.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-center p-2 bg-slate-50 rounded-lg">
                        <GripVertical className="w-4 h-4 text-slate-300" />
                        <input
                          type="text"
                          value={field.field}
                          onChange={(e) => updateAutocompleteField(idx, 'field', e.target.value)}
                          placeholder="FIELD_NAME"
                          className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded font-mono"
                        />
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateAutocompleteField(idx, 'label', e.target.value)}
                          placeholder="Display Label"
                          className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <input
                          type="number"
                          value={field.maxSuggestions || 10}
                          onChange={(e) => updateAutocompleteField(idx, 'maxSuggestions', parseInt(e.target.value))}
                          className="w-20 px-2 py-1.5 text-sm border border-slate-300 rounded"
                          title="Max suggestions"
                        />
                        <button
                          type="button"
                          onClick={() => removeAutocompleteField(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-slate-800">Search Fields</h3>
                  <button
                    type="button"
                    onClick={addSearchField}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                  >
                    <Plus className="w-4 h-4" /> Add Field
                  </button>
                </div>
                <p className="text-sm text-slate-500 mb-3">
                  Fields searchable via the search box
                </p>
                
                {(mapConfig.searchFields || []).length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    No search fields configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mapConfig.searchFields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-center p-2 bg-slate-50 rounded-lg">
                        <GripVertical className="w-4 h-4 text-slate-300" />
                        <input
                          type="text"
                          value={field.field}
                          onChange={(e) => updateSearchField(idx, 'field', e.target.value)}
                          placeholder="FIELD_NAME"
                          className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded font-mono"
                        />
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateSearchField(idx, 'label', e.target.value)}
                          placeholder="Display Label"
                          className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded"
                        />
                        <select
                          value={field.type || 'text'}
                          onChange={(e) => updateSearchField(idx, 'type', e.target.value)}
                          className="w-28 px-2 py-1.5 text-sm border border-slate-300 rounded"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeSearchField(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                <div>
                  <h3 className="font-medium text-slate-800">Table Columns</h3>
                  <p className="text-sm text-slate-500">Configure visible columns in Table view</p>
                </div>
                <button
                  type="button"
                  onClick={addTableColumn}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4" /> Add Column
                </button>
              </div>

              {(mapConfig.tableColumns || []).length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <Table2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p>No columns configured</p>
                  <p className="text-xs mt-1">Add columns to display in the table view</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 p-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
                    <div className="col-span-1"></div>
                    <div className="col-span-3">Field Name</div>
                    <div className="col-span-3">Header</div>
                    <div className="col-span-1">Width</div>
                    <div className="col-span-1 text-center">Sort</div>
                    <div className="col-span-1 text-center">Filter</div>
                    <div className="col-span-2"></div>
                  </div>
                  
                  {/* Rows */}
                  {mapConfig.tableColumns.map((col, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 p-2 border-t border-slate-200 items-center hover:bg-slate-50">
                      <div className="col-span-1">
                        <GripVertical className="w-4 h-4 text-slate-300 cursor-move" />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={col.field}
                          onChange={(e) => updateTableColumn(idx, 'field', e.target.value)}
                          placeholder="FIELD"
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded font-mono"
                        />
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
                      <div className="col-span-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeTableColumn(idx)}
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
                  <span className="font-medium text-slate-800">Enable Geocoding</span>
                </label>
                <p className="text-sm text-slate-500 mt-1 ml-7">
                  Allow address-to-coordinate conversion for search
                </p>
              </div>

              {mapConfig.geocoder?.enabled && (
                <div className="pl-7 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Geocoder Service URL
                    </label>
                    <input
                      type="url"
                      value={mapConfig.geocoder?.url || ''}
                      onChange={(e) => updateNestedField('geocoder', 'url', e.target.value)}
                      placeholder="https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Leave empty to use ArcGIS World Geocoder
                    </p>
                  </div>

                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-800">
                    <HelpCircle className="w-4 h-4 inline mr-1" />
                    Geocoding helps users search by address even when the data source doesn't have an address field.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-colors"
            style={{ backgroundColor: accentColor }}
          >
            <Save className="w-4 h-4" /> Save Map
          </button>
        </div>
      </div>
    </div>
  );
}
