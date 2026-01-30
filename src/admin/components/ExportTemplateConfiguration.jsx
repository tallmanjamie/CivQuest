// src/admin/components/ExportTemplateConfiguration.jsx
// Organization-level export template management
// Allows org admins to create, edit, duplicate, and delete export templates
//
// TEMPLATE STORAGE: Templates are stored in organizations/{orgId}.atlasConfig.exportTemplates
// or atlasConfigDraft.exportTemplates for the draft/publish workflow
//
// GLOBAL TEMPLATES: Super-admin managed templates are fetched from system config
// and displayed in the "From Template" modal alongside starter templates

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  LayoutTemplate,
  AlertCircle,
  Check,
  Clock,
  Settings,
  Printer,
  FileImage,
  X,
  Globe,
  RefreshCw
} from 'lucide-react';
import ExportTemplateEditor from './ExportTemplateEditor';
import { subscribeToGlobalExportTemplates } from '../../shared/services/systemConfig';

// Default templates that can be used as starting points
const STARTER_TEMPLATES = [
  {
    id: 'starter-landscape',
    name: 'Standard Landscape',
    description: 'Classic landscape layout with header, map, sidebar legend, and footer',
    pageSize: 'letter-landscape',
    elements: [
      { id: 'map-1', type: 'map', x: 2, y: 12, width: 65, height: 75, locked: false, visible: true },
      { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 10, locked: false, visible: true, content: { text: 'Map Title', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' } },
      { id: 'legend-1', type: 'legend', x: 70, y: 12, width: 28, height: 60, locked: false, visible: true, content: { showTitle: true, title: 'Legend' } },
      { id: 'scalebar-1', type: 'scalebar', x: 45, y: 88, width: 20, height: 4, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'footer-1', type: 'text', x: 0, y: 93, width: 100, height: 7, locked: false, visible: true, content: { text: 'This map is for informational purposes only.', fontSize: 10, fontWeight: 'normal', align: 'center', backgroundColor: '#f8fafc', color: '#64748b' } }
    ]
  },
  {
    id: 'starter-portrait',
    name: 'Standard Portrait',
    description: 'Portrait layout with header, large map area, and bottom legend',
    pageSize: 'letter-portrait',
    elements: [
      { id: 'map-1', type: 'map', x: 2, y: 12, width: 96, height: 55, locked: false, visible: true },
      { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 10, locked: false, visible: true, content: { text: 'Map Title', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' } },
      { id: 'legend-1', type: 'legend', x: 2, y: 70, width: 40, height: 25, locked: false, visible: true, content: { showTitle: true, title: 'Legend' } },
      { id: 'scalebar-1', type: 'scalebar', x: 55, y: 70, width: 25, height: 5, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'northArrow-1', type: 'northArrow', x: 85, y: 70, width: 12, height: 12, locked: false, visible: true, content: { style: 'default' } },
      { id: 'footer-1', type: 'text', x: 0, y: 94, width: 100, height: 6, locked: false, visible: true, content: { text: 'This map is for informational purposes only.', fontSize: 9, fontWeight: 'normal', align: 'center', backgroundColor: '#f8fafc', color: '#64748b' } }
    ]
  },
  {
    id: 'starter-maponly',
    name: 'Map Only',
    description: 'Full page map with minimal overlays - scalebar and north arrow only',
    pageSize: 'letter-landscape',
    elements: [
      { id: 'map-1', type: 'map', x: 0, y: 0, width: 100, height: 100, locked: false, visible: true },
      { id: 'scalebar-1', type: 'scalebar', x: 75, y: 92, width: 22, height: 5, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'northArrow-1', type: 'northArrow', x: 92, y: 5, width: 6, height: 8, locked: false, visible: true, content: { style: 'default' } }
    ]
  },
  {
    id: 'starter-presentation',
    name: 'Presentation Style',
    description: 'Clean layout with prominent title and logo areas for presentations',
    pageSize: 'tabloid-landscape',
    elements: [
      { id: 'map-1', type: 'map', x: 2, y: 18, width: 70, height: 72, locked: false, visible: true },
      { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 15, locked: false, visible: true, content: { text: 'Project Title', fontSize: 36, fontWeight: 'bold', align: 'center', backgroundColor: '#0f172a', color: '#ffffff' } },
      { id: 'logo-1', type: 'logo', x: 2, y: 2, width: 10, height: 10, locked: false, visible: true, content: { source: 'org-logo', alt: 'Organization Logo' } },
      { id: 'legend-1', type: 'legend', x: 75, y: 18, width: 23, height: 45, locked: false, visible: true, content: { showTitle: true, title: 'Map Legend' } },
      { id: 'text-1', type: 'text', x: 75, y: 65, width: 23, height: 25, locked: false, visible: true, content: { text: 'Additional notes or description can be added here.', fontSize: 11, fontWeight: 'normal', align: 'left', backgroundColor: '#f1f5f9', color: '#334155' } },
      { id: 'scalebar-1', type: 'scalebar', x: 55, y: 91, width: 15, height: 4, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'footer-1', type: 'text', x: 0, y: 95, width: 100, height: 5, locked: false, visible: true, content: { text: 'Confidential - For Internal Use Only', fontSize: 9, fontWeight: 'normal', align: 'center', backgroundColor: '#f8fafc', color: '#94a3b8' } }
    ]
  }
];

/**
 * ExportTemplateConfiguration Component
 * 
 * Manages export templates for an organization
 * 
 * Props:
 * @param {array} templates - Array of existing templates
 * @param {object} orgData - Organization data
 * @param {function} onUpdate - Called with updated templates array
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color
 */
export default function ExportTemplateConfiguration({
  templates = [],
  orgData,
  onUpdate,
  addToast,
  confirm,
  accentColor = '#004E7C'
}) {
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showStarterPicker, setShowStarterPicker] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState({});
  const [globalTemplates, setGlobalTemplates] = useState([]);
  const [loadingGlobalTemplates, setLoadingGlobalTemplates] = useState(true);

  // Subscribe to global templates from system config
  useEffect(() => {
    const unsubscribe = subscribeToGlobalExportTemplates((templates) => {
      setGlobalTemplates(templates || []);
      setLoadingGlobalTemplates(false);
    });

    return () => unsubscribe();
  }, []);

  // Create new blank template
  const handleCreateBlank = () => {
    setEditingTemplate({
      isNew: true,
      data: null
    });
  };

  // Create from starter template
  const handleCreateFromStarter = (starter) => {
    const newTemplate = {
      ...starter,
      id: `template-${Date.now()}`,
      name: `${starter.name} Copy`,
      createdAt: new Date().toISOString()
    };
    
    setEditingTemplate({
      isNew: true,
      data: newTemplate
    });
    setShowStarterPicker(false);
  };

  // Edit existing template
  const handleEditTemplate = (template) => {
    setEditingTemplate({
      isNew: false,
      data: template
    });
  };

  // Duplicate template
  const handleDuplicateTemplate = (template) => {
    const newTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    
    onUpdate([...templates, newTemplate]);
    addToast?.('Template duplicated successfully', 'success');
  };

  // Delete template
  const handleDeleteTemplate = (templateId, templateName) => {
    confirm?.({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        onUpdate(templates.filter(t => t.id !== templateId));
        addToast?.('Template deleted', 'success');
      }
    });
  };

  // Toggle template enabled/disabled
  const handleToggleEnabled = (templateId) => {
    onUpdate(templates.map(t => 
      t.id === templateId ? { ...t, enabled: !t.enabled } : t
    ));
  };

  // Save template from editor
  const handleSaveTemplate = (templateData) => {
    if (editingTemplate.isNew) {
      onUpdate([...templates, { ...templateData, createdAt: new Date().toISOString(), enabled: true }]);
      addToast?.('Template created successfully', 'success');
    } else {
      onUpdate(templates.map(t => 
        t.id === templateData.id ? { ...templateData, updatedAt: new Date().toISOString() } : t
      ));
      addToast?.('Template updated successfully', 'success');
    }
    setEditingTemplate(null);
  };

  // Toggle template expansion in list
  const toggleExpansion = (templateId) => {
    setExpandedTemplates(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  // Get page size display name
  const getPageSizeDisplay = (template) => {
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
      'custom': `Custom (${template.customWidth}×${template.customHeight}")`
    };
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Export Templates</h3>
          <p className="text-sm text-slate-500">
            Design custom layouts for map exports. Templates can be used in any map's export tool.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStarterPicker(true)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <LayoutTemplate className="w-4 h-4" />
            From Template
          </button>
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
      {templates.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <FileImage className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h4 className="text-lg font-medium text-slate-700 mb-1">No Export Templates</h4>
          <p className="text-sm text-slate-500 mb-4">
            Create custom export templates to define how maps are printed or exported as PDF/images.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowStarterPicker(true)}
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
          {templates.map(template => (
            <div
              key={template.id}
              className={`
                bg-white border rounded-xl overflow-hidden transition-shadow
                ${template.enabled !== false ? 'border-slate-200' : 'border-slate-200 bg-slate-50'}
              `}
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
                  style={{ backgroundColor: template.enabled !== false ? accentColor : '#94a3b8' }}
                >
                  <Printer className="w-5 h-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium truncate ${template.enabled !== false ? 'text-slate-800' : 'text-slate-500'}`}>
                      {template.name}
                    </h4>
                    {template.enabled === false && (
                      <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {getPageSizeDisplay(template)} • {template.elements?.length || 0} elements
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleEnabled(template.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    title={template.enabled !== false ? 'Disable template' : 'Enable template'}
                  >
                    {template.enabled !== false ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
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

                  {/* Element summary */}
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-xs text-slate-500 uppercase font-medium">Elements</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {template.elements?.map(element => (
                        <span
                          key={element.id}
                          className={`
                            px-2 py-1 text-xs rounded
                            ${element.visible !== false ? 'bg-white border border-slate-200 text-slate-700' : 'bg-slate-200 text-slate-500'}
                          `}
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

      {/* Template Picker Modal (Starter + Global Templates) */}
      {showStarterPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Choose a Template</h3>
                <p className="text-sm text-slate-500">Select a template to customize</p>
              </div>
              <button
                onClick={() => setShowStarterPicker(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Global Templates Section */}
              {loadingGlobalTemplates ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : globalTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Global Templates
                    </h4>
                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                      {globalTemplates.length}
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {globalTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleCreateFromStarter(template)}
                        className="flex items-start gap-4 p-4 border border-blue-200 bg-blue-50/50 rounded-xl text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-blue-600"
                        >
                          <Globe className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-800">{template.name}</h4>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{template.description || 'Global template from system library'}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span>
                              {template.pageSize?.includes('landscape') ? 'Landscape' : 'Portrait'}
                            </span>
                            <span>-</span>
                            <span>{template.elements?.length || 0} elements</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Starter Templates Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <LayoutTemplate className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Starter Templates
                  </h4>
                </div>
                <div className="grid gap-3">
                  {STARTER_TEMPLATES.map(starter => (
                    <button
                      key={starter.id}
                      onClick={() => handleCreateFromStarter(starter)}
                      className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: accentColor }}
                      >
                        <LayoutTemplate className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800">{starter.name}</h4>
                        <p className="text-sm text-slate-500 mt-0.5">{starter.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>
                            {starter.pageSize.includes('landscape') ? 'Landscape' : 'Portrait'}
                          </span>
                          <span>-</span>
                          <span>{starter.elements.length} elements</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowStarterPicker(false)}
                className="w-full px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {editingTemplate && (
        <ExportTemplateEditor
          data={editingTemplate.data}
          orgData={orgData}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}
