// src/config/geminiConfig.js
// Centralized Gemini API configuration
// Update model name here to change across all components

/**
 * Available Gemini Models (as of Jan 2025):
 * - gemini-2.5-flash          : Latest stable, fast & capable (RECOMMENDED)
 * - gemini-2.5-pro            : Most powerful, better reasoning
 * - gemini-2.0-flash-001      : Previous stable version (fallback)
 * 
 * Note: Model names change frequently. Check Google AI docs for latest.
 * See: https://ai.google.dev/gemini-api/docs/models
 */

// ===========================================
// CONFIGURE GEMINI SETTINGS HERE
// ===========================================

export const GEMINI_CONFIG = {
  // API Key - consider moving to environment variable for production
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  
  // Primary model to use across the application
  model: 'gemini-2.5-flash',
  
  // Fallback model if primary fails
  fallbackModel: 'gemini-2.0-flash-001',
  
  // Base API URL (v1beta supports latest models)
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get the full API endpoint URL for generateContent
 */
export const getGeminiEndpoint = (model = GEMINI_CONFIG.model) => {
  return `${GEMINI_CONFIG.baseUrl}/${model}:generateContent`;
};

/**
 * Get the full API URL with key parameter
 */
export const getGeminiUrl = (model = GEMINI_CONFIG.model) => {
  return `${getGeminiEndpoint(model)}?key=${GEMINI_CONFIG.apiKey}`;
};

/**
 * Get the fallback API URL
 */
export const getGeminiFallbackUrl = () => {
  return `${getGeminiEndpoint(GEMINI_CONFIG.fallbackModel)}?key=${GEMINI_CONFIG.apiKey}`;
};

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