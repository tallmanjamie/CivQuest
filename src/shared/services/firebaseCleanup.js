// src/shared/services/firebaseCleanup.js
// Firebase Data Cleanup Service
// Scans and removes orphaned data across all Firestore collections

import { db } from './firebase';
import { PATHS } from './paths';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Build a map of all valid organizations and their notification IDs.
 * Returns { orgIds: Set, notificationKeys: Set<"orgId_notifId"> }
 */
async function loadOrganizationIndex() {
  const snapshot = await getDocs(collection(db, PATHS.organizations));
  const orgIds = new Set();
  const notificationKeys = new Set();

  snapshot.docs.forEach(docSnap => {
    const orgId = docSnap.id;
    orgIds.add(orgId);
    const data = docSnap.data();
    if (Array.isArray(data.notifications)) {
      data.notifications.forEach(notif => {
        if (notif.id) {
          notificationKeys.add(`${orgId}_${notif.id}`);
        }
      });
    }
  });

  return { orgIds, notificationKeys };
}

/**
 * Build a set of all valid user UIDs from the users collection,
 * along with basic user data for display in scan results.
 */
async function loadUserIndex() {
  const snapshot = await getDocs(collection(db, PATHS.users));
  const userIds = new Set();
  const userData = new Map();
  snapshot.docs.forEach(docSnap => {
    userIds.add(docSnap.id);
    userData.set(docSnap.id, {
      email: docSnap.data().email || 'unknown'
    });
  });
  return { userIds, userData };
}

/**
 * Verify which user UIDs still exist in Firebase Authentication.
 * Calls the verifyUsers Cloud Function which uses the Admin SDK.
 * Returns a Set of UIDs that have been deleted from Auth.
 */
async function getDeletedUserIds(userIds) {
  const functions = getFunctions();
  const verifyUsers = httpsCallable(functions, 'verifyUsers');
  const uids = Array.from(userIds);

  try {
    const result = await verifyUsers({ uids });
    return new Set(result.data.deletedUids);
  } catch (err) {
    if (err.code === 'functions/not-found' || err.code === 'functions/unavailable') {
      throw new Error(
        'The verifyUsers Cloud Function is not deployed. ' +
        'Deploy it with: cd functions && npm install && firebase deploy --only functions'
      );
    }
    throw err;
  }
}

// ─── SCAN FUNCTIONS ───────────────────────────────────────────────────────────
// Each returns an array of issue objects describing what was found.

/**
 * Scan user subscriptions for references to non-existent orgs/notifications.
 */
export async function scanOrphanedSubscriptions(orgIndex) {
  const { orgIds, notificationKeys } = orgIndex;
  const usersSnapshot = await getDocs(collection(db, PATHS.users));
  const issues = [];

  usersSnapshot.docs.forEach(userDoc => {
    const data = userDoc.data();
    const subs = data.subscriptions || {};

    Object.keys(subs).forEach(key => {
      // Subscription keys use format: orgId_notificationId
      // orgId may contain underscores, so we need to find the matching org
      let matchedOrg = null;
      for (const orgId of orgIds) {
        if (key.startsWith(orgId + '_')) {
          matchedOrg = orgId;
          break;
        }
      }

      if (!matchedOrg) {
        issues.push({
          type: 'orphaned_subscription',
          userId: userDoc.id,
          email: data.email || 'unknown',
          key,
          reason: 'Organization no longer exists'
        });
      } else if (!notificationKeys.has(key)) {
        issues.push({
          type: 'orphaned_subscription',
          userId: userDoc.id,
          email: data.email || 'unknown',
          key,
          reason: 'Notification no longer exists'
        });
      }
    });
  });

  return issues;
}

/**
 * Scan user atlasAccess for references to non-existent organizations.
 */
export async function scanOrphanedAtlasAccess(orgIndex) {
  const { orgIds } = orgIndex;
  const usersSnapshot = await getDocs(collection(db, PATHS.users));
  const issues = [];

  usersSnapshot.docs.forEach(userDoc => {
    const data = userDoc.data();
    const access = data.atlasAccess || {};

    Object.keys(access).forEach(orgId => {
      if (!orgIds.has(orgId)) {
        issues.push({
          type: 'orphaned_atlas_access',
          userId: userDoc.id,
          email: data.email || 'unknown',
          orgId,
          reason: 'Organization no longer exists'
        });
      }
    });
  });

  return issues;
}

/**
 * Scan notifySubscribers subcollections for entries referencing deleted users.
 */
export async function scanOrphanedNotifySubscribers(orgIndex, userIds) {
  const { orgIds } = orgIndex;
  const issues = [];

  for (const orgId of orgIds) {
    const subsSnapshot = await getDocs(
      collection(db, PATHS.notifySubscribers(orgId))
    );

    subsSnapshot.docs.forEach(subDoc => {
      if (!userIds.has(subDoc.id)) {
        issues.push({
          type: 'orphaned_notify_subscriber',
          orgId,
          subscriberId: subDoc.id,
          email: subDoc.data().email || 'unknown',
          reason: 'User no longer exists'
        });
      }
    });
  }

  return issues;
}

/**
 * Identify Firestore user documents for users deleted from Firebase Authentication.
 * Uses pre-computed data from the Auth verification step (not async).
 */
export function scanOrphanedUserDocuments(deletedUserIds, userData) {
  const issues = [];
  for (const uid of deletedUserIds) {
    const data = userData.get(uid) || {};
    issues.push({
      type: 'orphaned_user_document',
      userId: uid,
      email: data.email || 'unknown',
      reason: 'User deleted from Firebase Authentication'
    });
  }
  return issues;
}

/**
 * Scan admin entries for org_admins referencing non-existent organizations.
 */
export async function scanOrphanedAdmins(orgIndex) {
  const { orgIds } = orgIndex;
  const adminsSnapshot = await getDocs(collection(db, PATHS.admins));
  const issues = [];

  adminsSnapshot.docs.forEach(adminDoc => {
    const data = adminDoc.data();
    if (data.role === 'org_admin' && data.organizationId && !orgIds.has(data.organizationId)) {
      issues.push({
        type: 'orphaned_admin',
        adminId: adminDoc.id,
        email: data.email || 'unknown',
        organizationId: data.organizationId,
        reason: 'Organization no longer exists'
      });
    }
  });

  return issues;
}

/**
 * Scan invitations for references to non-existent orgs/notifications.
 */
export async function scanOrphanedInvitations(orgIndex) {
  const { orgIds, notificationKeys } = orgIndex;
  const invSnapshot = await getDocs(collection(db, PATHS.invitations));
  const issues = [];

  invSnapshot.docs.forEach(invDoc => {
    const data = invDoc.data();
    const preAssigned = data.preAssignedSubscriptions || {};

    const orphanedKeys = [];
    Object.keys(preAssigned).forEach(key => {
      let matchedOrg = null;
      for (const orgId of orgIds) {
        if (key.startsWith(orgId + '_')) {
          matchedOrg = orgId;
          break;
        }
      }

      if (!matchedOrg || !notificationKeys.has(key)) {
        orphanedKeys.push(key);
      }
    });

    if (orphanedKeys.length > 0) {
      issues.push({
        type: 'orphaned_invitation',
        invitationId: invDoc.id,
        email: data.email || invDoc.id,
        orphanedKeys,
        reason: 'References non-existent organization or notification'
      });
    }
  });

  return issues;
}

/**
 * Scan logs for references to non-existent organizations.
 */
export async function scanOrphanedLogs(orgIndex) {
  const { orgIds } = orgIndex;
  const logsSnapshot = await getDocs(collection(db, PATHS.logs));
  const issues = [];

  logsSnapshot.docs.forEach(logDoc => {
    const data = logDoc.data();
    const orgId = data.organizationId || data.localityId;
    if (orgId && !orgIds.has(orgId)) {
      issues.push({
        type: 'orphaned_log',
        logId: logDoc.id,
        organizationId: orgId,
        sentAt: data.sentAt || data.timestamp || null,
        reason: 'Organization no longer exists'
      });
    }
  });

  return issues;
}

/**
 * Scan force_queue for references to non-existent orgs/notifications.
 */
export async function scanOrphanedForceQueue(orgIndex) {
  const { orgIds, notificationKeys } = orgIndex;
  const queueSnapshot = await getDocs(collection(db, PATHS.forceQueue));
  const issues = [];

  queueSnapshot.docs.forEach(qDoc => {
    const data = qDoc.data();
    const orgId = data.organizationId;
    const notifId = data.notificationId;

    if (orgId && !orgIds.has(orgId)) {
      issues.push({
        type: 'orphaned_force_queue',
        queueId: qDoc.id,
        organizationId: orgId,
        reason: 'Organization no longer exists'
      });
    } else if (orgId && notifId && !notificationKeys.has(`${orgId}_${notifId}`)) {
      issues.push({
        type: 'orphaned_force_queue',
        queueId: qDoc.id,
        organizationId: orgId,
        notificationId: notifId,
        reason: 'Notification no longer exists'
      });
    }
  });

  return issues;
}

/**
 * Scan for legacy collection data that should have been migrated.
 */
export async function scanLegacyData() {
  const legacyPaths = [
    { path: PATHS.legacy.configuration, label: 'Legacy Configuration' },
    { path: PATHS.legacy.users, label: 'Legacy Users' },
    { path: PATHS.legacy.orgAdmins, label: 'Legacy Org Admins' },
    { path: PATHS.legacy.invitations, label: 'Legacy Invitations' },
    { path: PATHS.legacy.logs, label: 'Legacy Logs' },
    { path: PATHS.legacy.forceQueue, label: 'Legacy Force Queue' },
  ];

  const issues = [];

  for (const { path, label } of legacyPaths) {
    try {
      const snapshot = await getDocs(collection(db, path));
      if (!snapshot.empty) {
        issues.push({
          type: 'legacy_data',
          path,
          label,
          count: snapshot.size,
          reason: `${snapshot.size} document${snapshot.size !== 1 ? 's' : ''} in legacy collection`
        });
      }
    } catch (err) {
      // Collection may not exist, which is fine
      console.warn(`Could not scan legacy path ${path}:`, err.message);
    }
  }

  return issues;
}

// ─── FULL SCAN ────────────────────────────────────────────────────────────────

/**
 * Run a full scan of all collections and return categorized results.
 * @param {function} onProgress - Optional callback for progress updates: (category, status)
 */
export async function runFullScan(onProgress = () => {}) {
  const results = {
    orphanedUserDocuments: [],
    orphanedSubscriptions: [],
    orphanedAtlasAccess: [],
    orphanedNotifySubscribers: [],
    orphanedAdmins: [],
    orphanedInvitations: [],
    orphanedLogs: [],
    orphanedForceQueue: [],
    legacyData: [],
  };

  onProgress('index', 'loading');
  const orgIndex = await loadOrganizationIndex();
  const { userIds, userData } = await loadUserIndex();
  onProgress('index', 'done');

  // Verify users against Firebase Authentication
  onProgress('authVerify', 'scanning');
  const deletedUserIds = await getDeletedUserIds(userIds);
  const validUserIds = new Set([...userIds].filter(id => !deletedUserIds.has(id)));
  onProgress('authVerify', 'done');

  // Scan for orphaned user documents (Firestore docs for deleted Auth users)
  onProgress('userDocuments', 'scanning');
  results.orphanedUserDocuments = scanOrphanedUserDocuments(deletedUserIds, userData);
  onProgress('userDocuments', 'done');

  onProgress('subscriptions', 'scanning');
  results.orphanedSubscriptions = await scanOrphanedSubscriptions(orgIndex);
  onProgress('subscriptions', 'done');

  onProgress('atlasAccess', 'scanning');
  results.orphanedAtlasAccess = await scanOrphanedAtlasAccess(orgIndex);
  onProgress('atlasAccess', 'done');

  // Use Auth-verified user IDs so deleted Auth users are correctly detected
  onProgress('notifySubscribers', 'scanning');
  results.orphanedNotifySubscribers = await scanOrphanedNotifySubscribers(orgIndex, validUserIds);
  onProgress('notifySubscribers', 'done');

  onProgress('admins', 'scanning');
  results.orphanedAdmins = await scanOrphanedAdmins(orgIndex);
  onProgress('admins', 'done');

  onProgress('invitations', 'scanning');
  results.orphanedInvitations = await scanOrphanedInvitations(orgIndex);
  onProgress('invitations', 'done');

  onProgress('logs', 'scanning');
  results.orphanedLogs = await scanOrphanedLogs(orgIndex);
  onProgress('logs', 'done');

  onProgress('forceQueue', 'scanning');
  results.orphanedForceQueue = await scanOrphanedForceQueue(orgIndex);
  onProgress('forceQueue', 'done');

  onProgress('legacy', 'scanning');
  results.legacyData = await scanLegacyData();
  onProgress('legacy', 'done');

  return results;
}

// ─── CLEANUP FUNCTIONS ────────────────────────────────────────────────────────
// Each removes the orphaned data identified by the scan.

/**
 * Remove orphaned subscription keys from user documents.
 */
export async function cleanOrphanedSubscriptions(issues) {
  // Group by userId for batch efficiency
  const byUser = {};
  issues.forEach(issue => {
    if (!byUser[issue.userId]) byUser[issue.userId] = [];
    byUser[issue.userId].push(issue.key);
  });

  let cleaned = 0;
  for (const [userId, keys] of Object.entries(byUser)) {
    const updates = {};
    keys.forEach(key => {
      updates[`subscriptions.${key}`] = deleteField();
    });
    await updateDoc(doc(db, PATHS.user(userId)), updates);
    cleaned += keys.length;
  }

  return cleaned;
}

/**
 * Remove orphaned atlasAccess keys from user documents.
 */
export async function cleanOrphanedAtlasAccess(issues) {
  const byUser = {};
  issues.forEach(issue => {
    if (!byUser[issue.userId]) byUser[issue.userId] = [];
    byUser[issue.userId].push(issue.orgId);
  });

  let cleaned = 0;
  for (const [userId, orgIds] of Object.entries(byUser)) {
    const updates = {};
    orgIds.forEach(orgId => {
      updates[`atlasAccess.${orgId}`] = deleteField();
    });
    await updateDoc(doc(db, PATHS.user(userId)), updates);
    cleaned += orgIds.length;
  }

  return cleaned;
}

/**
 * Remove orphaned notifySubscriber documents.
 */
export async function cleanOrphanedNotifySubscribers(issues) {
  let cleaned = 0;
  // Firestore batches are limited to 500 operations
  const batchSize = 400;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const issue of issues) {
    const docRef = doc(db, PATHS.notifySubscriber(issue.orgId, issue.subscriberId));
    batch.delete(docRef);
    batchCount++;
    cleaned++;

    if (batchCount >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return cleaned;
}

/**
 * Remove Firestore user documents for users deleted from Firebase Authentication.
 */
export async function cleanOrphanedUserDocuments(issues) {
  let cleaned = 0;
  const batchSize = 400;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const issue of issues) {
    batch.delete(doc(db, PATHS.user(issue.userId)));
    batchCount++;
    cleaned++;

    if (batchCount >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return cleaned;
}

/**
 * Remove orphaned admin entries.
 */
export async function cleanOrphanedAdmins(issues) {
  let cleaned = 0;
  for (const issue of issues) {
    await deleteDoc(doc(db, PATHS.admin(issue.adminId)));
    cleaned++;
  }
  return cleaned;
}

/**
 * Remove orphaned subscription keys from invitation documents.
 */
export async function cleanOrphanedInvitations(issues) {
  let cleaned = 0;
  for (const issue of issues) {
    const updates = {};
    issue.orphanedKeys.forEach(key => {
      updates[`preAssignedSubscriptions.${key}`] = deleteField();
    });
    await updateDoc(doc(db, PATHS.invitation(issue.email)), updates);
    cleaned += issue.orphanedKeys.length;
  }
  return cleaned;
}

/**
 * Remove orphaned log documents.
 */
export async function cleanOrphanedLogs(issues) {
  let cleaned = 0;
  const batchSize = 400;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const issue of issues) {
    const docRef = doc(db, PATHS.log(issue.logId));
    batch.delete(docRef);
    batchCount++;
    cleaned++;

    if (batchCount >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return cleaned;
}

/**
 * Remove orphaned force_queue documents.
 */
export async function cleanOrphanedForceQueue(issues) {
  let cleaned = 0;
  for (const issue of issues) {
    await deleteDoc(doc(db, PATHS.forceQueue + '/' + issue.queueId));
    cleaned++;
  }
  return cleaned;
}

/**
 * Remove all documents from a legacy collection.
 */
export async function cleanLegacyCollection(path) {
  const snapshot = await getDocs(collection(db, path));
  let cleaned = 0;
  const batchSize = 400;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    batchCount++;
    cleaned++;

    if (batchCount >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return cleaned;
}

/**
 * Run cleanup for a specific category.
 * @param {string} category - The category key from scan results
 * @param {Array} issues - The issues array for that category
 * @returns {number} Number of items cleaned
 */
export async function cleanCategory(category, issues) {
  switch (category) {
    case 'orphanedUserDocuments':
      return cleanOrphanedUserDocuments(issues);
    case 'orphanedSubscriptions':
      return cleanOrphanedSubscriptions(issues);
    case 'orphanedAtlasAccess':
      return cleanOrphanedAtlasAccess(issues);
    case 'orphanedNotifySubscribers':
      return cleanOrphanedNotifySubscribers(issues);
    case 'orphanedAdmins':
      return cleanOrphanedAdmins(issues);
    case 'orphanedInvitations':
      return cleanOrphanedInvitations(issues);
    case 'orphanedLogs':
      return cleanOrphanedLogs(issues);
    case 'orphanedForceQueue':
      return cleanOrphanedForceQueue(issues);
    case 'legacyData':
      // Legacy data is cleaned per-collection
      let total = 0;
      for (const issue of issues) {
        total += await cleanLegacyCollection(issue.path);
      }
      return total;
    default:
      throw new Error(`Unknown cleanup category: ${category}`);
  }
}

/**
 * Category metadata for display purposes.
 */
export const CLEANUP_CATEGORIES = {
  orphanedUserDocuments: {
    label: 'Orphaned User Documents',
    description: 'Firestore user records for accounts deleted from Firebase Authentication',
    icon: 'UserX',
    severity: 'high'
  },
  orphanedSubscriptions: {
    label: 'Orphaned Subscriptions',
    description: 'User subscription keys referencing deleted organizations or notifications',
    icon: 'Bell',
    severity: 'medium'
  },
  orphanedAtlasAccess: {
    label: 'Orphaned Atlas Access',
    description: 'User Atlas access entries referencing deleted organizations',
    icon: 'Map',
    severity: 'medium'
  },
  orphanedNotifySubscribers: {
    label: 'Orphaned Notify Subscribers',
    description: 'Organization subscriber records for users that no longer exist',
    icon: 'Users',
    severity: 'medium'
  },
  orphanedAdmins: {
    label: 'Orphaned Admin Entries',
    description: 'Org admin roles assigned to non-existent organizations',
    icon: 'Shield',
    severity: 'high'
  },
  orphanedInvitations: {
    label: 'Orphaned Invitations',
    description: 'Invitations with pre-assigned subscriptions to deleted orgs/notifications',
    icon: 'UserPlus',
    severity: 'low'
  },
  orphanedLogs: {
    label: 'Orphaned Logs',
    description: 'Notification archive entries for deleted organizations',
    icon: 'History',
    severity: 'low'
  },
  orphanedForceQueue: {
    label: 'Orphaned Force Queue',
    description: 'Manual broadcast queue entries for deleted orgs/notifications',
    icon: 'Clock',
    severity: 'medium'
  },
  legacyData: {
    label: 'Legacy Collection Data',
    description: 'Data remaining in deprecated collection paths from before migration',
    icon: 'Archive',
    severity: 'low'
  }
};
