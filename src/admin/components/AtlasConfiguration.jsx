// src/admin/components/AtlasConfiguration.jsx
// Atlas configuration management component
// Supports both super admin (all orgs) and org admin (single org) views
//
// UPDATED: Now passes orgData to MapEditModal for license enforcement
// This ensures license limits apply even when super admin edits maps
//
// The draft/publish workflow:
// 1. Edits are saved to atlasConfigDraft
// 2. Preview shows the draft configuration
// 3. Publish copies draft to live (atlasConfig)
// 4. Discard removes the draft, reverting to live

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot,
  deleteField
} from 'firebase/firestore';
import { 
  Building2, 
  Map, 
  Plus, 
  Edit2, 
  Trash2, 
  Copy,
  ChevronDown, 
  ChevronRight,
  Settings,
  Eye,
  Globe,
  Lock,
  Clock,
  Send,
  RotateCcw,
  FileEdit,
  AlertTriangle,
  PowerOff,
  ExternalLink
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * AtlasConfiguration Component
 * 
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} role - 'admin' | 'org_admin'
 * @param {string} [orgId] - Required for 'org_admin' role
 * @param {object} [orgData] - Required for 'org_admin' role
 * @param {function} addToast - Toast notification function
 * @param {function} confirm - Confirmation dialog function
 * @param {string} [accentColor] - Theme accent color
 * @param {React.Component} AtlasSettingsModal - Modal for editing settings
 * @param {React.Component} MapEditModal - Modal for editing maps
 */
export default function AtlasConfiguration({ 
  db,
  role = 'admin',
  orgId = null,
  orgData = null,
  addToast,
  confirm,
  accentColor = '#004E7C',
  AtlasSettingsModal,
  MapEditModal
}) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSettings, setEditingSettings] = useState(null);
  const [editingMap, setEditingMap] = useState(null);
  const [expandedOrgs, setExpandedOrgs] = useState({});

  // Fetch all organizations for admin role
  useEffect(() => {
    if (role === 'admin') {
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
    } else {
      setLoading(false);
    }
  }, [db, role]);

  // Default atlas config template
  const defaultAtlasConfig = {
    ui: {
      title: "CivQuest Atlas",
      headerTitle: "Organization Name",
      headerSubtitle: "CivQuest Property Site",
      headerClass: "bg-sky-700",
      logoLeft: "",
      logoRight: "",
      botAvatar: "",
      themeColor: "sky",
      defaultMode: "chat",
      // Map tools position and layout configuration
      mapToolsPosition: "upper-left", // upper-left, center, lower-left, lower-center
      mapToolsLayout: "stacked"       // stacked or horizontal
    },
    messages: {
      welcomeTitle: "Welcome!",
      welcomeText: "Search for an address or parcel ID to learn more about a property.",
      exampleQuestions: [],
      importantNote: ""
    },
    basemaps: [
      { label: "Default", id: "default", type: "esri" }
    ],
    data: {
      systemPrompt: "",
      maxRecordCount: 1000,
      timeZoneOffset: -5,
      defaultSort: "",
      autocompleteMaxResults: 100,
      maps: []
    }
  };

  // Default map template
  const defaultMapTemplate = {
    name: "New Map",
    searchPlaceholder: "Search for properties...",
    enabledModes: ["chat", "map", "table"],
    defaultMode: "chat",
    access: "private", // Default to private for safety
    webMap: {
      portalUrl: "https://www.arcgis.com",
      itemId: ""
    },
    endpoint: "",
    autocomplete: [],
    searchFields: [],
    tableColumns: [],
    geocoder: {
      enabled: false,
      url: ""
    },
    exportTemplates: [],
    customFeatureInfo: {
      layerId: "",
      tabs: [],
      export: {
        scaleRatio: 1.0,
        elements: []
      }
    }
  };

  // Helper: Check if org has unpublished changes
  const hasUnpublishedChanges = (org) => {
    return !!org.atlasConfigDraft;
  };

  // Helper: Get the working config (draft if exists, otherwise live)
  const getWorkingConfig = (org) => {
    return org.atlasConfigDraft || org.atlasConfig || null;
  };

  // Helper: Get live config
  const getLiveConfig = (org) => {
    return org.atlasConfig || null;
  };

  // Toggle organization expansion
  const toggleOrgExpansion = (orgIdToToggle) => {
    setExpandedOrgs(prev => ({
      ...prev,
      [orgIdToToggle]: !prev[orgIdToToggle]
    }));
  };

  // Save to DRAFT (not live)
  const handleSaveToDraft = async (targetOrgId, updatedConfig) => {
    try {
      const docRef = doc(db, PATHS.organizations, targetOrgId);
      await updateDoc(docRef, { atlasConfigDraft: updatedConfig });
      setEditingSettings(null);
      setEditingMap(null);
      addToast("Changes saved to draft", "success");
    } catch (err) {
      addToast("Error saving draft: " + err.message, "error");
    }
  };

  // Publish draft to live
  const handlePublish = async (targetOrgId, orgName, draftConfig) => {
    confirm({
      title: "Publish Changes",
      message: `This will make your draft changes live for "${orgName}". Users will immediately see the updated configuration. Continue?`,
      confirmLabel: "Publish",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { 
            atlasConfig: draftConfig,
            atlasConfigDraft: deleteField()
          });
          addToast("Changes published successfully!", "success");
        } catch (err) {
          addToast("Error publishing: " + err.message, "error");
        }
      }
    });
  };

  // Discard draft changes
  const handleDiscardDraft = (targetOrgId, orgName) => {
    confirm({
      title: "Discard Draft Changes",
      message: `Are you sure you want to discard all unpublished changes for "${orgName}"? This will revert to the last published configuration.`,
      destructive: true,
      confirmLabel: "Discard Changes",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { atlasConfigDraft: deleteField() });
          addToast("Draft changes discarded", "success");
        } catch (err) {
          addToast("Error discarding draft: " + err.message, "error");
        }
      }
    });
  };

  // Initialize atlas config for an org
  const handleInitializeAtlas = async (targetOrgId, orgName) => {
    confirm({
      title: "Initialize Atlas Configuration",
      message: `This will create a default Atlas configuration for "${orgName}". The configuration will start as a draft - you'll need to publish it to make it live. Continue?`,
      confirmLabel: "Initialize",
      onConfirm: async () => {
        try {
          const config = {
            ...defaultAtlasConfig,
            ui: {
              ...defaultAtlasConfig.ui,
              headerTitle: orgName
            }
          };
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          await updateDoc(docRef, { atlasConfig: config });
          addToast("Atlas configuration initialized", "success");
        } catch (err) {
          addToast("Error initializing: " + err.message, "error");
        }
      }
    });
  };

  // Uninitialize atlas config for an org
  const handleUninitializeAtlas = async (targetOrgId, orgName, workingConfig, hasDraft) => {
    const mapCount = workingConfig?.data?.maps?.length || 0;
    
    if (mapCount > 0) {
      addToast("Cannot uninitialize Atlas while maps exist. Delete all maps first.", "error");
      return;
    }

    confirm({
      title: "Uninitialize Atlas",
      message: `This will remove the Atlas configuration for "${orgName}". All settings will be lost. Continue?`,
      destructive: true,
      confirmLabel: "Uninitialize",
      onConfirm: async () => {
        try {
          const docRef = doc(db, PATHS.organizations, targetOrgId);
          const updates = { atlasConfig: deleteField() };
          if (hasDraft) {
            updates.atlasConfigDraft = deleteField();
          }
          await updateDoc(docRef, updates);
          addToast("Atlas configuration removed", "success");
        } catch (err) {
          addToast("Error uninitializing: " + err.message, "error");
        }
      }
    });
  };

  // Edit settings
  const handleEditSettings = (targetOrgId, liveConfig, draftConfig, targetOrgData) => {
    const configToEdit = draftConfig || liveConfig;
    setEditingSettings({ 
      orgId: targetOrgId, 
      orgData: targetOrgData,
      data: configToEdit, 
      liveConfig 
    });
  };

  // Save settings
  const handleSaveSettings = (updatedConfig) => {
    if (editingSettings) {
      handleSaveToDraft(editingSettings.orgId, updatedConfig);
    }
  };

  // Edit map - NOW INCLUDES orgData for license checking
  const handleEditMap = (targetOrgId, mapIdx, map, liveConfig, draftConfig, targetOrgData) => {
    const configToEdit = draftConfig || liveConfig;
    setEditingMap({ 
      orgId: targetOrgId,
      orgData: targetOrgData, // Include org data for license checking
      mapIdx, 
      data: map, 
      atlasConfig: configToEdit,
      liveConfig
    });
  };

  // Save map
  const handleSaveMap = (updatedMap) => {
    if (editingMap) {
      const updatedConfig = { ...editingMap.atlasConfig };
      const maps = [...(updatedConfig.data?.maps || [])];
      maps[editingMap.mapIdx] = updatedMap;
      updatedConfig.data = { ...updatedConfig.data, maps };
      handleSaveToDraft(editingMap.orgId, updatedConfig);
    }
  };

  // Add new map - NOW INCLUDES orgData
  const handleAddMap = (targetOrgId, liveConfig, draftConfig, targetOrgData) => {
    const configToUse = draftConfig || liveConfig;
    const newMap = { ...defaultMapTemplate };
    const updatedConfig = { ...configToUse };
    const maps = [...(updatedConfig.data?.maps || [])];
    maps.push(newMap);
    updatedConfig.data = { ...updatedConfig.data, maps };
    
    handleSaveToDraft(targetOrgId, updatedConfig);
    
    setTimeout(() => {
      setEditingMap({
        orgId: targetOrgId,
        orgData: targetOrgData, // Include org data for license checking
        mapIdx: maps.length - 1,
        data: newMap,
        atlasConfig: updatedConfig,
        liveConfig
      });
    }, 100);
  };

  // Delete map
  const handleDeleteMap = (targetOrgId, mapIndex, mapName, liveConfig, draftConfig) => {
    confirm({
      title: "Delete Map",
      message: `Are you sure you want to delete "${mapName}"? This cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete",
      onConfirm: async () => {
        const configToUse = draftConfig || liveConfig;
        const updatedConfig = { ...configToUse };
        const maps = [...(updatedConfig.data?.maps || [])];
        maps.splice(mapIndex, 1);
        updatedConfig.data = { ...updatedConfig.data, maps };
        handleSaveToDraft(targetOrgId, updatedConfig);
      }
    });
  };

  // Duplicate map - NOW INCLUDES orgData
  const handleDuplicateMap = (targetOrgId, map, liveConfig, draftConfig, targetOrgData) => {
    const configToUse = draftConfig || liveConfig;
    const newMap = { 
      ...map, 
      name: `${map.name} (Copy)`,
      access: 'private' // Force private for duplicates to be safe
    };
    const updatedConfig = { ...configToUse };
    const maps = [...(updatedConfig.data?.maps || [])];
    maps.push(newMap);
    updatedConfig.data = { ...updatedConfig.data, maps };
    
    handleSaveToDraft(targetOrgId, updatedConfig);
    
    setTimeout(() => {
      setEditingMap({
        orgId: targetOrgId,
        orgData: targetOrgData, // Include org data for license checking
        mapIdx: maps.length - 1,
        data: newMap,
        atlasConfig: updatedConfig,
        liveConfig
      });
    }, 100);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" 
             style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // --- RENDER FOR ADMIN (ALL ORGANIZATIONS) ---
  if (role === 'admin') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Atlas Configuration</h2>
            <p className="text-slate-500 text-sm">Manage Atlas settings for all organizations.</p>
          </div>
        </div>

        {organizations.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No organizations found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {organizations.map(org => (
              <OrganizationAtlasCard
                key={org.id}
                org={org}
                expanded={expandedOrgs[org.id]}
                onToggle={() => toggleOrgExpansion(org.id)}
                accentColor={accentColor}
                onInitialize={() => handleInitializeAtlas(org.id, org.name)}
                onUninitialize={() => handleUninitializeAtlas(
                  org.id, 
                  org.name, 
                  getWorkingConfig(org),
                  hasUnpublishedChanges(org)
                )}
                onEditSettings={() => handleEditSettings(org.id, org.atlasConfig, org.atlasConfigDraft, org)}
                onAddMap={() => handleAddMap(org.id, org.atlasConfig, org.atlasConfigDraft, org)}
                onEditMap={(idx, map) => handleEditMap(org.id, idx, map, org.atlasConfig, org.atlasConfigDraft, org)}
                onDeleteMap={(idx, name) => handleDeleteMap(org.id, idx, name, org.atlasConfig, org.atlasConfigDraft)}
                onDuplicateMap={(map) => handleDuplicateMap(org.id, map, org.atlasConfig, org.atlasConfigDraft, org)}
                onPublish={() => handlePublish(org.id, org.name, org.atlasConfigDraft)}
                onDiscardDraft={() => handleDiscardDraft(org.id, org.name)}
                hasUnpublishedChanges={hasUnpublishedChanges(org)}
                workingConfig={getWorkingConfig(org)}
                liveConfig={getLiveConfig(org)}
              />
            ))}
          </div>
        )}

        {/* Settings Modal */}
        {editingSettings && AtlasSettingsModal && (
          <AtlasSettingsModal 
            data={editingSettings.data}
            orgData={editingSettings.orgData}
            onClose={() => setEditingSettings(null)}
            onSave={handleSaveSettings}
          />
        )}

        {/* Map Edit Modal - NOW PASSES orgData */}
        {editingMap && MapEditModal && (
          <MapEditModal 
            data={editingMap.data}
            orgData={editingMap.orgData}
            onClose={() => setEditingMap(null)}
            onSave={handleSaveMap}
          />
        )}
      </div>
    );
  }

  // --- RENDER FOR ORG ADMIN (SINGLE ORGANIZATION) ---
  const hasAtlasConfig = orgData?.atlasConfig || orgData?.atlasConfigDraft;
  const workingConfig = orgData?.atlasConfigDraft || orgData?.atlasConfig;
  const liveConfig = orgData?.atlasConfig;
  const hasDraft = !!orgData?.atlasConfigDraft;

  return (
    <div className="space-y-4">
      {/* Header with Publish Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Atlas Configuration</h2>
          <p className="text-slate-500 text-sm">
            Configure maps and settings for your organization.
          </p>
        </div>
        
        {hasDraft && (
          <div className="flex items-center gap-2">
            <DraftStatusBadge />
            <button
              onClick={() => handleDiscardDraft(orgId, orgData?.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Discard
            </button>
            <button
              onClick={() => handlePublish(orgId, orgData?.name, orgData?.atlasConfigDraft)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white rounded-lg font-medium"
              style={{ backgroundColor: accentColor }}
            >
              <Send className="w-4 h-4" />
              Publish
            </button>
          </div>
        )}
      </div>

      {/* Not Initialized State */}
      {!hasAtlasConfig ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <Map className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Configured</h3>
          <p className="text-slate-500 mb-6">Initialize Atlas to enable interactive mapping.</p>
          <button
            onClick={() => handleInitializeAtlas(orgId, orgData?.name)}
            className="px-6 py-2 text-white rounded-lg font-medium"
            style={{ backgroundColor: accentColor }}
          >
            Initialize Atlas
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Draft Notice */}
          {hasDraft && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <FileEdit className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800">You have unpublished changes</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Use <strong>Preview</strong> to see how they look, then <strong>Publish</strong> to make them live.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Atlas Overview */}
          <AtlasOverviewCard
            atlasConfig={workingConfig}
            liveConfig={liveConfig}
            hasDraft={hasDraft}
            accentColor={accentColor}
            onEditSettings={() => handleEditSettings(orgId, liveConfig, orgData?.atlasConfigDraft, orgData)}
          />

          {/* Maps Section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Maps</h3>
              <button
                onClick={() => handleAddMap(orgId, liveConfig, orgData?.atlasConfigDraft, orgData)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
                style={{ backgroundColor: accentColor + '15', color: accentColor }}
              >
                <Plus className="w-4 h-4" />
                Add Map
              </button>
            </div>
            <div className="p-4">
              {workingConfig?.data?.maps?.length > 0 ? (
                <div className="space-y-2">
                  {workingConfig.data.maps.map((map, idx) => (
                    <MapRow
                      key={idx}
                      map={map}
                      idx={idx}
                      accentColor={accentColor}
                      onEdit={() => handleEditMap(orgId, idx, map, liveConfig, orgData?.atlasConfigDraft, orgData)}
                      onDelete={() => handleDeleteMap(orgId, idx, map.name, liveConfig, orgData?.atlasConfigDraft)}
                      onDuplicate={() => handleDuplicateMap(orgId, map, liveConfig, orgData?.atlasConfigDraft, orgData)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Map className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No maps configured.</p>
                </div>
              )}
            </div>
          </div>

          {/* Uninitialize Option */}
          {(!workingConfig?.data?.maps || workingConfig.data.maps.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800">Remove Atlas Configuration</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Since there are no maps configured, you can uninitialize Atlas.
                  </p>
                  <button
                    onClick={() => handleUninitializeAtlas(orgId, orgData?.name, workingConfig, hasDraft)}
                    className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 font-medium"
                  >
                    <PowerOff className="w-4 h-4" />
                    Uninitialize Atlas
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Modal - PASSES orgData */}
      {editingSettings && AtlasSettingsModal && (
        <AtlasSettingsModal 
          data={editingSettings.data}
          orgData={editingSettings.orgData || orgData}
          onClose={() => setEditingSettings(null)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Map Edit Modal - PASSES orgData */}
      {editingMap && MapEditModal && (
        <MapEditModal 
          data={editingMap.data}
          orgData={editingMap.orgData || orgData}
          onClose={() => setEditingMap(null)}
          onSave={handleSaveMap}
        />
      )}
    </div>
  );
}

// --- Draft Status Badge ---
function DraftStatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
      <Clock className="w-3 h-3" />
      Draft
    </span>
  );
}

// --- Atlas Overview Card ---
function AtlasOverviewCard({ atlasConfig, liveConfig, hasDraft, accentColor, onEditSettings }) {
  const ui = atlasConfig?.ui || {};
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">Settings Overview</h3>
        <button
          onClick={onEditSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
        >
          <Settings className="w-4 h-4" />
          Edit Settings
        </button>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-slate-500">Title</span>
          <p className="font-medium text-slate-800">{ui.headerTitle || 'Not set'}</p>
        </div>
        <div>
          <span className="text-slate-500">Theme</span>
          <p className="font-medium text-slate-800 capitalize">{ui.themeColor || 'Sky'}</p>
        </div>
        <div>
          <span className="text-slate-500">Default Mode</span>
          <p className="font-medium text-slate-800 capitalize">{ui.defaultMode || 'Chat'}</p>
        </div>
        <div>
          <span className="text-slate-500">Status</span>
          <p className={`font-medium ${hasDraft ? 'text-amber-600' : 'text-emerald-600'}`}>
            {hasDraft ? 'Has Draft' : 'Published'}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Map Row ---
function MapRow({ map, idx, accentColor, onEdit, onDelete, onDuplicate }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700 truncate">{map.name}</span>
          {map.access === 'public' ? (
            <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              <Globe className="w-3 h-3" />
              Public
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
              <Lock className="w-3 h-3" />
              Private
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate">{map.endpoint || 'No endpoint configured'}</p>
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={onDuplicate}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// --- Organization Atlas Card (Admin view) ---
function OrganizationAtlasCard({ 
  org, 
  expanded, 
  onToggle, 
  accentColor, 
  onInitialize,
  onUninitialize,
  onEditSettings,
  onAddMap, 
  onEditMap, 
  onDeleteMap, 
  onDuplicateMap,
  onPublish,
  onDiscardDraft,
  hasUnpublishedChanges,
  workingConfig,
  liveConfig
}) {
  const hasAtlasConfig = !!workingConfig;
  const mapCount = workingConfig?.data?.maps?.length || 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <button className="text-slate-400">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="font-bold text-slate-800">{org.name || org.id}</h3>
              {hasUnpublishedChanges && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">{org.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasAtlasConfig ? (
            <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
              <Map className="w-3 h-3" />
              {mapCount} map{mapCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
              Not initialized
            </span>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100">
          {!hasAtlasConfig ? (
            <div className="p-6 text-center">
              <Map className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">Atlas is not initialized.</p>
              <button
                onClick={(e) => { e.stopPropagation(); onInitialize(); }}
                className="px-4 py-2 text-white rounded-lg font-medium"
                style={{ backgroundColor: accentColor }}
              >
                Initialize Atlas
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Draft Actions */}
              {hasUnpublishedChanges && (
                <div className="flex items-center justify-between bg-amber-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800">
                    <FileEdit className="w-4 h-4" />
                    <span className="text-sm font-medium">Unpublished changes</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDiscardDraft(); }}
                      className="px-3 py-1 text-xs border border-amber-300 text-amber-700 rounded hover:bg-amber-100"
                    >
                      Discard
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onPublish(); }}
                      className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                    >
                      Publish
                    </button>
                  </div>
                </div>
              )}

              {/* Settings Row */}
              <div className="flex items-center justify-between">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditSettings(); }}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  <Settings className="w-4 h-4" />
                  Edit Settings
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddMap(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
                  style={{ backgroundColor: accentColor + '15', color: accentColor }}
                >
                  <Plus className="w-4 h-4" />
                  Add Map
                </button>
              </div>

              {/* Maps List */}
              {mapCount === 0 ? (
                <div className="text-center py-4 text-slate-400">
                  <p className="text-sm">No maps configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {workingConfig.data.maps.map((map, idx) => (
                    <MapRow
                      key={idx}
                      map={map}
                      idx={idx}
                      accentColor={accentColor}
                      onEdit={() => onEditMap(idx, map)}
                      onDelete={() => onDeleteMap(idx, map.name)}
                      onDuplicate={() => onDuplicateMap(map)}
                    />
                  ))}
                </div>
              )}

              {/* Preview Links */}
              {mapCount > 0 && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <a
                    href={`/atlas?org=${org.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Preview Live
                  </a>
                  {hasUnpublishedChanges && (
                    <a
                      href={`/atlas?org=${org.id}&preview=draft`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700"
                    >
                      <Eye className="w-3 h-3" />
                      Preview Draft
                    </a>
                  )}
                </div>
              )}

              {/* Uninitialize */}
              {mapCount === 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); onUninitialize(); }}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Uninitialize Atlas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
