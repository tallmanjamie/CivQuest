// src/admin/components/GlobalExportTemplateLibrary.jsx
// Component for super admins to manage global export template library
// These templates are available to org admins when they choose "From Template"
// for both map export templates and feature export templates

import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileOutput,
  Plus,
  Edit2,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  Save,
  RefreshCw,
  AlertCircle,
  X,
  Globe,
  Library
} from 'lucide-react';
import {
  subscribeToSystemConfig,
  updateGlobalExportTemplates,
  updateGlobalFeatureExportTemplates
} from '../../shared/services/systemConfig';
import ExportTemplateEditor from './ExportTemplateEditor';
import FeatureExportTemplateEditor from './FeatureExportTemplateEditor';

// Default starter templates for map export (same as in ExportTemplateConfiguration)
const DEFAULT_MAP_EXPORT_TEMPLATES = [
  {
    id: 'global-starter-landscape',
    name: 'Standard Landscape',
    description: 'Classic landscape layout with header, map, sidebar legend, and footer',
    pageSize: 'letter-landscape',
    backgroundColor: '#ffffff',
    elements: [
      { id: 'map-1', type: 'map', x: 2, y: 12, width: 65, height: 75, locked: false, visible: true },
      { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 10, locked: false, visible: true, content: { text: 'Map Title', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' } },
      { id: 'legend-1', type: 'legend', x: 70, y: 12, width: 28, height: 60, locked: false, visible: true, content: { showTitle: true, title: 'Legend' } },
      { id: 'scalebar-1', type: 'scalebar', x: 45, y: 88, width: 20, height: 4, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'footer-1', type: 'text', x: 0, y: 93, width: 100, height: 7, locked: false, visible: true, content: { text: 'This map is for informational purposes only.', fontSize: 10, fontWeight: 'normal', align: 'center', backgroundColor: '#f8fafc', color: '#64748b' } }
    ]
  },
  {
    id: 'global-starter-portrait',
    name: 'Standard Portrait',
    description: 'Portrait layout with header, large map area, and bottom legend',
    pageSize: 'letter-portrait',
    backgroundColor: '#ffffff',
    elements: [
      { id: 'map-1', type: 'map', x: 2, y: 12, width: 96, height: 55, locked: false, visible: true },
      { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 10, locked: false, visible: true, content: { text: 'Map Title', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' } },
      { id: 'legend-1', type: 'legend', x: 2, y: 70, width: 40, height: 25, locked: false, visible: true, content: { showTitle: true, title: 'Legend' } },
      { id: 'scalebar-1', type: 'scalebar', x: 55, y: 70, width: 25, height: 5, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'northArrow-1', type: 'northArrow', x: 85, y: 70, width: 12, height: 12, locked: false, visible: true, content: { style: 'default' } },
      { id: 'footer-1', type: 'text', x: 0, y: 94, width: 100, height: 6, locked: false, visible: true, content: { text: 'This map is for informational purposes only.', fontSize: 9, fontWeight: 'normal', align: 'center', backgroundColor: '#f8fafc', color: '#64748b' } }
    ]
  }
];

// Default starter templates for feature export
const DEFAULT_FEATURE_EXPORT_TEMPLATES = [
  {
    id: 'global-starter-feature-basic',
    name: 'Basic Feature Report',
    description: 'Simple layout with title, attributes, and footer',
    pageSize: 'letter-portrait',
    backgroundColor: '#ffffff',
    elements: [
      { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 8, locked: false, visible: true, content: { text: 'Feature Report', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' } },
      { id: 'logo-1', type: 'logo', x: 2, y: 1, width: 12, height: 6, locked: false, visible: true, content: { source: 'org-logo', alt: 'Organization Logo' } },
      { id: 'date-1', type: 'date', x: 80, y: 2, width: 18, height: 4, locked: false, visible: true, content: { format: 'MMMM D, YYYY', fontSize: 10, align: 'right', color: '#ffffff' } },
      { id: 'attributes-1', type: 'attributeData', x: 2, y: 12, width: 96, height: 60, locked: false, visible: true, content: { style: 'table', showLabels: true, fontSize: 11 } },
      { id: 'text-1', type: 'text', x: 2, y: 75, width: 96, height: 8, locked: false, visible: true, content: { text: 'This report is for informational purposes only.', fontSize: 9, fontWeight: 'normal', align: 'center', backgroundColor: '#f8fafc', color: '#64748b' } },
      { id: 'pageNumber-1', type: 'pageNumber', x: 45, y: 95, width: 10, height: 3, locked: false, visible: true, content: { format: 'Page {current} of {total}', fontSize: 9, align: 'center' } }
    ],
    mapExportTemplateId: null
  }
];

/**
 * GlobalExportTemplateLibrary - Global template library management for super admins
 */
export default function GlobalExportTemplateLibrary({
  db,
  addToast,
  confirm,
  adminEmail,
  accentColor = '#004E7C'
}) {
  const [activeTab, setActiveTab] = useState('map'); // 'map' or 'feature'
  const [mapTemplates, setMapTemplates] = useState([]);
  const [featureTemplates, setFeatureTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalMapTemplates, setOriginalMapTemplates] = useState([]);
  const [originalFeatureTemplates, setOriginalFeatureTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [expandedTemplates, setExpandedTemplates] = useState({});

  // Subscribe to system config for real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToSystemConfig((config) => {
      const maps = config.globalExportTemplates || [];
      const features = config.globalFeatureExportTemplates || [];
      setMapTemplates(maps);
      setFeatureTemplates(features);
      setOriginalMapTemplates(JSON.parse(JSON.stringify(maps)));
      setOriginalFeatureTemplates(JSON.parse(JSON.stringify(features)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Track changes
  useEffect(() => {
    const mapChanged = JSON.stringify(mapTemplates) !== JSON.stringify(originalMapTemplates);
    const featureChanged = JSON.stringify(featureTemplates) !== JSON.stringify(originalFeatureTemplates);
    setHasChanges(mapChanged || featureChanged);
  }, [mapTemplates, featureTemplates, originalMapTemplates, originalFeatureTemplates]);

  // Save all changes
  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateGlobalExportTemplates(mapTemplates, adminEmail),
        updateGlobalFeatureExportTemplates(featureTemplates, adminEmail)
      ]);
      setOriginalMapTemplates(JSON.parse(JSON.stringify(mapTemplates)));
      setOriginalFeatureTemplates(JSON.parse(JSON.stringify(featureTemplates)));
      addToast?.('Global templates saved successfully', 'success');
    } catch (err) {
      console.error('Error saving global templates:', err);
      addToast?.('Failed to save global templates', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    confirm?.({
      title: 'Discard Changes',
      message: 'Are you sure you want to discard all unsaved changes?',
      destructive: true,
      confirmLabel: 'Discard',
      onConfirm: () => {
        setMapTemplates(JSON.parse(JSON.stringify(originalMapTemplates)));
        setFeatureTemplates(JSON.parse(JSON.stringify(originalFeatureTemplates)));
        addToast?.('Changes discarded', 'info');
      }
    });
  };

  // Create new blank template
  const handleCreateBlank = () => {
    setEditingTemplate({
      isNew: true,
      type: activeTab,
      data: null
    });
  };

  // Create from default template
  const handleCreateFromDefault = (defaultTemplate) => {
    const now = new Date().toISOString();
    const newTemplate = {
      ...defaultTemplate,
      id: `global-${activeTab}-${Date.now()}`,
      name: `${defaultTemplate.name} Copy`,
      createdAt: now,
      updatedAt: now
    };

    setEditingTemplate({
      isNew: true,
      type: activeTab,
      data: newTemplate
    });
  };

  // Edit existing template
  const handleEditTemplate = (template) => {
    setEditingTemplate({
      isNew: false,
      type: activeTab,
      data: template
    });
  };

  // Duplicate template
  const handleDuplicateTemplate = (template) => {
    const now = new Date().toISOString();
    const newTemplate = {
      ...template,
      id: `global-${activeTab}-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: now,
      updatedAt: now
    };

    if (activeTab === 'map') {
      setMapTemplates([...mapTemplates, newTemplate]);
    } else {
      setFeatureTemplates([...featureTemplates, newTemplate]);
    }
    addToast?.('Template duplicated', 'success');
  };

  // Delete template
  const handleDeleteTemplate = (templateId, templateName) => {
    confirm?.({
      title: 'Delete Global Template',
      message: `Are you sure you want to delete "${templateName}"? Organizations using this template will no longer see it in their template library.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        if (activeTab === 'map') {
          setMapTemplates(mapTemplates.filter(t => t.id !== templateId));
        } else {
          setFeatureTemplates(featureTemplates.filter(t => t.id !== templateId));
        }
        addToast?.('Template deleted', 'success');
      }
    });
  };

  // Save template from editor
  const handleSaveTemplate = (templateData) => {
    const now = new Date().toISOString();

    if (editingTemplate.isNew) {
      const newTemplate = {
        ...templateData,
        id: templateData.id || `global-${activeTab}-${Date.now()}`,
        createdAt: now,
        updatedAt: now
      };

      if (editingTemplate.type === 'map') {
        setMapTemplates([...mapTemplates, newTemplate]);
      } else {
        setFeatureTemplates([...featureTemplates, newTemplate]);
      }
      addToast?.('Template created', 'success');
    } else {
      const updatedTemplate = { ...templateData, updatedAt: now };

      if (editingTemplate.type === 'map') {
        setMapTemplates(mapTemplates.map(t =>
          t.id === templateData.id ? updatedTemplate : t
        ));
      } else {
        setFeatureTemplates(featureTemplates.map(t =>
          t.id === templateData.id ? updatedTemplate : t
        ));
      }
      addToast?.('Template updated', 'success');
    }
    setEditingTemplate(null);
  };

  // Toggle template expansion
  const toggleExpansion = (templateId) => {
    setExpandedTemplates(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  // Get page size display name
  const getPageSizeDisplay = (template) => {
    const PAGE_SIZES = {
      'letter-landscape': 'Letter Landscape (11x8.5")',
      'letter-portrait': 'Letter Portrait (8.5x11")',
      'legal-landscape': 'Legal Landscape (14x8.5")',
      'legal-portrait': 'Legal Portrait (8.5x14")',
      'tabloid-landscape': 'Tabloid Landscape (17x11")',
      'tabloid-portrait': 'Tabloid Portrait (11x17")',
      'a4-landscape': 'A4 Landscape',
      'a4-portrait': 'A4 Portrait',
      'a3-landscape': 'A3 Landscape',
      'a3-portrait': 'A3 Portrait',
      'custom': `Custom (${template.customWidth}x${template.customHeight}")`
    };
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  const currentTemplates = activeTab === 'map' ? mapTemplates : featureTemplates;
  const defaultTemplates = activeTab === 'map' ? DEFAULT_MAP_EXPORT_TEMPLATES : DEFAULT_FEATURE_EXPORT_TEMPLATES;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: accentColor }}
          >
            <Library className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Global Export Templates</h2>
            <p className="text-sm text-slate-500">
              Create templates that org admins can use as starting points
            </p>
          </div>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Global Template Library</p>
          <p className="mt-1 text-blue-700">
            Templates you create here will appear in the "From Template" menu for all organization admins.
            When an org admin selects a global template, a copy is created in their organization's template library.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('map')}
          className={`
            px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2
            ${activeTab === 'map'
              ? 'border-current text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }
          `}
          style={activeTab === 'map' ? { borderColor: accentColor, color: accentColor } : {}}
        >
          <Printer className="w-4 h-4" />
          Map Export Templates
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">
            {mapTemplates.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('feature')}
          className={`
            px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2
            ${activeTab === 'feature'
              ? 'border-current text-slate-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }
          `}
          style={activeTab === 'feature' ? { borderColor: accentColor, color: accentColor } : {}}
        >
          <FileOutput className="w-4 h-4" />
          Feature Export Templates
          <span className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">
            {featureTemplates.length}
          </span>
        </button>
      </div>

      {/* Template Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {currentTemplates.length === 0
            ? 'No templates in the global library yet'
            : `${currentTemplates.length} template${currentTemplates.length !== 1 ? 's' : ''} in library`
          }
        </div>
        <div className="flex gap-2">
          <div className="relative group">
            <button
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <LayoutTemplate className="w-4 h-4" />
              From Starter
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* Dropdown menu */}
            <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <div className="p-2">
                <div className="text-xs font-medium text-slate-400 uppercase px-3 py-2">
                  Starter Templates
                </div>
                {defaultTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleCreateFromDefault(template)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg text-left hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    >
                      {activeTab === 'map' ? (
                        <Printer className="w-4 h-4" />
                      ) : (
                        <FileOutput className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm">{template.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{template.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateBlank}
            className="px-3 py-2 text-sm text-white rounded-lg flex items-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </div>

      {/* Templates List */}
      {currentTemplates.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          {activeTab === 'map' ? (
            <Printer className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          ) : (
            <FileOutput className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          )}
          <h4 className="text-lg font-medium text-slate-700 mb-1">
            No {activeTab === 'map' ? 'Map Export' : 'Feature Export'} Templates
          </h4>
          <p className="text-sm text-slate-500 mb-4">
            Create global templates that org admins can use as starting points.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => handleCreateFromDefault(defaultTemplates[0])}
              className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            >
              <LayoutTemplate className="w-4 h-4" />
              Start from Template
            </button>
            <button
              onClick={handleCreateBlank}
              className="px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-4 h-4" />
              Create Blank
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {currentTemplates.map(template => (
            <div
              key={template.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              {/* Template Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => toggleExpansion(template.id)}
              >
                <button className="text-slate-400">
                  {expandedTemplates[template.id] ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>

                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {activeTab === 'map' ? (
                    <Printer className="w-5 h-5" />
                  ) : (
                    <FileOutput className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-800 truncate">
                      {template.name}
                    </h4>
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Global
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {template.description || getPageSizeDisplay(template)}
                    {template.elements && ` - ${template.elements.length} elements`}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Edit template"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicateTemplate(template)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Duplicate template"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id, template.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTemplates[template.id] && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Page Size</span>
                      <p className="font-medium text-slate-700">{getPageSizeDisplay(template)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Elements</span>
                      <p className="font-medium text-slate-700">{template.elements?.length || 0} items</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Created</span>
                      <p className="font-medium text-slate-700">
                        {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Updated</span>
                      <p className="font-medium text-slate-700">
                        {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {template.description && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <span className="text-xs text-slate-500 uppercase font-medium">Description</span>
                      <p className="text-sm text-slate-700 mt-1">{template.description}</p>
                    </div>
                  )}

                  {/* Element summary */}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-medium">Elements</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {template.elements?.map(element => (
                        <span
                          key={element.id}
                          className="px-2 py-1 text-xs bg-white border border-slate-200 text-slate-700 rounded"
                        >
                          {element.type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Template Editor Modal */}
      {editingTemplate && editingTemplate.type === 'map' && (
        <ExportTemplateEditor
          data={editingTemplate.data}
          orgData={null}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
          accentColor={accentColor}
          isGlobalTemplate={true}
        />
      )}

      {editingTemplate && editingTemplate.type === 'feature' && (
        <FeatureExportTemplateEditor
          data={editingTemplate.data}
          orgData={null}
          mapExportTemplates={mapTemplates}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
          accentColor={accentColor}
          isGlobalTemplate={true}
        />
      )}
    </div>
  );
}
