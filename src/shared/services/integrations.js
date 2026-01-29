// src/shared/services/integrations.js
// Service for managing system-wide integrations (EagleView/Pictometry, etc.)

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
 * Integration types
 */
export const INTEGRATION_TYPES = {
  ATLAS: 'atlas',
  NOTIFY: 'notify'
};

/**
 * Available integration definitions
 * Each integration has a unique key and configuration schema
 */
export const AVAILABLE_INTEGRATIONS = {
  pictometry: {
    id: 'pictometry',
    name: 'EagleView (Pictometry)',
    description: 'Aerial imagery viewer integration. Adds an EagleView button to feature popups that opens the location in EagleView with the feature geometry highlighted.',
    type: INTEGRATION_TYPES.ATLAS,
    icon: 'eye', // lucide icon name
    // Config schema for org-level settings (API key and window dimensions configured per-org)
    configSchema: {
      apiKey: {
        type: 'string',
        label: 'API Key',
        description: 'Your EagleView/Pictometry API key',
        required: true,
        placeholder: 'e.g., 3f513db9-95ae-4df3-b64b-b26267b95cce'
      }
    }
  },
  nearmap: {
    id: 'nearmap',
    name: 'Nearmap',
    description: 'High-resolution aerial imagery integration. Adds a Nearmap button to feature popups that opens the location in the Nearmap viewer with the feature geometry highlighted.',
    type: INTEGRATION_TYPES.ATLAS,
    icon: 'map-pin', // lucide icon name
    // No API key required - authentication is handled in the Nearmap embed widget
    // Window dimensions configured per-org in OrgIntegrationsConfig
    configSchema: {}
  }
  // Future integrations can be added here:
  // googleStreetView: { ... },
};

/**
 * Default structure for integrations in system config
 */
export const DEFAULT_INTEGRATIONS_CONFIG = {
  integrations: []
  // Structure of an integration:
  // {
  //   id: 'unique-uuid',
  //   type: 'pictometry', // key from AVAILABLE_INTEGRATIONS
  //   name: 'Custom Display Name',
  //   integrationType: 'atlas' | 'notify',
  //   enabled: true,
  //   organizations: ['org1', 'org2'], // org IDs that have access
  //   config: {
  //     apiKey: '...' // org-specific config handled at org level
  //   },
  //   createdAt: timestamp,
  //   updatedAt: timestamp
  // }
};

/**
 * Get all integrations from system config
 */
export async function getIntegrations() {
  const docRef = doc(db, PATHS.systemConfig);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return [];
  }

  return docSnap.data().integrations || [];
}

/**
 * Subscribe to integrations changes (real-time)
 */
export function subscribeToIntegrations(callback) {
  const docRef = doc(db, PATHS.systemConfig);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().integrations || []);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('[integrations] Subscription error:', error);
    callback([]);
  });
}

/**
 * Add a new integration
 */
export async function addIntegration(integration, userId = null) {
  const docRef = doc(db, PATHS.systemConfig);
  const docSnap = await getDoc(docRef);

  const now = new Date().toISOString();
  const newIntegration = {
    ...integration,
    id: integration.id || crypto.randomUUID(),
    enabled: integration.enabled !== false,
    organizations: integration.organizations || [],
    createdAt: now,
    updatedAt: now
  };

  let integrations = [];
  if (docSnap.exists()) {
    integrations = docSnap.data().integrations || [];
  }

  integrations.push(newIntegration);

  if (docSnap.exists()) {
    await updateDoc(docRef, {
      integrations,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
  } else {
    await setDoc(docRef, {
      integrations,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
  }

  return newIntegration;
}

/**
 * Update an existing integration
 */
export async function updateIntegration(integrationId, updates, userId = null) {
  const docRef = doc(db, PATHS.systemConfig);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('System config not found');
  }

  const integrations = docSnap.data().integrations || [];
  const index = integrations.findIndex(i => i.id === integrationId);

  if (index === -1) {
    throw new Error('Integration not found');
  }

  integrations[index] = {
    ...integrations[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, {
    integrations,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });

  return integrations[index];
}

/**
 * Delete an integration
 */
export async function deleteIntegration(integrationId, userId = null) {
  const docRef = doc(db, PATHS.systemConfig);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('System config not found');
  }

  const integrations = (docSnap.data().integrations || []).filter(
    i => i.id !== integrationId
  );

  await updateDoc(docRef, {
    integrations,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
}

/**
 * Toggle integration enabled/disabled
 */
export async function toggleIntegration(integrationId, enabled, userId = null) {
  return updateIntegration(integrationId, { enabled }, userId);
}

/**
 * Assign/unassign organizations to an integration
 */
export async function updateIntegrationOrganizations(integrationId, organizations, userId = null) {
  return updateIntegration(integrationId, { organizations }, userId);
}

/**
 * Get integrations available for a specific organization
 * Returns only enabled integrations that include this org in their organizations list
 */
export async function getIntegrationsForOrganization(orgId) {
  const integrations = await getIntegrations();
  return integrations.filter(
    i => i.enabled && i.organizations.includes(orgId)
  );
}

/**
 * Get integrations of a specific type (atlas/notify) for an organization
 */
export async function getIntegrationsForOrganizationByType(orgId, integrationType) {
  const integrations = await getIntegrationsForOrganization(orgId);
  return integrations.filter(i => i.integrationType === integrationType);
}

/**
 * Check if a specific integration type is enabled for an organization
 */
export async function isIntegrationEnabledForOrg(orgId, integrationTypeKey) {
  const integrations = await getIntegrationsForOrganization(orgId);
  return integrations.some(i => i.type === integrationTypeKey);
}

/**
 * Get the configuration for a specific integration type for an organization
 * This returns the org-level config stored in the organization document
 */
export async function getOrgIntegrationConfig(orgId, integrationTypeKey) {
  // First check if integration is enabled for org
  const integrations = await getIntegrationsForOrganization(orgId);
  const integration = integrations.find(i => i.type === integrationTypeKey);

  if (!integration) {
    return null;
  }

  // Get org-level config
  const orgDocRef = doc(db, PATHS.organization(orgId));
  const orgSnap = await getDoc(orgDocRef);

  if (!orgSnap.exists()) {
    return null;
  }

  const orgData = orgSnap.data();
  return orgData.integrations?.[integrationTypeKey] || null;
}

/**
 * Update org-level integration configuration
 */
export async function updateOrgIntegrationConfig(orgId, integrationTypeKey, config) {
  const orgDocRef = doc(db, PATHS.organization(orgId));

  await updateDoc(orgDocRef, {
    [`integrations.${integrationTypeKey}`]: config,
    updatedAt: serverTimestamp()
  });
}

export default {
  INTEGRATION_TYPES,
  AVAILABLE_INTEGRATIONS,
  DEFAULT_INTEGRATIONS_CONFIG,
  getIntegrations,
  subscribeToIntegrations,
  addIntegration,
  updateIntegration,
  deleteIntegration,
  toggleIntegration,
  updateIntegrationOrganizations,
  getIntegrationsForOrganization,
  getIntegrationsForOrganizationByType,
  isIntegrationEnabledForOrg,
  getOrgIntegrationConfig,
  updateOrgIntegrationConfig
};
