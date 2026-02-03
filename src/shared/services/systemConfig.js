// src/shared/services/systemConfig.js
// Service for managing system-wide configuration (global help, etc.)

import { db } from './firebase';
import { PATHS } from './paths';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Default system configuration structure
 *
 * Help article structure:
 * {
 *   id: string,
 *   title: string,
 *   content: string,
 *   tags: string[],
 *   media: Array<{ id, type: 'image'|'video', url, title, thumbnail?, tags }>,
 *   links: Array<{ id, title, url, description? }>  // External links tied to this article
 * }
 *
 * Integration structure:
 * {
 *   id: string,
 *   type: string, // key from AVAILABLE_INTEGRATIONS (e.g., 'pictometry')
 *   name: string, // custom display name
 *   integrationType: 'atlas' | 'notify',
 *   enabled: boolean,
 *   organizations: string[], // org IDs that have access
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 *
 * Global Export Template structure (map export):
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   pageSize: string, // 'letter-landscape', 'letter-portrait', etc.
 *   customWidth?: number,
 *   customHeight?: number,
 *   backgroundColor: string,
 *   elements: Array<{ id, type, x, y, width, height, locked, visible, content }>,
 *   createdAt: string,
 *   updatedAt: string
 * }
 *
 * Global Feature Export Template structure:
 * {
 *   id: string,
 *   name: string,
 *   description: string,
 *   pageSize: string,
 *   customWidth?: number,
 *   customHeight?: number,
 *   backgroundColor: string,
 *   elements: Array<{ id, type, x, y, width, height, locked, visible, content }>,
 *   mapExportTemplateId: string | null,
 *   createdAt: string,
 *   updatedAt: string
 * }
 *
 * AI Settings structure:
 * {
 *   geminiModel: string,         // Primary Gemini model (e.g., 'gemini-2.5-flash')
 *   geminiFallbackModel: string  // Fallback model if primary fails
 * }
 */

/**
 * Default AI settings
 */
export const DEFAULT_AI_SETTINGS = {
  geminiModel: 'gemini-2.5-flash',
  geminiFallbackModel: 'gemini-2.0-flash-001'
};

/**
 * Default ESRI settings
 * Settings for ESRI/ArcGIS integration
 */
export const DEFAULT_ESRI_SETTINGS = {
  clientId: '' // ESRI/ArcGIS OAuth client ID for the app
};

export const DEFAULT_SYSTEM_CONFIG = {
  globalHelpDocumentation: [],
  integrations: [], // System-level integrations configuration
  globalExportTemplates: [], // Global map export templates for org admins to use
  globalFeatureExportTemplates: [], // Global feature export templates for org admins to use
  aiSettings: DEFAULT_AI_SETTINGS, // AI configuration settings
  esriSettings: DEFAULT_ESRI_SETTINGS, // ESRI/ArcGIS configuration settings
  updatedAt: null,
  updatedBy: null
};

/**
 * Fetch the system configuration
 */
export async function getSystemConfig() {
  const docRef = doc(db, PATHS.systemConfig);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }

  return {
    ...DEFAULT_SYSTEM_CONFIG,
    ...docSnap.data()
  };
}

/**
 * Subscribe to system configuration changes (real-time)
 */
export function subscribeToSystemConfig(callback) {
  const docRef = doc(db, PATHS.systemConfig);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        ...DEFAULT_SYSTEM_CONFIG,
        ...docSnap.data()
      });
    } else {
      callback({ ...DEFAULT_SYSTEM_CONFIG });
    }
  }, (error) => {
    console.error('[systemConfig] Subscription error:', error);
    callback({ ...DEFAULT_SYSTEM_CONFIG });
  });
}

/**
 * Get global help documentation
 */
export async function getGlobalHelpDocumentation() {
  const config = await getSystemConfig();
  return config.globalHelpDocumentation || [];
}

/**
 * Subscribe to global help documentation changes
 */
export function subscribeToGlobalHelp(callback) {
  return subscribeToSystemConfig((config) => {
    callback(config.globalHelpDocumentation || []);
  });
}

/**
 * Update the system configuration
 */
export async function updateSystemConfig(data, userId = null) {
  const docRef = doc(db, PATHS.systemConfig);
  const docSnap = await getDoc(docRef);

  const updateData = {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  };

  if (docSnap.exists()) {
    await updateDoc(docRef, updateData);
  } else {
    await setDoc(docRef, {
      ...DEFAULT_SYSTEM_CONFIG,
      ...updateData
    });
  }
}

/**
 * Update global help documentation
 * External links are now stored within each help article's 'links' array
 */
export async function updateGlobalHelpDocumentation(helpDocs, userId = null) {
  const updateData = { globalHelpDocumentation: helpDocs };
  await updateSystemConfig(updateData, userId);
}

/**
 * Get global export templates (map export)
 */
export async function getGlobalExportTemplates() {
  const config = await getSystemConfig();
  return config.globalExportTemplates || [];
}

/**
 * Subscribe to global export templates changes
 */
export function subscribeToGlobalExportTemplates(callback) {
  return subscribeToSystemConfig((config) => {
    callback(config.globalExportTemplates || []);
  });
}

/**
 * Update global export templates (map export)
 */
export async function updateGlobalExportTemplates(templates, userId = null) {
  const updateData = { globalExportTemplates: templates };
  await updateSystemConfig(updateData, userId);
}

/**
 * Get global feature export templates
 */
export async function getGlobalFeatureExportTemplates() {
  const config = await getSystemConfig();
  return config.globalFeatureExportTemplates || [];
}

/**
 * Subscribe to global feature export templates changes
 */
export function subscribeToGlobalFeatureExportTemplates(callback) {
  return subscribeToSystemConfig((config) => {
    callback(config.globalFeatureExportTemplates || []);
  });
}

/**
 * Update global feature export templates
 */
export async function updateGlobalFeatureExportTemplates(templates, userId = null) {
  const updateData = { globalFeatureExportTemplates: templates };
  await updateSystemConfig(updateData, userId);
}

/**
 * Get AI settings
 */
export async function getAISettings() {
  const config = await getSystemConfig();
  return {
    ...DEFAULT_AI_SETTINGS,
    ...(config.aiSettings || {})
  };
}

/**
 * Subscribe to AI settings changes
 */
export function subscribeToAISettings(callback) {
  return subscribeToSystemConfig((config) => {
    callback({
      ...DEFAULT_AI_SETTINGS,
      ...(config.aiSettings || {})
    });
  });
}

/**
 * Update AI settings
 */
export async function updateAISettings(aiSettings, userId = null) {
  const updateData = { aiSettings };
  await updateSystemConfig(updateData, userId);
}

/**
 * Get ESRI settings
 */
export async function getESRISettings() {
  const config = await getSystemConfig();
  return {
    ...DEFAULT_ESRI_SETTINGS,
    ...(config.esriSettings || {})
  };
}

/**
 * Subscribe to ESRI settings changes
 */
export function subscribeToESRISettings(callback) {
  return subscribeToSystemConfig((config) => {
    callback({
      ...DEFAULT_ESRI_SETTINGS,
      ...(config.esriSettings || {})
    });
  });
}

/**
 * Update ESRI settings
 */
export async function updateESRISettings(esriSettings, userId = null) {
  const updateData = { esriSettings };
  await updateSystemConfig(updateData, userId);
}

export default {
  getSystemConfig,
  subscribeToSystemConfig,
  getGlobalHelpDocumentation,
  subscribeToGlobalHelp,
  updateSystemConfig,
  updateGlobalHelpDocumentation,
  getGlobalExportTemplates,
  subscribeToGlobalExportTemplates,
  updateGlobalExportTemplates,
  getGlobalFeatureExportTemplates,
  subscribeToGlobalFeatureExportTemplates,
  updateGlobalFeatureExportTemplates,
  getAISettings,
  subscribeToAISettings,
  updateAISettings,
  getESRISettings,
  subscribeToESRISettings,
  updateESRISettings,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_AI_SETTINGS,
  DEFAULT_ESRI_SETTINGS
};
