// src/shared/services/invitations.js
import { db } from './firebase';
import { PATHS } from './paths';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Get invitation by email
 */
export async function getInvitation(email) {
  const docRef = doc(db, PATHS.invitation(email));
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
 * Create an invitation for a user
 */
export async function createInvitation(email, data) {
  const docRef = doc(db, PATHS.invitation(email));
  await setDoc(docRef, {
    ...data,
    email: email.toLowerCase(),
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

/**
 * Mark invitation as claimed
 */
export async function claimInvitation(email, uid) {
  const docRef = doc(db, PATHS.invitation(email));
  await updateDoc(docRef, {
    status: 'claimed',
    claimedAt: serverTimestamp(),
    claimedBy: uid
  });
}

/**
 * Process invitation and return subscriptions to apply
 * Handles both new format (subscriptions object) and legacy format (single notifId)
 */
export function processInvitationSubscriptions(inviteData) {
  let subscriptionsToApply = {};
  
  if (inviteData.subscriptions && typeof inviteData.subscriptions === 'object') {
    // New format: multiple subscriptions
    subscriptionsToApply = inviteData.subscriptions;
  } else if (inviteData.orgId && inviteData.notifId) {
    // Legacy format: single subscription
    const legacyKey = `${inviteData.orgId}_${inviteData.notifId}`;
    subscriptionsToApply[legacyKey] = true;
  }
  
  return subscriptionsToApply;
}

export default {
  getInvitation,
  createInvitation,
  claimInvitation,
  processInvitationSubscriptions
};
