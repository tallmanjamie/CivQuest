// src/admin/components/AtlasAdminSection.jsx
// Atlas Admin Section - integrates into AdminApp
// Provides atlas configuration management for both super_admin and org_admin roles
//
// UPDATED:
// - MapEditor wrapper now passes orgData for license enforcement
// - Added Export Templates tab for managing export templates at organization level
// - Export templates are stored in atlasConfig.exportTemplates
// - Added Feature Export Templates tab for managing feature export templates
// - Feature export templates are stored in atlasConfig.featureExportTemplates
// - Super admin can now manage templates across all organizations

import React, { useState, useEffect } from 'react';
import {
  Map,
  Settings,
  Layers,
  Eye,
  AlertCircle,
  Users,
  Printer,
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Copy,
  EyeOff,
  Search,
  Loader2,
  LayoutTemplate,
  FileImage,
  X,
  Link2,
  Globe,
  Save,
  RotateCcw,
  FileOutput
} from 'lucide-react';
import { doc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { PATHS } from '../../shared/services/paths';
import AtlasConfiguration from './AtlasConfiguration';
import AtlasSettingsEditor from './AtlasSettingsEditor';
import MapEditor from './MapEditor';
import ServiceFinder from './ServiceFinder';
import AtlasUserManagement from './AtlasUserManagement';
import ExportTemplateConfiguration from './ExportTemplateConfiguration';
import ExportTemplateEditor from './ExportTemplateEditor';
import FeatureExportTemplateConfiguration from './FeatureExportTemplateConfiguration';
import FeatureExportTemplateEditor from './FeatureExportTemplateEditor';

/**
 * AtlasAdminSection Component
 * 
 * Renders the Atlas admin content based on the active tab.
 * Works with both super_admin and org_admin roles.
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'super_admin' | 'org_admin'
 * @param {string} activeTab - Current active tab ID
 * @param {string} [orgId] - Organization ID (for org_admin)
 * @param {object} [orgData] - Organization data (for org_admin)
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} accentColor - Theme accent color
 * @param {string} [adminEmail] - Current admin's email for audit trail
 */
export default function AtlasAdminSection({
  db,
  role,
  activeTab,
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor,
  adminEmail = null
}) {
  // Service Finder modal state
  const [showServiceFinder, setShowServiceFinder] = useState(false);
  const [serviceFinderCallback, setServiceFinderCallback] = useState(null);
  
  // Print service URL state for org_admin
  const [printServiceUrl, setPrintServiceUrl] = useState('');
  const [savingPrintService, setSavingPrintService] = useState(false);

  // Check if Atlas is initialized (live or draft)
  const hasAtlasConfig = !!orgData?.atlasConfig || !!orgData?.atlasConfigDraft;
  
  // Get working config (draft takes precedence)
  const workingConfig = orgData?.atlasConfigDraft || orgData?.atlasConfig;
  
  // Initialize print service URL from config
  useEffect(() => {
    if (workingConfig?.printServiceUrl) {
      setPrintServiceUrl(workingConfig.printServiceUrl);
    } else {
      setPrintServiceUrl(DEFAULT_PRINT_SERVICE_URL);
    }
  }, [workingConfig?.printServiceUrl]);

  // Handle service finder selection
  const handleOpenServiceFinder = (callback) => {
    setServiceFinderCallback(() => callback);
    setShowServiceFinder(true);
  };

  const handleServiceSelect = (serviceUrl) => {
    if (serviceFinderCallback) {
      serviceFinderCallback(serviceUrl);
    }
    setShowServiceFinder(false);
    setServiceFinderCallback(null);
  };
  
  // Handle print service URL save (org_admin)
  const handleSavePrintServiceUrl = async () => {
    if (!db || !orgId) {
      addToast?.('Unable to save: missing database connection', 'error');
      return;
    }

    try {
      setSavingPrintService(true);
      const configField = orgData?.atlasConfigDraft ? 'atlasConfigDraft' : 'atlasConfig';
      const currentConfig = orgData?.[configField] || {};
      
      const updatedConfig = {
        ...currentConfig,
        printServiceUrl: printServiceUrl || DEFAULT_PRINT_SERVICE_URL
      };

      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, { [configField]: updatedConfig });

      addToast?.('Print service URL saved', 'success');
    } catch (error) {
      console.error('Error saving print service URL:', error);
      addToast?.('Failed to save print service URL', 'error');
    } finally {
      setSavingPrintService(false);
    }
  };

  // Handle export templates update
  const handleUpdateExportTemplates = async (templates) => {
    if (!db || !orgId) {
      addToast?.('Unable to save: missing database connection', 'error');
      return;
    }

    try {
      // Determine which config to update (prefer draft if it exists)
      const configField = orgData?.atlasConfigDraft ? 'atlasConfigDraft' : 'atlasConfig';
      const currentConfig = orgData?.[configField] || {};

      // Update the config with new templates
      const updatedConfig = {
        ...currentConfig,
        exportTemplates: templates
      };

      // Save to Firestore
      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, {
        [configField]: updatedConfig
      });

      addToast?.('Export templates saved', 'success');
    } catch (error) {
      console.error('Error saving export templates:', error);
      addToast?.('Failed to save export templates', 'error');
    }
  };

  // Handle feature export templates update
  const handleUpdateFeatureExportTemplates = async (templates) => {
    if (!db || !orgId) {
      addToast?.('Unable to save: missing database connection', 'error');
      return;
    }

    try {
      // Determine which config to update (prefer draft if it exists)
      const configField = orgData?.atlasConfigDraft ? 'atlasConfigDraft' : 'atlasConfig';
      const currentConfig = orgData?.[configField] || {};

      // Update the config with new feature export templates
      const updatedConfig = {
        ...currentConfig,
        featureExportTemplates: templates
      };

      // Save to Firestore
      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, {
        [configField]: updatedConfig
      });

      addToast?.('Feature export templates saved', 'success');
    } catch (error) {
      console.error('Error saving feature export templates:', error);
      addToast?.('Failed to save feature export templates', 'error');
    }
  };

  // Render based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'configuration':
      case 'maps':
        // Main atlas configuration view
        return (
          <AtlasConfiguration
            db={db}
            role={role === 'super_admin' ? 'admin' : 'org_admin'}
            orgId={orgId}
            orgData={orgData}
            addToast={addToast}
            confirm={confirm}
            accentColor={accentColor}
            AtlasSettingsModal={AtlasSettingsEditor}
            // UPDATED: MapEditor wrapper now passes orgData for license enforcement
            MapEditModal={({ data, orgData: passedOrgData, onClose, onSave }) => (
              <MapEditor
                data={data}
                orgData={passedOrgData}
                onClose={onClose}
                onSave={onSave}
                accentColor={accentColor}
                onOpenServiceFinder={(type) => handleOpenServiceFinder((url) => {
                  console.log('Selected service:', url, 'for type:', type);
                })}
              />
            )}
          />
        );

      case 'export-templates':
        // Export template management
        // For super_admin: show org selector then template editor
        // For org_admin: check if Atlas is initialized first
        
        if (role === 'super_admin') {
          return (
            <SuperAdminExportTemplates
              db={db}
              addToast={addToast}
              confirm={confirm}
              accentColor={accentColor}
            />
          );
        }
        
        if (!hasAtlasConfig) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
              <p className="text-slate-500 mb-4">
                You need to initialize Atlas before you can manage export templates.
              </p>
              <p className="text-sm text-slate-400">
                Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Print Service Configuration */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-800">Print Service Configuration</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Print Service URL
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        value={printServiceUrl}
                        onChange={(e) => setPrintServiceUrl(e.target.value)}
                        placeholder={DEFAULT_PRINT_SERVICE_URL}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                      />
                    </div>
                    <button
                      onClick={() => setPrintServiceUrl(DEFAULT_PRINT_SERVICE_URL)}
                      className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                      title="Reset to default"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleSavePrintServiceUrl}
                      disabled={savingPrintService}
                      className="px-4 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: accentColor }}
                    >
                      {savingPrintService ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    ArcGIS Print Service endpoint used to generate map exports. This should be a valid Export Web Map Task URL.
                  </p>
                </div>
              </div>
            </div>

            {/* Export Templates */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <ExportTemplateConfiguration
                templates={workingConfig?.exportTemplates || []}
                orgData={orgData}
                onUpdate={handleUpdateExportTemplates}
                addToast={addToast}
                confirm={confirm}
                accentColor={accentColor}
              />
            </div>
          </div>
        );

      case 'feature-export-templates':
        // Feature export template management
        // For super_admin: show org selector then template editor
        // For org_admin: check if Atlas is initialized first

        if (role === 'super_admin') {
          return (
            <SuperAdminFeatureExportTemplates
              db={db}
              addToast={addToast}
              confirm={confirm}
              accentColor={accentColor}
            />
          );
        }

        if (!hasAtlasConfig) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
              <p className="text-slate-500 mb-4">
                You need to initialize Atlas before you can manage feature export templates.
              </p>
              <p className="text-sm text-slate-400">
                Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
              </p>
            </div>
          );
        }

        return (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <FeatureExportTemplateConfiguration
              templates={workingConfig?.featureExportTemplates || []}
              mapExportTemplates={workingConfig?.exportTemplates || []}
              orgData={orgData}
              onUpdate={handleUpdateFeatureExportTemplates}
              addToast={addToast}
              confirm={confirm}
              accentColor={accentColor}
            />
          </div>
        );

      case 'users':
        // Atlas user management
        // For org_admin: check if Atlas is initialized first
        if (role === 'org_admin' && !hasAtlasConfig) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
              <p className="text-slate-500 mb-4">
                You need to initialize Atlas before you can manage users.
              </p>
              <p className="text-sm text-slate-400">
                Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
              </p>
            </div>
          );
        }

        return (
          <AtlasUserManagement
            db={db}
            role={role === 'super_admin' ? 'admin' : 'org_admin'}
            orgId={orgId}
            orgData={orgData}
            addToast={addToast}
            confirm={confirm}
            accentColor={accentColor}
            adminEmail={adminEmail}
          />
        );

      case 'preview':
        // Atlas preview (link to atlas app) - only for org_admin
        if (!hasAtlasConfig) {
          return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
              <p className="text-slate-500 mb-4">
                You need to initialize Atlas before you can preview it.
              </p>
              <p className="text-sm text-slate-400">
                Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
              </p>
            </div>
          );
        }

        // org_admin with Atlas initialized
        const hasDraftConfig = !!orgData?.atlasConfigDraft;
        
        return (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
              <Eye className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Preview Atlas</h3>
              <p className="text-slate-500 mb-6">
                See how your Atlas configuration looks to end users.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* Preview Live */}
                <a
                  href={`/atlas?org=${orgId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
                >
                  <Map className="w-4 h-4" />
                  Preview Live
                </a>
                
                {/* Preview Draft (only if draft exists) */}
                {hasDraftConfig && (
                  <a
                    href={`/atlas?org=${orgId}&preview=draft`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-2 text-white rounded-lg font-medium"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Eye className="w-4 h-4" />
                    Preview Draft Changes
                  </a>
                )}
              </div>
              
              {hasDraftConfig && (
                <p className="text-sm text-amber-600 mt-4">
                  You have unpublished changes. Preview Draft to see your changes before publishing.
                </p>
              )}
            </div>

            {/* Preview Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="font-medium text-slate-700 mb-2">About Preview</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• <strong>Preview Live</strong> shows the current published configuration that users see</li>
                <li>• <strong>Preview Draft</strong> shows your unpublished changes (only visible to admins)</li>
                <li>• Changes must be published from the Maps tab to go live</li>
              </ul>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-slate-500">
            <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p>Select a tab to manage Atlas configuration.</p>
          </div>
        );
    }
  };

  return (
    <>
      {renderContent()}

      {/* Service Finder Modal */}
      {showServiceFinder && (
        <ServiceFinder
          isOpen={showServiceFinder}
          onClose={() => setShowServiceFinder(false)}
          onSelect={handleServiceSelect}
        />
      )}
    </>
  );
}

// Page size display helper
const PAGE_SIZES = {
  'letter-landscape': 'Letter Landscape',
  'letter-portrait': 'Letter Portrait',
  'legal-landscape': 'Legal Landscape',
  'legal-portrait': 'Legal Portrait',
  'tabloid-landscape': 'Tabloid Landscape',
  'tabloid-portrait': 'Tabloid Portrait',
  'a4-landscape': 'A4 Landscape',
  'a4-portrait': 'A4 Portrait',
  'a3-landscape': 'A3 Landscape',
  'a3-portrait': 'A3 Portrait',
  'custom': 'Custom'
};

// Default print service URL
const DEFAULT_PRINT_SERVICE_URL = 'https://maps.civ.quest/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task';

// Default starter templates
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
    description: 'Full page map with minimal overlays',
    pageSize: 'letter-landscape',
    elements: [
      { id: 'map-1', type: 'map', x: 0, y: 0, width: 100, height: 100, locked: false, visible: true },
      { id: 'scalebar-1', type: 'scalebar', x: 75, y: 92, width: 22, height: 5, locked: false, visible: true, content: { style: 'line', units: 'feet' } },
      { id: 'northArrow-1', type: 'northArrow', x: 92, y: 5, width: 6, height: 8, locked: false, visible: true, content: { style: 'default' } }
    ]
  }
];

/**
 * SuperAdminExportTemplates Component
 * 
 * Super Admin view for managing export templates across all organizations
 */
function SuperAdminExportTemplates({ db, addToast, confirm, accentColor = '#004E7C' }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showStarterPicker, setShowStarterPicker] = useState(null);
  const [editingPrintService, setEditingPrintService] = useState({}); // { orgId: urlValue }
  const [savingPrintService, setSavingPrintService] = useState({});

  // Fetch all organizations
  useEffect(() => {
    const q = collection(db, PATHS.organizations);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orgs = snapshot.docs.map(docSnap => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      }));
      setOrganizations(orgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  const getWorkingConfig = (org) => org.atlasConfigDraft || org.atlasConfig;
  const hasAtlas = (org) => !!org.atlasConfig || !!org.atlasConfigDraft;
  const getTemplates = (org) => getWorkingConfig(org)?.exportTemplates || [];
  const getPrintServiceUrl = (org) => getWorkingConfig(org)?.printServiceUrl || DEFAULT_PRINT_SERVICE_URL;

  const toggleOrg = (orgId) => {
    setExpandedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  // Initialize print service URL when org is expanded
  const handleOrgExpand = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    if (org && !editingPrintService[orgId]) {
      setEditingPrintService(prev => ({
        ...prev,
        [orgId]: getPrintServiceUrl(org)
      }));
    }
    toggleOrg(orgId);
  };

  // Save print service URL
  const savePrintServiceUrl = async (orgId) => {
    try {
      setSavingPrintService(prev => ({ ...prev, [orgId]: true }));
      const org = organizations.find(o => o.id === orgId);
      if (!org) return;

      const configField = org.atlasConfigDraft ? 'atlasConfigDraft' : 'atlasConfig';
      const currentConfig = org[configField] || {};
      
      const updatedConfig = { 
        ...currentConfig, 
        printServiceUrl: editingPrintService[orgId] || DEFAULT_PRINT_SERVICE_URL 
      };
      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, { [configField]: updatedConfig });

      addToast?.('Print service URL saved', 'success');
    } catch (error) {
      console.error('Error saving print service URL:', error);
      addToast?.('Failed to save print service URL', 'error');
    } finally {
      setSavingPrintService(prev => ({ ...prev, [orgId]: false }));
    }
  };

  // Reset print service URL to default
  const resetPrintServiceUrl = (orgId) => {
    setEditingPrintService(prev => ({
      ...prev,
      [orgId]: DEFAULT_PRINT_SERVICE_URL
    }));
  };

  const saveTemplates = async (orgId, templates) => {
    try {
      const org = organizations.find(o => o.id === orgId);
      if (!org) return;

      const configField = org.atlasConfigDraft ? 'atlasConfigDraft' : 'atlasConfig';
      const currentConfig = org[configField] || {};
      
      const updatedConfig = { ...currentConfig, exportTemplates: templates };
      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, { [configField]: updatedConfig });

      addToast?.('Export templates saved', 'success');
    } catch (error) {
      console.error('Error saving export templates:', error);
      addToast?.('Failed to save export templates', 'error');
    }
  };

  const handleCreateBlank = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    setEditingTemplate({ orgId, orgData: org, isNew: true, data: null });
  };

  const handleCreateFromStarter = (orgId, starter) => {
    const org = organizations.find(o => o.id === orgId);
    const newTemplate = {
      ...starter,
      id: `template-${Date.now()}`,
      name: `${starter.name}`,
      createdAt: new Date().toISOString()
    };
    setEditingTemplate({ orgId, orgData: org, isNew: true, data: newTemplate });
    setShowStarterPicker(null);
  };

  const handleEditTemplate = (orgId, template) => {
    const org = organizations.find(o => o.id === orgId);
    setEditingTemplate({ orgId, orgData: org, isNew: false, data: template });
  };

  const handleDuplicateTemplate = (orgId, template) => {
    const org = organizations.find(o => o.id === orgId);
    const templates = getTemplates(org);
    const newTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    saveTemplates(orgId, [...templates, newTemplate]);
  };

  const handleDeleteTemplate = (orgId, templateId, templateName) => {
    confirm?.({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        const org = organizations.find(o => o.id === orgId);
        const templates = getTemplates(org);
        saveTemplates(orgId, templates.filter(t => t.id !== templateId));
      }
    });
  };

  const handleToggleEnabled = (orgId, templateId) => {
    const org = organizations.find(o => o.id === orgId);
    const templates = getTemplates(org);
    saveTemplates(orgId, templates.map(t => 
      t.id === templateId ? { ...t, enabled: t.enabled === false ? true : false } : t
    ));
  };

  const handleSaveTemplate = (templateData) => {
    const { orgId, isNew } = editingTemplate;
    const org = organizations.find(o => o.id === orgId);
    const templates = getTemplates(org);

    if (isNew) {
      saveTemplates(orgId, [...templates, { ...templateData, createdAt: new Date().toISOString(), enabled: true }]);
    } else {
      saveTemplates(orgId, templates.map(t => 
        t.id === templateData.id ? { ...templateData, updatedAt: new Date().toISOString() } : t
      ));
    }
    setEditingTemplate(null);
  };

  const filteredOrgs = organizations.filter(org =>
    org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPageSizeDisplay = (template) => {
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}×${template.customHeight}")`;
    }
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Export Templates</h2>
          <p className="text-slate-500 text-sm">Manage map export templates for all organizations.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Organizations List */}
      {filteredOrgs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No organizations found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrgs.map(org => {
            const templates = getTemplates(org);
            const isExpanded = expandedOrgs[org.id];
            const atlasEnabled = hasAtlas(org);

            return (
              <div key={org.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Organization Header */}
                <button
                  onClick={() => handleOrgExpand(org.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                  
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: atlasEnabled ? accentColor : '#94a3b8' }}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-slate-800">{org.name}</h3>
                    <p className="text-sm text-slate-500">
                      {atlasEnabled ? (
                        <span>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-amber-600">Atlas not initialized</span>
                      )}
                    </p>
                  </div>

                  {atlasEnabled && templates.length > 0 && (
                    <div className="flex -space-x-1">
                      {templates.slice(0, 3).map((t) => (
                        <div 
                          key={t.id}
                          className="w-6 h-6 rounded bg-slate-200 border-2 border-white flex items-center justify-center"
                          title={t.name}
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                        </div>
                      ))}
                      {templates.length > 3 && (
                        <div className="w-6 h-6 rounded bg-slate-300 border-2 border-white flex items-center justify-center text-xs text-slate-600">
                          +{templates.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    {!atlasEnabled ? (
                      <div className="text-center py-6">
                        <AlertCircle className="w-10 h-10 mx-auto text-amber-400 mb-2" />
                        <p className="text-slate-600 font-medium">Atlas Not Initialized</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Initialize Atlas for this organization before managing export templates.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Print Service Configuration */}
                        <div className="bg-white rounded-lg border border-slate-200 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Globe className="w-4 h-4 text-slate-500" />
                            <h4 className="text-sm font-medium text-slate-700">Print Service URL</h4>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="url"
                                value={editingPrintService[org.id] ?? getPrintServiceUrl(org)}
                                onChange={(e) => setEditingPrintService(prev => ({
                                  ...prev,
                                  [org.id]: e.target.value
                                }))}
                                placeholder={DEFAULT_PRINT_SERVICE_URL}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                              />
                            </div>
                            <button
                              onClick={() => resetPrintServiceUrl(org.id)}
                              className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                              title="Reset to default"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => savePrintServiceUrl(org.id)}
                              disabled={savingPrintService[org.id]}
                              className="px-3 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                              style={{ backgroundColor: accentColor }}
                              title="Save print service URL"
                            >
                              {savingPrintService[org.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            ArcGIS Print Service endpoint used to generate map exports for this organization.
                          </p>
                        </div>

                        {/* Add Template Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowStarterPicker(org.id)}
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-white flex items-center gap-2"
                          >
                            <LayoutTemplate className="w-4 h-4" />
                            From Template
                          </button>
                          <button
                            onClick={() => handleCreateBlank(org.id)}
                            className="px-3 py-2 text-sm text-white rounded-lg flex items-center gap-2"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Plus className="w-4 h-4" />
                            New Blank
                          </button>
                        </div>

                        {/* Templates List */}
                        {templates.length === 0 ? (
                          <div className="text-center py-6 bg-white rounded-lg border border-dashed border-slate-300">
                            <FileImage className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="text-slate-500">No export templates yet</p>
                            <p className="text-sm text-slate-400">Create a template to enable map exports</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {templates.map(template => (
                              <div
                                key={template.id}
                                className={`flex items-center gap-3 p-3 bg-white rounded-lg border ${template.enabled === false ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}
                              >
                                <div 
                                  className="w-10 h-10 rounded flex items-center justify-center"
                                  style={{ 
                                    backgroundColor: template.enabled !== false ? `${accentColor}15` : '#f1f5f9',
                                    color: template.enabled !== false ? accentColor : '#94a3b8'
                                  }}
                                >
                                  <Printer className="w-5 h-5" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-800 truncate">{template.name}</h4>
                                  <p className="text-xs text-slate-500">
                                    {getPageSizeDisplay(template)} • {template.elements?.length || 0} elements
                                  </p>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleToggleEnabled(org.id, template.id)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title={template.enabled !== false ? 'Disable' : 'Enable'}
                                  >
                                    {template.enabled !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleEditTemplate(org.id, template)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateTemplate(org.id, template)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title="Duplicate"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTemplate(org.id, template.id, template.name)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    title="Delete"
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Starter Template Picker Modal */}
      {showStarterPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Choose a Starter Template</h3>
                <p className="text-sm text-slate-500">Select a template to customize</p>
              </div>
              <button onClick={() => setShowStarterPicker(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid gap-4">
                {STARTER_TEMPLATES.map(starter => (
                  <button
                    key={starter.id}
                    onClick={() => handleCreateFromStarter(showStarterPicker, starter)}
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
                        <span>{starter.pageSize.includes('landscape') ? 'Landscape' : 'Portrait'}</span>
                        <span>•</span>
                        <span>{starter.elements.length} elements</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowStarterPicker(null)}
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
          orgData={editingTemplate.orgData}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

/**
 * SuperAdminFeatureExportTemplates Component
 *
 * Super Admin view for managing feature export templates across all organizations
 */
function SuperAdminFeatureExportTemplates({ db, addToast, confirm, accentColor = '#004E7C' }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showStarterPicker, setShowStarterPicker] = useState(null);

  // Default starter templates for feature export
  const FEATURE_STARTER_TEMPLATES = [
    {
      id: 'starter-basic',
      name: 'Basic Feature Report',
      description: 'Simple layout with title, attributes, and optional map',
      pageSize: 'letter-portrait',
      elements: [
        { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 8, locked: false, visible: true, content: { text: 'Feature Report', fontSize: 24, fontWeight: 'bold', align: 'center', backgroundColor: '#1e293b', color: '#ffffff' } },
        { id: 'date-1', type: 'date', x: 80, y: 2, width: 18, height: 4, locked: false, visible: true, content: { format: 'MMMM D, YYYY', fontSize: 10, align: 'right', color: '#ffffff' } },
        { id: 'attributes-1', type: 'attributeData', x: 2, y: 12, width: 96, height: 60, locked: false, visible: true, content: { style: 'table', showLabels: true, fontSize: 11 } },
        { id: 'pageNumber-1', type: 'pageNumber', x: 45, y: 95, width: 10, height: 3, locked: false, visible: true, content: { format: 'Page {current} of {total}', fontSize: 9, align: 'center' } }
      ],
      mapExportTemplateId: null
    },
    {
      id: 'starter-compact',
      name: 'Compact Feature Card',
      description: 'Compact single-page summary with key attributes',
      pageSize: 'letter-landscape',
      elements: [
        { id: 'title-1', type: 'title', x: 0, y: 0, width: 100, height: 10, locked: false, visible: true, content: { text: 'Feature Summary', fontSize: 20, fontWeight: 'bold', align: 'center', backgroundColor: '#0f172a', color: '#ffffff' } },
        { id: 'date-1', type: 'date', x: 85, y: 2, width: 13, height: 6, locked: false, visible: true, content: { format: 'MM/DD/YYYY', fontSize: 10, align: 'right', color: '#ffffff' } },
        { id: 'attributes-1', type: 'attributeData', x: 2, y: 14, width: 96, height: 75, locked: false, visible: true, content: { style: 'list', showLabels: true, fontSize: 10 } },
        { id: 'pageNumber-1', type: 'pageNumber', x: 90, y: 92, width: 8, height: 4, locked: false, visible: true, content: { format: '{current}/{total}', fontSize: 8, align: 'right' } }
      ],
      mapExportTemplateId: null
    }
  ];

  // Fetch all organizations
  useEffect(() => {
    const q = collection(db, PATHS.organizations);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setOrganizations(orgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  const getWorkingConfig = (org) => org.atlasConfigDraft || org.atlasConfig;
  const hasAtlas = (org) => !!org.atlasConfig || !!org.atlasConfigDraft;
  const getTemplates = (org) => getWorkingConfig(org)?.featureExportTemplates || [];
  const getMapExportTemplates = (org) => getWorkingConfig(org)?.exportTemplates || [];

  const toggleOrg = (orgId) => {
    setExpandedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const saveTemplates = async (orgId, templates) => {
    try {
      const org = organizations.find(o => o.id === orgId);
      if (!org) return;

      const configField = org.atlasConfigDraft ? 'atlasConfigDraft' : 'atlasConfig';
      const currentConfig = org[configField] || {};

      const updatedConfig = { ...currentConfig, featureExportTemplates: templates };
      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, { [configField]: updatedConfig });

      addToast?.('Feature export templates saved', 'success');
    } catch (error) {
      console.error('Error saving feature export templates:', error);
      addToast?.('Failed to save feature export templates', 'error');
    }
  };

  const handleCreateBlank = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    setEditingTemplate({ orgId, orgData: org, isNew: true, data: null });
  };

  const handleCreateFromStarter = (orgId, starter) => {
    const org = organizations.find(o => o.id === orgId);
    const newTemplate = {
      ...starter,
      id: `feature-template-${Date.now()}`,
      name: `${starter.name}`,
      createdAt: new Date().toISOString()
    };
    setEditingTemplate({ orgId, orgData: org, isNew: true, data: newTemplate });
    setShowStarterPicker(null);
  };

  const handleEditTemplate = (orgId, template) => {
    const org = organizations.find(o => o.id === orgId);
    setEditingTemplate({ orgId, orgData: org, isNew: false, data: template });
  };

  const handleDuplicateTemplate = (orgId, template) => {
    const org = organizations.find(o => o.id === orgId);
    const templates = getTemplates(org);
    const newTemplate = {
      ...template,
      id: `feature-template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      createdAt: new Date().toISOString()
    };
    saveTemplates(orgId, [...templates, newTemplate]);
  };

  const handleDeleteTemplate = (orgId, templateId, templateName) => {
    confirm?.({
      title: 'Delete Feature Export Template',
      message: `Are you sure you want to delete "${templateName}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: () => {
        const org = organizations.find(o => o.id === orgId);
        const templates = getTemplates(org);
        saveTemplates(orgId, templates.filter(t => t.id !== templateId));
      }
    });
  };

  const handleToggleEnabled = (orgId, templateId) => {
    const org = organizations.find(o => o.id === orgId);
    const templates = getTemplates(org);
    saveTemplates(orgId, templates.map(t =>
      t.id === templateId ? { ...t, enabled: t.enabled === false ? true : false } : t
    ));
  };

  const handleSaveTemplate = (templateData) => {
    const { orgId, isNew } = editingTemplate;
    const org = organizations.find(o => o.id === orgId);
    const templates = getTemplates(org);

    if (isNew) {
      saveTemplates(orgId, [...templates, { ...templateData, createdAt: new Date().toISOString(), enabled: true }]);
    } else {
      saveTemplates(orgId, templates.map(t =>
        t.id === templateData.id ? { ...templateData, updatedAt: new Date().toISOString() } : t
      ));
    }
    setEditingTemplate(null);
  };

  const filteredOrgs = organizations.filter(org =>
    org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPageSizeDisplay = (template) => {
    if (template.pageSize === 'custom') {
      return `Custom (${template.customWidth}×${template.customHeight}")`;
    }
    return PAGE_SIZES[template.pageSize] || template.pageSize;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Feature Export Templates</h2>
          <p className="text-slate-500 text-sm">Manage feature export templates for all organizations.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Organizations List */}
      {filteredOrgs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No organizations found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrgs.map(org => {
            const templates = getTemplates(org);
            const isExpanded = expandedOrgs[org.id];
            const atlasEnabled = hasAtlas(org);

            return (
              <div key={org.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Organization Header */}
                <button
                  onClick={() => toggleOrg(org.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>

                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: atlasEnabled ? accentColor : '#94a3b8' }}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>

                  <div className="flex-1 text-left">
                    <h3 className="font-medium text-slate-800">{org.name}</h3>
                    <p className="text-sm text-slate-500">
                      {atlasEnabled ? (
                        <span>{templates.length} feature template{templates.length !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-amber-600">Atlas not initialized</span>
                      )}
                    </p>
                  </div>

                  {atlasEnabled && templates.length > 0 && (
                    <div className="flex -space-x-1">
                      {templates.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          className="w-6 h-6 rounded bg-slate-200 border-2 border-white flex items-center justify-center"
                          title={t.name}
                        >
                          <FileOutput className="w-3 h-3 text-slate-500" />
                        </div>
                      ))}
                      {templates.length > 3 && (
                        <div className="w-6 h-6 rounded bg-slate-300 border-2 border-white flex items-center justify-center text-xs text-slate-600">
                          +{templates.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    {!atlasEnabled ? (
                      <div className="text-center py-6">
                        <AlertCircle className="w-10 h-10 mx-auto text-amber-400 mb-2" />
                        <p className="text-slate-600 font-medium">Atlas Not Initialized</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Initialize Atlas for this organization before managing feature export templates.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Add Template Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowStarterPicker(org.id)}
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-white flex items-center gap-2"
                          >
                            <LayoutTemplate className="w-4 h-4" />
                            From Template
                          </button>
                          <button
                            onClick={() => handleCreateBlank(org.id)}
                            className="px-3 py-2 text-sm text-white rounded-lg flex items-center gap-2"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Plus className="w-4 h-4" />
                            New Blank
                          </button>
                        </div>

                        {/* Templates List */}
                        {templates.length === 0 ? (
                          <div className="text-center py-6 bg-white rounded-lg border border-dashed border-slate-300">
                            <FileOutput className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="text-slate-500">No feature export templates yet</p>
                            <p className="text-sm text-slate-400">Create a template to enable feature exports</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {templates.map(template => (
                              <div
                                key={template.id}
                                className={`flex items-center gap-3 p-3 bg-white rounded-lg border ${template.enabled === false ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}
                              >
                                <div
                                  className="w-10 h-10 rounded flex items-center justify-center"
                                  style={{
                                    backgroundColor: template.enabled !== false ? `${accentColor}15` : '#f1f5f9',
                                    color: template.enabled !== false ? accentColor : '#94a3b8'
                                  }}
                                >
                                  <FileOutput className="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-slate-800 truncate">{template.name}</h4>
                                  <p className="text-xs text-slate-500">
                                    {getPageSizeDisplay(template)} • {template.elements?.length || 0} elements
                                    {template.mapExportTemplateId && (
                                      <span className="ml-1 text-blue-600">+ Map</span>
                                    )}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleToggleEnabled(org.id, template.id)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title={template.enabled !== false ? 'Disable' : 'Enable'}
                                  >
                                    {template.enabled !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleEditTemplate(org.id, template)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateTemplate(org.id, template)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title="Duplicate"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTemplate(org.id, template.id, template.name)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    title="Delete"
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Starter Template Picker Modal */}
      {showStarterPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Choose a Starter Template</h3>
                <p className="text-sm text-slate-500">Select a feature export template to customize</p>
              </div>
              <button onClick={() => setShowStarterPicker(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid gap-4">
                {FEATURE_STARTER_TEMPLATES.map(starter => (
                  <button
                    key={starter.id}
                    onClick={() => handleCreateFromStarter(showStarterPicker, starter)}
                    className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: accentColor }}
                    >
                      <FileOutput className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-800">{starter.name}</h4>
                      <p className="text-sm text-slate-500 mt-0.5">{starter.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>{starter.pageSize.includes('landscape') ? 'Landscape' : 'Portrait'}</span>
                        <span>•</span>
                        <span>{starter.elements.length} elements</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowStarterPicker(null)}
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
        <FeatureExportTemplateEditor
          data={editingTemplate.data}
          orgData={editingTemplate.orgData}
          mapExportTemplates={getMapExportTemplates(editingTemplate.orgData)}
          onClose={() => setEditingTemplate(null)}
          onSave={handleSaveTemplate}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

/**
 * Get Atlas navigation items based on role
 * @param {string} role - 'super_admin' | 'org_admin'
 * @returns {Array} Navigation items for atlas section
 */
export function getAtlasNavItems(role) {
  if (role === 'super_admin') {
    return [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'configuration', label: 'Configuration', icon: Settings },
      { id: 'export-templates', label: 'Export Templates', icon: Printer },
      { id: 'feature-export-templates', label: 'Feature Export', icon: FileOutput },
    ];
  }

  // org_admin - includes Export Templates and Feature Export Templates
  return [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'maps', label: 'Maps', icon: Layers },
    { id: 'export-templates', label: 'Export Templates', icon: Printer },
    { id: 'feature-export-templates', label: 'Feature Export', icon: FileOutput },
    { id: 'preview', label: 'Preview', icon: Eye }
  ];
}