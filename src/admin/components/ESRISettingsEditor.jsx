// src/admin/components/ESRISettingsEditor.jsx
// Super Admin component for managing ESRI/ArcGIS settings

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  Save,
  Map,
  Info,
  Key
} from 'lucide-react';
import {
  subscribeToESRISettings,
  updateESRISettings,
  DEFAULT_ESRI_SETTINGS
} from '../../shared/services/systemConfig';

export default function ESRISettingsEditor({ db, addToast, confirm, adminEmail, accentColor = '#004E7C' }) {
  const [esriSettings, setESRISettings] = useState(DEFAULT_ESRI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_ESRI_SETTINGS);

  // Subscribe to ESRI settings
  useEffect(() => {
    const unsubscribe = subscribeToESRISettings((settings) => {
      setESRISettings(settings);
      setOriginalSettings(settings);
      setLoading(false);
      setHasChanges(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSettingChange = (field, value) => {
    setESRISettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateESRISettings(esriSettings, adminEmail);
      addToast('ESRI settings saved successfully', 'success');
      setHasChanges(false);
    } catch (err) {
      addToast(`Error saving ESRI settings: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setESRISettings(originalSettings);
    setHasChanges(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ESRI Settings</h2>
          <p className="text-slate-500 text-sm">Configure ESRI/ArcGIS integration settings for the CivQuest platform.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg font-medium hover:bg-slate-200"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentColor }}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800">ESRI/ArcGIS Configuration</p>
            <p className="text-blue-700 mt-1">
              These settings control the ESRI/ArcGIS integration for CivQuest.
              The Client ID is used for OAuth authentication with ArcGIS services.
              Changes will take effect immediately for all organizations.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Card Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <Map className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">ArcGIS Application Settings</h3>
              <p className="text-sm text-slate-500">Configure your ArcGIS application credentials</p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          {/* Client ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Client ID
              </div>
            </label>
            <p className="text-sm text-slate-500 mb-3">
              The OAuth Client ID from your ArcGIS Developer application.
              This is required for authenticating users with ArcGIS services.
            </p>
            <input
              type="text"
              value={esriSettings.clientId}
              onChange={(e) => handleSettingChange('clientId', e.target.value)}
              placeholder="Enter your ESRI Client ID"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-2">
              You can find or create your Client ID at{' '}
              <a
                href="https://developers.arcgis.com/applications/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                developers.arcgis.com
              </a>
            </p>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-500">
              <span className="font-medium">Current Client ID:</span>
              <span className="ml-2 font-mono text-slate-700">
                {esriSettings.clientId || '(not set)'}
              </span>
            </div>
            {hasChanges && (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            )}
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-slate-100 rounded-lg p-4">
        <h4 className="font-medium text-slate-700 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>
            Go to the{' '}
            <a
              href="https://developers.arcgis.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              ArcGIS Developers Portal
            </a>
            {' '}and sign in with your ArcGIS account.
          </li>
          <li>Create a new application or select an existing one.</li>
          <li>Copy the Client ID from your application settings.</li>
          <li>Paste the Client ID in the field above and save.</li>
        </ol>
        <p className="text-xs text-slate-500 mt-3">
          Additional ESRI settings will be available in future updates.
        </p>
      </div>
    </div>
  );
}
