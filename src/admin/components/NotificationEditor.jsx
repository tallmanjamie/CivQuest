// src/admin/components/NotificationEditor.jsx
// Modal for editing individual notification configurations
// Handles schedule, source, fields, query config, and spatial filters
//
// LICENSE ENFORCEMENT: Enforces public/private visibility based on organization license
// - Professional: Private only (no public notifications allowed)
// - Organization: Public or private allowed

import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  History,
  MessageSquare,
  LinkIcon,
  Lock,
  ListFilter,
  LayoutList,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Play,
  Search,
  Map as MapIcon,
  Trash2,
  FlaskConical,
  Shield,
  Eye,
  LayoutTemplate,
  Mail,
  ChevronDown,
  Palette,
  Edit2
} from 'lucide-react';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import ServiceFinder from './ServiceFinder';
import SpatialFilter from './SpatialFilter';
import {
  canHavePublicNotifications,
  getProductLicenseLimits,
  PRODUCTS,
  LICENSE_TYPES
} from '../../shared/services/licenses';
import {
  CustomTemplateEditor,
  DisplayFieldEditor,
  DEFAULT_THEME,
  DEFAULT_CUSTOM_TEMPLATE_HTML
} from './customTemplate';

/**
 * NotificationEditModal
 * 
 * Edits an individual notification configuration:
 * - Basic settings (name, schedule, access)
 * - Data source (endpoint, credentials)
 * - Display fields configuration
 * - Query configuration
 * - Spatial filter (geofence)
 * 
 * Props:
 * @param {object} data - The notification configuration object to edit
 * @param {object} orgData - Organization data for license checking
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated notification config when saved
 */
export default function NotificationEditModal({ data, orgData, onClose, onSave }) {
  // Check license constraints
  // IMPORTANT: Default to restrictive (false) when orgData is missing
  // This ensures super admins can't accidentally bypass license limits
  const canBePublic = orgData ? canHavePublicNotifications(orgData) : false;
  const licenseLimits = orgData ? getProductLicenseLimits(orgData, PRODUCTS.NOTIFY) : null;

  const [formData, setFormData] = useState({
      ...data,
      source: {
          ...data.source,
          // Ensure queryConfig structure exists and has defaults
          queryConfig: {
            mode: 'none',
            rules: [],
            logic: 'AND',
            ...(data.source?.queryConfig || {})
          },
          // Ensure spatial filter is initialized
          spatialFilter: data.source?.spatialFilter || null
      },
      // Ensure runTime has a default if missing for calendar types
      runTime: data.runTime || (['monthly', 'weekly', 'daily'].includes(data.type) ? '00:00' : undefined),
      // Handle public/private access - support both legacy isPublic and access property
      // If can't be public, force private
      access: canBePublic 
        ? (data.access || (data.isPublic ? 'public' : 'private'))
        : 'private'
  });

  const [availableFields, setAvailableFields] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null); // { type: 'success'|'error', message: '', recordCount?: number }
  
  // Track if the service is a table (no geometry support)
  const [isTable, setIsTable] = useState(false);
  
  // Query Validation State
  const [isQueryValidating, setIsQueryValidating] = useState(false);
  const [queryValidationResult, setQueryValidationResult] = useState(null); // { type: 'success'|'warning'|'error', message: '' }

  // Service Finder Modal State
  const [showServiceFinder, setShowServiceFinder] = useState(false);

  // Spatial Filter Modal State
  const [showSpatialFilter, setShowSpatialFilter] = useState(false);

  // Show license warning if notification was public but license changed
  const [showLicenseWarning, setShowLicenseWarning] = useState(
    !canBePublic && (data.access === 'public' || data.isPublic)
  );

  // Email Templates State
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(data.emailTemplateId || '');
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Template Type State: 'standard' or 'custom'
  // If customTemplate exists and has html, default to 'custom'
  const [templateType, setTemplateType] = useState(
    data.customTemplate?.html ? 'custom' : 'standard'
  );

  // Custom Template Editor Modal State
  const [showCustomTemplateEditor, setShowCustomTemplateEditor] = useState(false);

  // Display Field Editor State
  const [editingField, setEditingField] = useState(null);

  // Configuration for the proxy service
  const ARCGIS_PROXY_URL = window.ARCGIS_PROXY_URL || 'https://notify.civ.quest';

  // Fetch email templates from Firestore on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const db = getFirestore();
        const templatesRef = collection(db, 'email_templates');
        const snapshot = await getDocs(templatesRef);
        const temps = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(t => t.isActive !== false); // Only show active templates
        setEmailTemplates(temps);
      } catch (err) {
        console.error('Failed to fetch email templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  // Handle email template selection
  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    if (templateId === '') {
      // Clear template - use default email format
      setFormData(prev => ({
        ...prev,
        emailTemplateId: '',
        emailTemplate: ''
      }));
    } else {
      const selected = emailTemplates.find(t => t.id === templateId);
      if (selected) {
        setFormData(prev => ({
          ...prev,
          emailTemplateId: templateId,
          emailTemplate: selected.html || ''
        }));
      }
    }
  };

  // Handle template type change
  const handleTemplateTypeChange = (newType) => {
    if (newType === 'standard' && templateType === 'custom') {
      // Switching from custom to standard - confirm with user
      if (formData.customTemplate?.html && !window.confirm(
        'Switch to Standard Template? Your custom template will be preserved but not used. You can switch back to custom at any time.'
      )) {
        return;
      }
    }
    setTemplateType(newType);
  };

  // Handle custom template updates
  const handleCustomTemplateChange = (customTemplate) => {
    setFormData(prev => ({
      ...prev,
      customTemplate: {
        ...customTemplate,
        updatedAt: new Date().toISOString()
      }
    }));
  };

  // Initialize custom template with defaults if switching to custom mode
  const initializeCustomTemplate = () => {
    if (!formData.customTemplate?.html) {
      setFormData(prev => ({
        ...prev,
        customTemplate: {
          html: DEFAULT_CUSTOM_TEMPLATE_HTML,
          includeCSV: true,
          theme: { ...DEFAULT_THEME },
          statistics: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }));
    }
  };

  // Handle display field updates with formatting
  const handleDisplayFieldUpdate = (updatedField) => {
    const displayFields = formData.source?.displayFields || [];
    const updatedFields = displayFields.map(f => {
      const fieldName = typeof f === 'string' ? f : f.field;
      if (fieldName === updatedField.field) {
        return updatedField;
      }
      return f;
    });
    handleSourceChange('displayFields', updatedFields);
    setEditingField(null);
  };

  // Get display field info (handles both string and object formats)
  const getFieldInfo = (field) => {
    if (typeof field === 'string') {
      return { field, label: field };
    }
    return field;
  };

  const handleChange = (field, value) => {
    let finalValue = value;
    
    // Enforce strict ID naming convention (no spaces, special chars)
    if (field === 'id') {
      finalValue = value.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    // Prevent setting access to public if license doesn't allow
    if (field === 'access' && value === 'public' && !canBePublic) {
      return; // Silently ignore - checkbox should be disabled anyway
    }

    setFormData(prev => ({ ...prev, [field]: finalValue }));
  };

  const handleSourceChange = (field, value) => {
    setFormData(prev => ({ 
      ...prev, 
      source: { ...prev.source, [field]: value } 
    }));
  };

  /**
   * Convert technical error messages to plain English
   */
  const getPlainEnglishMessage = (type, rawMessage, fieldCount = 0) => {
    if (type === 'success') {
      if (fieldCount === 1) {
        return `Found 1 field`;
      }
      return `Found ${fieldCount} fields`;
    }
    
    // Error messages - convert to plain English
    const lowerMessage = rawMessage.toLowerCase();
    
    if (lowerMessage.includes('fetch') || lowerMessage.includes('network') || lowerMessage.includes('cors')) {
      return `Couldn't connect to the server. Check the URL and try again.`;
    }
    if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return `Access denied. Check your username and password.`;
    }
    if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
      return `You don't have permission to access this service.`;
    }
    if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
      return `Service not found. Double-check the URL.`;
    }
    if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) {
      return `The server had an error. Try again later.`;
    }
    if (lowerMessage.includes('timeout')) {
      return `Request timed out. The service might be slow or unavailable.`;
    }
    
    // Generic fallback
    return rawMessage;
  };

  /**
   * Handle selecting a service from ServiceFinder
   */
  const handleServiceSelected = (serviceData) => {
    // Update the endpoint
    handleSourceChange('endpoint', serviceData.url);
    
    // Close the modal
    setShowServiceFinder(false);
    
    // Auto-validate with the new endpoint
    setTimeout(() => {
      validateAndFetchFields(serviceData.url, formData.source?.username, formData.source?.password);
    }, 100);
  };

  /**
   * Validate endpoint and fetch fields (via proxy)
   */
  const validateAndFetchFields = async (endpoint = formData.source?.endpoint, username = formData.source?.username, password = formData.source?.password) => {
    if (!endpoint) {
      setValidationResult({ type: 'error', message: 'Enter an endpoint URL' });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const requestBody = {
        serviceUrl: endpoint,
        ...(username && password ? { username, password } : {})
      };

      const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to fetch metadata');
      }

      const metadata = await res.json();
      
      if (!metadata.fields || metadata.fields.length === 0) {
        throw new Error('No fields found in this service');
      }

      // Check if this is a table (no geometry)
      const geometryType = metadata.geometryType || metadata.type;
      setIsTable(!geometryType || geometryType === 'Table');

      // Extract field names
      const fields = metadata.fields.map(f => f.name);
      setAvailableFields(fields);
      
      const successMessage = getPlainEnglishMessage('success', '', fields.length);
      setValidationResult({ 
        type: 'success', 
        message: successMessage
      });

    } catch (err) {
      console.error('Validation error:', err);
      const errorMessage = getPlainEnglishMessage('error', err.message);
      setValidationResult({ type: 'error', message: errorMessage });
    } finally {
      setIsValidating(false);
    }
  };

  // Auto-validate on mount if endpoint exists
  useEffect(() => {
    if (data.source?.endpoint) {
      validateAndFetchFields(data.source.endpoint, data.source.username, data.source.password);
    }
  }, []);

  // Toggle display field (handles both string and object formats)
  const toggleDisplayField = (fieldName) => {
    const current = formData.source?.displayFields || [];
    // Check if field exists (in either string or object format)
    const fieldExists = current.some(f =>
      (typeof f === 'string' ? f : f.field) === fieldName
    );

    let updated;
    if (fieldExists) {
      // Remove field
      updated = current.filter(f =>
        (typeof f === 'string' ? f : f.field) !== fieldName
      );
    } else {
      // Add field as object with label
      updated = [...current, { field: fieldName, label: fieldName }];
    }
    handleSourceChange('displayFields', updated);
  };

  // Move display field
  const moveDisplayField = (from, direction) => {
    const fields = [...(formData.source?.displayFields || [])];
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= fields.length) return;
    [fields[from], fields[to]] = [fields[to], fields[from]];
    handleSourceChange('displayFields', fields);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    // Clean up data before saving
    const cleanedData = {
      ...formData,
      // Remove isPublic legacy field, use access instead
      isPublic: undefined
    };
    delete cleanedData.isPublic;
    onSave(cleanedData);
  };

  // --- Query Builder Logic ---
  const queryModes = [
    { id: 'none', label: 'No Filter', desc: 'Include all records from the source' },
    { id: 'simple', label: 'Simple Filter', desc: 'Filter by specific field values' },
    { id: 'advanced', label: 'Advanced (SQL)', desc: 'Write custom WHERE clause' }
  ];

  const handleQueryModeChange = (mode) => {
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        queryConfig: {
          ...prev.source.queryConfig,
          mode,
          // Reset rules when switching modes
          rules: mode === 'simple' ? (prev.source.queryConfig?.rules?.length ? prev.source.queryConfig.rules : [{ field: '', operator: '=', value: '' }]) : [],
          advancedWhere: mode === 'advanced' ? (prev.source.queryConfig?.advancedWhere || '') : undefined
        }
      }
    }));
  };

  const addQueryRule = () => {
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        queryConfig: {
          ...prev.source.queryConfig,
          rules: [...(prev.source.queryConfig?.rules || []), { field: '', operator: '=', value: '' }]
        }
      }
    }));
  };

  const updateQueryRule = (index, field, value) => {
    setFormData(prev => {
      const rules = [...(prev.source.queryConfig?.rules || [])];
      rules[index] = { ...rules[index], [field]: value };
      return {
        ...prev,
        source: {
          ...prev.source,
          queryConfig: { ...prev.source.queryConfig, rules }
        }
      };
    });
  };

  const removeQueryRule = (index) => {
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        queryConfig: {
          ...prev.source.queryConfig,
          rules: prev.source.queryConfig.rules.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const toggleQueryLogic = () => {
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        queryConfig: {
          ...prev.source.queryConfig,
          logic: prev.source.queryConfig?.logic === 'AND' ? 'OR' : 'AND'
        }
      }
    }));
  };

  /**
   * Generate the WHERE clause from rules
   */
  const buildWhereClause = () => {
    const config = formData.source?.queryConfig;
    if (!config || config.mode === 'none') return '1=1';
    if (config.mode === 'advanced') return config.advancedWhere || '1=1';
    
    const rules = config.rules || [];
    if (rules.length === 0) return '1=1';
    
    const clauses = rules
      .filter(r => r.field && r.value !== undefined && r.value !== '')
      .map(r => {
        const isNumeric = !isNaN(r.value) && r.value.trim() !== '';
        const formattedValue = isNumeric ? r.value : `'${r.value.replace(/'/g, "''")}'`;
        return `${r.field} ${r.operator} ${formattedValue}`;
      });
    
    if (clauses.length === 0) return '1=1';
    return clauses.join(` ${config.logic || 'AND'} `);
  };

  /**
   * Test the generated query against the endpoint
   */
  const validateQuery = async () => {
    const endpoint = formData.source?.endpoint;
    if (!endpoint) {
      setQueryValidationResult({ type: 'error', message: 'No endpoint configured' });
      return;
    }

    const whereClause = buildWhereClause();
    if (whereClause === '1=1' && formData.source?.queryConfig?.mode !== 'none') {
      setQueryValidationResult({ type: 'warning', message: 'Query is empty - will return all records' });
      return;
    }

    setIsQueryValidating(true);
    setQueryValidationResult(null);

    try {
      // Build query URL
      const baseUrl = endpoint.replace(/\/$/, '');
      const params = new URLSearchParams({
        where: whereClause,
        returnCountOnly: 'true',
        f: 'json'
      });

      // Use proxy for the query
      const proxyBody = {
        serviceUrl: `${baseUrl}/query?${params.toString()}`,
        ...(formData.source?.username && formData.source?.password 
          ? { username: formData.source.username, password: formData.source.password } 
          : {})
      };

      const res = await fetch(`${ARCGIS_PROXY_URL}/api/arcgis/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody)
      });

      if (!res.ok) {
        throw new Error('Query failed');
      }

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Invalid query');
      }

      const count = data.count ?? data.features?.length ?? 0;
      
      if (count === 0) {
        setQueryValidationResult({ 
          type: 'warning', 
          message: 'Query returned 0 records. Check your filter values.' 
        });
      } else {
        setQueryValidationResult({ 
          type: 'success', 
          message: `Query matches ${count.toLocaleString()} record${count !== 1 ? 's' : ''}`
        });
      }

    } catch (err) {
      console.error('Query validation error:', err);
      setQueryValidationResult({ 
        type: 'error', 
        message: err.message.includes('Invalid') 
          ? 'Invalid query syntax. Check field names and values.' 
          : 'Failed to validate query'
      });
    } finally {
      setIsQueryValidating(false);
    }
  };

  /**
   * Handle Spatial Filter save
   */
  const handleSpatialFilterSave = (spatialFilter) => {
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        spatialFilter
      }
    }));
    setShowSpatialFilter(false);
  };

  /**
   * Clear spatial filter
   */
  const clearSpatialFilter = () => {
    setFormData(prev => ({
      ...prev,
      source: {
        ...prev.source,
        spatialFilter: null
      }
    }));
  };

  const queryConfig = formData.source?.queryConfig || { mode: 'none', rules: [], logic: 'AND' };
  const operators = [
    { value: '=', label: 'equals' },
    { value: '<>', label: 'not equals' },
    { value: '>', label: 'greater than' },
    { value: '<', label: 'less than' },
    { value: '>=', label: 'greater or equal' },
    { value: '<=', label: 'less or equal' },
    { value: 'LIKE', label: 'contains' }
  ];

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50">
      {/* Service Finder Modal */}
      {showServiceFinder && (
          <ServiceFinder 
            onClose={() => setShowServiceFinder(false)}
            onServiceSelected={handleServiceSelected}
          />
      )}

      {/* Spatial Filter Modal */}
      {showSpatialFilter && (
          <SpatialFilter
            initialFilter={formData.source?.spatialFilter}
            endpoint={formData.source?.endpoint}
            onClose={() => setShowSpatialFilter(false)}
            onSave={handleSpatialFilterSave}
          />
      )}

      {/* Custom Template Editor Modal */}
      {showCustomTemplateEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-[#004E7C]" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Custom Template Designer</h3>
                  <p className="text-sm text-slate-500">Design your email template with branding and statistics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomTemplateEditor(false)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <CustomTemplateEditor
                customTemplate={formData.customTemplate || {}}
                onChange={handleCustomTemplateChange}
                notification={formData}
                locality={orgData}
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setShowCustomTemplateEditor(false)}
                className="px-4 py-2 border border-slate-200 rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowCustomTemplateEditor(false)}
                className="px-4 py-2 bg-[#004E7C] text-white rounded text-sm font-medium flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display Field Editor Modal */}
      {editingField && (
        <DisplayFieldEditor
          field={editingField}
          onSave={handleDisplayFieldUpdate}
          onCancel={() => setEditingField(null)}
        />
      )}

      {/* Main Editor Panel */}
      <div className="w-full max-w-lg bg-white shadow-lg h-full overflow-y-auto">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="font-bold text-lg text-slate-800">
                  {data.id ? 'Edit Notification' : 'Add Notification'}
              </h3>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
              </button>
            </div>

            {/* License Warning Banner */}
            {showLicenseWarning && (
              <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Notification Access Changed</p>
                  <p className="text-xs text-amber-700 mt-1">
                    This notification was previously set to public, but your {licenseLimits?.label || 'Professional'} license 
                    only allows private notifications. The access level has been changed to private.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowLicenseWarning(false)}
                  className="p-1 hover:bg-amber-100 rounded text-amber-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-5 flex-1 overflow-y-auto">

                {/* BASIC INFO */}
                <section className="space-y-3">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Basic Info
                  </h4>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-slate-500 mb-1">ID (unique)</label>
                      <input 
                          value={formData.id || ''} 
                          onChange={e => handleChange('id', e.target.value)} 
                          className="w-full px-2 py-2 border rounded text-xs font-mono"
                          placeholder="my_notif"
                      />
                    </div>
                    <div className="col-span-8">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                      <input 
                          value={formData.name || ''} 
                          onChange={e => handleChange('name', e.target.value)} 
                          className="w-full px-2 py-2 border rounded text-xs"
                          placeholder="My Notification"
                      />
                    </div>
                  </div>
                </section>

                {/* SCHEDULE */}
                <section className="space-y-3">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <History className="w-4 h-4" /> Schedule
                  </h4>

                  <div className="grid grid-cols-12 gap-3">
                    {/* Type */}
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Frequency</label>
                      <select 
                          value={formData.type || 'daily'} 
                          onChange={e => handleChange('type', e.target.value)} 
                          className="w-full px-2 py-2 border rounded text-xs"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                        <option value="hours">Hourly</option>
                        <option value="minutes">Minutes</option>
                      </select>
                    </div>
                    {/* Day Selector (Monthly / Weekly) */}
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        {formData.type === 'monthly' ? 'Day of Month' : 
                         formData.type === 'weekly' ? 'Day of Week' : 
                         formData.type === 'hours' ? 'Every N Hours' :
                         formData.type === 'minutes' ? 'Every N Minutes' :
                         'Interval'}
                      </label>
                      {formData.type === 'monthly' && (
                        <select 
                            value={formData.runDay || 1} 
                            onChange={e => handleChange('runDay', parseInt(e.target.value))}
                            className="w-full px-2 py-2 border rounded text-xs"
                        >
                          {[...Array(28)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      )}
                      {formData.type === 'weekly' && (
                        <select 
                            value={formData.runDay || 0} 
                            onChange={e => handleChange('runDay', parseInt(e.target.value))}
                            className="w-full px-2 py-2 border rounded text-xs"
                        >
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                            <option key={day} value={i}>{day}</option>
                          ))}
                        </select>
                      )}
                      {formData.type === 'hours' && (
                        <select 
                            value={formData.runDay || 1} 
                            onChange={e => handleChange('runDay', parseInt(e.target.value))}
                            className="w-full px-2 py-2 border rounded text-xs"
                        >
                          <option value={1}>Every Hour</option>
                          <option value={2}>Every 2 Hours</option>
                          <option value={3}>Every 3 Hours</option>
                          <option value={4}>Every 4 Hours</option>
                          <option value={6}>Every 6 Hours</option>
                          <option value={8}>Every 8 Hours</option>
                          <option value={12}>Every 12 Hours</option>
                        </select>
                      )}
                      {formData.type === 'minutes' && (
                        <select 
                            value={formData.runDay || 15} 
                            onChange={e => handleChange('runDay', parseInt(e.target.value))}
                            className="w-full px-2 py-2 border rounded text-xs"
                        >
                          <option value={5}>Every 5 Minutes</option>
                          <option value={10}>Every 10 Minutes</option>
                          <option value={15}>Every 15 Minutes</option>
                          <option value={30}>Every 30 Minutes</option>
                          <option value={45}>Every 45 Minutes</option>
                        </select>
                      )}
                    </div>

                    {/* Run Time Input - Only for Calendar Types */}
                    {['monthly', 'weekly', 'daily'].includes(formData.type) && (
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Run Time (UTC)</label>
                          <input 
                              type="time" 
                              value={formData.runTime || '00:00'} 
                              onChange={e => handleChange('runTime', e.target.value)} 
                              className="w-full px-2 py-2 border rounded text-xs" 
                          />
                        </div>
                    )}
                  </div>
                  
                  {/* Options */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                        <input type="checkbox" checked={formData.paused || false} onChange={e => handleChange('paused', e.target.checked)} className="rounded" />
                        <span className="text-slate-700 group-hover:text-slate-900">
                            Pause Notification
                        </span>
                    </label>
                    
                    {/* Conditionally hide sendEmpty for high-frequency types */}
                    {!['hours', 'minutes'].includes(formData.type) && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer group">
                            <input type="checkbox" checked={formData.sendEmpty || false} onChange={e => handleChange('sendEmpty', e.target.checked)} className="rounded" />
                            <span className="text-slate-700 group-hover:text-slate-900">Send notification even if empty</span>
                        </label>
                    )}
                    
                    {['hours', 'minutes'].includes(formData.type) && (
                        <div className="flex items-center gap-2 text-sm text-slate-400 italic">
                            <input type="checkbox" checked={false} disabled className="rounded opacity-50" />
                            <span>Send empty disabled for high-frequency notifications</span>
                        </div>
                    )}
                    
                    {/* Public/Private visibility with license enforcement */}
                    <div className="space-y-1">
                      <label className={`flex items-center gap-2 text-sm cursor-pointer group ${!canBePublic ? 'opacity-60' : ''}`}>
                          <input 
                            type="checkbox" 
                            checked={formData.access === 'public'} 
                            onChange={e => handleChange('access', e.target.checked ? 'public' : 'private')} 
                            className="rounded"
                            disabled={!canBePublic}
                          />
                          <span className="text-slate-700 group-hover:text-slate-900">Make notification public</span>
                          {!canBePublic && <Lock className="w-3 h-3 text-slate-400" />}
                      </label>
                      
                      {/* License restriction message */}
                      {!canBePublic && (
                        <div className="ml-6 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">
                            <span className="font-medium">{licenseLimits?.label || 'Professional'} License:</span> Only private notifications are allowed. 
                            Upgrade to Organization license for public notifications.
                          </p>
                        </div>
                      )}
                      
                      {canBePublic && formData.access !== 'public' && (
                          <p className="text-[10px] text-slate-400 ml-6">Private: Only invited users can subscribe</p>
                      )}
                      {canBePublic && formData.access === 'public' && (
                          <p className="text-[10px] text-slate-400 ml-6">Public: Anyone can discover and subscribe</p>
                      )}
                    </div>

                    {/* Lookback Settings - for sub-daily types */}
                    {['hours', 'minutes'].includes(formData.type) && (
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <label className="block text-xs font-medium text-amber-800 mb-1 flex items-center gap-1">
                                <History className="w-3 h-3" /> Lookback Window
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={formData.lookbackMinutes || (formData.type === 'hours' ? (formData.runDay || 1) * 60 : (formData.runDay || 15))}
                                    onChange={e => handleChange('lookbackMinutes', parseInt(e.target.value))}
                                    className="flex-1 px-2 py-1.5 border rounded text-sm bg-white"
                                >
                                    <option value={5}>5 minutes</option>
                                    <option value={10}>10 minutes</option>
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={60}>1 hour</option>
                                    <option value={120}>2 hours</option>
                                    <option value={240}>4 hours</option>
                                    <option value={480}>8 hours</option>
                                    <option value={1440}>24 hours</option>
                                </select>
                            </div>
                            <p className="text-[10px] text-amber-700 mt-1.5 leading-tight">
                                Records modified within this window will be included. Defaults to your notification interval.
                            </p>
                        </div>
                    )}
                    
                    {/* Lag Settings - Hidden for sub-daily types */}
                    {!['hours', 'minutes'].includes(formData.type) && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                                <History className="w-3 h-3" /> Lookback Lag (Days)
                            </label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number"
                                    min="0"
                                    max="365"
                                    value={formData.lagDays ?? 0}
                                    onChange={e => handleChange('lagDays', Math.max(0, parseInt(e.target.value) || 0))}
                                    className="w-20 px-2 py-1.5 border rounded text-sm"
                                    placeholder="0"
                                />
                                <span className="text-xs text-slate-500">days before notification time</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">
                                Shifts the lookback window earlier. Useful when source data is delayed.
                            </p>
                        </div>
                    )}
                  </div>
                </section>

                {/* DATA SOURCE */}
                <section className="space-y-3">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" /> Data Source
                    </h4>
                    
                    {/* Endpoint with Service Finder button */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            ArcGIS Feature Service Endpoint
                        </label>
                        <div className="flex gap-2">
                            <input 
                                value={formData.source?.endpoint || ''} 
                                onChange={e => handleSourceChange('endpoint', e.target.value)}
                                onBlur={() => validateAndFetchFields()}
                                placeholder="https://services.arcgis.com/.../FeatureServer/0"
                                className="flex-1 px-2 py-2 border rounded text-xs font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => setShowServiceFinder(true)}
                                className="px-3 py-2 bg-[#004E7C] text-white rounded text-xs flex items-center gap-1.5 hover:bg-[#003d61] transition-colors"
                                title="Browse services from ArcGIS"
                            >
                                <Search className="w-3.5 h-3.5" />
                                Find
                            </button>
                        </div>
                    </div>
                    
                    {/* Auth */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Username (optional)</label>
                        <input 
                            value={formData.source?.username || ''} 
                            onChange={e => handleSourceChange('username', e.target.value)}
                            className="w-full px-2 py-2 border rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Password (optional)</label>
                        <input 
                            type="password"
                            value={formData.source?.password || ''} 
                            onChange={e => handleSourceChange('password', e.target.value)}
                            className="w-full px-2 py-2 border rounded text-xs"
                        />
                      </div>
                    </div>

                    {/* Validate button */}
                    <button 
                        type="button"
                        onClick={() => validateAndFetchFields()}
                        disabled={isValidating || !formData.source?.endpoint}
                        className="w-full py-2 px-3 border border-[#004E7C] text-[#004E7C] rounded text-xs font-medium hover:bg-[#004E7C]/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isValidating && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isValidating ? 'Connecting...' : 'Test Connection & Load Fields'}
                    </button>

                    {/* Validation result */}
                    {validationResult && (
                        <div className={`p-2 rounded text-xs flex items-center gap-2 ${
                            validationResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 
                            'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {validationResult.type === 'success' ? (
                                <Check className="w-3.5 h-3.5" />
                            ) : (
                                <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            {validationResult.message}
                        </div>
                    )}
                </section>

                {/* DISPLAY FIELDS */}
                {availableFields.length > 0 && (
                    <section className="space-y-3">
                      <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                          <LayoutList className="w-4 h-4" /> Display Fields
                          <span className="text-xs text-slate-400 font-normal ml-1">
                              ({(formData.source?.displayFields || []).length} selected)
                          </span>
                      </h4>

                      {/* Selected fields with reorder and edit */}
                      {(formData.source?.displayFields || []).length > 0 && (
                          <div className="space-y-1 mb-3">
                              <label className="text-xs text-slate-500">Selected (click to edit formatting):</label>
                              <div className="space-y-1">
                                  {(formData.source?.displayFields || []).map((field, idx) => {
                                      const fieldInfo = getFieldInfo(field);
                                      const hasFormatting = typeof field !== 'string' && (field.format || field.decimals !== undefined);
                                      return (
                                          <div key={fieldInfo.field} className="flex items-center gap-2 bg-[#004E7C]/5 border border-[#004E7C]/20 rounded px-2 py-1.5">
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2">
                                                      <span className="text-xs font-mono text-[#004E7C]">{fieldInfo.field}</span>
                                                      {fieldInfo.label !== fieldInfo.field && (
                                                          <span className="text-[10px] text-slate-500">→ {fieldInfo.label}</span>
                                                      )}
                                                  </div>
                                                  {hasFormatting && (
                                                      <p className="text-[9px] text-slate-400 mt-0.5">
                                                          {field.format || 'auto'}
                                                          {field.decimals !== undefined && `, ${field.decimals} decimals`}
                                                          {field.currency && `, ${field.currency}`}
                                                      </p>
                                                  )}
                                              </div>
                                              <button
                                                  type="button"
                                                  onClick={() => setEditingField(field)}
                                                  className="p-0.5 text-slate-400 hover:text-[#004E7C] hover:bg-[#004E7C]/10 rounded"
                                                  title="Edit formatting"
                                              >
                                                  <Edit2 className="w-3 h-3" />
                                              </button>
                                              <button type="button" onClick={() => moveDisplayField(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                                  <ArrowUp className="w-3 h-3" />
                                              </button>
                                              <button type="button" onClick={() => moveDisplayField(idx, 'down')} disabled={idx === (formData.source?.displayFields || []).length - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                                                  <ArrowDown className="w-3 h-3" />
                                              </button>
                                              <button type="button" onClick={() => toggleDisplayField(fieldInfo.field)} className="p-0.5 text-red-400 hover:text-red-600">
                                                  <X className="w-3 h-3" />
                                              </button>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}

                      {/* Available fields */}
                      <div>
                          <label className="text-xs text-slate-500">Available fields:</label>
                          <div className="flex flex-wrap gap-1 mt-1 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded border">
                              {availableFields
                                  .filter(f => {
                                      const selectedFieldNames = (formData.source?.displayFields || []).map(df =>
                                          typeof df === 'string' ? df : df.field
                                      );
                                      return !selectedFieldNames.includes(f);
                                  })
                                  .map(field => (
                                      <button
                                          key={field}
                                          type="button"
                                          onClick={() => toggleDisplayField(field)}
                                          className="px-2 py-1 text-xs font-mono bg-white border rounded hover:bg-slate-100 hover:border-[#004E7C] transition-colors"
                                      >
                                          {field}
                                      </button>
                                  ))
                              }
                          </div>
                      </div>
                    </section>
                )}

                {/* QUERY FILTER */}
                <section className="space-y-3">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <ListFilter className="w-4 h-4" /> Query Filter
                    </h4>

                    {/* Mode Selection */}
                    <div className="grid grid-cols-3 gap-2">
                        {queryModes.map(mode => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => handleQueryModeChange(mode.id)}
                                className={`p-2 rounded border text-left transition-colors ${
                                    queryConfig.mode === mode.id 
                                        ? 'border-[#004E7C] bg-[#004E7C]/5 ring-1 ring-[#004E7C]' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="text-xs font-medium">{mode.label}</div>
                                <div className="text-[10px] text-slate-500">{mode.desc}</div>
                            </button>
                        ))}
                    </div>

                    {/* Simple Mode Rules */}
                    {queryConfig.mode === 'simple' && (
                        <div className="space-y-2 bg-slate-50 p-3 rounded border border-slate-200">
                            {/* Logic Toggle */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-600">Match</span>
                                <button
                                    type="button"
                                    onClick={toggleQueryLogic}
                                    className="px-3 py-1 text-xs font-medium rounded border border-slate-300 hover:bg-white"
                                >
                                    {queryConfig.logic === 'AND' ? 'ALL rules (AND)' : 'ANY rule (OR)'}
                                </button>
                            </div>

                            {/* Rules */}
                            {(queryConfig.rules || []).map((rule, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <select
                                        value={rule.field}
                                        onChange={e => updateQueryRule(idx, 'field', e.target.value)}
                                        className="flex-1 px-2 py-1.5 border rounded text-xs"
                                    >
                                        <option value="">Select field...</option>
                                        {availableFields.map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={rule.operator}
                                        onChange={e => updateQueryRule(idx, 'operator', e.target.value)}
                                        className="w-32 px-2 py-1.5 border rounded text-xs"
                                    >
                                        {operators.map(op => (
                                            <option key={op.value} value={op.value}>{op.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        value={rule.value}
                                        onChange={e => updateQueryRule(idx, 'value', e.target.value)}
                                        placeholder="value"
                                        className="flex-1 px-2 py-1.5 border rounded text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeQueryRule(idx)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addQueryRule}
                                className="w-full py-1.5 border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:border-[#004E7C] hover:text-[#004E7C]"
                            >
                                + Add Rule
                            </button>
                        </div>
                    )}

                    {/* Advanced Mode */}
                    {queryConfig.mode === 'advanced' && (
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500">WHERE clause:</label>
                            <textarea
                                value={queryConfig.advancedWhere || ''}
                                onChange={e => setFormData(prev => ({
                                    ...prev,
                                    source: {
                                        ...prev.source,
                                        queryConfig: { ...prev.source.queryConfig, advancedWhere: e.target.value }
                                    }
                                }))}
                                placeholder="STATUS = 'Active' AND MODIFIED_DATE > CURRENT_DATE - 7"
                                className="w-full px-3 py-2 border rounded text-xs font-mono h-20"
                            />
                        </div>
                    )}

                    {/* Generated WHERE preview & Test button */}
                    {queryConfig.mode !== 'none' && (
                        <div className="space-y-2">
                            <div className="p-2 bg-slate-100 rounded border border-slate-200">
                                <label className="text-[10px] text-slate-500 block mb-1">Generated WHERE:</label>
                                <code className="text-xs font-mono text-slate-700 break-all">
                                    {buildWhereClause()}
                                </code>
                            </div>

                            {/* Test Query Button */}
                            <button
                                type="button"
                                onClick={validateQuery}
                                disabled={isQueryValidating || !formData.source?.endpoint}
                                className="w-full py-2 px-3 border border-[#004E7C] text-[#004E7C] rounded text-xs font-medium hover:bg-[#004E7C]/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isQueryValidating && <Loader2 className="w-3 h-3 animate-spin" />}
                                <FlaskConical className="w-3 h-3" />
                                {isQueryValidating ? 'Testing...' : 'Test Query'}
                            </button>

                            {/* Query validation result */}
                            {queryValidationResult && (
                                <div className={`p-2 rounded text-xs flex items-center gap-2 ${
                                    queryValidationResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    queryValidationResult.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {queryValidationResult.type === 'success' ? <Check className="w-3.5 h-3.5" /> :
                                     queryValidationResult.type === 'warning' ? <AlertCircle className="w-3.5 h-3.5" /> :
                                     <AlertCircle className="w-3.5 h-3.5" />}
                                    {queryValidationResult.message}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* SPATIAL FILTER */}
                <section className={`space-y-3 ${isTable ? 'opacity-50' : ''}`}>
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <MapIcon className="w-4 h-4" /> Spatial Filter (Geofence)
                    </h4>
                    {isTable ? (
                        <p className="text-xs text-slate-500 italic">
                            Spatial filtering is not available for table services (no geometry).
                        </p>
                    ) : (
                        <>
                            <p className="text-xs text-slate-500">Optionally restrict notifications to a specific geographic area.</p>

                            <div className="flex items-center gap-3 mt-2">
                                <button 
                                    type="button"
                                    onClick={() => setShowSpatialFilter(true)}
                                    className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded flex items-center gap-2 hover:bg-slate-50 hover:text-[#004E7C] transition-colors shadow-sm"
                                >
                                    <MapIcon className="w-3 h-3" />
                                    {formData.source?.spatialFilter ? 'Edit Geofence' : 'Draw Geofence'}
                                </button>

                                {formData.source?.spatialFilter && (
                                    <>
                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            {formData.source.spatialFilter.type === 'circle' 
                                                ? `Circle: ${(formData.source.spatialFilter.radius / 1609.34).toFixed(1)} mi radius`
                                                : `Polygon: ${formData.source.spatialFilter.coordinates?.length || 0} points`
                                            }
                                            {formData.source.spatialFilter.buffer > 0 && 
                                                ` + ${(formData.source.spatialFilter.buffer / 1609.34).toFixed(1)} mi buffer`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clearSpatialFilter}
                                            className="text-xs text-red-500 hover:text-red-700"
                                        >
                                            Clear
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </section>

                {/* EMAIL TEMPLATE */}
                <section className="space-y-3">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Email Template
                  </h4>

                  {/* Template Type Selector */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Standard Template Option */}
                      <button
                        type="button"
                        onClick={() => handleTemplateTypeChange('standard')}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          templateType === 'standard'
                            ? 'border-[#004E7C] bg-[#004E7C]/5 ring-1 ring-[#004E7C]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-[#004E7C]" />
                          <span className="text-sm font-medium text-slate-800">Standard Template</span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Use the default CivQuest email design. Includes data table and CSV download.
                        </p>
                      </button>

                      {/* Custom Template Option */}
                      <button
                        type="button"
                        onClick={() => {
                          handleTemplateTypeChange('custom');
                          initializeCustomTemplate();
                        }}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          templateType === 'custom'
                            ? 'border-[#004E7C] bg-[#004E7C]/5 ring-1 ring-[#004E7C]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Palette className="w-4 h-4 text-[#004E7C]" />
                          <span className="text-sm font-medium text-slate-800">Custom Template</span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Design your own email with custom branding, statistics, and layout.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Standard Template Settings */}
                  {templateType === 'standard' && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                          <LayoutTemplate className="w-3.5 h-3.5" />
                          Email Template
                        </label>
                        {loadingTemplates ? (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading templates...
                          </div>
                        ) : (
                          <>
                            <select
                              value={selectedTemplateId}
                              onChange={(e) => handleTemplateSelect(e.target.value)}
                              className="w-full px-2 py-2 border border-slate-200 rounded text-xs bg-white"
                            >
                              <option value="">Default Template (Standard Layout)</option>
                              {emailTemplates.map(t => (
                                <option key={t.id} value={t.id}>
                                  {t.name} {t.category ? `(${t.category})` : ''}
                                </option>
                              ))}
                            </select>
                            {selectedTemplateId && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                <Check className="w-3 h-3" />
                                <span>Custom template selected: Uses {`{{placeholders}}`} for dynamic content</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Custom Template Settings */}
                  {templateType === 'custom' && (
                    <div className="bg-gradient-to-br from-[#004E7C]/5 to-[#0077B6]/5 p-3 rounded-lg border border-[#004E7C]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-800">Custom Template Designer</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {formData.customTemplate?.statistics?.length || 0} statistics configured
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCustomTemplateEditor(true)}
                          className="px-3 py-1.5 bg-[#004E7C] text-white rounded text-xs font-medium hover:bg-[#003d61] flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3 h-3" />
                          Open Designer
                        </button>
                      </div>

                      {formData.customTemplate && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <p className="text-[10px] text-slate-500 uppercase">Theme</p>
                            <div className="flex gap-1 mt-1">
                              <div
                                className="w-4 h-4 rounded border border-slate-200"
                                style={{ backgroundColor: formData.customTemplate.theme?.primaryColor || '#004E7C' }}
                                title="Primary Color"
                              />
                              <div
                                className="w-4 h-4 rounded border border-slate-200"
                                style={{ backgroundColor: formData.customTemplate.theme?.secondaryColor || '#f2f2f2' }}
                                title="Secondary Color"
                              />
                              <div
                                className="w-4 h-4 rounded border border-slate-200"
                                style={{ backgroundColor: formData.customTemplate.theme?.accentColor || '#0077B6' }}
                                title="Accent Color"
                              />
                            </div>
                          </div>
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <p className="text-[10px] text-slate-500 uppercase">Statistics</p>
                            <p className="text-sm font-bold text-[#004E7C]">
                              {formData.customTemplate.statistics?.length || 0}
                            </p>
                          </div>
                          <div className="p-2 bg-white rounded border border-slate-200">
                            <p className="text-[10px] text-slate-500 uppercase">CSV</p>
                            <p className="text-xs font-medium text-slate-700">
                              {formData.customTemplate.includeCSV !== false ? 'Included' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
                    <input
                        value={formData.message?.subject || ''}
                        onChange={e => setFormData(prev => ({
                            ...prev,
                            message: { ...prev.message, subject: e.target.value }
                        }))}
                        placeholder="New {{count}} records"
                        className="w-full px-2 py-2 border rounded text-xs"
                    />
                  </div>

                  {/* Intro */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {templateType === 'custom' || selectedTemplateId ? 'Email Intro (used as {{emailIntro}})' : 'Intro'}
                    </label>
                    <textarea
                        value={formData.message?.intro || ''}
                        onChange={e => setFormData(prev => ({
                            ...prev,
                            message: { ...prev.message, intro: e.target.value }
                        }))}
                        placeholder="Here are the latest updates..."
                        className="w-full px-2 py-2 border rounded text-xs h-16"
                    />
                    {(templateType === 'custom' || selectedTemplateId) && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        This text will be inserted where {`{{emailIntro}}`} appears in the template.
                      </p>
                    )}
                  </div>

                  {/* Zero State Message */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Zero State Message {(templateType === 'custom' || selectedTemplateId) && '(used as {{emailZeroStateMessage}})'}
                    </label>
                    <textarea
                        value={formData.emailZeroStateMessage || ''}
                        onChange={e => handleChange('emailZeroStateMessage', e.target.value)}
                        placeholder="No new records found for this period."
                        className="w-full px-2 py-2 border rounded text-xs h-12"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Shown when the notification runs but finds no records (requires "Send even if empty" enabled).
                    </p>
                  </div>
                </section>

            </div>

            {/* Footer */}
            <div className="p-4 border-t flex justify-end gap-2 bg-white sticky bottom-0">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">
                  Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-[#004E7C] text-white rounded text-sm font-medium flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save
              </button>
            </div>
        </form>
      </div>
    </div>
  );
}
