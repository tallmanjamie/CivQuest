// src/admin/components/AISettingsEditor.jsx
// Super Admin component for managing AI settings (Gemini model configuration)

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  Save,
  Sparkles,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import {
  subscribeToAISettings,
  updateAISettings,
  DEFAULT_AI_SETTINGS
} from '../../shared/services/systemConfig';

/**
 * Available Gemini Models
 * Updated list based on Google AI documentation
 */
const AVAILABLE_MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Latest stable model. Fast & capable, best for most use cases.',
    recommended: true
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Most powerful model. Better reasoning capabilities.',
    recommended: false
  },
  {
    id: 'gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    description: 'Previous stable version. Good fallback option.',
    recommended: false
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Legacy stable model. Use for compatibility.',
    recommended: false
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Legacy pro model. Higher quality but slower.',
    recommended: false
  }
];

export default function AISettingsEditor({ db, addToast, confirm, adminEmail, accentColor = '#004E7C' }) {
  const [aiSettings, setAISettings] = useState(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(DEFAULT_AI_SETTINGS);

  // Subscribe to AI settings
  useEffect(() => {
    const unsubscribe = subscribeToAISettings((settings) => {
      setAISettings(settings);
      setOriginalSettings(settings);
      setLoading(false);
      setHasChanges(false);
    });
    return () => unsubscribe();
  }, []);

  const handleModelChange = (field, value) => {
    setAISettings(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validate that primary and fallback models are different
    if (aiSettings.geminiModel === aiSettings.geminiFallbackModel) {
      addToast('Primary and fallback models should be different for redundancy', 'warning');
    }

    setSaving(true);
    try {
      await updateAISettings(aiSettings, adminEmail);
      addToast('AI settings saved successfully', 'success');
      setHasChanges(false);
    } catch (err) {
      addToast(`Error saving AI settings: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAISettings(originalSettings);
    setHasChanges(false);
  };

  const getModelInfo = (modelId) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId) || {
      id: modelId,
      name: modelId,
      description: 'Custom model',
      recommended: false
    };
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
          <h2 className="text-xl font-bold text-slate-800">AI Settings</h2>
          <p className="text-slate-500 text-sm">Configure AI model settings for the CivQuest platform.</p>
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
            <p className="font-medium text-blue-800">Gemini AI Configuration</p>
            <p className="text-blue-700 mt-1">
              These settings control which Gemini model is used for AI features across CivQuest,
              including the Atlas chat assistant, help panel, and notification wizard.
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
              <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Gemini Model Configuration</h3>
              <p className="text-sm text-slate-500">Select the AI models used for queries</p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-6">
          {/* Primary Model */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Primary Model
            </label>
            <p className="text-sm text-slate-500 mb-3">
              The main model used for AI queries. Choose a model that balances speed and capability.
            </p>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map(model => (
                <label
                  key={model.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    aiSettings.geminiModel === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="geminiModel"
                    value={model.id}
                    checked={aiSettings.geminiModel === model.id}
                    onChange={(e) => handleModelChange('geminiModel', e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{model.name}</span>
                      {model.recommended && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Recommended
                        </span>
                      )}
                      {aiSettings.geminiModel === model.id && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{model.description}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{model.id}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200" />

          {/* Fallback Model */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fallback Model
            </label>
            <p className="text-sm text-slate-500 mb-3">
              Used when the primary model fails or is unavailable. Should be different from the primary model.
            </p>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map(model => (
                <label
                  key={model.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    aiSettings.geminiFallbackModel === model.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="geminiFallbackModel"
                    value={model.id}
                    checked={aiSettings.geminiFallbackModel === model.id}
                    onChange={(e) => handleModelChange('geminiFallbackModel', e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{model.name}</span>
                      {aiSettings.geminiFallbackModel === model.id && (
                        <Check className="w-4 h-4 text-orange-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{model.description}</p>
                    <p className="text-xs text-slate-400 font-mono mt-1">{model.id}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Warning if same model selected */}
          {aiSettings.geminiModel === aiSettings.geminiFallbackModel && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Same Model Selected</p>
                  <p className="text-amber-700 mt-1">
                    The primary and fallback models are the same. For better redundancy,
                    consider selecting a different fallback model.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-500">
              <span className="font-medium">Current Configuration:</span>
              <span className="ml-2 font-mono text-slate-700">{aiSettings.geminiModel}</span>
              <span className="mx-2 text-slate-400">|</span>
              <span className="text-slate-400">Fallback:</span>
              <span className="ml-1 font-mono text-slate-700">{aiSettings.geminiFallbackModel}</span>
            </div>
            {hasChanges && (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            )}
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-slate-100 rounded-lg p-4">
        <h4 className="font-medium text-slate-700 mb-2">Model Information</h4>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>
            <span className="font-medium">Gemini 2.5 Flash:</span> Best balance of speed and quality. Recommended for most use cases.
          </li>
          <li>
            <span className="font-medium">Gemini 2.5 Pro:</span> Higher quality responses but slower. Use for complex queries.
          </li>
          <li>
            <span className="font-medium">Gemini 2.0 Flash:</span> Previous generation, stable and reliable fallback option.
          </li>
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          Model availability may vary. Check{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/models"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Google AI documentation
          </a>
          {' '}for the latest model information.
        </p>
      </div>
    </div>
  );
}
