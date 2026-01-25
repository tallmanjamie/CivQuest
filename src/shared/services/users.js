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
 * Disable user account
 */
export async function disableUser(uid) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    disabled: true,
    subscriptions: {}
  });
}