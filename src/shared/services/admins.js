// src/shared/services/admins.js
import { db } from './firebase';
import { PATHS } from './paths';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Check if user is a super admin
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
 * Check if user is an org admin for a specific organization
 */
export async function isOrgAdmin(uid, orgId = null) {
  const docRef = doc(db, PATHS.admin(uid));
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return false;
  }
  
  const data = docSnap.data();
  
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
  if (adminInfo.role === 'org_admin') {
    return adminInfo.organizationId === orgId;
  }
  
  return false;
}