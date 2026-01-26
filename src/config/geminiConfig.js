// src/config/geminiConfig.js
// Centralized Gemini API configuration
// Update model name here to change across all components

/**
 * Available Gemini Models (as of Jan 2025):
 * - gemini-3-flash-preview    : Latest preview, fast & capable (RECOMMENDED)
 * - gemini-3-pro-preview      : Most powerful, better reasoning
 * - gemini-2.5-flash          : Stable, production-ready
 * - gemini-2.0-flash          : Previous stable version
 * 
 * See: https://ai.google.dev/gemini-api/docs/models
 */

// ===========================================
// CONFIGURE GEMINI SETTINGS HERE
// ===========================================

export const GEMINI_CONFIG = {
  // API Key - consider moving to environment variable for production
  apiKey: 'AIzaSyBhvt_ue8AiQy8ChwQM2JMK-0oBvUBaGes',
  
  // Model to use across the application
  model: 'gemini-3-flash-preview',
  
  // Base API URL (v1beta supports latest models)
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get the full API endpoint URL for generateContent
 */
export const getGeminiEndpoint = () => {
  return `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.model}:generateContent`;
};

/**
 * Get the full API URL with key parameter
 */
export const getGeminiUrl = () => {
  return `${getGeminiEndpoint()}?key=${GEMINI_CONFIG.apiKey}`;
};

/**
 * Default generation config for query translation (low temperature for consistency)
 */
export const GEMINI_QUERY_CONFIG = {
  temperature: 0.1,
  maxOutputTokens: 1024,
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
  maxOutputTokens: 1024,
};

export default GEMINI_CONFIG;
