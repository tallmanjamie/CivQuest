/**
 * Firestore Path Configuration
 * src/shared/services/paths.js
 * 
 * Defines the unified Firestore collection paths for the CivQuest platform.
 * These paths replace the legacy nested paths under artifacts/civquest_notifications/
 */

// Feature flag for migration - set to true to use new paths
export const USE_NEW_PATHS = true;

/**
 * Collection path definitions
 */
export const PATHS = {
  // System configuration (global settings for Atlas)
  systemConfig: 'system/config',

  // Organizations collection
  organizations: 'organizations',
  organization: (orgId) => `organizations/${orgId}`,
  
  // Users collection
  users: 'users',
  user: (uid) => `users/${uid}`,
  
  // Admins collection (super_admin and org_admin roles)
  admins: 'admins',
  admin: (uid) => `admins/${uid}`,
  
  // Invitations collection
  invitations: 'invitations',
  invitation: (email) => `invitations/${email.toLowerCase()}`,
  
  // Logs collection (notification archive)
  logs: 'logs',
  log: (logId) => `logs/${logId}`,
  
  // Force queue for manual broadcast triggers
  forceQueue: 'force_queue',
  
  // Legacy paths (for reference/migration support)
  legacy: {
    configuration: 'artifacts/civquest_notifications/configuration',
    users: 'artifacts/civquest_notifications/users',
    orgAdmins: 'artifacts/civquest_notifications/org_admins',
    invitations: 'artifacts/civquest_notifications/invitations',
    logs: 'artifacts/civquest_notifications/public/data/logs',
    forceQueue: 'artifacts/civquest_notifications/force_queue'
  }
};

/**
 * Helper to get the correct path based on USE_NEW_PATHS flag
 * Useful during migration period when running old and new code in parallel
 */
export function getPath(pathKey, ...args) {
  if (!USE_NEW_PATHS) {
    // Return legacy paths
    switch (pathKey) {
      case 'organizations':
        return PATHS.legacy.configuration;
      case 'organization':
        return `${PATHS.legacy.configuration}/${args[0]}`;
      case 'users':
        return PATHS.legacy.users;
      case 'user':
        return `${PATHS.legacy.users}/${args[0]}`;
      case 'admins':
        return PATHS.legacy.orgAdmins;
      case 'admin':
        return `${PATHS.legacy.orgAdmins}/${args[0]}`;
      case 'invitations':
        return PATHS.legacy.invitations;
      case 'invitation':
        return `${PATHS.legacy.invitations}/${args[0]}`;
      case 'logs':
        return PATHS.legacy.logs;
      case 'log':
        return `${PATHS.legacy.logs}/${args[0]}`;
      case 'forceQueue':
        return PATHS.legacy.forceQueue;
      default:
        return pathKey;
    }
  }
  
  // Return new unified paths
  switch (pathKey) {
    case 'systemConfig':
      return PATHS.systemConfig;
    case 'organizations':
      return PATHS.organizations;
    case 'organization':
      return PATHS.organization(args[0]);
    case 'users':
      return PATHS.users;
    case 'user':
      return PATHS.user(args[0]);
    case 'admins':
      return PATHS.admins;
    case 'admin':
      return PATHS.admin(args[0]);
    case 'invitations':
      return PATHS.invitations;
    case 'invitation':
      return PATHS.invitation(args[0]);
    case 'logs':
      return PATHS.logs;
    case 'log':
      return PATHS.log(args[0]);
    case 'forceQueue':
      return PATHS.forceQueue;
    default:
      return pathKey;
  }
}

export default PATHS;
