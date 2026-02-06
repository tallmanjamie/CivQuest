// Cloud Functions for CivQuest
// Provides server-side operations requiring Firebase Admin SDK

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Verify which user UIDs still exist in Firebase Authentication.
 * Accepts a list of UIDs and returns those that have been deleted from Auth.
 * Only callable by super admins.
 */
exports.verifyUsers = onCall({
  cors: [
    'https://admin.civ.quest',
    'https://civquest-notify.web.app',
    'https://civquest-notify.firebaseapp.com',
    'http://localhost:5173'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  // Verify caller is a super admin
  const adminDoc = await admin.firestore().collection('admins').doc(request.auth.uid).get();
  if (!adminDoc.exists || adminDoc.data().role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Super admin access required');
  }

  const { uids } = request.data;
  if (!Array.isArray(uids) || uids.length === 0) {
    return { deletedUids: [] };
  }

  const deletedUids = [];
  // admin.auth().getUsers() accepts up to 100 identifiers per call
  const batchSize = 100;

  for (let i = 0; i < uids.length; i += batchSize) {
    const batch = uids.slice(i, i + batchSize);
    const identifiers = batch.map(uid => ({ uid }));
    const result = await admin.auth().getUsers(identifiers);
    result.notFound.forEach(id => deletedUids.push(id.uid));
  }

  return { deletedUids };
});
