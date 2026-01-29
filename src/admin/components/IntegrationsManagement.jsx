// src/admin/components/IntegrationsManagement.jsx
// Super Admin component for managing system-wide integrations

import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  Check,
  Trash2,
  Edit2,
  Search,
  Loader2,
  Eye,
  EyeOff,
  Building2,
  Puzzle,
  Map,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Maximize2
} from 'lucide-react';
import {
  collection,
  onSnapshot
} from 'firebase/firestore';
import { PATHS } from '../../shared/services/paths';
import {
  AVAILABLE_INTEGRATIONS,
  INTEGRATION_TYPES,
  subscribeToIntegrations,
  addIntegration,
  updateIntegration,
  deleteIntegration,
  toggleIntegration
} from '../../shared/services/integrations';

export default function IntegrationsManagement({ db, addToast, confirm, adminEmail, accentColor = '#004E7C' }) {
  const [integrations, setIntegrations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIntegrations, setExpandedIntegrations] = useState({});

  // Load integrations
  useEffect(() => {
    const unsubscribe = subscribeToIntegrations((data) => {
      setIntegrations(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load organizations
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, PATHS.organizations), (snapshot) => {
      const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrganizations(orgs);
    });
    return () => unsubscribe();
  }, [db]);

  const filteredIntegrations = integrations.filter(integration =>
    integration.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddIntegration = async (integrationData) => {
    try {
      await addIntegration(integrationData, adminEmail);
      addToast('Integration added successfully', 'success');
      setShowAddModal(false);
    } catch (err) {
      addToast(`Error adding integration: ${err.message}`, 'error');
    }
  };

  const handleUpdateIntegration = async (integrationId, updates) => {
    try {
      await updateIntegration(integrationId, updates, adminEmail);
      addToast('Integration updated successfully', 'success');
      setEditingIntegration(null);
    } catch (err) {
      addToast(`Error updating integration: ${err.message}`, 'error');
    }
  };

  const handleDeleteIntegration = (integration) => {
    confirm({
      title: 'Delete Integration',
      message: `Are you sure you want to delete "${integration.name}"? This will remove access for all assigned organizations.`,
      destructive: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteIntegration(integration.id, adminEmail);
          addToast('Integration deleted', 'success');
        } catch (err) {
          addToast(`Error deleting integration: ${err.message}`, 'error');
        }
      }
    });
  };

  const handleToggleEnabled = async (integration) => {
    try {
      await toggleIntegration(integration.id, !integration.enabled, adminEmail);
      addToast(`Integration ${integration.enabled ? 'disabled' : 'enabled'}`, 'success');
    } catch (err) {
      addToast(`Error updating integration: ${err.message}`, 'error');
    }
  };

  const toggleExpanded = (integrationId) => {
    setExpandedIntegrations(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }));
  };

  const getIntegrationDefinition = (type) => {
    return AVAILABLE_INTEGRATIONS[type] || null;
  };

  const getOrgName = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    return org ? org.name : orgId;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Integrations</h2>
          <p className="text-slate-500 text-sm">Configure third-party integrations and assign them to organizations.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          <Plus className="w-4 h-4" /> Add Integration
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search integrations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': accentColor }}
        />
      </div>

      {/* Available Integrations Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Available Integrations</h4>
            <div className="mt-2 space-y-1">
              {Object.values(AVAILABLE_INTEGRATIONS).map(def => (
                <div key={def.id} className="flex items-center gap-2 text-sm text-blue-700">
                  <span className="font-medium">{def.name}</span>
                  <span className="text-blue-500">({def.type})</span>
                  <span className="text-blue-400">- {def.description.slice(0, 80)}...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Integrations List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Puzzle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium text-slate-700">No integrations configured</h3>
          <p className="text-slate-500 text-sm mt-1">Click "Add Integration" to set up your first integration.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIntegrations.map(integration => {
            const definition = getIntegrationDefinition(integration.type);
            const isExpanded = expandedIntegrations[integration.id];

            return (
              <div
                key={integration.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleExpanded(integration.id)}
                        className="p-1 hover:bg-slate-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-500" />
                        )}
                      </button>

                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${accentColor}15` }}
                      >
                        {integration.integrationType === INTEGRATION_TYPES.ATLAS ? (
                          <Map className="w-5 h-5" style={{ color: accentColor }} />
                        ) : (
                          <Bell className="w-5 h-5" style={{ color: accentColor }} />
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-800">{integration.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span className="capitalize">{integration.integrationType}</span>
                          <span className="text-slate-300">|</span>
                          <span>{definition?.name || integration.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                        integration.enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {integration.enabled ? <Check className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {integration.enabled ? 'Active' : 'Disabled'}
                      </span>

                      {/* Org Count */}
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        <Building2 className="w-3 h-3" />
                        {integration.organizations?.length || 0} orgs
                      </span>

                      {/* Actions */}
                      <button
                        onClick={() => handleToggleEnabled(integration)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        title={integration.enabled ? 'Disable' : 'Enable'}
                      >
                        {integration.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setEditingIntegration(integration)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteIntegration(integration)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Description */}
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Description</h4>
                        <p className="text-sm text-slate-600">
                          {definition?.description || 'No description available'}
                        </p>
                      </div>

                      {/* Assigned Organizations */}
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Assigned Organizations</h4>
                        {integration.organizations?.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {integration.organizations.map(orgId => (
                              <span
                                key={orgId}
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-200 rounded"
                              >
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {getOrgName(orgId)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No organizations assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Window Dimension Settings (Pictometry only) */}
                    {integration.type === 'pictometry' && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Maximize2 className="w-4 h-4 text-slate-400" />
                          <h4 className="text-xs font-bold uppercase text-slate-500">Default Popup Window Size</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">Width:</span>
                            <span className="text-sm font-medium text-slate-800">
                              {integration.defaultWindowConfig?.windowWidth ?? 80}
                              {integration.defaultWindowConfig?.windowWidthUnit || '%'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">Height:</span>
                            <span className="text-sm font-medium text-slate-800">
                              {integration.defaultWindowConfig?.windowHeight ?? 80}
                              {integration.defaultWindowConfig?.windowHeightUnit || '%'}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          Click Edit to modify window dimensions. Organizations can override these defaults.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <AddIntegrationModal
          organizations={organizations}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddIntegration}
          accentColor={accentColor}
        />
      )}

      {/* Edit Integration Modal */}
      {editingIntegration && (
        <EditIntegrationModal
          integration={editingIntegration}
          organizations={organizations}
          onClose={() => setEditingIntegration(null)}
          onSave={(updates) => handleUpdateIntegration(editingIntegration.id, updates)}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}

// --- ADD INTEGRATION MODAL ---
function AddIntegrationModal({ organizations, onClose, onSave, accentColor }) {
  const [selectedType, setSelectedType] = useState('');
  const [name, setName] = useState('');
  const [integrationType, setIntegrationType] = useState(INTEGRATION_TYPES.ATLAS);
  const [selectedOrgs, setSelectedOrgs] = useState([]);
  const [saving, setSaving] = useState(false);
  // Window dimension defaults for pictometry/nearmap
  const [windowWidth, setWindowWidth] = useState(80);
  const [windowWidthUnit, setWindowWidthUnit] = useState('%');
  const [windowHeight, setWindowHeight] = useState(80);
  const [windowHeightUnit, setWindowHeightUnit] = useState('%');

  // Helper to check if integration type supports window configuration
  const supportsWindowConfig = (type) => ['pictometry', 'nearmap'].includes(type);

  const integrationOptions = Object.values(AVAILABLE_INTEGRATIONS);

  const handleSelectType = (type) => {
    setSelectedType(type);
    const def = AVAILABLE_INTEGRATIONS[type];
    if (def) {
      setName(def.name);
      setIntegrationType(def.type);
    }
  };

  const toggleOrg = (orgId) => {
    setSelectedOrgs(prev =>
      prev.includes(orgId)
        ? prev.filter(id => id !== orgId)
        : [...prev, orgId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedType || !name) return;

    setSaving(true);
    const integrationData = {
      type: selectedType,
      name,
      integrationType,
      organizations: selectedOrgs,
      enabled: true
    };

    // Add window dimension defaults for integrations that support it
    if (supportsWindowConfig(selectedType)) {
      integrationData.defaultWindowConfig = {
        windowWidth,
        windowWidthUnit,
        windowHeight,
        windowHeightUnit
      };
    }

    await onSave(integrationData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Add Integration</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Integration Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Integration Type</label>
            <div className="grid grid-cols-1 gap-3">
              {integrationOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectType(option.id)}
                  className={`flex items-start gap-3 p-4 border rounded-lg text-left transition ${
                    selectedType === option.id
                      ? 'border-2'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={selectedType === option.id ? { borderColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}15` }}
                  >
                    {option.type === INTEGRATION_TYPES.ATLAS ? (
                      <Map className="w-5 h-5" style={{ color: accentColor }} />
                    ) : (
                      <Bell className="w-5 h-5" style={{ color: accentColor }} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800">{option.name}</h4>
                    <p className="text-sm text-slate-500 mt-0.5">{option.description}</p>
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">
                      {option.type}
                    </span>
                  </div>
                  {selectedType === option.id && (
                    <Check className="w-5 h-5 flex-shrink-0 ml-auto" style={{ color: accentColor }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <>
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a custom name..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': accentColor }}
                  required
                />
              </div>

              {/* Integration Target (Atlas/Notify) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Integration Target</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIntegrationType(INTEGRATION_TYPES.ATLAS)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition ${
                      integrationType === INTEGRATION_TYPES.ATLAS
                        ? 'border-2'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={integrationType === INTEGRATION_TYPES.ATLAS ? { borderColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                  >
                    <Map className="w-5 h-5" style={integrationType === INTEGRATION_TYPES.ATLAS ? { color: accentColor } : { color: '#94a3b8' }} />
                    <span className={integrationType === INTEGRATION_TYPES.ATLAS ? 'font-medium text-slate-800' : 'text-slate-500'}>Atlas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntegrationType(INTEGRATION_TYPES.NOTIFY)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg transition ${
                      integrationType === INTEGRATION_TYPES.NOTIFY
                        ? 'border-2'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={integrationType === INTEGRATION_TYPES.NOTIFY ? { borderColor: accentColor, backgroundColor: `${accentColor}08` } : {}}
                  >
                    <Bell className="w-5 h-5" style={integrationType === INTEGRATION_TYPES.NOTIFY ? { color: accentColor } : { color: '#94a3b8' }} />
                    <span className={integrationType === INTEGRATION_TYPES.NOTIFY ? 'font-medium text-slate-800' : 'text-slate-500'}>Notify</span>
                  </button>
                </div>
              </div>

              {/* Organization Assignment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign to Organizations
                  <span className="font-normal text-slate-400 ml-2">({selectedOrgs.length} selected)</span>
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {organizations.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      No organizations found
                    </div>
                  ) : (
                    organizations.map(org => (
                      <label
                        key={org.id}
                        className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrgs.includes(org.id)}
                          onChange={() => toggleOrg(org.id)}
                          className="w-4 h-4 rounded border-slate-300"
                          style={{ accentColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">{org.name}</div>
                          <div className="text-xs text-slate-500">{org.id}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Window Size Configuration (Pictometry/Nearmap) */}
              {supportsWindowConfig(selectedType) && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Maximize2 className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Default Popup Window Size</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Configure the default size of the {selectedType === 'pictometry' ? 'EagleView' : 'Nearmap'} popup window. Organizations can override these defaults in their own configuration. Use pixels (px) for fixed sizes or percentage (%) for responsive sizing.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Width */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Width</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={windowWidth}
                          onChange={(e) => setWindowWidth(parseInt(e.target.value) || 80)}
                          min="1"
                          max={windowWidthUnit === '%' ? 100 : 3000}
                          placeholder="80"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                          style={{ '--tw-ring-color': accentColor }}
                        />
                        <select
                          value={windowWidthUnit}
                          onChange={(e) => setWindowWidthUnit(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm bg-white"
                          style={{ '--tw-ring-color': accentColor }}
                        >
                          <option value="%">%</option>
                          <option value="px">px</option>
                        </select>
                      </div>
                    </div>
                    {/* Height */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Height</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={windowHeight}
                          onChange={(e) => setWindowHeight(parseInt(e.target.value) || 80)}
                          min="1"
                          max={windowHeightUnit === '%' ? 100 : 3000}
                          placeholder="80"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                          style={{ '--tw-ring-color': accentColor }}
                        />
                        <select
                          value={windowHeightUnit}
                          onChange={(e) => setWindowHeightUnit(e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm bg-white"
                          style={{ '--tw-ring-color': accentColor }}
                        >
                          <option value="%">%</option>
                          <option value="px">px</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Default: 80% width x 80% height. For percentage values, the popup will be sized relative to the browser viewport.
                  </p>
                </div>
              )}
            </>
          )}
        </form>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedType || !name}
            className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Integration
          </button>
        </div>
      </div>
    </div>
  );
}

// --- EDIT INTEGRATION MODAL ---
function EditIntegrationModal({ integration, organizations, onClose, onSave, accentColor }) {
  const [name, setName] = useState(integration.name || '');
  const [selectedOrgs, setSelectedOrgs] = useState(integration.organizations || []);
  const [saving, setSaving] = useState(false);
  // Window dimension defaults for pictometry/nearmap
  const [windowWidth, setWindowWidth] = useState(integration.defaultWindowConfig?.windowWidth ?? 80);
  const [windowWidthUnit, setWindowWidthUnit] = useState(integration.defaultWindowConfig?.windowWidthUnit || '%');
  const [windowHeight, setWindowHeight] = useState(integration.defaultWindowConfig?.windowHeight ?? 80);
  const [windowHeightUnit, setWindowHeightUnit] = useState(integration.defaultWindowConfig?.windowHeightUnit || '%');

  const definition = AVAILABLE_INTEGRATIONS[integration.type];

  // Helper to check if integration type supports window configuration
  const supportsWindowConfig = (type) => ['pictometry', 'nearmap'].includes(type);

  const toggleOrg = (orgId) => {
    setSelectedOrgs(prev =>
      prev.includes(orgId)
        ? prev.filter(id => id !== orgId)
        : [...prev, orgId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    const updates = {
      name,
      organizations: selectedOrgs
    };

    // Add window dimension defaults for integrations that support it
    if (supportsWindowConfig(integration.type)) {
      updates.defaultWindowConfig = {
        windowWidth,
        windowWidthUnit,
        windowHeight,
        windowHeightUnit
      };
    }

    await onSave(updates);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Edit Integration</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Integration Info (Read-only) */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                {integration.integrationType === INTEGRATION_TYPES.ATLAS ? (
                  <Map className="w-5 h-5" style={{ color: accentColor }} />
                ) : (
                  <Bell className="w-5 h-5" style={{ color: accentColor }} />
                )}
              </div>
              <div>
                <h4 className="font-medium text-slate-800">{definition?.name || integration.type}</h4>
                <p className="text-sm text-slate-500">{definition?.description || 'No description'}</p>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a custom name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor }}
              required
            />
          </div>

          {/* Organization Assignment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign to Organizations
              <span className="font-normal text-slate-400 ml-2">({selectedOrgs.length} selected)</span>
            </label>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {organizations.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">
                  No organizations found
                </div>
              ) : (
                organizations.map(org => (
                  <label
                    key={org.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOrgs.includes(org.id)}
                      onChange={() => toggleOrg(org.id)}
                      className="w-4 h-4 rounded border-slate-300"
                      style={{ accentColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 truncate">{org.name}</div>
                      <div className="text-xs text-slate-500">{org.id}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Window Size Configuration (Pictometry/Nearmap) */}
          {supportsWindowConfig(integration.type) && (
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Maximize2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Default Popup Window Size</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Configure the default size of the {integration.type === 'pictometry' ? 'EagleView' : 'Nearmap'} popup window. Organizations can override these defaults in their own configuration. Use pixels (px) for fixed sizes or percentage (%) for responsive sizing.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {/* Width */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Width</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={windowWidth}
                      onChange={(e) => setWindowWidth(parseInt(e.target.value) || 80)}
                      min="1"
                      max={windowWidthUnit === '%' ? 100 : 3000}
                      placeholder="80"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                      style={{ '--tw-ring-color': accentColor }}
                    />
                    <select
                      value={windowWidthUnit}
                      onChange={(e) => setWindowWidthUnit(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm bg-white"
                      style={{ '--tw-ring-color': accentColor }}
                    >
                      <option value="%">%</option>
                      <option value="px">px</option>
                    </select>
                  </div>
                </div>
                {/* Height */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Height</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={windowHeight}
                      onChange={(e) => setWindowHeight(parseInt(e.target.value) || 80)}
                      min="1"
                      max={windowHeightUnit === '%' ? 100 : 3000}
                      placeholder="80"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                      style={{ '--tw-ring-color': accentColor }}
                    />
                    <select
                      value={windowHeightUnit}
                      onChange={(e) => setWindowHeightUnit(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm bg-white"
                      style={{ '--tw-ring-color': accentColor }}
                    >
                      <option value="%">%</option>
                      <option value="px">px</option>
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Default: 80% width x 80% height. For percentage values, the popup will be sized relative to the browser viewport.
              </p>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name}
            className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: accentColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
