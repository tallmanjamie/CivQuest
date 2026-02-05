// src/shared/services/organizations.js
import { db } from './firebase';
import { PATHS } from './paths';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Fetch all organizations
 */
export async function getAllOrganizations() {
  const snapshot = await getDocs(collection(db, PATHS.organizations));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Fetch a single organization by ID
 */
export async function getOrganization(orgId) {
  const docRef = doc(db, PATHS.organization(orgId));
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data()
  };
}

/**
 * Subscribe to organization changes (real-time)
 */
export function subscribeToOrganization(orgId, callback) {
  const docRef = doc(db, PATHS.organization(orgId));
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        id: docSnap.id,
        ...docSnap.data()
      });
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribe to all organizations (real-time)
 */
export function subscribeToAllOrganizations(callback) {
  return onSnapshot(collection(db, PATHS.organizations), (snapshot) => {
    const orgs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(orgs);
  });
}

/**
 * Get organization's notification configuration
 * Returns array of notification configs
 */
export async function getOrganizationNotifications(orgId) {
  const org = await getOrganization(orgId);
  return org?.notifications || [];
}

/**
 * Get organization's Atlas configuration
 */
export async function getOrganizationAtlasConfig(orgId) {
  const org = await getOrganization(orgId);
  return org?.atlasConfig || null;
}

/**
 * Create a new organization
 */
export async function createOrganization(orgId, data) {
  const docRef = doc(db, PATHS.organization(orgId));
  await setDoc(docRef, {
    ...data,
    createdAt: serverTimestamp()
  });
}

/**
 * Update an organization
 */
export async function updateOrganization(orgId, data) {
  const docRef = doc(db, PATHS.organization(orgId));
  await updateDoc(docRef, data);
}

/**
 * Delete an organization
 */
export async function deleteOrganization(orgId) {
  const docRef = doc(db, PATHS.organization(orgId));
  await deleteDoc(docRef);
}

/**
 * Format notifications for display
 * @param {Array} notifications - Array of notification configs
 * @param {string} orgId - Organization ID for key construction
 */
export function formatNotificationsForDisplay(notifications = [], orgId = '') {
  return notifications.map(n => {
    let scheduleText = n.type;
    if (n.type === 'monthly') {
      scheduleText = `Monthly on day ${n.runDay}`;
    } else if (n.type === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      scheduleText = `Weekly on ${days[n.runDay] || 'Scheduled Day'}`;
    } else if (n.type === 'daily') {
      scheduleText = "Daily";
    }

    // Use explicit id if available, otherwise generate from name (handles legacy notifications)
    // Convert name to id format: replace spaces with underscores
    const notificationId = n.id || (n.name ? n.name.replace(/\s+/g, '_') : undefined);

    return {
      id: notificationId,
      key: orgId ? `${orgId}_${notificationId}` : notificationId, // Key construction matches Admin/Backend logic
      name: n.name,
      schedule: scheduleText,
      description: n.description,
      access: n.access || 'public' // Default to public if not set
    };
  });
}

export default {
  getAllOrganizations,
  getOrganization,
  subscribeToOrganization,
  subscribeToAllOrganizations,
  getOrganizationNotifications,
  getOrganizationAtlasConfig,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  formatNotificationsForDisplay
};
