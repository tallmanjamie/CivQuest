// src/admin/components/AtlasSettingsEditor.jsx
// Modal for editing Atlas general settings (UI, messages, basemaps)
// Similar pattern to NotificationEditor but for Atlas configuration
//
// UPDATES:
// - Supports custom hex colors for theme
// - Shows image previews for logos/avatar
// - Blank text fields = element hidden in Atlas

import React, { useState } from 'react';
import {
  X,
  Save,
  Palette,
  MessageSquare,
  Globe,
  Image,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  ArrowUpFromLine,
  ArrowDownToLine,
  Lightbulb,
  Eye,
  EyeOff,
  Shield,
  Code,
  Link,
  CheckSquare,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Video,
  FileImage,
  Tag,
  Type,
  Search,
  ChevronDown,
  ChevronRight,
  Info,
  LayoutGrid,
  AlignVerticalJustifyStart,
  AlignHorizontalJustifyStart,
  MoveHorizontal,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  FileSpreadsheet,
  FileText,
  FileArchive,
  MessageCircle,
  Map,
  Table2
} from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { isHttpUrl } from '../../shared/utils/urlSecurity';

/**
 * Helper to check if a string is a valid hex color
 */
function isValidHex(color) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Image Preview Component
 */
function ImagePreview({ url, label, onClear }) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!url) {
    return (
      <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs">
        No image
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        )}
        {error ? (
          <div className="text-red-400 text-xs text-center px-2">
            <AlertCircle className="w-5 h-5 mx-auto mb-1" />
            Failed to load
          </div>
        ) : (
          <img 
            src={url} 
            alt={label}
            onLoad={() => setLoading(false)}
            onError={() => { setError(true); setLoading(false); }}
            className={`max-w-full max-h-full object-contain ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          />
        )}
      </div>
      {url && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title="Remove image"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/**
 * AtlasSettingsEditor Modal
 */
export default function AtlasSettingsEditor({ 
  data, 
  onClose, 
  onSave,
  accentColor = '#004E7C'
}) {
  // Clone the data to avoid mutating props
  const [config, setConfig] = useState(() => ({
    ui: {
      title: '',
      headerTitle: '',
      headerSubtitle: '',
      headerClass: 'bg-sky-700',
      logoLeft: '',
      logoRight: '',
      botAvatar: '',
      themeColor: 'sky',
      defaultMode: 'chat',
      searchBarPosition: 'top',
      searchPlaceholder: '',
      defaultSearchBarSize: 'medium',  // Default search bar size for org users
      chatWindowPlacement: 'bottom',  // Chat window placement (top or bottom)
      // Map tools position and layout
      mapToolsPosition: 'upper-left',
      mapToolsLayout: 'stacked',
      // Info popup configuration
      info: {
        enabled: false,
        text: '',
        logo: '',
        buttons: [],
        ...data?.ui?.info
      },
      // Header links configuration
      links: {
        enabled: false,
        layout: 'horizontal',
        items: [],
        ...data?.ui?.links
      },
      ...data?.ui
    },
    messages: {
      welcomeTitle: '',
      welcomeText: '',
      exampleQuestions: [],
      importantNote: '',
      searchTip: '',
      ...data?.messages
    },
    disclaimer: {
      enabled: false,
      title: 'Notice',
      width: '600',
      widthUnit: 'px',
      height: '400',
      heightUnit: 'px',
      contentMode: 'html',
      htmlContent: '',
      embedUrl: '',
      confirmationType: 'confirmation',
      checkboxText: 'I agree to the terms and conditions',
      buttonText: 'Continue',
      ...data?.disclaimer
    },
    basemaps: data?.basemaps || [{ label: 'Default', id: 'default', type: 'esri' }],
    data: {
      systemPrompt: '',
      maxRecordCount: 1000,
      timeZoneOffset: -5,
      defaultSort: '',
      autocompleteMaxResults: 100,
      ...data?.data
    },
    helpDocumentation: data?.helpDocumentation || [],
    useGlobalHelp: data?.useGlobalHelp !== false,  // Default to true
    supplementGlobalHelp: data?.supplementGlobalHelp || false,  // Use global + org-specific
    customHelpModeText: data?.customHelpModeText || '',  // Custom text for help mode display
    // ArcGIS Portal URL for organization authentication
    arcgisPortalUrl: data?.arcgisPortalUrl || '',
    // Export options configuration
    exportOptions: {
      chatSearchResults: {
        csv: true,
        pdf: true,
        shp: true
      },
      searchResultsPanel: {
        csv: true,
        shp: true
      },
      mapMarkup: {
        csv: true,
        shp: true
      },
      tableMode: {
        csv: true,
        shp: true
      },
      ...data?.exportOptions
    }
  }));

  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState('ui');
  const [expandedSections, setExpandedSections] = useState({
    ui: true,
    messages: true,
    disclaimer: false,
    basemaps: false,
    helpDocumentation: true,  // Expanded by default so users can see the new feature
    data: false
  });

  // State for disclaimer HTML preview
  const [showDisclaimerPreview, setShowDisclaimerPreview] = useState(false);

  // Custom hex color input
  const [customHexInput, setCustomHexInput] = useState(
    isValidHex(config.ui.themeColor) ? config.ui.themeColor : ''
  );

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Tab definitions
  const tabs = [
    { id: 'ui', label: 'User Interface', icon: Palette },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'disclaimer', label: 'Disclaimer', icon: Shield },
    { id: 'basemaps', label: 'Basemaps', icon: Globe },
    { id: 'exports', label: 'Exports', icon: Download },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'help', label: 'Help', icon: BookOpen },
    { id: 'advanced', label: 'Advanced', icon: HelpCircle }
  ];

  // Update UI field
  const updateUI = (field, value) => {
    setConfig(prev => ({
      ...prev,
      ui: { ...prev.ui, [field]: value }
    }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  // Update messages field
  const updateMessages = (field, value) => {
    setConfig(prev => ({
      ...prev,
      messages: { ...prev.messages, [field]: value }
    }));
  };

  // Update data field
  const updateData = (field, value) => {
    setConfig(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value }
    }));
  };

  // Update export options
  const updateExportOption = (category, format, value) => {
    setConfig(prev => ({
      ...prev,
      exportOptions: {
        ...prev.exportOptions,
        [category]: {
          ...prev.exportOptions[category],
          [format]: value
        }
      }
    }));
  };

  // Update disclaimer field
  const updateDisclaimer = (field, value) => {
    setConfig(prev => ({
      ...prev,
      disclaimer: { ...prev.disclaimer, [field]: value }
    }));
  };

  // Update info popup field
  const updateInfo = (field, value) => {
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        info: { ...prev.ui.info, [field]: value }
      }
    }));
  };

  // Info popup button handlers
  const addInfoButton = () => {
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        info: {
          ...prev.ui.info,
          buttons: [...(prev.ui.info.buttons || []), { label: '', url: '' }]
        }
      }
    }));
  };

  const updateInfoButton = (index, field, value) => {
    const updated = [...(config.ui.info.buttons || [])];
    updated[index] = { ...updated[index], [field]: value };
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        info: { ...prev.ui.info, buttons: updated }
      }
    }));
  };

  const removeInfoButton = (index) => {
    const updated = (config.ui.info.buttons || []).filter((_, i) => i !== index);
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        info: { ...prev.ui.info, buttons: updated }
      }
    }));
  };

  // Update header links field
  const updateLinks = (field, value) => {
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        links: { ...prev.ui.links, [field]: value }
      }
    }));
  };

  // Header link handlers
  const addHeaderLink = () => {
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        links: {
          ...prev.ui.links,
          items: [...(prev.ui.links.items || []), { label: '', url: '' }]
        }
      }
    }));
  };

  const updateHeaderLink = (index, field, value) => {
    const updated = [...(config.ui.links.items || [])];
    updated[index] = { ...updated[index], [field]: value };
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        links: { ...prev.ui.links, items: updated }
      }
    }));
  };

  const removeHeaderLink = (index) => {
    const updated = (config.ui.links.items || []).filter((_, i) => i !== index);
    setConfig(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        links: { ...prev.ui.links, items: updated }
      }
    }));
  };

  // Example questions
  const addExampleQuestion = () => {
    setConfig(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        exampleQuestions: [...(prev.messages.exampleQuestions || []), '']
      }
    }));
  };

  const updateExampleQuestion = (index, value) => {
    const updated = [...config.messages.exampleQuestions];
    updated[index] = value;
    setConfig(prev => ({
      ...prev,
      messages: { ...prev.messages, exampleQuestions: updated }
    }));
  };

  const removeExampleQuestion = (index) => {
    const updated = config.messages.exampleQuestions.filter((_, i) => i !== index);
    setConfig(prev => ({
      ...prev,
      messages: { ...prev.messages, exampleQuestions: updated }
    }));
  };

  // Basemaps
  const addBasemap = () => {
    setConfig(prev => ({
      ...prev,
      basemaps: [...prev.basemaps, { 
        label: 'New Basemap', 
        id: `basemap_${Date.now()}`, 
        type: 'esri' 
      }]
    }));
  };

  const updateBasemap = (index, field, value) => {
    const updated = [...config.basemaps];
    updated[index] = { ...updated[index], [field]: value };
    setConfig(prev => ({ ...prev, basemaps: updated }));
  };

  const removeBasemap = (index) => {
    if (config.basemaps.length <= 1) return;
    const updated = config.basemaps.filter((_, i) => i !== index);
    setConfig(prev => ({ ...prev, basemaps: updated }));
  };

  // Help Documentation handlers
  const addHelpDoc = () => {
    setConfig(prev => ({
      ...prev,
      helpDocumentation: [...prev.helpDocumentation, {
        id: `help_${Date.now()}`,
        title: '',
        content: '',
        tags: [],
        media: [],
        links: []
      }]
    }));
  };

  const updateHelpDoc = (index, field, value) => {
    const updated = [...config.helpDocumentation];
    updated[index] = { ...updated[index], [field]: value };
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const removeHelpDoc = (index) => {
    const updated = config.helpDocumentation.filter((_, i) => i !== index);
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const addHelpDocTag = (docIndex, tag) => {
    if (!tag.trim()) return;
    const updated = [...config.helpDocumentation];
    const currentTags = updated[docIndex].tags || [];
    if (!currentTags.includes(tag.trim())) {
      updated[docIndex] = { ...updated[docIndex], tags: [...currentTags, tag.trim()] };
      setConfig(prev => ({ ...prev, helpDocumentation: updated }));
    }
  };

  const removeHelpDocTag = (docIndex, tagIndex) => {
    const updated = [...config.helpDocumentation];
    updated[docIndex].tags = updated[docIndex].tags.filter((_, i) => i !== tagIndex);
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const addHelpDocMedia = (docIndex) => {
    const updated = [...config.helpDocumentation];
    const currentMedia = updated[docIndex].media || [];
    updated[docIndex] = {
      ...updated[docIndex],
      media: [...currentMedia, {
        id: `media_${Date.now()}`,
        type: 'image',
        url: '',
        title: '',
        thumbnail: '',
        tags: []
      }]
    };
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const updateHelpDocMedia = (docIndex, mediaIndex, field, value) => {
    const updated = [...config.helpDocumentation];
    updated[docIndex].media[mediaIndex] = { ...updated[docIndex].media[mediaIndex], [field]: value };
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const removeHelpDocMedia = (docIndex, mediaIndex) => {
    const updated = [...config.helpDocumentation];
    updated[docIndex].media = updated[docIndex].media.filter((_, i) => i !== mediaIndex);
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const addMediaTag = (docIndex, mediaIndex, tag) => {
    if (!tag.trim()) return;
    const updated = [...config.helpDocumentation];
    const currentTags = updated[docIndex].media[mediaIndex].tags || [];
    if (!currentTags.includes(tag.trim())) {
      updated[docIndex].media[mediaIndex].tags = [...currentTags, tag.trim()];
      setConfig(prev => ({ ...prev, helpDocumentation: updated }));
    }
  };

  const removeMediaTag = (docIndex, mediaIndex, tagIndex) => {
    const updated = [...config.helpDocumentation];
    updated[docIndex].media[mediaIndex].tags = updated[docIndex].media[mediaIndex].tags.filter((_, i) => i !== tagIndex);
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  // Help Documentation link handlers (external links tied to specific articles)
  const addHelpDocLink = (docIndex) => {
    const updated = [...config.helpDocumentation];
    const currentLinks = updated[docIndex].links || [];
    updated[docIndex] = {
      ...updated[docIndex],
      links: [...currentLinks, {
        id: `link_${Date.now()}`,
        title: '',
        url: '',
        description: ''
      }]
    };
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const updateHelpDocLink = (docIndex, linkIndex, field, value) => {
    const updated = [...config.helpDocumentation];
    updated[docIndex].links[linkIndex] = { ...updated[docIndex].links[linkIndex], [field]: value };
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  const removeHelpDocLink = (docIndex, linkIndex) => {
    const updated = [...config.helpDocumentation];
    updated[docIndex].links = updated[docIndex].links.filter((_, i) => i !== linkIndex);
    setConfig(prev => ({ ...prev, helpDocumentation: updated }));
  };

  // Handle custom hex color
  const handleCustomHexChange = (value) => {
    setCustomHexInput(value);
    if (isValidHex(value)) {
      updateUI('themeColor', value);
    }
  };

  // Validate and save
  const handleSave = () => {
    const newErrors = {};
    
    if (!config.ui.title?.trim()) {
      newErrors.title = 'Site title is required';
    }
    if (!config.ui.headerTitle?.trim()) {
      newErrors.headerTitle = 'Header title is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Clean up empty example questions
    const cleanConfig = {
      ...config,
      messages: {
        ...config.messages,
        exampleQuestions: config.messages.exampleQuestions.filter(q => q.trim())
      }
    };

    onSave(cleanConfig);
  };

  // Theme color options (removed red)
  const themeColors = [
    { id: 'sky', label: 'Sky Blue', hex: '#0ea5e9' },
    { id: 'blue', label: 'Blue', hex: '#3b82f6' },
    { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
    { id: 'purple', label: 'Purple', hex: '#a855f7' },
    { id: 'emerald', label: 'Emerald', hex: '#10b981' },
    { id: 'teal', label: 'Teal', hex: '#14b8a6' },
    { id: 'amber', label: 'Amber', hex: '#f59e0b' },
    { id: 'orange', label: 'Orange', hex: '#f97316' },
    { id: 'rose', label: 'Rose', hex: '#f43f5e' },
    { id: 'slate', label: 'Slate', hex: '#64748b' }
  ];

  // Check if current theme is a custom hex
  const isCustomHex = isValidHex(config.ui.themeColor) && 
    !themeColors.find(c => c.id === config.ui.themeColor);

  // Search bar position options
  const searchBarPositions = [
    { id: 'top', label: 'Top', icon: ArrowUpFromLine },
    { id: 'bottom', label: 'Bottom', icon: ArrowDownToLine }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Palette className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Atlas Settings</h2>
              <p className="text-sm text-slate-500">Configure UI, messages, and basemaps</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
          {/* UI Tab */}
          {activeTab === 'ui' && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Site Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.ui.title}
                  onChange={(e) => updateUI('title', e.target.value)}
                  placeholder="CivQuest Atlas"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 ${
                    errors.title ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-sky-500'
                  }`}
                />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Header Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.ui.headerTitle}
                  onChange={(e) => updateUI('headerTitle', e.target.value)}
                  placeholder="Organization Name"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 ${
                    errors.headerTitle ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-sky-500'
                  }`}
                />
                {errors.headerTitle && <p className="text-xs text-red-500 mt-1">{errors.headerTitle}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  Header Subtitle
                  {!config.ui.headerSubtitle && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Hidden if empty
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={config.ui.headerSubtitle}
                  onChange={(e) => updateUI('headerSubtitle', e.target.value)}
                  placeholder="Leave empty to hide"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Default Mode
                </label>
                <select
                  value={config.ui.defaultMode}
                  onChange={(e) => updateUI('defaultMode', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                >
                  <option value="chat">Chat</option>
                  <option value="map">Map</option>
                  <option value="table">Table</option>
                </select>
              </div>

              {/* Theme Color */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Theme Color
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {themeColors.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => {
                        updateUI('themeColor', color.id);
                        setCustomHexInput('');
                      }}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        config.ui.themeColor === color.id 
                          ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' 
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.label}
                    />
                  ))}
                </div>
                
                {/* Custom Hex Input */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Or custom:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customHexInput}
                      onChange={(e) => handleCustomHexChange(e.target.value)}
                      placeholder="#004E7C"
                      className={`w-28 px-3 py-1.5 border rounded-lg text-sm font-mono ${
                        customHexInput && !isValidHex(customHexInput) 
                          ? 'border-red-300' 
                          : 'border-slate-300'
                      }`}
                    />
                    {isValidHex(customHexInput) && (
                      <div 
                        className={`w-8 h-8 rounded-full border-2 border-white shadow ${
                          isCustomHex ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                        }`}
                        style={{ backgroundColor: customHexInput }}
                      />
                    )}
                  </div>
                  {customHexInput && !isValidHex(customHexInput) && (
                    <span className="text-xs text-red-500">Invalid hex (use #RRGGBB)</span>
                  )}
                </div>
              </div>

              {/* Search Bar Position */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Search Bar Position
                </label>
                <div className="flex gap-2">
                  {searchBarPositions.map(pos => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => updateUI('searchBarPosition', pos.id)}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        config.ui.searchBarPosition === pos.id
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <pos.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{pos.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Placeholder */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  Search Bar Placeholder
                  {!config.ui.searchPlaceholder && (
                    <span className="text-xs text-slate-400">(uses default)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={config.ui.searchPlaceholder}
                  onChange={(e) => updateUI('searchPlaceholder', e.target.value)}
                  placeholder="Leave empty for default: Search properties..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                />
              </div>

              {/* Default Search Bar Size */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Default Search Bar Size
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Set the default search bar size for all users. Users can override this in their account settings.
                </p>
                <div className="flex gap-2">
                  {[
                    { id: 'small', label: 'Small' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'large', label: 'Large' }
                  ].map(size => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => updateUI('defaultSearchBarSize', size.id)}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        (config.ui.defaultSearchBarSize || 'medium') === size.id
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span className="text-sm font-medium">{size.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Window Placement */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Chat Window Placement
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Position the chat interface at the top or bottom of the screen. Logged-in users can override this in their settings.
                </p>
                <div className="flex gap-2">
                  {[
                    { id: 'top', label: 'Top', icon: ArrowUpFromLine },
                    { id: 'bottom', label: 'Bottom', icon: ArrowDownToLine }
                  ].map(placement => (
                    <button
                      key={placement.id}
                      type="button"
                      onClick={() => updateUI('chatWindowPlacement', placement.id)}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        (config.ui.chatWindowPlacement || 'bottom') === placement.id
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <placement.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{placement.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Map Tools Configuration */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Map Tools Position & Layout
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Map Tools Position */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Position
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'upper-left', label: 'Upper Left' },
                      { id: 'center', label: 'Center' },
                      { id: 'lower-left', label: 'Lower Left' },
                      { id: 'lower-center', label: 'Lower Center' }
                    ].map(pos => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => updateUI('mapToolsPosition', pos.id)}
                        className={`p-2 border rounded-lg text-center transition-colors ${
                          config.ui.mapToolsPosition === pos.id
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <span className="text-sm font-medium">{pos.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map Tools Layout */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Layout
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateUI('mapToolsLayout', 'stacked')}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        config.ui.mapToolsLayout === 'stacked'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <AlignVerticalJustifyStart className="w-5 h-5" />
                      <span className="text-sm font-medium">Stacked</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUI('mapToolsLayout', 'horizontal')}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        config.ui.mapToolsLayout === 'horizontal'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <MoveHorizontal className="w-5 h-5" />
                      <span className="text-sm font-medium">Horizontal</span>
                    </button>
                  </div>
                </div>

                {/* Map Tools Icon Justification */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Icon Justification
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateUI('mapToolsJustification', 'left')}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        (config.ui.mapToolsJustification || 'left') === 'left'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <AlignLeft className="w-5 h-5" />
                      <span className="text-sm font-medium">Left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUI('mapToolsJustification', 'center')}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        config.ui.mapToolsJustification === 'center'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <AlignCenter className="w-5 h-5" />
                      <span className="text-sm font-medium">Center</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateUI('mapToolsJustification', 'right')}
                      className={`flex-1 p-3 border rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        config.ui.mapToolsJustification === 'right'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <AlignRight className="w-5 h-5" />
                      <span className="text-sm font-medium">Right</span>
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Controls where and how the map tools (Search Results, Markup, Layers, etc.) are displayed on the map. Icon Justification aligns the icon and text within each tool button.
              </p>
            </div>

            {/* Logos & Images */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Image className="w-4 h-4" /> Logos & Images
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Logo Left (Header)</label>
                  <ImagePreview 
                    url={config.ui.logoLeft} 
                    label="Logo Left"
                    onClear={() => updateUI('logoLeft', '')}
                  />
                  <input
                    type="url"
                    value={config.ui.logoLeft}
                    onChange={(e) => updateUI('logoLeft', e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Logo Right (Header)</label>
                  <ImagePreview 
                    url={config.ui.logoRight} 
                    label="Logo Right"
                    onClear={() => updateUI('logoRight', '')}
                  />
                  <input
                    type="url"
                    value={config.ui.logoRight}
                    onChange={(e) => updateUI('logoRight', e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Bot Avatar (Chat)</label>
                  <ImagePreview
                    url={config.ui.botAvatar}
                    label="Bot Avatar"
                    onClear={() => updateUI('botAvatar', '')}
                  />
                  <input
                    type="url"
                    value={config.ui.botAvatar}
                    onChange={(e) => updateUI('botAvatar', e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Header Links */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Link className="w-4 h-4" /> Header Links
                </h4>
                <button
                  type="button"
                  onClick={() => updateLinks('enabled', !config.ui.links?.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    config.ui.links?.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.ui.links?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Display navigation links in the header bar (max 4 links)
              </p>

              {config.ui.links?.enabled && (
                <>
                {/* Layout Selector */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Layout Style
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateLinks('layout', 'horizontal')}
                      className={`flex-1 p-2 border rounded-lg flex flex-col items-center gap-1 transition-colors text-xs ${
                        config.ui.links?.layout !== 'stacked'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-6 h-0.5 bg-current rounded"></span>
                        <span className="w-6 h-0.5 bg-current rounded"></span>
                        <span className="w-6 h-0.5 bg-current rounded"></span>
                      </div>
                      <span className="font-medium">Horizontal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLinks('layout', 'stacked')}
                      className={`flex-1 p-2 border rounded-lg flex flex-col items-center gap-1 transition-colors text-xs ${
                        config.ui.links?.layout === 'stacked'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="w-8 h-0.5 bg-current rounded"></span>
                        <span className="w-6 h-0.5 bg-current rounded"></span>
                        <span className="w-7 h-0.5 bg-current rounded"></span>
                      </div>
                      <span className="font-medium">Stacked</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {config.ui.links?.layout === 'stacked'
                      ? 'Links displayed vertically, right-aligned with smaller text'
                      : 'Links displayed in a row across the header'}
                  </p>
                </div>

                <div className="space-y-2">
                  {(config.ui.links?.items || []).map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateHeaderLink(idx, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => updateHeaderLink(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeHeaderLink(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(config.ui.links?.items || []).length === 0 && (
                    <p className="text-sm text-slate-400 italic">No header links added</p>
                  )}
                  {(config.ui.links?.items || []).length < 4 && (
                    <button
                      type="button"
                      onClick={addHeaderLink}
                      className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Link
                    </button>
                  )}
                </div>
                </>
              )}
            </div>

            {/* Info Popup */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Info Popup
                </h4>
                <button
                  type="button"
                  onClick={() => updateInfo('enabled', !config.ui.info?.enabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    config.ui.info?.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.ui.info?.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Display an info button in the header that opens a popup with organization info and links
              </p>

              {config.ui.info?.enabled && (
                <div className="space-y-4">
                  {/* Header Text */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Header Text
                    </label>
                    <input
                      type="text"
                      value={config.ui.info?.headerText || ''}
                      onChange={(e) => updateInfo('headerText', e.target.value.slice(0, 25))}
                      placeholder="Welcome!"
                      maxLength={25}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      {(config.ui.info?.headerText || '').length}/25 characters
                    </p>
                  </div>

                  {/* Info Text */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Popup Title Text
                    </label>
                    <input
                      type="text"
                      value={config.ui.info?.text || ''}
                      onChange={(e) => updateInfo('text', e.target.value)}
                      placeholder="e.g., City of Springfield GIS Portal"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                    />
                  </div>

                  {/* Info Logo */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Popup Logo
                    </label>
                    <ImagePreview
                      url={config.ui.info?.logo}
                      label="Info Logo"
                      onClear={() => updateInfo('logo', '')}
                    />
                    <input
                      type="url"
                      value={config.ui.info?.logo || ''}
                      onChange={(e) => updateInfo('logo', e.target.value)}
                      placeholder="https://..."
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                    />
                  </div>

                  {/* Info Buttons */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">
                      Popup Buttons
                    </label>
                    <div className="space-y-2">
                      {(config.ui.info?.buttons || []).map((button, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={button.label}
                            onChange={(e) => updateInfoButton(idx, 'label', e.target.value)}
                            placeholder="Button Label"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                          />
                          <input
                            type="url"
                            value={button.url}
                            onChange={(e) => updateInfoButton(idx, 'url', e.target.value)}
                            placeholder="https://..."
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => removeInfoButton(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(config.ui.info?.buttons || []).length === 0 && (
                        <p className="text-sm text-slate-400 italic">No buttons added</p>
                      )}
                      <button
                        type="button"
                        onClick={addInfoButton}
                        className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Button
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    Welcome Title
                    {!config.messages.welcomeTitle && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Hidden if empty
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={config.messages.welcomeTitle}
                    onChange={(e) => updateMessages('welcomeTitle', e.target.value)}
                    placeholder="Leave empty to hide"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    Welcome Text
                    {!config.messages.welcomeText && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> Hidden if empty
                      </span>
                    )}
                  </label>
                  <textarea
                    value={config.messages.welcomeText}
                    onChange={(e) => updateMessages('welcomeText', e.target.value)}
                    placeholder="Leave empty to hide the welcome section"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                </div>
              </div>

              {/* Example Questions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  Example Questions
                  <span className="text-xs text-slate-400">(shown on welcome screen)</span>
                </label>
                <div className="space-y-2">
                  {config.messages.exampleQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateExampleQuestion(idx, e.target.value)}
                        placeholder={`Example ${idx + 1}`}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeExampleQuestion(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {config.messages.exampleQuestions.length === 0 && (
                    <p className="text-sm text-slate-400 italic">No example questions added</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addExampleQuestion}
                  className="mt-2 text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Example Question
                </button>
              </div>

              {/* Important Note / Disclaimer */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Important Note (Disclaimer)
                  {!config.messages.importantNote && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Hidden if empty
                    </span>
                  )}
                </label>
                <textarea
                  value={config.messages.importantNote}
                  onChange={(e) => updateMessages('importantNote', e.target.value)}
                  placeholder="Leave empty to hide the disclaimer banner"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                />
              </div>

              {/* Search Tip */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Search Tip
                  {!config.messages.searchTip && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Hidden if empty
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={config.messages.searchTip}
                  onChange={(e) => updateMessages('searchTip', e.target.value)}
                  placeholder="Leave empty to hide the tip"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                />
              </div>

              {/* No Results Message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-500" />
                  No Results Message
                  {!config.messages.noResultsMessage && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      Using default message
                    </span>
                  )}
                </label>
                <textarea
                  value={config.messages.noResultsMessage || ''}
                  onChange={(e) => updateMessages('noResultsMessage', e.target.value)}
                  placeholder="I couldn't find any properties matching your search. Try checking the spelling or using a different format."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Message shown when a search returns no results. Leave empty to use the default message.
                </p>
              </div>
            </div>
          )}

          {/* Disclaimer Tab */}
          {activeTab === 'disclaimer' && (
            <div className="space-y-6">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="font-medium text-slate-700">Enable Disclaimer Popup</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Show a disclaimer when users first visit the site
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateDisclaimer('enabled', !config.disclaimer.enabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.disclaimer.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.disclaimer.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Show configuration options only when enabled */}
              {config.disclaimer.enabled && (
                <>
                  {/* Title Configuration */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Popup Title
                    </label>
                    <input
                      type="text"
                      value={config.disclaimer.title || 'Notice'}
                      onChange={(e) => updateDisclaimer('title', e.target.value)}
                      placeholder="Notice"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      The title shown in the disclaimer popup header
                    </p>
                  </div>

                  {/* Size Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Width
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={config.disclaimer.width}
                          onChange={(e) => updateDisclaimer('width', e.target.value)}
                          placeholder="600"
                          min="100"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                        />
                        <select
                          value={config.disclaimer.widthUnit}
                          onChange={(e) => updateDisclaimer('widthUnit', e.target.value)}
                          className="w-20 px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                        >
                          <option value="px">px</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Height
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={config.disclaimer.height}
                          onChange={(e) => updateDisclaimer('height', e.target.value)}
                          placeholder="400"
                          min="100"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                        />
                        <select
                          value={config.disclaimer.heightUnit}
                          onChange={(e) => updateDisclaimer('heightUnit', e.target.value)}
                          className="w-20 px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                        >
                          <option value="px">px</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Content Mode Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Content Source
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateDisclaimer('contentMode', 'richText')}
                        className={`flex-1 p-3 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                          config.disclaimer.contentMode === 'richText'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <Type className="w-5 h-5" />
                        <span className="font-medium">Text Editor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDisclaimer('contentMode', 'html')}
                        className={`flex-1 p-3 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                          config.disclaimer.contentMode === 'html'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <Code className="w-5 h-5" />
                        <span className="font-medium">HTML Editor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDisclaimer('contentMode', 'embed')}
                        className={`flex-1 p-3 border rounded-lg flex items-center justify-center gap-2 transition-colors ${
                          config.disclaimer.contentMode === 'embed'
                            ? 'border-sky-500 bg-sky-50 text-sky-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <Link className="w-5 h-5" />
                        <span className="font-medium">Embed URL</span>
                      </button>
                    </div>
                  </div>

                  {/* Content Input */}
                  {config.disclaimer.contentMode === 'richText' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Disclaimer Content
                      </label>
                      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                        <ReactQuill
                          value={config.disclaimer.richTextContent || ''}
                          onChange={(content) => updateDisclaimer('richTextContent', content)}
                          placeholder="Enter your disclaimer content here..."
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, 3, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'color': [] }, { 'background': [] }],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              [{ 'indent': '-1'}, { 'indent': '+1' }],
                              [{ 'align': [] }],
                              ['link'],
                              ['clean']
                            ]
                          }}
                          formats={[
                            'header',
                            'bold', 'italic', 'underline', 'strike',
                            'color', 'background',
                            'list', 'bullet', 'indent',
                            'align',
                            'link'
                          ]}
                          className="disclaimer-rich-editor"
                          style={{ minHeight: '200px' }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Use the formatting toolbar to style your disclaimer content. No HTML knowledge required.
                      </p>
                    </div>
                  )}
                  {config.disclaimer.contentMode === 'html' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-slate-700">
                          HTML Content
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowDisclaimerPreview(!showDisclaimerPreview)}
                          className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
                        >
                          {showDisclaimerPreview ? (
                            <>
                              <Code className="w-3 h-3" /> Show Code
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" /> Preview
                            </>
                          )}
                        </button>
                      </div>
                      {showDisclaimerPreview ? (
                        <div
                          className="w-full min-h-[200px] max-h-[300px] overflow-auto px-3 py-2 border border-slate-300 rounded-lg bg-white prose prose-sm prose-slate max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: config.disclaimer.htmlContent || '<p class="text-slate-400 italic">No content yet...</p>'
                          }}
                        />
                      ) : (
                        <textarea
                          value={config.disclaimer.htmlContent}
                          onChange={(e) => updateDisclaimer('htmlContent', e.target.value)}
                          placeholder="<h2>Terms and Conditions</h2>\n<p>Enter your disclaimer content here...</p>"
                          rows={8}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                        />
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        Supports HTML formatting. Content will be styled automatically.
                      </p>
                    </div>
                  )}
                  {config.disclaimer.contentMode === 'embed' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Embed URL
                      </label>
                      <input
                        type="url"
                        value={config.disclaimer.embedUrl}
                        onChange={(e) => updateDisclaimer('embedUrl', e.target.value)}
                        placeholder="https://example.com/disclaimer"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        The page will be embedded in an iframe. Ensure the URL allows embedding.
                      </p>
                      {/* HTTPS warning */}
                      {isHttpUrl(config.disclaimer.embedUrl) && (
                        <div className="flex items-center gap-2 mt-2 text-amber-600">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <p className="text-xs">
                            HTTP URLs will be automatically upgraded to HTTPS for security.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirmation Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Confirmation Type
                    </label>
                    <div className="space-y-2">
                      <label
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          config.disclaimer.confirmationType === 'confirmation'
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="confirmationType"
                          value="confirmation"
                          checked={config.disclaimer.confirmationType === 'confirmation'}
                          onChange={(e) => updateDisclaimer('confirmationType', e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium text-slate-700">Require Confirmation</span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            User must check the checkbox before the continue button is enabled
                          </p>
                        </div>
                      </label>
                      <label
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          config.disclaimer.confirmationType === 'dontShowAgain'
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="confirmationType"
                          value="dontShowAgain"
                          checked={config.disclaimer.confirmationType === 'dontShowAgain'}
                          onChange={(e) => updateDisclaimer('confirmationType', e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium text-slate-700">Don't Show Again Option</span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Continue button is always enabled. If user checks the box, a cookie prevents future displays.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Checkbox and Button Text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Checkbox Text
                      </label>
                      <input
                        type="text"
                        value={config.disclaimer.checkboxText}
                        onChange={(e) => updateDisclaimer('checkboxText', e.target.value)}
                        placeholder={
                          config.disclaimer.confirmationType === 'confirmation'
                            ? 'I agree to the terms and conditions'
                            : "Don't show this again"
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Button Text
                      </label>
                      <input
                        type="text"
                        value={config.disclaimer.buttonText}
                        onChange={(e) => updateDisclaimer('buttonText', e.target.value)}
                        placeholder="Continue"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                      />
                    </div>
                  </div>

                  {/* Theme Note */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Palette className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">
                        <strong>Note:</strong> The disclaimer header and button colors will automatically match your theme color set in the User Interface tab.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Basemaps Tab */}
          {activeTab === 'basemaps' && (
            <div className="space-y-4">
              {config.basemaps.map((basemap, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={basemap.label}
                        onChange={(e) => updateBasemap(idx, 'label', e.target.value)}
                        placeholder="Street Map"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                      <select
                        value={basemap.type}
                        onChange={(e) => updateBasemap(idx, 'type', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      >
                        <option value="esri">Esri Basemap ID</option>
                        <option value="arcgis">ArcGIS TileLayer</option>
                        <option value="wms">WMS Layer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        {basemap.type === 'esri' ? 'Basemap ID' : 'URL'}
                      </label>
                      <input
                        type="text"
                        value={basemap.type === 'esri' ? basemap.id : basemap.url}
                        onChange={(e) => updateBasemap(idx, basemap.type === 'esri' ? 'id' : 'url', e.target.value)}
                        placeholder={basemap.type === 'esri' ? 'streets-navigation-vector' : 'https://...'}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBasemap(idx)}
                    disabled={config.basemaps.length <= 1}
                    className="p-1.5 text-red-500 hover:bg-red-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBasemap}
                className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Basemap
              </button>
            </div>
          )}

          {/* Exports Tab */}
          {activeTab === 'exports' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">Export Options</p>
                    <p className="text-blue-700 mt-1">
                      Configure which export formats are available for each feature. Disabled formats will be hidden from users.
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Search Results Exports */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-5 h-5" style={{ color: accentColor }} />
                  <h3 className="font-semibold text-slate-800">Chat Search Results</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Export options available when viewing search results in the chat interface.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.chatSearchResults?.csv !== false}
                      onChange={(e) => updateExportOption('chatSearchResults', 'csv', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-700">CSV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.chatSearchResults?.pdf !== false}
                      onChange={(e) => updateExportOption('chatSearchResults', 'pdf', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileText className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-slate-700">PDF</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.chatSearchResults?.shp !== false}
                      onChange={(e) => updateExportOption('chatSearchResults', 'shp', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileArchive className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-700">Shapefile</span>
                  </label>
                </div>
              </div>

              {/* Search Results Panel Exports */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="w-5 h-5" style={{ color: accentColor }} />
                  <h3 className="font-semibold text-slate-800">Search Results Panel</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Export options available in the map's search results panel.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.searchResultsPanel?.csv !== false}
                      onChange={(e) => updateExportOption('searchResultsPanel', 'csv', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-700">CSV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.searchResultsPanel?.shp !== false}
                      onChange={(e) => updateExportOption('searchResultsPanel', 'shp', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileArchive className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-700">Shapefile</span>
                  </label>
                </div>
              </div>

              {/* Map Markup Exports */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Map className="w-5 h-5" style={{ color: accentColor }} />
                  <h3 className="font-semibold text-slate-800">Map Markup</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Export options for user-drawn markups on the map.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.mapMarkup?.csv !== false}
                      onChange={(e) => updateExportOption('mapMarkup', 'csv', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-700">CSV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.mapMarkup?.shp !== false}
                      onChange={(e) => updateExportOption('mapMarkup', 'shp', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileArchive className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-700">Shapefile</span>
                  </label>
                </div>
              </div>

              {/* Table Mode Exports */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Table2 className="w-5 h-5" style={{ color: accentColor }} />
                  <h3 className="font-semibold text-slate-800">Table Mode</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Export options available in the table view.
                </p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.tableMode?.csv !== false}
                      onChange={(e) => updateExportOption('tableMode', 'csv', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-700">CSV</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.exportOptions.tableMode?.shp !== false}
                      onChange={(e) => updateExportOption('tableMode', 'shp', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <FileArchive className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-700">Shapefile</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800">ArcGIS Integration</p>
                    <p className="text-blue-700 mt-1">
                      Configure your ArcGIS organization settings for user authentication and map services.
                    </p>
                  </div>
                </div>
              </div>

              {/* ArcGIS Organization URL */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-5 h-5" style={{ color: accentColor }} />
                  <h3 className="font-semibold text-slate-800">ArcGIS Organization</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Organization Portal URL
                    </label>
                    <input
                      type="url"
                      value={config.arcgisPortalUrl}
                      onChange={(e) => setConfig(prev => ({ ...prev, arcgisPortalUrl: e.target.value }))}
                      placeholder="https://yourorg.maps.arcgis.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Enter your ArcGIS organization portal URL. This is used to authenticate Atlas users with your organization's ArcGIS account.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Example: https://civicvanguard.maps.arcgis.com or https://yourorg.maps.arcgis.com
                    </p>
                  </div>

                  {/* Preview of configured URL */}
                  {config.arcgisPortalUrl && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs font-medium text-slate-600 mb-1">Configured Portal:</p>
                      <a
                        href={config.arcgisPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-sky-600 hover:text-sky-700 hover:underline break-all"
                      >
                        {config.arcgisPortalUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional info */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Important</p>
                    <p className="text-amber-700 mt-1">
                      The ESRI Client ID for OAuth authentication is configured at the system level by administrators.
                      Contact your system administrator if you need to update the OAuth credentials.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help Documentation Tab */}
          {activeTab === 'help' && (
            <div className="space-y-6">
              {/* Custom Help Mode Display Text */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Custom Help Mode Display Text
                </label>
                <input
                  type="text"
                  value={config.customHelpModeText}
                  onChange={(e) => setConfig(prev => ({ ...prev, customHelpModeText: e.target.value }))}
                  placeholder="Ask questions about how to use Atlas. Click again to return to property search."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Customize the message shown when help mode is active. Leave empty to use the default text.
                </p>
              </div>

              {/* Global Help Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="font-medium text-slate-700">Use Global Atlas Help</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, this organization uses the global help documentation configured by Atlas administrators.
                    Disable to create custom help for this organization only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    useGlobalHelp: !prev.useGlobalHelp,
                    // If turning off global help, also turn off supplement
                    supplementGlobalHelp: !prev.useGlobalHelp ? prev.supplementGlobalHelp : false
                  }))}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${
                    config.useGlobalHelp ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.useGlobalHelp ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Supplement Global Help Option - only shown when useGlobalHelp is true */}
              {config.useGlobalHelp && (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <span className="font-medium text-slate-700">Supplement with Organization Help</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Add organization-specific help articles that will be searched alongside global help.
                      Your organization's help takes precedence when searching.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, supplementGlobalHelp: !prev.supplementGlobalHelp }))}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${
                      config.supplementGlobalHelp ? 'bg-blue-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        config.supplementGlobalHelp ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Show custom help editor when NOT using global help OR when supplementing global help */}
              {(!config.useGlobalHelp || config.supplementGlobalHelp) ? (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      {config.supplementGlobalHelp ? (
                        <>
                          <strong>Supplemental Help:</strong> Add organization-specific documentation that will be searched alongside global help.
                          Your organization's help articles take precedence when matching user queries.
                        </>
                      ) : (
                        <>
                          <strong>Custom Help Mode:</strong> Add organization-specific documentation that users can access in chat mode.
                          Include images and videos with tags to help the AI find relevant media when answering questions.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Help Articles */}
                  {config.helpDocumentation.map((doc, docIdx) => (
                    <HelpDocEditor
                      key={doc.id || docIdx}
                      doc={doc}
                      docIndex={docIdx}
                      onUpdate={updateHelpDoc}
                      onRemove={removeHelpDoc}
                      onAddTag={addHelpDocTag}
                      onRemoveTag={removeHelpDocTag}
                      onAddMedia={addHelpDocMedia}
                      onUpdateMedia={updateHelpDocMedia}
                      onRemoveMedia={removeHelpDocMedia}
                      onAddMediaTag={addMediaTag}
                      onRemoveMediaTag={removeMediaTag}
                      onAddLink={addHelpDocLink}
                      onUpdateLink={updateHelpDocLink}
                      onRemoveLink={removeHelpDocLink}
                    />
                  ))}

                  {config.helpDocumentation.length === 0 && (
                    <p className="text-sm text-slate-400 italic text-center py-4">
                      No custom help documentation added yet. Click below to add your first article.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={addHelpDoc}
                    className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Help Article
                  </button>
                </>
              ) : (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <Globe className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-medium text-slate-700 mb-1">Using Global Atlas Help</h3>
                  <p className="text-sm text-slate-500 mb-3">
                    This organization is using the global help documentation configured by Atlas administrators.
                  </p>
                  <p className="text-xs text-slate-400">
                    Turn on "Supplement with Organization Help" above to add your own help articles alongside global help,
                    or turn off "Use Global Atlas Help" to create fully custom help for this organization.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Advanced Settings Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  System Prompt (for AI Query Translation)
                </label>
                <textarea
                  value={config.data.systemPrompt}
                  onChange={(e) => updateData('systemPrompt', e.target.value)}
                  placeholder="Instructions for Gemini to translate natural language to SQL..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Max Record Count
                  </label>
                  <input
                    type="number"
                    value={config.data.maxRecordCount}
                    onChange={(e) => updateData('maxRecordCount', parseInt(e.target.value) || 1000)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Autocomplete Max Results
                  </label>
                  <input
                    type="number"
                    value={config.data.autocompleteMaxResults}
                    onChange={(e) => updateData('autocompleteMaxResults', parseInt(e.target.value) || 100)}
                    min="1"
                    max="500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Default number of suggestions shown in search autocomplete
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Timezone Offset (hours)
                  </label>
                  <input
                    type="number"
                    value={config.data.timeZoneOffset}
                    onChange={(e) => updateData('timeZoneOffset', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default Sort
                  </label>
                  <input
                    type="text"
                    value={config.data.defaultSort}
                    onChange={(e) => updateData('defaultSort', e.target.value)}
                    placeholder="FIELD_NAME DESC"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsible Section Component
 */
function Section({ title, icon: Icon, expanded, onToggle, children, accentColor }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
          <span className="font-semibold text-slate-800">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="p-4 border-t border-slate-200">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Help Documentation Editor Component
 * Handles individual help article editing with media attachments and external links
 */
function HelpDocEditor({
  doc,
  docIndex,
  onUpdate,
  onRemove,
  onAddTag,
  onRemoveTag,
  onAddMedia,
  onUpdateMedia,
  onRemoveMedia,
  onAddMediaTag,
  onRemoveMediaTag,
  onAddLink,
  onUpdateLink,
  onRemoveLink
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(docIndex, newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div
        className="p-3 bg-slate-50 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <BookOpen className="w-4 h-4 text-sky-600" />
          <span className="font-medium text-slate-700">
            {doc.title || 'Untitled Article'}
          </span>
          {doc.tags && doc.tags.length > 0 && (
            <span className="text-xs text-slate-400">
              ({doc.tags.length} tags)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(docIndex); }}
          className="p-1 text-red-500 hover:bg-red-50 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-slate-200">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Article Title
            </label>
            <input
              type="text"
              value={doc.title}
              onChange={(e) => onUpdate(docIndex, 'title', e.target.value)}
              placeholder="e.g., How to Search by Address"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Content
              <span className="text-xs text-slate-400 font-normal ml-2">(HTML formatting supported)</span>
            </label>
            <textarea
              value={doc.content}
              onChange={(e) => onUpdate(docIndex, 'content', e.target.value)}
              placeholder="Write the help content here. HTML tags like <p>, <ul>, <li>, <strong>, <em>, <h3>, <br> are supported for rich formatting."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm font-mono"
            />
            <p className="mt-1 text-xs text-slate-400">
              Supported tags: &lt;p&gt;, &lt;br&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;h3&gt;, &lt;h4&gt;, &lt;blockquote&gt;, &lt;a href="..."&gt;
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Tag className="w-4 h-4" />
              Tags
              <span className="text-xs text-slate-400 font-normal">(helps match queries)</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(doc.tags || []).map((tag, tagIdx) => (
                <span
                  key={tagIdx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-800 rounded-full text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(docIndex, tagIdx)}
                    className="hover:text-sky-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm hover:bg-sky-200"
              >
                Add
              </button>
            </div>
          </div>

          {/* Media Section */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              <FileImage className="w-4 h-4" />
              Media (Screenshots & Videos)
            </label>

            {/* Media Items */}
            {(doc.media || []).map((media, mediaIdx) => (
              <MediaEditor
                key={media.id || mediaIdx}
                media={media}
                docIndex={docIndex}
                mediaIndex={mediaIdx}
                onUpdate={onUpdateMedia}
                onRemove={onRemoveMedia}
                onAddTag={onAddMediaTag}
                onRemoveTag={onRemoveMediaTag}
              />
            ))}

            <button
              type="button"
              onClick={() => onAddMedia(docIndex)}
              className="mt-2 w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Image or Video
            </button>
          </div>

          {/* External Links Section */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              <Link className="w-4 h-4" />
              External Links
              <span className="text-xs text-slate-400 font-normal">(opens in new window)</span>
            </label>

            {/* Link Items */}
            {(doc.links || []).map((link, linkIdx) => (
              <div
                key={link.id || linkIdx}
                className="p-3 bg-slate-50 rounded-lg mb-2"
              >
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center flex-shrink-0">
                    <Link className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={link.title}
                        onChange={(e) => onUpdateLink(docIndex, linkIdx, 'title', e.target.value)}
                        placeholder="Link Title"
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveLink(docIndex, linkIdx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => onUpdateLink(docIndex, linkIdx, 'url', e.target.value)}
                      placeholder="URL (https://...)"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                    <input
                      type="text"
                      value={link.description || ''}
                      onChange={(e) => onUpdateLink(docIndex, linkIdx, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => onAddLink(docIndex)}
              className="mt-2 w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add External Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Media Editor Component
 * Handles individual media items (images/videos) with tags
 */
function MediaEditor({
  media,
  docIndex,
  mediaIndex,
  onUpdate,
  onRemove,
  onAddTag,
  onRemoveTag
}) {
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(docIndex, mediaIndex, newTag.trim());
      setNewTag('');
    }
  };

  return (
    <div className="p-3 bg-slate-50 rounded-lg mb-2">
      <div className="flex items-start gap-3">
        {/* Media Preview */}
        <div className="w-24 h-16 bg-slate-200 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
          {media.url ? (
            media.type === 'video' ? (
              <Video className="w-8 h-8 text-slate-400" />
            ) : (
              <img
                src={media.url}
                alt={media.title || 'Media'}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )
          ) : (
            <FileImage className="w-8 h-8 text-slate-400" />
          )}
        </div>

        {/* Media Fields */}
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <select
              value={media.type}
              onChange={(e) => onUpdate(docIndex, mediaIndex, 'type', e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-xs"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <input
              type="text"
              value={media.title}
              onChange={(e) => onUpdate(docIndex, mediaIndex, 'title', e.target.value)}
              placeholder="Title"
              className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
            />
            <button
              type="button"
              onClick={() => onRemove(docIndex, mediaIndex)}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <input
            type="url"
            value={media.url}
            onChange={(e) => onUpdate(docIndex, mediaIndex, 'url', e.target.value)}
            placeholder="URL (https://...)"
            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
          />

          {/* Media Tags */}
          <div>
            <div className="flex flex-wrap gap-1 mb-1">
              {(media.tags || []).map((tag, tagIdx) => (
                <span
                  key={tagIdx}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => onRemoveTag(docIndex, mediaIndex, tagIdx)}
                    className="hover:text-emerald-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag for matching..."
                className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs hover:bg-emerald-200"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
