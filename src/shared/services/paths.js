// src/shared/services/paths.js
// ============================================
// FIRESTORE PATH CONFIGURATION
// ============================================
// This file defines paths for both legacy and new Firestore structures.
// During migration, both are supported. After migration, legacy paths
// will be deprecated.

// NEW PATHS (Unified Platform - Phase 1+)
export const PATHS = {
  // Organizations collection (formerly configuration)
  organizations: 'organizations',
  organization: (orgId) => `organizations/${orgId}`,
  
  // Users collection (top-level)
  users: 'users',
  user: (uid) => `users/${uid}`,
  
  // Admins collection
  admins: 'admins',
  admin: (uid) => `admins/${uid}`,
  
  // Archives (notification history)
  archives: 'archives',
  orgArchive: (orgId) => `archives/${orgId}`,
  orgNotifications: (orgId) => `archives/${orgId}/notifications`
};

// LEGACY PATHS (Pre-Phase 1 - for backward compatibility)
export const LEGACY_PATHS = {
  root: 'artifacts/civquest_notifications',
  configuration: 'artifacts/civquest_notifications/configuration',
  orgConfig: (orgId) => `artifacts/civquest_notifications/configuration/${orgId}`,
  users: 'artifacts/civquest_notifications/users',
  user: (uid) => `artifacts/civquest_notifications/users/${uid}`,
  orgAdmins: 'artifacts/civquest_notifications/org_admins',
  orgAdmin: (email) => `artifacts/civquest_notifications/org_admins/${email}`,
  invitations: 'artifacts/civquest_notifications/invitations',
  invitation: (email) => `artifacts/civquest_notifications/invitations/${email}`
};

// Feature flag to toggle between legacy and new paths
// Set to true once migration is complete and verified
export const USE_NEW_PATHS = true;

// Helper to get the appropriate path based on feature flag
export const getPath = (pathType, ...args) => {
  if (USE_NEW_PATHS) {
    return PATHS[pathType]?.(...args) || PATHS[pathType];
  }
  return LEGACY_PATHS[pathType]?.(...args) || LEGACY_PATHS[pathType];
};