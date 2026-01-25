// src/shared/services/paths.js
// ============================================
// FIRESTORE PATH CONFIGURATION
// ============================================
// Phase 0 migration is COMPLETE. Using new unified paths.

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
  
  // Logs collection (notification history)
  // After running migrate:logs script, this points to new top-level collection
  logs: 'logs',
  
  // Invitations
  invitations: 'invitations',
  invitation: (email) => `invitations/${email.toLowerCase()}`
};

// LEGACY PATHS (Pre-Phase 1 - kept for reference only)
export const LEGACY_PATHS = {
  root: 'artifacts/civquest_notifications',
  configuration: 'artifacts/civquest_notifications/configuration',
  orgConfig: (orgId) => `artifacts/civquest_notifications/configuration/${orgId}`,
  users: 'artifacts/civquest_notifications/users',
  user: (uid) => `artifacts/civquest_notifications/users/${uid}`,
  orgAdmins: 'artifacts/civquest_notifications/org_admins',
  orgAdmin: (email) => `artifacts/civquest_notifications/org_admins/${email}`,
  invitations: 'artifacts/civquest_notifications/invitations',
  invitation: (email) => `artifacts/civquest_notifications/invitations/${email.toLowerCase()}`,
  logs: 'artifacts/civquest_notifications/public/data/logs'
};

// Feature flag - NOW USING NEW PATHS
export const USE_NEW_PATHS = true;

// Helper to get the appropriate path based on feature flag
export const getPath = (pathType, ...args) => {
  const paths = USE_NEW_PATHS ? PATHS : LEGACY_PATHS;
  const pathFn = paths[pathType];
  
  if (typeof pathFn === 'function') {
    return pathFn(...args);
  }
  return pathFn;
};

// Export both for explicit usage during transition
export default {
  PATHS,
  LEGACY_PATHS,
  USE_NEW_PATHS,
  getPath
};
