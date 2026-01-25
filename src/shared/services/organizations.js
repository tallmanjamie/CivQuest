// src/shared/services/organizations.js
import { db } from './firebase';
import { PATHS } from './paths';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  onSnapshot,
  query,
  where 
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