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
  GripVertical,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  HelpCircle,
  ArrowUpFromLine,
  ArrowDownToLine,
  Lightbulb,
  Search,
  Eye,
  EyeOff,
  Layers,
  FileOutput,
  LayoutList,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

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
    basemaps: data?.basemaps || [{ label: 'Default', id: 'default', type: 'esri' }],
    data: {
      systemPrompt: '',
      maxRecordCount: 1000,
      timeZoneOffset: -5,
      defaultSort: '',
      ...data?.data
    },
    customFeatureInfo: {
      layerId: '',
      tabs: [],
      export: {
        scaleRatio: 1.0,
        elements: []
      },
      ...data?.customFeatureInfo
    }
  }));

  const [errors, setErrors] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    ui: true,
    messages: true,
    basemaps: false,
    data: false,
    customFeatureInfo: false
  });
  
  // Custom hex color input
  const [customHexInput, setCustomHexInput] = useState(
    isValidHex(config.ui.themeColor) ? config.ui.themeColor : ''
  );

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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

  // Custom Feature Info functions
  const updateCustomFeatureInfo = (field, value) => {
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, [field]: value }
    }));
  };

  // Tab management
  const addTab = () => {
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        tabs: [...(prev.customFeatureInfo.tabs || []), { name: '', elements: [] }]
      }
    }));
  };

  const updateTab = (index, field, value) => {
    const updated = [...config.customFeatureInfo.tabs];
    updated[index] = { ...updated[index], [field]: value };
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const removeTab = (index) => {
    const updated = config.customFeatureInfo.tabs.filter((_, i) => i !== index);
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const moveTab = (index, direction) => {
    const tabs = [...config.customFeatureInfo.tabs];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tabs.length) return;
    [tabs[index], tabs[newIndex]] = [tabs[newIndex], tabs[index]];
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs }
    }));
  };

  // Tab element management
  const addTabElement = (tabIndex) => {
    const updated = [...config.customFeatureInfo.tabs];
    updated[tabIndex] = {
      ...updated[tabIndex],
      elements: [...(updated[tabIndex].elements || []), '']
    };
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const updateTabElement = (tabIndex, elementIndex, value) => {
    const updated = [...config.customFeatureInfo.tabs];
    const elements = [...updated[tabIndex].elements];
    elements[elementIndex] = value;
    updated[tabIndex] = { ...updated[tabIndex], elements };
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  const removeTabElement = (tabIndex, elementIndex) => {
    const updated = [...config.customFeatureInfo.tabs];
    updated[tabIndex] = {
      ...updated[tabIndex],
      elements: updated[tabIndex].elements.filter((_, i) => i !== elementIndex)
    };
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: { ...prev.customFeatureInfo, tabs: updated }
    }));
  };

  // Export settings management
  const updateExportSetting = (field, value) => {
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo.export, [field]: value }
      }
    }));
  };

  const addExportElement = () => {
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: {
          ...prev.customFeatureInfo.export,
          elements: [...(prev.customFeatureInfo.export.elements || []), '']
        }
      }
    }));
  };

  const updateExportElement = (index, value) => {
    const updated = [...config.customFeatureInfo.export.elements];
    updated[index] = value;
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo.export, elements: updated }
      }
    }));
  };

  const removeExportElement = (index) => {
    const updated = config.customFeatureInfo.export.elements.filter((_, i) => i !== index);
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo.export, elements: updated }
      }
    }));
  };

  const moveExportElement = (index, direction) => {
    const elements = [...config.customFeatureInfo.export.elements];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= elements.length) return;
    [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
    setConfig(prev => ({
      ...prev,
      customFeatureInfo: {
        ...prev.customFeatureInfo,
        export: { ...prev.customFeatureInfo.export, elements }
      }
    }));
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

    // Clean up empty example questions and customFeatureInfo
    const cleanConfig = {
      ...config,
      messages: {
        ...config.messages,
        exampleQuestions: config.messages.exampleQuestions.filter(q => q.trim())
      },
      customFeatureInfo: {
        ...config.customFeatureInfo,
        tabs: config.customFeatureInfo.tabs
          .filter(tab => tab.name.trim())
          .map(tab => ({
            ...tab,
            elements: tab.elements.filter(el => el.trim())
          })),
        export: {
          ...config.customFeatureInfo.export,
          elements: config.customFeatureInfo.export.elements.filter(el => el.trim())
        }
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
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Atlas Settings</h2>
            <p className="text-sm text-slate-500">Configure UI, messages, and basemaps</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* UI Section */}
          <Section
            title="User Interface"
            icon={Palette}
            expanded={expandedSections.ui}
            onToggle={() => toggleSection('ui')}
            accentColor={accentColor}
          >
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
          </Section>

          {/* Messages Section */}
          <Section
            title="Messages"
            icon={MessageSquare}
            expanded={expandedSections.messages}
            onToggle={() => toggleSection('messages')}
            accentColor={accentColor}
          >
            <div className="space-y-4">
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
            </div>
          </Section>

          {/* Basemaps Section */}
          <Section
            title="Basemaps"
            icon={Globe}
            expanded={expandedSections.basemaps}
            onToggle={() => toggleSection('basemaps')}
            accentColor={accentColor}
          >
            <div className="space-y-3">
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
          </Section>

          {/* Advanced/Data Section */}
          <Section
            title="Advanced Settings"
            icon={HelpCircle}
            expanded={expandedSections.data}
            onToggle={() => toggleSection('data')}
            accentColor={accentColor}
          >
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </Section>

          {/* Custom Feature Info Section */}
          <Section
            title="Custom Feature Info"
            icon={Layers}
            expanded={expandedSections.customFeatureInfo}
            onToggle={() => toggleSection('customFeatureInfo')}
            accentColor={accentColor}
          >
            <div className="space-y-6">
              {/* Layer ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Layer ID
                </label>
                <input
                  type="text"
                  value={config.customFeatureInfo.layerId}
                  onChange={(e) => updateCustomFeatureInfo('layerId', e.target.value)}
                  placeholder="e.g., 194f67ad7e3-layer-42"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-slate-400">
                  The layer ID for the feature with custom tab display
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
                    onClick={addTab}
                    className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Tab
                  </button>
                </div>

                {config.customFeatureInfo.tabs.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-4 text-center bg-slate-50 rounded-lg">
                    No tabs configured. Add a tab to organize feature popup elements.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {config.customFeatureInfo.tabs.map((tab, tabIdx) => (
                      <div key={tabIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Tab Header */}
                        <div className="flex items-center gap-2 p-3 bg-slate-50">
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveTab(tabIdx, -1)}
                              disabled={tabIdx === 0}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveTab(tabIdx, 1)}
                              disabled={tabIdx === config.customFeatureInfo.tabs.length - 1}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={tab.name}
                            onChange={(e) => updateTab(tabIdx, 'name', e.target.value)}
                            placeholder="Tab Name"
                            className="flex-1 px-2 py-1.5 border border-slate-300 rounded text-sm font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => removeTab(tabIdx)}
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
                          {tab.elements.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No elements added</p>
                          ) : (
                            <div className="space-y-1.5">
                              {tab.elements.map((element, elIdx) => (
                                <div key={elIdx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={element}
                                    onChange={(e) => updateTabElement(tabIdx, elIdx, e.target.value)}
                                    placeholder="Element name"
                                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeTabElement(tabIdx, elIdx)}
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
                            onClick={() => addTabElement(tabIdx)}
                            className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 mt-2"
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
                      value={config.customFeatureInfo.export.scaleRatio}
                      onChange={(e) => updateExportSetting('scaleRatio', parseFloat(e.target.value) || 1.0)}
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
                        onClick={addExportElement}
                        className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> Add Element
                      </button>
                    </div>

                    {config.customFeatureInfo.export.elements.length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-3 text-center bg-slate-50 rounded-lg">
                        No export elements configured
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {config.customFeatureInfo.export.elements.map((element, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveExportElement(idx, -1)}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveExportElement(idx, 1)}
                                disabled={idx === config.customFeatureInfo.export.elements.length - 1}
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
                              onChange={(e) => updateExportElement(idx, e.target.value)}
                              placeholder="Element name"
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeExportElement(idx)}
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
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white rounded-lg font-medium flex items-center gap-2"
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
