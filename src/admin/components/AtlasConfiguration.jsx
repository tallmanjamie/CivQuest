// src/admin/components/AtlasConfiguration.jsx
// Atlas Configuration Management with Draft/Publish Workflow
// Manages atlas UI, messages, basemaps, and map configurations
// Changes are saved to draft until explicitly published

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot,
  deleteField
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Edit2,
  Map,
  Layers,
  Globe,
  Palette,
  MessageSquare,
  Settings,
  Building2,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Image,
  MapPin,
  Table2,
  Wand2,
  PowerOff,
  AlertTriangle,
  Upload,
  RotateCcw,
  CheckCircle2,
  Clock,
  FileEdit,
  Send
} from 'lucide-react';
import { PATHS } from '../../shared/services/paths';

/**
 * Atlas Configuration Management Component with Draft/Publish Workflow
 * 
 * Data Structure:
 * - atlasConfig: The LIVE configuration that Atlas app uses
 * - atlasConfigDraft: The DRAFT configuration that admins edit
 * 
 * Workflow:
 * 1. Edits are saved to atlasConfigDraft
 * 2. Preview shows the draft configuration
 * 3. Publish copies draft to live (atlasConfig)
 * 4. Discard removes the draft, reverting to live
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
        // All orgs collapsed by default for super admin
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
      defaultMode: "chat"
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
      maps: []
    }
  };

  // Default map template
  const defaultMapTemplate = {
    name: "New Map",
    searchPlaceholder: "Search for properties...",
    enabledModes: ["chat", "map", "table"],
    defaultMode: "chat",
    access: "public",
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

  // Initialize atlas config for an org (creates as draft first)
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
          // Initialize directly to live since there's nothing to preview yet
          await updateDoc(docRef, { atlasConfig: config });
          addToast("Atlas configuration initialized", "success");
        } catch (err) {
          addToast("Error initializing: " + err.message, "error");
        }
      }
    });
  };

  // Uninitialize atlas config for an org (only if no maps)
  const handleUninitializeAtlas = async (targetOrgId, orgName, workingConfig, hasDraft) => {
    const mapCount = workingConfig?.data?.maps?.length || 0;
    
    if (mapCount > 0) {
      addToast("Cannot uninitialize Atlas while maps exist. Delete all maps first.", "error");
      return;
    }

    confirm({
      title: "Uninitialize Atlas",
      message: `This will remove the Atlas configuration for "${orgName}". All settings (UI, messages, basemaps) will be lost. This action cannot be undone. Continue?`,
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

  // Edit settings - creates draft from live if needed
  const handleEditSettings = (targetOrgId, liveConfig, draftConfig) => {
    const configToEdit = draftConfig || liveConfig;
    setEditingSettings({ orgId: targetOrgId, data: configToEdit, liveConfig });
  };

  // Save settings - saves to draft
  const handleSaveSettings = (updatedConfig) => {
    if (editingSettings) {
      handleSaveToDraft(editingSettings.orgId, updatedConfig);
    }
  };

  // Edit map - creates draft from live if needed
  const handleEditMap = (targetOrgId, mapIdx, map, liveConfig, draftConfig) => {
    const configToEdit = draftConfig || liveConfig;
    setEditingMap({ 
      orgId: targetOrgId, 
      mapIdx, 
      data: map, 
      atlasConfig: configToEdit,
      liveConfig
    });
  };

  // Save map - saves to draft
  const handleSaveMap = (updatedMap) => {
    if (editingMap) {
      const updatedConfig = { ...editingMap.atlasConfig };
      const maps = [...(updatedConfig.data?.maps || [])];
      maps[editingMap.mapIdx] = updatedMap;
      updatedConfig.data = { ...updatedConfig.data, maps };
      handleSaveToDraft(editingMap.orgId, updatedConfig);
    }
  };

  // Add new map - saves to draft
  const handleAddMap = (targetOrgId, liveConfig, draftConfig) => {
    const configToUse = draftConfig || liveConfig;
    const newMap = { ...defaultMapTemplate };
    const updatedConfig = { ...configToUse };
    const maps = [...(updatedConfig.data?.maps || [])];
    maps.push(newMap);
    updatedConfig.data = { ...updatedConfig.data, maps };
    
    // Save to draft and open editor
    handleSaveToDraft(targetOrgId, updatedConfig);
    
    // Open the new map for editing after a brief delay
    setTimeout(() => {
      setEditingMap({
        orgId: targetOrgId,
        mapIdx: maps.length - 1,
        data: newMap,
        atlasConfig: updatedConfig,
        liveConfig
      });
    }, 100);
  };

  // Delete map - saves to draft
  const handleDeleteMap = (targetOrgId, mapIndex, mapName, liveConfig, draftConfig) => {
    confirm({
      title: "Delete Map",
      message: `Are you sure you want to delete "${mapName}"? This change will be saved to draft.`,
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

  // Duplicate map - saves to draft
  const handleDuplicateMap = (targetOrgId, map, liveConfig, draftConfig) => {
    const configToUse = draftConfig || liveConfig;
    const duplicatedMap = { 
      ...JSON.parse(JSON.stringify(map)), 
      name: `${map.name} (Copy)` 
    };
    const updatedConfig = { ...configToUse };
    const maps = [...(updatedConfig.data?.maps || [])];
    maps.push(duplicatedMap);
    updatedConfig.data = { ...updatedConfig.data, maps };
    handleSaveToDraft(targetOrgId, updatedConfig);
    addToast(`Map "${map.name}" duplicated`, "success");
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

        {/* Organization Cards */}
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
                onEditSettings={() => handleEditSettings(org.id, org.atlasConfig, org.atlasConfigDraft)}
                onAddMap={() => handleAddMap(org.id, org.atlasConfig, org.atlasConfigDraft)}
                onEditMap={(idx, map) => handleEditMap(org.id, idx, map, org.atlasConfig, org.atlasConfigDraft)}
                onDeleteMap={(idx, name) => handleDeleteMap(org.id, idx, name, org.atlasConfig, org.atlasConfigDraft)}
                onDuplicateMap={(map) => handleDuplicateMap(org.id, map, org.atlasConfig, org.atlasConfigDraft)}
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
            onClose={() => setEditingSettings(null)}
            onSave={handleSaveSettings}
          />
        )}

        {/* Map Edit Modal */}
        {editingMap && MapEditModal && (
          <MapEditModal 
            data={editingMap.data}
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
        
        {/* Publish/Discard Actions */}
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
          <p className="text-slate-500 mb-6">Initialize Atlas to enable interactive mapping and data exploration for your organization.</p>
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
                    Your changes are saved as a draft. Use <strong>Preview</strong> to see how they look, 
                    then <strong>Publish</strong> to make them live.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Atlas Overview Card */}
          <AtlasOverviewCard 
            atlasConfig={workingConfig}
            liveConfig={liveConfig}
            hasDraft={hasDraft}
            accentColor={accentColor}
            onEditSettings={() => handleEditSettings(orgId, liveConfig, orgData?.atlasConfigDraft)}
          />

          {/* Maps Section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5" style={{ color: accentColor }} />
                <h3 className="font-bold text-slate-800">Maps</h3>
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  {workingConfig?.data?.maps?.length || 0}
                </span>
              </div>
              <button
                onClick={() => handleAddMap(orgId, liveConfig, orgData?.atlasConfigDraft)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg"
                style={{ backgroundColor: accentColor }}
              >
                <Plus className="w-4 h-4" /> Add Map
              </button>
            </div>
            <div className="p-4">
              {workingConfig?.data?.maps && workingConfig.data.maps.length > 0 ? (
                <div className="space-y-2">
                  {workingConfig.data.maps.map((map, idx) => (
                    <MapRow
                      key={idx}
                      map={map}
                      idx={idx}
                      accentColor={accentColor}
                      onEdit={() => handleEditMap(orgId, idx, map, liveConfig, orgData?.atlasConfigDraft)}
                      onDelete={() => handleDeleteMap(orgId, idx, map.name, liveConfig, orgData?.atlasConfigDraft)}
                      onDuplicate={() => handleDuplicateMap(orgId, map, liveConfig, orgData?.atlasConfigDraft)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Map className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No maps configured.</p>
                  <button
                    onClick={() => handleAddMap(orgId, liveConfig, orgData?.atlasConfigDraft)}
                    className="mt-3 text-sm font-medium hover:underline"
                    style={{ color: accentColor }}
                  >
                    Add your first map
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Uninitialize Option - Only shown when no maps exist */}
          {(!workingConfig?.data?.maps || workingConfig.data.maps.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-800">Remove Atlas Configuration</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Since there are no maps configured, you can uninitialize Atlas to remove all settings.
                  </p>
                  <button
                    onClick={() => handleUninitializeAtlas(orgId, orgData?.name, workingConfig, hasDraft)}
                    className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors font-medium"
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

      {/* Atlas Settings Modal */}
      {editingSettings && AtlasSettingsModal && (
        <AtlasSettingsModal 
          data={editingSettings.data}
          onClose={() => setEditingSettings(null)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Map Edit Modal */}
      {editingMap && MapEditModal && (
        <MapEditModal 
          data={editingMap.data}
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
  const messages = atlasConfig?.messages || {};
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" style={{ color: accentColor }} />
          <h3 className="font-bold text-slate-800">General Settings</h3>
          {hasDraft && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              Modified
            </span>
          )}
        </div>
        <button
          onClick={onEditSettings}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded transition-all"
          title="Edit Settings"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* UI Settings */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3 h-3" /> UI Theme
          </h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500">Title:</span> {ui.title || '-'}</p>
            <p><span className="text-slate-500">Header:</span> {ui.headerTitle || '-'}</p>
            <p><span className="text-slate-500">Theme:</span> {ui.themeColor || 'sky'}</p>
          </div>
        </div>
        
        {/* Messages */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Messages
          </h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500">Welcome:</span> {messages.welcomeTitle || '-'}</p>
            <p><span className="text-slate-500">Examples:</span> {messages.exampleQuestions?.length || 0}</p>
          </div>
        </div>
        
        {/* Basemaps */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Globe className="w-3 h-3" /> Basemaps
          </h4>
          <div className="space-y-1 text-sm">
            <p><span className="text-slate-500">Count:</span> {atlasConfig?.basemaps?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Map Row ---
function MapRow({ map, idx, accentColor, onEdit, onDelete, onDuplicate }) {
  const modesDisplay = map.enabledModes?.join(', ') || 'None';
  
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
             style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
          <Map className="w-4 h-4" />
        </div>
        <div>
          <p className="font-medium text-slate-800">{map.name}</p>
          <p className="text-xs text-slate-500">
            {map.access === 'private' ? '🔒 Private' : '🌐 Public'} • Modes: {modesDisplay}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onDuplicate}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded"
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
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// --- Organization Atlas Card (for Admin view) ---
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
  const hasAtlasConfig = workingConfig || liveConfig;
  const mapCount = workingConfig?.data?.maps?.length || 0;
  const canUninitialize = hasAtlasConfig && mapCount === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
          <Building2 className="w-5 h-5" style={{ color: accentColor }} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800">{org.name}</h3>
              {hasAtlasConfig && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  Atlas Enabled
                </span>
              )}
              {hasUnpublishedChanges && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {hasAtlasConfig 
                ? `${mapCount} map${mapCount !== 1 ? 's' : ''} configured`
                : 'Atlas not initialized'
              }
            </p>
          </div>
        </div>
        
        {/* Quick Actions in Header */}
        {hasAtlasConfig && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {hasUnpublishedChanges && (
              <>
                <button
                  onClick={onDiscardDraft}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-50"
                >
                  <RotateCcw className="w-3 h-3" /> Discard
                </button>
                <button
                  onClick={onPublish}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white rounded"
                  style={{ backgroundColor: accentColor }}
                >
                  <Send className="w-3 h-3" /> Publish
                </button>
              </>
            )}
            <a
              href={`/atlas?org=${org.id}${hasUnpublishedChanges ? '&preview=draft' : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-50"
            >
              <ExternalLink className="w-3 h-3" /> Preview
            </a>
          </div>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 border-t border-slate-100">
          {!hasAtlasConfig ? (
            <div className="text-center py-6">
              <Map className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-3">Atlas not initialized for this organization.</p>
              <button
                onClick={(e) => { e.stopPropagation(); onInitialize(); }}
                className="px-4 py-2 text-white text-sm rounded-lg font-medium"
                style={{ backgroundColor: accentColor }}
              >
                Initialize Atlas
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Draft Notice */}
              {hasUnpublishedChanges && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <FileEdit className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    This organization has unpublished changes. Preview to review, then publish to make live.
                  </p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditSettings(); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddMap(); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-white rounded-lg"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Map
                </button>
                {canUninitialize && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUninitialize(); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
                  >
                    <PowerOff className="w-3.5 h-3.5" /> Uninitialize
                  </button>
                )}
              </div>

              {/* Maps List */}
              {mapCount > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Maps ({mapCount})
                  </h4>
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

              {/* Overview Stats */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">{mapCount}</p>
                  <p className="text-xs text-slate-500">Maps</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">
                    {workingConfig?.basemaps?.length || 0}
                  </p>
                  <p className="text-xs text-slate-500">Basemaps</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">
                    {hasUnpublishedChanges ? (
                      <span className="text-amber-600">Draft</span>
                    ) : (
                      <span className="text-emerald-600">Live</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">Status</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
