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
 * Note: globalHelpLinks has been deprecated - links are now stored as media items
 * within help articles (type: 'link')
 */
export const DEFAULT_SYSTEM_CONFIG = {
  globalHelpDocumentation: [],
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
 * Note: Links are now stored as media items within articles (type: 'link')
 * instead of as a separate globalHelpLinks array
 */
export async function updateGlobalHelpDocumentation(helpDocs, userId = null) {
  const updateData = { globalHelpDocumentation: helpDocs };
  await updateSystemConfig(updateData, userId);
}

export default {
  getSystemConfig,
  subscribeToSystemConfig,
  getGlobalHelpDocumentation,
  subscribeToGlobalHelp,
  updateSystemConfig,
  updateGlobalHelpDocumentation,
  DEFAULT_SYSTEM_CONFIG
};
