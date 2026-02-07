// src/admin/components/MapEditor.jsx
// Modal for editing individual Atlas map configurations
// Handles webmap settings, endpoint, columns, search fields, geocoder, export templates, and layer visibility
//
// LICENSE ENFORCEMENT: Enforces public/private visibility based on organization license
// - Professional: Private only (no public maps allowed)
// - Organization: Public or private allowed
//
// FEATURES:
// - Export Templates tab for selecting which export templates are available for this map
// - Feature Export Template selection (one per map)
// - Layers tab for configuring which layers are hidden from the Atlas layer list
//   (hidden layers remain functional but don't appear in the layers panel)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  EyeOff,
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
  RefreshCw,
  Sparkles,
  Bot,
  Copy
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

// Extract popup element names from a WebMap popupInfo object
const extractPopupElements = (popupInfo) => {
  if (!popupInfo) return [];

  const elements = [];

  // Use popupElements if available (newer WebMap format)
  if (popupInfo.popupElements && Array.isArray(popupInfo.popupElements)) {
    popupInfo.popupElements.forEach((el, index) => {
      let name = '';
      if (el.type === 'fields') {
        name = 'fields';
      } else if (el.type === 'expression') {
        const exprIdx = el.expressionInfoIndex;
        if (exprIdx != null && popupInfo.expressionInfos?.[exprIdx]) {
          name = popupInfo.expressionInfos[exprIdx].name ||
                 popupInfo.expressionInfos[exprIdx].title ||
                 `expression_${exprIdx}`;
        } else {
          name = `expression_${index}`;
        }
      } else if (el.type === 'text') {
        name = el.title || `text_${index}`;
      } else if (el.type === 'attachments') {
        name = 'attachments';
      } else if (el.type === 'media') {
        name = el.title || 'media';
      } else {
        name = el.title || el.type || `element_${index}`;
      }

      if (name) {
        elements.push({ name, type: el.type });
      }
    });
  }

  // Fallback: derive from expressionInfos and fieldInfos if no popupElements found
  if (elements.length === 0) {
    if (popupInfo.fieldInfos?.some(fi => fi.visible !== false)) {
      elements.push({ name: 'fields', type: 'fields' });
    }
    if (popupInfo.expressionInfos && Array.isArray(popupInfo.expressionInfos)) {
      popupInfo.expressionInfos.forEach(expr => {
        if (expr.name || expr.title) {
          elements.push({
            name: expr.name || expr.title,
            type: 'expression'
          });
        }
      });
    }
    if (popupInfo.showAttachments) {
      elements.push({ name: 'attachments', type: 'attachments' });
    }
  }

  return elements;
};

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
    // Hidden layers - array of layer IDs to hide from the layer list
    hiddenLayers: [],
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

  // AI prompt generation state
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Feature service fields state
  const [availableFields, setAvailableFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState(null);
  const [lastFetchedEndpoint, setLastFetchedEndpoint] = useState('');

  // WebMap layers state (for hidden layers configuration)
  const [webMapLayers, setWebMapLayers] = useState([]);
  const [webMapLayersLoading, setWebMapLayersLoading] = useState(false);
  const [webMapLayersError, setWebMapLayersError] = useState(null);
  const [lastFetchedWebMap, setLastFetchedWebMap] = useState('');

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

  // Fetch layers from WebMap for hidden layers configuration
  const fetchWebMapLayers = useCallback(async (portalUrl, itemId) => {
    if (!portalUrl || !itemId) {
      setWebMapLayers([]);
      setWebMapLayersError(null);
      return;
    }

    const webMapKey = `${portalUrl}|${itemId}`;

    // Don't refetch if we already have layers for this webmap
    if (webMapKey === lastFetchedWebMap && webMapLayers.length > 0) {
      return;
    }

    setWebMapLayersLoading(true);
    setWebMapLayersError(null);

    try {
      // Fetch the WebMap item data from ArcGIS
      const itemUrl = `${portalUrl}/sharing/rest/content/items/${itemId}/data?f=json`;
      const response = await fetch(itemUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch WebMap: ${response.status}`);
      }

      const webMapData = await response.json();

      if (webMapData.error) {
        throw new Error(webMapData.error.message || 'Error fetching WebMap data');
      }

      // Extract layers from the WebMap
      const extractedLayers = [];

      // Helper function to fetch sublayers from a MapServer
      const fetchMapServerSublayers = async (url, parentId, depth, webMapSublayers) => {
        try {
          // Fetch the MapServer metadata
          const mapServerUrl = `${url}?f=json`;
          const mapServerResponse = await fetch(mapServerUrl);
          if (!mapServerResponse.ok) return;

          const mapServerData = await mapServerResponse.json();
          if (mapServerData.error) return;

          // Process sublayers recursively
          const processSublayers = (layers, parentLayerId, currentDepth) => {
            if (!layers || !Array.isArray(layers)) return;

            layers.forEach(sublayer => {
              const sublayerId = `${parentLayerId}-${sublayer.id}`;
              // Find popup info from the WebMap JSON for this sublayer
              const webMapSublayer = webMapSublayers?.find(wsl => wsl.id === sublayer.id);
              extractedLayers.push({
                id: sublayerId,
                title: sublayer.name || `Sublayer ${sublayer.id}`,
                type: 'MapServer Sublayer',
                depth: currentDepth,
                popupElements: extractPopupElements(webMapSublayer?.popupInfo)
              });

              // Check for nested sublayers (group layers within MapServer)
              if (sublayer.subLayerIds && Array.isArray(sublayer.subLayerIds)) {
                const childLayers = layers.filter(l => sublayer.subLayerIds.includes(l.id));
                // We don't recurse into sublayers here because MapServer returns a flat list
                // with parent/child relationships via parentLayerId
              }
            });
          };

          if (mapServerData.layers) {
            processSublayers(mapServerData.layers, parentId, depth + 1);
          }
        } catch (err) {
          console.warn('Failed to fetch MapServer sublayers:', err);
        }
      };

      // Process operational layers
      if (webMapData.operationalLayers && Array.isArray(webMapData.operationalLayers)) {
        const processLayer = async (layer, depth = 0) => {
          const layerInfo = {
            id: layer.id,
            title: layer.title || layer.name || 'Untitled Layer',
            type: layer.layerType || 'unknown',
            depth,
            popupElements: extractPopupElements(layer.popupInfo)
          };
          extractedLayers.push(layerInfo);

          // Check if this is a MapServer layer and fetch its sublayers
          const isMapServer = layer.layerType === 'ArcGISMapServiceLayer' ||
                              (layer.url && layer.url.includes('/MapServer'));

          if (isMapServer && layer.url) {
            await fetchMapServerSublayers(layer.url, layer.id, depth, layer.layers);
          }

          // Process sublayers if present (for group layers)
          if (layer.layers && Array.isArray(layer.layers)) {
            for (const sublayer of layer.layers) {
              await processLayer(sublayer, depth + 1);
            }
          }
        };

        for (const layer of webMapData.operationalLayers) {
          await processLayer(layer);
        }
      }

      setWebMapLayers(extractedLayers);
      setLastFetchedWebMap(webMapKey);
      setWebMapLayersError(null);
    } catch (err) {
      console.error('Error fetching WebMap layers:', err);
      setWebMapLayersError(err.message || 'Failed to fetch WebMap layers');
      setWebMapLayers([]);
    } finally {
      setWebMapLayersLoading(false);
    }
  }, [lastFetchedWebMap, webMapLayers.length]);

  // Fetch WebMap layers when webMap config changes
  useEffect(() => {
    const portalUrl = mapConfig.webMap?.portalUrl;
    const itemId = mapConfig.webMap?.itemId;
    if (portalUrl && itemId) {
      const webMapKey = `${portalUrl}|${itemId}`;
      if (webMapKey !== lastFetchedWebMap) {
        fetchWebMapLayers(portalUrl, itemId);
      }
    }
  }, [mapConfig.webMap?.portalUrl, mapConfig.webMap?.itemId, lastFetchedWebMap, fetchWebMapLayers]);

  // Get available popup elements for the currently selected feature info layer
  const availablePopupElements = useMemo(() => {
    const selectedLayerId = mapConfig.customFeatureInfo?.layerId;
    if (!selectedLayerId || webMapLayers.length === 0) return [];
    const selectedLayer = webMapLayers.find(l => l.id === selectedLayerId);
    return selectedLayer?.popupElements || [];
  }, [mapConfig.customFeatureInfo?.layerId, webMapLayers]);

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
        { field: '', headerName: '', width: 150, sortable: true, filter: true, chatResults: false, fieldType: 'text' }
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

  // Hidden layers management
  const toggleHiddenLayer = (layerId) => {
    setMapConfig(prev => {
      const currentIds = prev.hiddenLayers || [];
      if (currentIds.includes(layerId)) {
        return { ...prev, hiddenLayers: currentIds.filter(id => id !== layerId) };
      } else {
        return { ...prev, hiddenLayers: [...currentIds, layerId] };
      }
    });
  };

  const hideAllLayers = () => {
    setMapConfig(prev => ({
      ...prev,
      hiddenLayers: webMapLayers.map(l => l.id)
    }));
  };

  const showAllLayers = () => {
    setMapConfig(prev => ({
      ...prev,
      hiddenLayers: []
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

  // Generate AI system prompt from map configuration
  const generateSystemPrompt = useCallback(async () => {
    setIsGeneratingPrompt(true);
    try {
      // Gather fields - use already-loaded availableFields, or fetch them
      let fields = availableFields;
      if (fields.length === 0 && mapConfig.endpoint) {
        try {
          const fetchUrl = mapConfig.endpoint.includes('?')
            ? `${mapConfig.endpoint}&f=json`
            : `${mapConfig.endpoint}?f=json`;
          let json;
          let response = await fetch(fetchUrl);
          if (response.ok) {
            json = await response.json();
          } else {
            const proxyResponse = await fetch(`${PROXY_BASE_URL}/arcgis/json`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: mapConfig.endpoint })
            });
            if (proxyResponse.ok) {
              json = await proxyResponse.json();
            }
          }
          if (json?.fields && Array.isArray(json.fields)) {
            fields = json.fields;
            setAvailableFields([...fields].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            setLastFetchedEndpoint(mapConfig.endpoint);
          }
        } catch (err) {
          console.warn('Could not fetch fields for prompt generation:', err);
        }
      }

      // Build field schema description
      const fieldLines = fields.map(f => {
        const alias = f.alias && f.alias !== f.name ? ` (alias: "${f.alias}")` : '';
        const type = f.type ? ` [${f.type.replace('esriFieldType', '')}]` : '';
        return `   - ${f.name}${alias}${type}`;
      });

      // Identify key field types
      const dateFields = fields.filter(f => f.type === 'esriFieldTypeDate');
      const numericFields = fields.filter(f =>
        f.type === 'esriFieldTypeDouble' ||
        f.type === 'esriFieldTypeSingle' ||
        f.type === 'esriFieldTypeInteger' ||
        f.type === 'esriFieldTypeSmallInteger'
      );
      const textFields = fields.filter(f => f.type === 'esriFieldTypeString');
      const oidField = fields.find(f => f.type === 'esriFieldTypeOID');

      // Build search fields context
      const searchFieldLines = (mapConfig.searchFields || []).map(sf =>
        `   - ${sf.field} ("${sf.label || sf.field}", type: ${sf.type || 'text'})`
      );

      // Build table columns context
      const tableColumnLines = (mapConfig.tableColumns || []).map(col =>
        `   - ${col.field} ("${col.headerName || col.field}", display: ${col.fieldType || 'text'}${col.chatResults ? ', shown in chat' : ''})`
      );

      // Build autocomplete context
      const autocompleteLines = (mapConfig.autocomplete || []).map(ac =>
        `   - ${ac.type}: field=${ac.field}, label="${ac.label || ''}"${ac.pattern ? `, pattern=${ac.pattern}` : ''}`
      );

      // Detect potential address fields
      const addressFields = fields.filter(f =>
        /address|addr|street|location/i.test(f.name) ||
        /address|addr|street|location/i.test(f.alias || '')
      );

      // Detect potential ID fields
      const idFields = fields.filter(f =>
        /parcel|pin|pid|folio|account|id$/i.test(f.name) && f.type !== 'esriFieldTypeOID'
      );

      // Generate the prompt
      const mapName = mapConfig.name || 'this map';
      let prompt = `You are a SQL translator for an ArcGIS Feature Service powering the "${mapName}" map.\n\n`;

      // Special rules for detected patterns
      if (idFields.length > 0) {
        const idField = idFields[0];
        const sampleLength = idField.length || 13;
        prompt += `**SPECIAL RULE: ID DETECTION**\n`;
        prompt += `If the user input appears to be a record ID or parcel number (a numeric or alphanumeric identifier), do NOT generate SQL.\n`;
        prompt += `Instead, return JSON: { "parcelId": "The ID String" }\n`;
        prompt += `Likely ID field: ${idField.name}${idField.alias ? ` ("${idField.alias}")` : ''}\n\n`;
      }

      if (addressFields.length > 0) {
        prompt += `**SPECIAL RULE: ADDRESS DETECTION**\n`;
        prompt += `If the user input is a specific street address (e.g. "306 Cedar Road", "123 Main St"), do NOT generate SQL.\n`;
        prompt += `Instead, return JSON: { "address": "The Normalized Address String" }\n`;
        prompt += `Address field(s): ${addressFields.map(f => f.name).join(', ')}\n\n`;
      }

      prompt += `**STANDARD RULE: SQL GENERATION**\n`;
      prompt += `If the input is a question about data, convert English to a valid SQL 'WHERE' clause.\n\n`;

      prompt += `CRITICAL SYNTAX RULES:\n`;
      prompt += `1. **STRICT SCHEMA**: You MUST ONLY use fields from the schema below. Never invent field names.\n\n`;

      if (dateFields.length > 0) {
        prompt += `2. **DATES & TIMEZONES**:\n`;
        prompt += `   - ArcGIS data is stored in GMT.\n`;
        prompt += `   - SYNTAX: timestamp 'YYYY-MM-DD HH:MM:SS'\n`;
        prompt += `   - For specific dates, create a range covering the full GMT window.\n`;
        prompt += `   - Date fields: ${dateFields.map(f => f.name).join(', ')}\n\n`;
      }

      if (textFields.length > 0) {
        prompt += `${dateFields.length > 0 ? '3' : '2'}. **TEXT MATCHING**:\n`;
        prompt += `   - ALWAYS use 'LIKE' with wildcards (%) for text comparisons, never '='.\n`;
        prompt += `   - Text fields are stored in UPPERCASE. Convert user input to uppercase.\n`;
        prompt += `   - CORRECT: FIELDNAME LIKE '%SEARCH TERM%'\n`;
        prompt += `   - WRONG: FIELDNAME = 'Search Term'\n\n`;
      }

      if (addressFields.length > 0) {
        const ruleNum = 2 + (dateFields.length > 0 ? 1 : 0) + (textFields.length > 0 ? 1 : 0);
        prompt += `${ruleNum}. **ADDRESS NORMALIZATION**:\n`;
        prompt += `   - Use standard postal abbreviations in SQL strings:\n`;
        prompt += `   - Boulevard -> BLVD, Street -> ST, Road -> RD, Avenue -> AVE\n`;
        prompt += `   - Drive -> DR, Court -> CT, Lane -> LN, Parkway -> PKWY\n`;
        prompt += `   - Highway -> HWY, Cove -> CV, Way -> WY\n\n`;
      }

      const nextRule = 2 + (dateFields.length > 0 ? 1 : 0) + (textFields.length > 0 ? 1 : 0) + (addressFields.length > 0 ? 1 : 0);

      prompt += `${nextRule}. **LIMITS & SORTING**:\n`;
      prompt += `   - If user asks for "Top 5", "10 most expensive", etc., extract that number as 'limit'.\n`;
      prompt += `   - Ensure 'orderBy' matches the intent.\n`;
      prompt += `   - If no limit is specified, set 'limit' to null.\n\n`;

      prompt += `${nextRule + 1}. **SMART QUERYING**:\n`;
      prompt += `   - Infer reasonable filters from context.\n`;
      prompt += `   - If user implies a monetary transaction, consider filtering out zero/null amounts.\n\n`;

      // Field schema
      prompt += `AVAILABLE FIELDS SCHEMA:\n`;
      if (fieldLines.length > 0) {
        prompt += fieldLines.join('\n') + '\n\n';
      } else {
        prompt += `   (No fields loaded - configure the feature service endpoint first)\n\n`;
      }

      // Search fields context
      if (searchFieldLines.length > 0) {
        prompt += `CONFIGURED SEARCH FIELDS:\n`;
        prompt += searchFieldLines.join('\n') + '\n\n';
      }

      // Output format
      prompt += `OUTPUT FORMAT:\n`;
      prompt += `Return JSON: { "where": "SQL_WHERE_CLAUSE", "orderBy": "FIELD_NAME ASC/DESC", "limit": INTEGER_OR_NULL }`;
      if (addressFields.length > 0) {
        prompt += ` OR { "address": "Address String" }`;
      }
      if (idFields.length > 0) {
        prompt += ` OR { "parcelId": "ID String" }`;
      }
      prompt += `\n`;

      updateField('systemPrompt', prompt);
    } catch (err) {
      console.error('Error generating system prompt:', err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [mapConfig, availableFields, updateField]);

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

  // Tab definitions - now includes Feature Info, Layers, and Export tabs
  const tabs = [
    { id: 'basic', label: 'Basic', icon: Settings },
    { id: 'data', label: 'Data Source', icon: Link2 },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'table', label: 'Table', icon: Table2 },
    { id: 'geocoder', label: 'Geocoder', icon: MapPin },
    { id: 'layers', label: 'Layers', icon: Layers },
    { id: 'featureInfo', label: 'Feature Info', icon: LayoutList },
    { id: 'export', label: 'Export', icon: Printer },
    { id: 'aiPrompt', label: 'AI Prompt', icon: Bot }
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
                      <div className="col-span-2">Field</div>
                      <div className="col-span-2">Header</div>
                      <div className="col-span-2">Type</div>
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
                        <div className="col-span-2">
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
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={col.headerName}
                            onChange={(e) => updateTableColumn(idx, 'headerName', e.target.value)}
                            placeholder="Column Header"
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                          />
                        </div>
                        <div className="col-span-2">
                          <select
                            value={col.fieldType || 'text'}
                            onChange={(e) => updateTableColumn(idx, 'fieldType', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded bg-white"
                            title="Display format for this field"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="currency">Currency</option>
                            <option value="date">Date</option>
                          </select>
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

          {/* Layers Tab - Hidden Layers Configuration */}
          {activeTab === 'layers' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Layers className="w-5 h-5" />
                <h3 className="font-semibold">Layer Visibility</h3>
              </div>

              <p className="text-sm text-slate-600">
                Select layers to hide from the Atlas layer list. Hidden layers remain functional for
                operations and display but won't appear in the layers panel for end users.
              </p>

              {/* WebMap Configuration Required Notice */}
              {(!mapConfig.webMap?.portalUrl || !mapConfig.webMap?.itemId) ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800">WebMap Configuration Required</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Configure a WebMap in the Data Source tab to load and manage layer visibility.
                        You need to set both the Portal URL and WebMap Item ID.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Loading State */}
                  {webMapLayersLoading && (
                    <div className="flex items-center gap-2 text-slate-500 py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading layers from WebMap...</span>
                    </div>
                  )}

                  {/* Error State */}
                  {webMapLayersError && !webMapLayersLoading && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-red-800">Failed to Load Layers</h4>
                          <p className="text-sm text-red-700 mt-1">{webMapLayersError}</p>
                          <button
                            type="button"
                            onClick={() => fetchWebMapLayers(mapConfig.webMap?.portalUrl, mapConfig.webMap?.itemId)}
                            className="mt-2 text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Layers List */}
                  {!webMapLayersLoading && !webMapLayersError && webMapLayers.length === 0 && (
                    <div className="text-center py-6 text-slate-400">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No layers found in WebMap</p>
                      <button
                        type="button"
                        onClick={() => fetchWebMapLayers(mapConfig.webMap?.portalUrl, mapConfig.webMap?.itemId)}
                        className="mt-2 text-sm hover:underline flex items-center gap-1 mx-auto"
                        style={{ color: accentColor }}
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh Layers
                      </button>
                    </div>
                  )}

                  {!webMapLayersLoading && webMapLayers.length > 0 && (
                    <>
                      {/* Header with selection info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">
                            {(mapConfig.hiddenLayers || []).length} of {webMapLayers.length} layers hidden
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={showAllLayers}
                            className="text-xs text-slate-600 hover:text-slate-800 underline"
                          >
                            Show All
                          </button>
                          <button
                            type="button"
                            onClick={hideAllLayers}
                            className="text-xs text-slate-600 hover:text-slate-800 underline"
                          >
                            Hide All
                          </button>
                          <button
                            type="button"
                            onClick={() => fetchWebMapLayers(mapConfig.webMap?.portalUrl, mapConfig.webMap?.itemId)}
                            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                            title="Refresh layer list"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Info note */}
                      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>
                          Layers marked as hidden will not appear in the layers panel but remain active
                          in the map. Users can still see features and interact with hidden layers.
                        </p>
                      </div>

                      {/* Layer list */}
                      <div className="space-y-1 max-h-[350px] overflow-y-auto border border-slate-200 rounded-lg">
                        {webMapLayers.map(layer => {
                          const isHidden = (mapConfig.hiddenLayers || []).includes(layer.id);

                          return (
                            <label
                              key={layer.id}
                              className={`
                                flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                                ${isHidden
                                  ? 'bg-slate-100 hover:bg-slate-150'
                                  : 'bg-white hover:bg-slate-50'}
                                ${layer.depth > 0 ? 'border-l-2 border-slate-200' : ''}
                              `}
                              style={{ paddingLeft: `${12 + layer.depth * 16}px` }}
                            >
                              <input
                                type="checkbox"
                                checked={isHidden}
                                onChange={() => toggleHiddenLayer(layer.id)}
                                className="sr-only"
                              />

                              <div
                                className={`
                                  w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                  ${isHidden
                                    ? 'border-slate-400 bg-slate-400'
                                    : 'border-slate-300 bg-white'}
                                `}
                              >
                                {isHidden && <EyeOff className="w-3 h-3 text-white" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm truncate ${isHidden ? 'text-slate-500' : 'text-slate-700'}`}>
                                    {layer.title}
                                  </span>
                                  {isHidden && (
                                    <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 truncate font-mono">
                                  {layer.id}
                                </p>
                              </div>

                              {isHidden ? (
                                <EyeOff className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              ) : (
                                <Eye className="w-4 h-4 text-slate-300 flex-shrink-0" />
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {/* Summary of hidden layers */}
                      {(mapConfig.hiddenLayers || []).length > 0 && (
                        <div className="pt-3 border-t border-slate-200">
                          <span className="text-xs text-slate-500 uppercase font-medium">Hidden Layers</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(mapConfig.hiddenLayers || []).map(id => {
                              const layer = webMapLayers.find(l => l.id === id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded"
                                >
                                  <EyeOff className="w-3 h-3" />
                                  {layer?.title || id}
                                  <button
                                    type="button"
                                    onClick={() => toggleHiddenLayer(id)}
                                    className="ml-1 hover:text-slate-800"
                                    title="Show this layer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
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
                {webMapLayersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading layers from WebMap...
                  </div>
                ) : webMapLayers.length > 0 ? (
                  <select
                    value={mapConfig.customFeatureInfo?.layerId || ''}
                    onChange={(e) => updateCustomFeatureInfo('layerId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                  >
                    <option value="">-- Select a layer --</option>
                    {webMapLayers.map(layer => (
                      <option key={layer.id} value={layer.id}>
                        {'\u00A0\u00A0'.repeat(layer.depth || 0)}{layer.title} ({layer.id})
                      </option>
                    ))}
                    {/* Preserve existing value if not in list */}
                    {mapConfig.customFeatureInfo?.layerId &&
                     !webMapLayers.find(l => l.id === mapConfig.customFeatureInfo.layerId) && (
                      <option value={mapConfig.customFeatureInfo.layerId}>
                        {mapConfig.customFeatureInfo.layerId} (not found in WebMap)
                      </option>
                    )}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={mapConfig.customFeatureInfo?.layerId || ''}
                      onChange={(e) => updateCustomFeatureInfo('layerId', e.target.value)}
                      placeholder="e.g., 194f67ad7e3-layer-42"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                    />
                    {webMapLayersError ? (
                      <p className="mt-1 text-xs text-amber-500">
                        Could not load layers: {webMapLayersError}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Configure a WebMap to select from available layers
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  The layer for features that should display custom tabs
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
                                  {availablePopupElements.length > 0 ? (
                                    <select
                                      value={element}
                                      onChange={(e) => updateFeatureInfoTabElement(tabIdx, elIdx, e.target.value)}
                                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                    >
                                      <option value="">-- Select element --</option>
                                      {availablePopupElements.map(pe => (
                                        <option key={pe.name} value={pe.name}>
                                          {pe.name} ({pe.type})
                                        </option>
                                      ))}
                                      {element && !availablePopupElements.find(pe => pe.name === element) && (
                                        <option value={element}>{element} (custom)</option>
                                      )}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={element}
                                      onChange={(e) => updateFeatureInfoTabElement(tabIdx, elIdx, e.target.value)}
                                      placeholder="Element name"
                                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                    />
                                  )}
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
                            {availablePopupElements.length > 0 ? (
                              <select
                                value={element}
                                onChange={(e) => updateFeatureInfoExportElement(idx, e.target.value)}
                                className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                              >
                                <option value="">-- Select element --</option>
                                {availablePopupElements.map(pe => (
                                  <option key={pe.name} value={pe.name}>
                                    {pe.name} ({pe.type})
                                  </option>
                                ))}
                                {element && !availablePopupElements.find(pe => pe.name === element) && (
                                  <option value={element}>{element} (custom)</option>
                                )}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={element}
                                onChange={(e) => updateFeatureInfoExportElement(idx, e.target.value)}
                                placeholder="Element name"
                                className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                              />
                            )}
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

          {/* AI Prompt Tab */}
          {activeTab === 'aiPrompt' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Bot className="w-5 h-5" />
                <h3 className="font-semibold">AI System Prompt</h3>
              </div>

              <p className="text-sm text-slate-600">
                Configure the AI system prompt for this map. This prompt is used for AI query translation
                to convert natural language queries into SQL.
              </p>

              {/* Auto-generate button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateSystemPrompt}
                  disabled={isGeneratingPrompt}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPrompt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
                  )}
                  {isGeneratingPrompt ? 'Generating...' : 'Auto-Generate from Map Config'}
                </button>
                {mapConfig.systemPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(mapConfig.systemPrompt);
                    }}
                    className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm text-slate-600"
                    title="Copy prompt to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                )}
              </div>

              {/* Prompt info when fields are available */}
              {availableFields.length > 0 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {availableFields.length} service fields available for prompt generation
                </p>
              )}
              {!mapConfig.endpoint && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Configure a feature service endpoint in the Data Source tab for better prompt generation
                </p>
              )}

              {/* System prompt textarea */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  System Prompt (for AI Query Translation)
                </label>
                <textarea
                  value={mapConfig.systemPrompt || ''}
                  onChange={(e) => updateField('systemPrompt', e.target.value)}
                  placeholder="Instructions for AI to translate natural language to SQL for this map's feature service..."
                  rows={16}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm font-mono"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-400">
                    {mapConfig.systemPrompt ? `${mapConfig.systemPrompt.length} characters` : 'No prompt configured'}
                  </p>
                  {mapConfig.systemPrompt && (
                    <button
                      type="button"
                      onClick={() => updateField('systemPrompt', '')}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
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
