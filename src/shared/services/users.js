// src/shared/services/users.js
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
 * Get user document by UID
 */
export async function getUser(uid) {
  const docRef = doc(db, PATHS.user(uid));
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
 * Create or update user document
 */
export async function createUser(uid, userData) {
  const docRef = doc(db, PATHS.user(uid));
  await setDoc(docRef, {
    ...userData,
    createdAt: serverTimestamp(),
    disabled: false,
    subscriptions: {}
  }, { merge: true });
}

/**
 * Update user subscriptions
 */
export async function updateUserSubscriptions(uid, subscriptions) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, { subscriptions });
}

/**
 * Toggle a single subscription
 */
export async function toggleSubscription(uid, subscriptionKey, enabled) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    [`subscriptions.${subscriptionKey}`]: enabled
  });
}

/**
 * Subscribe to user document changes (real-time)
 */
export function subscribeToUser(uid, callback) {
  const docRef = doc(db, PATHS.user(uid));
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
 * Update last login timestamp
 */
export async function updateLastLogin(uid, email) {
  const docRef = doc(db, PATHS.user(uid));
  await setDoc(docRef, { 
    lastLogin: serverTimestamp(), 
    email: email 
  }, { merge: true });
}

/**
 * Disable user account (legacy - use suspendUser instead)
 */
export async function disableUser(uid) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    disabled: true,
    subscriptions: {}
  });
}

/**
 * Suspend user account (preserves subscriptions/access)
 * User cannot log in while suspended but their data is preserved
 */
export async function suspendUser(uid, reason = '') {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    suspended: true,
    suspendedAt: serverTimestamp(),
    suspendReason: reason
  });
}

/**
 * Unsuspend user account (restore access)
 */
export async function unsuspendUser(uid) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    suspended: false,
    suspendedAt: null,
    suspendReason: null,
    unsuspendedAt: serverTimestamp()
  });
}

/**
 * Link ArcGIS account to user
 */
export async function linkArcGISAccount(uid, arcgisData) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    linkedArcGISUsername: arcgisData.username,
    arcgisProfile: {
      username: arcgisData.username,
      fullName: arcgisData.fullName || '',
      email: arcgisData.email,
      orgId: arcgisData.orgId || null,
      linkedAt: new Date().toISOString()
    },
    ...(arcgisData.organization && {
      arcgisOrganization: {
        id: arcgisData.organization.id,
        name: arcgisData.organization.name,
        urlKey: arcgisData.organization.urlKey || null
      }
    })
  });
}

export default {
  getUser,
  createUser,
  updateUserSubscriptions,
  toggleSubscription,
  subscribeToUser,
  updateLastLogin,
  disableUser,
  suspendUser,
  unsuspendUser,
  linkArcGISAccount
};
