// src/config/geminiConfig.js
// Centralized Gemini API configuration
// Model settings can be configured in superadmin System > AI settings

/**
 * Available Gemini Models (as of Jan 2025):
 * - gemini-2.5-flash          : Latest stable, fast & capable (RECOMMENDED)
 * - gemini-2.5-pro            : Most powerful, better reasoning
 * - gemini-2.0-flash-001      : Previous stable version (fallback)
 *
 * Note: Model names change frequently. Check Google AI docs for latest.
 * See: https://ai.google.dev/gemini-api/docs/models
 */

import { getAISettings, subscribeToAISettings } from '../shared/services/systemConfig';

// ===========================================
// DEFAULT CONFIGURATION (used as fallback)
// ===========================================

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_FALLBACK_MODEL = 'gemini-2.0-flash-001';

export const GEMINI_CONFIG = {
  // API Key from environment variable
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',

  // Default model (used if dynamic config not loaded)
  model: DEFAULT_MODEL,

  // Default fallback model
  fallbackModel: DEFAULT_FALLBACK_MODEL,

  // Base API URL (v1beta supports latest models)
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// ===========================================
// DYNAMIC CONFIGURATION CACHE
// ===========================================

// Cache for dynamic AI settings from Firestore
let cachedAISettings = null;
let settingsSubscription = null;
let settingsLoadPromise = null;

/**
 * Initialize dynamic AI settings from Firestore
 * Call this early in app initialization
 */
export async function initializeAISettings() {
  if (settingsLoadPromise) {
    return settingsLoadPromise;
  }

  settingsLoadPromise = getAISettings().then(settings => {
    cachedAISettings = settings;
    return settings;
  }).catch(err => {
    console.warn('[geminiConfig] Failed to load AI settings, using defaults:', err);
    return null;
  });

  return settingsLoadPromise;
}

/**
 * Subscribe to AI settings changes for real-time updates
 * Returns unsubscribe function
 */
export function subscribeToAISettingsChanges(callback) {
  if (settingsSubscription) {
    return settingsSubscription;
  }

  settingsSubscription = subscribeToAISettings((settings) => {
    cachedAISettings = settings;
    if (callback) {
      callback(settings);
    }
  });

  return settingsSubscription;
}

/**
 * Get the current model (from cache or default)
 */
export function getCurrentModel() {
  return cachedAISettings?.geminiModel || GEMINI_CONFIG.model;
}

/**
 * Get the current fallback model (from cache or default)
 */
export function getCurrentFallbackModel() {
  return cachedAISettings?.geminiFallbackModel || GEMINI_CONFIG.fallbackModel;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get the full API endpoint URL for generateContent
 * Uses dynamic model if available, otherwise falls back to default
 */
export const getGeminiEndpoint = (model = null) => {
  const activeModel = model || getCurrentModel();
  return `${GEMINI_CONFIG.baseUrl}/${activeModel}:generateContent`;
};

/**
 * Get the full API URL with key parameter
 * Uses dynamic model if available, otherwise falls back to default
 */
export const getGeminiUrl = (model = null) => {
  return `${getGeminiEndpoint(model)}?key=${GEMINI_CONFIG.apiKey}`;
};

/**
 * Get the fallback API URL
 * Uses dynamic fallback model if available, otherwise falls back to default
 */
export const getGeminiFallbackUrl = () => {
  const fallbackModel = getCurrentFallbackModel();
  return `${getGeminiEndpoint(fallbackModel)}?key=${GEMINI_CONFIG.apiKey}`;
};

/**
 * Async version: Get the primary API URL after ensuring settings are loaded
 * Use this for initial calls where you want to ensure dynamic config is loaded
 */
export async function getGeminiUrlAsync() {
  await initializeAISettings();
  return getGeminiUrl();
}

/**
 * Async version: Get the fallback API URL after ensuring settings are loaded
 */
export async function getGeminiFallbackUrlAsync() {
  await initializeAISettings();
  return getGeminiFallbackUrl();
}

/**
 * Default generation config for query translation
 * - Low temperature for consistency
 * - Higher token limit to avoid truncated JSON responses
 */
export const GEMINI_QUERY_CONFIG = {
  temperature: 0.1,
  maxOutputTokens: 4096,
};

/**
 * Default generation config for creative/ranking tasks
 */
export const GEMINI_CREATIVE_CONFIG = {
  temperature: 0.2,
  maxOutputTokens: 4096,
};

/**
 * Default generation config for structured output (notification wizard)
 */
export const GEMINI_STRUCTURED_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 4096,
};

export default GEMINI_CONFIG;
