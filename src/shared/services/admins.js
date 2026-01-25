// src/shared/services/admins.js
import { db } from './firebase';
import { PATHS } from './paths';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Check if user is a super admin
 * @param {string} uid - User's Firebase UID
 */
export async function isSuperAdmin(uid) {
  const docRef = doc(db, PATHS.admin(uid));
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return false;
  }
  
  return docSnap.data().role === 'super_admin';
}

/**
 * Check if user is an org admin
 * @param {string} uid - User's Firebase UID
 * @param {string} orgId - Optional organization ID to check against
 */
export async function isOrgAdmin(uid, orgId = null) {
  const docRef = doc(db, PATHS.admin(uid));
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return false;
  }
  
  const data = docSnap.data();
  
  // Super admins can manage all orgs
  if (data.role === 'super_admin') {
    return true;
  }
  
  // Check if org_admin
  if (data.role !== 'org_admin') {
    return false;
  }
  
  // If orgId provided, check if admin is for that specific org
  if (orgId) {
    return data.organizationId === orgId;
  }
  
  return true;
}

/**
 * Get admin document with role info
 * @param {string} uid - Admin's Firebase UID
 */
export async function getAdminInfo(uid) {
  const docRef = doc(db, PATHS.admin(uid));
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
 * Get admin by email (searches collection)
 * @param {string} email - Admin's email address
 */
export async function getAdminByEmail(email) {
  const q = query(
    collection(db, PATHS.admins),
    where('email', '==', email.toLowerCase())
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const adminDoc = snapshot.docs[0];
  return {
    id: adminDoc.id,
    ...adminDoc.data()
  };
}

/**
 * Get all admins
 */
export async function getAllAdmins() {
  const snapshot = await getDocs(collection(db, PATHS.admins));
  return snapshot.docs.map(adminDoc => ({
    id: adminDoc.id,
    ...adminDoc.data()
  }));
}

/**
 * Get all org admins for a specific organization
 */
export async function getOrgAdmins(orgId) {
  const q = query(
    collection(db, PATHS.admins),
    where('organizationId', '==', orgId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(adminDoc => ({
    id: adminDoc.id,
    ...adminDoc.data()
  }));
}

/**
 * Subscribe to all admins (real-time)
 */
export function subscribeToAdmins(callback) {
  return onSnapshot(collection(db, PATHS.admins), (snapshot) => {
    const admins = snapshot.docs.map(adminDoc => ({
      id: adminDoc.id,
      ...adminDoc.data()
    }));
    callback(admins);
  });
}

/**
 * Create a new admin
 * @param {string} uid - User's Firebase UID
 * @param {object} data - Admin data including email, role, organizationId
 */
export async function createAdmin(uid, data) {
  const docRef = doc(db, PATHS.admin(uid));
  await setDoc(docRef, {
    email: data.email.toLowerCase(),
    role: data.role, // 'super_admin' or 'org_admin'
    organizationId: data.organizationId || null,
    createdAt: serverTimestamp()
  });
}

/**
 * Update an admin
 */
export async function updateAdmin(uid, data) {
  const docRef = doc(db, PATHS.admin(uid));
  await updateDoc(docRef, data);
}

/**
 * Delete an admin
 */
export async function deleteAdmin(uid) {
  const docRef = doc(db, PATHS.admin(uid));
  await deleteDoc(docRef);
}

/**
 * Check if user can manage a specific organization
 */
export async function canManageOrg(uid, orgId) {
  const adminInfo = await getAdminInfo(uid);
  
  if (!adminInfo) {
    return false;
  }
  
  // Super admins can manage all orgs
  if (adminInfo.role === 'super_admin') {
    return true;
  }
  
  // Org admins can only manage their assigned org
  return adminInfo.role === 'org_admin' && adminInfo.organizationId === orgId;
}

export default {
  isSuperAdmin,
  isOrgAdmin,
  getAdminInfo,
  getAdminByEmail,
  getAllAdmins,
  getOrgAdmins,
  subscribeToAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  canManageOrg
};
