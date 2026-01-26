// src/admin/components/AtlasSettingsEditor.jsx
// Modal for editing Atlas general settings (UI, messages, basemaps)
// Similar pattern to NotificationEditor but for Atlas configuration

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
  HelpCircle
} from 'lucide-react';

/**
 * AtlasSettingsEditor Modal
 * 
 * Edits the overall Atlas configuration:
 * - UI settings (title, header, colors, logos)
 * - Messages (welcome, examples, notes)
 * - Basemaps configuration
 * - Data settings (system prompt, limits)
 * 
 * Props:
 * @param {object} data - The atlasConfig object to edit
 * @param {function} onClose - Called when modal is closed
 * @param {function} onSave - Called with updated config when saved
 * @param {string} [accentColor] - Theme accent color
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
      ...data?.ui
    },
    messages: {
      welcomeTitle: '',
      welcomeText: '',
      exampleQuestions: [],
      importantNote: '',
      ...data?.messages
    },
    basemaps: data?.basemaps || [{ label: 'Default', id: 'default', type: 'esri' }],
    data: {
      systemPrompt: '',
      maxRecordCount: 1000,
      timeZoneOffset: -5,
      defaultSort: '',
      maps: data?.data?.maps || [],
      ...data?.data
    }
  }));

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState({
    ui: true,
    messages: true,
    basemaps: true,
    data: false
  });

  // Validation errors
  const [errors, setErrors] = useState({});

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Update UI field
  const updateUI = (field, value) => {
    setConfig(prev => ({
      ...prev,
      ui: { ...prev.ui, [field]: value }
    }));
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

  // Add example question
  const addExampleQuestion = () => {
    setConfig(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        exampleQuestions: [...prev.messages.exampleQuestions, '']
      }
    }));
  };

  // Update example question
  const updateExampleQuestion = (index, value) => {
    const updated = [...config.messages.exampleQuestions];
    updated[index] = value;
    updateMessages('exampleQuestions', updated);
  };

  // Remove example question
  const removeExampleQuestion = (index) => {
    const updated = config.messages.exampleQuestions.filter((_, i) => i !== index);
    updateMessages('exampleQuestions', updated);
  };

  // Add basemap
  const addBasemap = () => {
    setConfig(prev => ({
      ...prev,
      basemaps: [...prev.basemaps, { 
        label: 'New Basemap', 
        id: `basemap_${Date.now()}`, 
        type: 'esri',
        url: '' 
      }]
    }));
  };

  // Update basemap
  const updateBasemap = (index, field, value) => {
    const updated = [...config.basemaps];
    updated[index] = { ...updated[index], [field]: value };
    setConfig(prev => ({ ...prev, basemaps: updated }));
  };

  // Remove basemap
  const removeBasemap = (index) => {
    setConfig(prev => ({
      ...prev,
      basemaps: prev.basemaps.filter((_, i) => i !== index)
    }));
  };

  // Validate form
  const validate = () => {
    const newErrors = {};
    
    if (!config.ui.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!config.ui.headerTitle?.trim()) {
      newErrors.headerTitle = 'Header title is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;
    onSave(config);
  };

  // Theme color options
  const themeColors = [
    { id: 'sky', label: 'Sky Blue', class: 'bg-sky-500' },
    { id: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { id: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
    { id: 'violet', label: 'Violet', class: 'bg-violet-500' },
    { id: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
    { id: 'teal', label: 'Teal', class: 'bg-teal-500' },
    { id: 'amber', label: 'Amber', class: 'bg-amber-500' },
    { id: 'rose', label: 'Rose', class: 'bg-rose-500' },
    { id: 'slate', label: 'Slate', class: 'bg-slate-500' }
  ];

  // Default mode options
  const modeOptions = [
    { id: 'chat', label: 'Chat' },
    { id: 'map', label: 'Map' },
    { id: 'table', label: 'Table' }
  ];

  // Basemap type options
  const basemapTypes = [
    { id: 'esri', label: 'Esri Default' },
    { id: 'arcgis', label: 'ArcGIS Service' },
    { id: 'wms', label: 'WMS Service' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Atlas Settings</h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* UI Settings Section */}
          <Section
            title="UI Settings"
            icon={Palette}
            expanded={expandedSections.ui}
            onToggle={() => toggleSection('ui')}
            accentColor={accentColor}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Site Title *
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
                  Header Title *
                </label>
                <input
                  type="text"
                  value={config.ui.headerTitle}
                  onChange={(e) => updateUI('headerTitle', e.target.value)}
                  placeholder="City of Example"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-50 ${
                    errors.headerTitle ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-sky-500'
                  }`}
                />
                {errors.headerTitle && <p className="text-xs text-red-500 mt-1">{errors.headerTitle}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Header Subtitle
                </label>
                <input
                  type="text"
                  value={config.ui.headerSubtitle}
                  onChange={(e) => updateUI('headerSubtitle', e.target.value)}
                  placeholder="CivQuest Property Site"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Theme Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {themeColors.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => updateUI('themeColor', color.id)}
                      className={`w-8 h-8 rounded-lg ${color.class} transition-all ${
                        config.ui.themeColor === color.id 
                          ? 'ring-2 ring-offset-2 ring-slate-400' 
                          : 'hover:scale-110'
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Default View Mode
                </label>
                <select
                  value={config.ui.defaultMode}
                  onChange={(e) => updateUI('defaultMode', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                >
                  {modeOptions.map(mode => (
                    <option key={mode.id} value={mode.id}>{mode.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Header CSS Class
                </label>
                <input
                  type="text"
                  value={config.ui.headerClass}
                  onChange={(e) => updateUI('headerClass', e.target.value)}
                  placeholder="bg-sky-700"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Image className="w-4 h-4 inline mr-1" /> Logo URLs
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="url"
                    value={config.ui.logoLeft}
                    onChange={(e) => updateUI('logoLeft', e.target.value)}
                    placeholder="Left logo URL"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                  />
                  <input
                    type="url"
                    value={config.ui.logoRight}
                    onChange={(e) => updateUI('logoRight', e.target.value)}
                    placeholder="Right logo URL"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Chat Bot Avatar URL
                </label>
                <input
                  type="url"
                  value={config.ui.botAvatar}
                  onChange={(e) => updateUI('botAvatar', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                />
              </div>
            </div>
          </Section>

          {/* Messages Section */}
          <Section
            title="Welcome Messages"
            icon={MessageSquare}
            expanded={expandedSections.messages}
            onToggle={() => toggleSection('messages')}
            accentColor={accentColor}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Welcome Title
                </label>
                <input
                  type="text"
                  value={config.messages.welcomeTitle}
                  onChange={(e) => updateMessages('welcomeTitle', e.target.value)}
                  placeholder="Welcome!"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Welcome Text
                </label>
                <textarea
                  value={config.messages.welcomeText}
                  onChange={(e) => updateMessages('welcomeText', e.target.value)}
                  placeholder="Explain what users can do with this Atlas..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Example Questions
                  <span className="text-slate-400 font-normal ml-2">
                    (shown as quick-start suggestions)
                  </span>
                </label>
                <div className="space-y-2">
                  {config.messages.exampleQuestions.map((q, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateExampleQuestion(idx, e.target.value)}
                        placeholder="e.g., 123 Main Street"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeExampleQuestion(idx)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExampleQuestion}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Example
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Important Note
                  <span className="text-slate-400 font-normal ml-2">
                    (optional disclaimer or notice)
                  </span>
                </label>
                <textarea
                  value={config.messages.importantNote}
                  onChange={(e) => updateMessages('importantNote', e.target.value)}
                  placeholder="Any important disclaimer or note..."
                  rows={2}
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
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={basemap.label}
                        onChange={(e) => updateBasemap(idx, 'label', e.target.value)}
                        placeholder="Basemap name"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">ID</label>
                      <input
                        type="text"
                        value={basemap.id}
                        onChange={(e) => updateBasemap(idx, 'id', e.target.value)}
                        placeholder="unique_id"
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                      <select
                        value={basemap.type}
                        onChange={(e) => updateBasemap(idx, 'type', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                      >
                        {basemapTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
                        <input
                          type="url"
                          value={basemap.url || ''}
                          onChange={(e) => updateBasemap(idx, 'url', e.target.value)}
                          placeholder={basemap.type === 'esri' ? 'N/A' : 'Service URL'}
                          disabled={basemap.type === 'esri'}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBasemap(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        disabled={config.basemaps.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addBasemap}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Basemap
              </button>
            </div>
          </Section>

          {/* Advanced Data Settings */}
          <Section
            title="Advanced Settings"
            icon={HelpCircle}
            expanded={expandedSections.data}
            onToggle={() => toggleSection('data')}
            accentColor={accentColor}
          >
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                These settings affect all maps in this Atlas instance.
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
                    min={100}
                    max={50000}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">Maximum features to return from queries</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Timezone Offset (hours)
                  </label>
                  <input
                    type="number"
                    value={config.data.timeZoneOffset}
                    onChange={(e) => updateData('timeZoneOffset', parseInt(e.target.value) || 0)}
                    min={-12}
                    max={12}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">UTC offset for date calculations</p>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">SQL-style sort clause for results</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  AI System Prompt
                  <span className="text-slate-400 font-normal ml-2">
                    (for Chat mode query translation)
                  </span>
                </label>
                <textarea
                  value={config.data.systemPrompt}
                  onChange={(e) => updateData('systemPrompt', e.target.value)}
                  placeholder="Instructions for the AI to translate natural language queries..."
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 font-mono text-sm"
                />
              </div>
            </div>
          </Section>
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
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Collapsible Section Component ---
function Section({ title, icon: Icon, expanded, onToggle, accentColor, children }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
          <span className="font-medium text-slate-800">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
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
