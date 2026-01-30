// src/admin/components/OrgIntegrationsConfig.jsx
// Organization-level integrations configuration for org admins
// Allows org admins to configure credentials for integrations assigned to their organization

import React, { useState, useEffect } from 'react';
import {
  Puzzle,
  Eye,
  Key,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  ExternalLink,
  Map,
  MapPin,
  Maximize2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { PATHS } from '../../shared/services/paths';
import {
  AVAILABLE_INTEGRATIONS,
  subscribeToIntegrations
} from '../../shared/services/integrations';

/**
 * OrgIntegrationsConfig Component
 *
 * Displays integrations assigned to the organization and allows
 * org admins to configure their credentials (e.g., API keys).
 *
 * Props:
 * @param {object} db - Firestore database instance
 * @param {string} orgId - Organization ID
 * @param {object} orgData - Organization data
 * @param {function} addToast - Toast notification function
 * @param {string} accentColor - Theme accent color
 */
export default function OrgIntegrationsConfig({
  db,
  orgId,
  orgData,
  addToast,
  accentColor = '#1E5631'
}) {
  const [systemIntegrations, setSystemIntegrations] = useState([]);
  const [orgIntegrations, setOrgIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  // Subscribe to system integrations
  useEffect(() => {
    const unsubscribe = subscribeToIntegrations((data) => {
      // Filter to only integrations assigned to this org and enabled
      const orgAssigned = data.filter(
        i => i.enabled && i.organizations?.includes(orgId)
      );
      setSystemIntegrations(orgAssigned);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orgId]);

  // Subscribe to org-level integration config
  useEffect(() => {
    if (!db || !orgId) return;

    const orgRef = doc(db, PATHS.organizations, orgId);
    const unsubscribe = onSnapshot(orgRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrgIntegrations(data.integrations || {});
      }
    });
    return () => unsubscribe();
  }, [db, orgId]);

  // Save org-level integration config
  const handleSaveConfig = async (integrationTypeKey, config) => {
    if (!db || !orgId) {
      addToast?.('Unable to save: missing database connection', 'error');
      return;
    }

    try {
      setSaving(prev => ({ ...prev, [integrationTypeKey]: true }));

      const orgRef = doc(db, PATHS.organizations, orgId);
      await updateDoc(orgRef, {
        [`integrations.${integrationTypeKey}`]: config,
        updatedAt: serverTimestamp()
      });

      addToast?.('Integration configuration saved', 'success');
    } catch (error) {
      console.error('Error saving integration config:', error);
      addToast?.('Failed to save configuration', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [integrationTypeKey]: false }));
    }
  };

  const getIntegrationDefinition = (type) => {
    return AVAILABLE_INTEGRATIONS[type] || null;
  };

  const getOrgConfig = (integrationTypeKey) => {
    return orgIntegrations[integrationTypeKey] || {};
  };

  const hasAtlasConfig = !!orgData?.atlasConfig || !!orgData?.atlasConfigDraft;

  // Show Atlas not initialized message
  if (!hasAtlasConfig) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Atlas Not Initialized</h3>
        <p className="text-slate-500 mb-4">
          You need to initialize Atlas before you can configure integrations.
        </p>
        <p className="text-sm text-slate-400">
          Go to the <strong>Maps</strong> tab to initialize Atlas for your organization.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  // No integrations assigned
  if (systemIntegrations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Integrations</h2>
          <p className="text-slate-500 text-sm">Configure third-party integrations for your Atlas application.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
          <Puzzle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Integrations Assigned</h3>
          <p className="text-slate-500 mb-4">
            Your organization does not have any integrations assigned yet.
          </p>
          <p className="text-sm text-slate-400">
            Contact your system administrator to enable integrations for your organization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Integrations</h2>
        <p className="text-slate-500 text-sm">Configure third-party integrations for your Atlas application.</p>
      </div>

      {/* Integrations List */}
      <div className="space-y-4">
        {systemIntegrations.map(integration => {
          const definition = getIntegrationDefinition(integration.type);
          const orgConfig = getOrgConfig(integration.type);

          return (
            <IntegrationConfigCard
              key={integration.id}
              integration={integration}
              definition={definition}
              orgConfig={orgConfig}
              onSave={(config) => handleSaveConfig(integration.type, config)}
              saving={saving[integration.type]}
              accentColor={accentColor}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * IntegrationConfigCard Component
 *
 * Renders configuration UI for a single integration
 */
function IntegrationConfigCard({
  integration,
  definition,
  orgConfig,
  onSave,
  saving,
  accentColor
}) {
  const [config, setConfig] = useState(orgConfig);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when orgConfig changes
  useEffect(() => {
    setConfig(orgConfig);
    setHasChanges(false);
  }, [orgConfig]);

  const handleFieldChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(config);
    setHasChanges(false);
  };

  const isConfigured = config?.apiKey && config.apiKey.trim() !== '';

  // Render Pictometry-specific configuration
  if (integration.type === 'pictometry') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Eye className="w-6 h-6" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-800 text-lg">{integration.name}</h3>
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {definition?.description || 'Aerial imagery viewer integration'}
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="p-5 space-y-4">
          {/* API Key Field */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                EagleView API Key
              </div>
            </label>
            <input
              type="text"
              value={config?.apiKey || ''}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder="e.g., 3f513db9-95ae-4df3-b64b-b26267b95cce"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent font-mono text-sm"
              style={{ '--tw-ring-color': accentColor }}
            />
          </div>

          {/* Window Size Configuration */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Maximize2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Popup Window Size</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Configure the size of the EagleView popup window that appears within Atlas. Use pixels (px) for fixed sizes or percentage (%) for responsive sizing.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {/* Width */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Width</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config?.windowWidth ?? 80}
                    onChange={(e) => handleFieldChange('windowWidth', parseInt(e.target.value) || 80)}
                    min="1"
                    max={config?.windowWidthUnit === 'px' ? 3000 : 100}
                    placeholder="80"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                    style={{ '--tw-ring-color': accentColor }}
                  />
                  <select
                    value={config?.windowWidthUnit || '%'}
                    onChange={(e) => handleFieldChange('windowWidthUnit', e.target.value)}
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
                    value={config?.windowHeight ?? 80}
                    onChange={(e) => handleFieldChange('windowHeight', parseInt(e.target.value) || 80)}
                    min="1"
                    max={config?.windowHeightUnit === 'px' ? 3000 : 100}
                    placeholder="80"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                    style={{ '--tw-ring-color': accentColor }}
                  />
                  <select
                    value={config?.windowHeightUnit || '%'}
                    onChange={(e) => handleFieldChange('windowHeightUnit', e.target.value)}
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

          {/* Domain Requirement Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">Domain Configuration Required</p>
                <p className="text-blue-700">
                  Your EagleView API Key must be configured for use with the domain where your Atlas application is deployed.
                  For hosted deployments, ensure the key is authorized for:
                </p>
                <div className="mt-2 p-2 bg-blue-100 rounded font-mono text-xs text-blue-800">
                  https://atlas.civ.quest/
                </div>
                <p className="text-blue-600 text-xs mt-2">
                  If you are using a custom domain, ensure your API key is authorized for that domain instead.
                  Contact EagleView support if you need assistance configuring domain access for your API key.
                </p>
              </div>
            </div>
          </div>

          {/* EagleView Documentation Link */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ExternalLink className="w-4 h-4" />
            <a
              href="https://www.eagleview.com/product/imagery/connect/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: accentColor }}
            >
              Learn more about EagleView Connect API
            </a>
          </div>
        </div>

        {/* Footer with Save Button */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {hasChanges ? (
              <span className="text-amber-600 font-medium">You have unsaved changes</span>
            ) : isConfigured ? (
              <span className="text-green-600">Configuration saved</span>
            ) : (
              <span>Enter your API key to enable EagleView integration</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
            style={{ backgroundColor: hasChanges ? accentColor : '#94a3b8' }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Render Nearmap-specific configuration
  // Note: Nearmap requires an embedUrl to be configured
  if (integration.type === 'nearmap') {
    // Nearmap is configured when embedUrl is set
    const nearmapConfigured = config?.embedUrl && config.embedUrl.trim() !== '';

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <MapPin className="w-6 h-6" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-800 text-lg">{integration.name}</h3>
                {nearmapConfigured ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3" />
                    Configured
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    Setup Required
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {definition?.description || 'High-resolution aerial imagery integration'}
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="p-5 space-y-4">
          {/* Embed URL Configuration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-slate-400" />
                Nearmap Embed URL
              </div>
            </label>
            <input
              type="text"
              value={config?.embedUrl || ''}
              onChange={(e) => handleFieldChange('embedUrl', e.target.value)}
              placeholder="e.g., https://example.com/nearmap/index.html?lat={lat}&lon={lon}&w={width}&h={height}"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent font-mono text-sm"
              style={{ '--tw-ring-color': accentColor }}
            />
            <p className="text-xs text-slate-500 mt-1">
              Use <code className="bg-slate-100 px-1 rounded">{'{lat}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{lon}'}</code>, <code className="bg-slate-100 px-1 rounded">{'{width}'}</code>, and <code className="bg-slate-100 px-1 rounded">{'{height}'}</code> as placeholders.
            </p>
          </div>

          {/* Info about configuration */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800 mb-1">Embed URL Required</p>
                <p className="text-blue-700">
                  Enter the URL for your organization's Nearmap viewer. The URL should include placeholders that will be replaced when opening the viewer:
                </p>
                <ul className="text-blue-700 mt-1 ml-4 list-disc">
                  <li><code className="bg-blue-100 px-1 rounded">{'{lat}'}</code> / <code className="bg-blue-100 px-1 rounded">{'{latitude}'}</code> - WGS84 latitude</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{lon}'}</code> / <code className="bg-blue-100 px-1 rounded">{'{lng}'}</code> / <code className="bg-blue-100 px-1 rounded">{'{longitude}'}</code> - WGS84 longitude</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{width}'}</code> - Window width in pixels</li>
                  <li><code className="bg-blue-100 px-1 rounded">{'{height}'}</code> - Window height in pixels</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Window Size Configuration */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Maximize2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Popup Window Size (pixels)</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Configure the size of the Nearmap popup window in pixels. These values are also passed to the embed URL via the <code className="bg-slate-100 px-1 rounded">{'{width}'}</code> and <code className="bg-slate-100 px-1 rounded">{'{height}'}</code> placeholders.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {/* Width */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Width (px)</label>
                <input
                  type="number"
                  value={config?.windowWidth ?? 1000}
                  onChange={(e) => handleFieldChange('windowWidth', parseInt(e.target.value) || 1000)}
                  min="400"
                  max="3000"
                  placeholder="1000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                  style={{ '--tw-ring-color': accentColor }}
                />
              </div>
              {/* Height */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Height (px)</label>
                <input
                  type="number"
                  value={config?.windowHeight ?? 700}
                  onChange={(e) => handleFieldChange('windowHeight', parseInt(e.target.value) || 700)}
                  min="300"
                  max="3000"
                  placeholder="700"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 text-sm"
                  style={{ '--tw-ring-color': accentColor }}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Default: 1000px width x 700px height. Minimum: 400x300px.
            </p>
          </div>

          {/* Nearmap Documentation Link */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ExternalLink className="w-4 h-4" />
            <a
              href="https://docs.nearmap.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: accentColor }}
            >
              Learn more about Nearmap
            </a>
          </div>
        </div>

        {/* Footer with Save Button */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {hasChanges ? (
              <span className="text-amber-600 font-medium">You have unsaved changes</span>
            ) : nearmapConfigured ? (
              <span className="text-green-600">Configuration saved</span>
            ) : (
              <span>Enter your embed URL to enable Nearmap integration</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
            style={{ backgroundColor: hasChanges ? accentColor : '#94a3b8' }}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Generic configuration card for other integrations (future-proofing)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <Map className="w-6 h-6" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 text-lg">{integration.name}</h3>
            <p className="text-sm text-slate-500 mt-1">
              {definition?.description || 'Integration'}
            </p>

            {/* Render config fields from schema */}
            {definition?.configSchema && (
              <div className="mt-4 space-y-3">
                {Object.entries(definition.configSchema).map(([fieldKey, fieldDef]) => (
                  <div key={fieldKey}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {fieldDef.label}
                      {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type={fieldDef.type === 'password' ? 'password' : 'text'}
                      value={config?.[fieldKey] || ''}
                      onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                      placeholder={fieldDef.placeholder || ''}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': accentColor }}
                    />
                    {fieldDef.description && (
                      <p className="text-xs text-slate-500 mt-1">{fieldDef.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with Save Button */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          style={{ backgroundColor: hasChanges ? accentColor : '#94a3b8' }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}
