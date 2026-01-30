// src/shared/services/users.js
import { db } from './firebase';
import { PATHS } from './paths';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
 * Also maintains the org-specific notifySubscribers subcollection for org admin access
 */
export async function toggleSubscription(uid, subscriptionKey, enabled, userEmail = null) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    [`subscriptions.${subscriptionKey}`]: enabled
  });

  // Update org-specific notifySubscribers subcollection
  // Extract orgId from key format: "{orgId}_{notificationId}"
  const orgId = subscriptionKey.split('_')[0];
  if (orgId) {
    try {
      await updateNotifySubscriber(uid, orgId, subscriptionKey, enabled, userEmail);
    } catch (err) {
      // Log but don't fail - the primary subscription update succeeded
      console.warn('Failed to update notifySubscribers subcollection:', err);
    }
  }
}

/**
 * Update the notifySubscribers subcollection for an organization
 * This allows org admins to query their subscribers without accessing the global users collection
 */
async function updateNotifySubscriber(uid, orgId, subscriptionKey, enabled, userEmail) {
  const subscriberRef = doc(db, PATHS.notifySubscriber(orgId, uid));
  const subscriberSnap = await getDoc(subscriberRef);

  if (subscriberSnap.exists()) {
    const data = subscriberSnap.data();
    const subscriptions = { ...data.subscriptions, [subscriptionKey]: enabled };

    // Check if user has any active subscriptions to this org
    const hasActiveSubscription = Object.values(subscriptions).some(v => v === true);

    if (hasActiveSubscription) {
      await updateDoc(subscriberRef, {
        subscriptions,
        updatedAt: serverTimestamp()
      });
    } else {
      // No active subscriptions - remove from org's subscriber list
      await deleteDoc(subscriberRef);
    }
  } else if (enabled) {
    // New subscriber - create entry
    await setDoc(subscriberRef, {
      uid,
      email: userEmail,
      subscriptions: { [subscriptionKey]: true },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
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

/**
 * Unlink ArcGIS account from user
 */
export async function unlinkArcGISAccount(uid) {
  const docRef = doc(db, PATHS.user(uid));
  await updateDoc(docRef, {
    linkedArcGISUsername: null,
    arcgisProfile: null,
    arcgisOrganization: null
  });
}

/**
 * Update user profile (firstName, lastName)
 */
export async function updateUserProfile(uid, profileData) {
  const docRef = doc(db, PATHS.user(uid));
  const updates = {};

  if (profileData.firstName !== undefined) {
    updates.firstName = profileData.firstName;
  }
  if (profileData.lastName !== undefined) {
    updates.lastName = profileData.lastName;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = serverTimestamp();
    await updateDoc(docRef, updates);
  }
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
  linkArcGISAccount,
  unlinkArcGISAccount,
  updateUserProfile
};
