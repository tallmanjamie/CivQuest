// migrate-logs.js
// ============================================
// FIRESTORE LOGS MIGRATION SCRIPT
// ============================================
// Migrates logs from:
//   artifacts/civquest_notifications/public/data/logs
// To:
//   logs (top-level collection)
//
// Run with: npm run migrate:logs
// ============================================

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  writeBatch
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPiMgjC3dOGCbw3h5gDLXZdsOo-lHI_YY",
  authDomain: "civquest-notify.firebaseapp.com",
  projectId: "civquest-notify",
  storageBucket: "civquest-notify.firebasestorage.app",
  messagingSenderId: "126930260374",
  appId: "1:126930260374:web:30571ee0ec9068399c0db7"
};

// Admin credentials
const ADMIN_EMAIL = 'support@civicvanguard.com';
const ADMIN_PASSWORD = 'Port1234';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Paths
const LEGACY_LOGS_PATH = 'artifacts/civquest_notifications/public/data/logs';
const NEW_LOGS_PATH = 'logs';

// Batch size for Firestore writes (max 500)
const BATCH_SIZE = 400;

async function migrateLogs() {
  console.log('============================================');
  console.log('CIVQUEST LOGS MIGRATION');
  console.log('============================================');
  console.log(`From: ${LEGACY_LOGS_PATH}`);
  console.log(`To:   ${NEW_LOGS_PATH}`);
  console.log('============================================\n');

  try {
    // Step 0: Authenticate as admin
    console.log('Step 0: Authenticating as admin...');
    const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log(`✓ Authenticated as: ${userCredential.user.email}\n`);

    // Step 1: Fetch all logs from legacy path
    console.log('Step 1: Fetching logs from legacy path...');
    const legacyLogsRef = collection(db, LEGACY_LOGS_PATH);
    const snapshot = await getDocs(legacyLogsRef);
    
    if (snapshot.empty) {
      console.log('No logs found in legacy path. Nothing to migrate.');
      return;
    }

    const logs = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      data: docSnap.data()
    }));

    console.log(`✓ Found ${logs.length} logs to migrate.\n`);

    // Step 2: Migrate in batches
    console.log('Step 2: Migrating logs to new path...');
    
    let migratedCount = 0;
    let batchCount = 0;
    
    // Process in batches
    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batchLogs = logs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      
      for (const log of batchLogs) {
        const newDocRef = doc(db, NEW_LOGS_PATH, log.id);
        
        // Transform data if needed (normalize field names)
        const migratedData = {
          ...log.data,
          // Normalize legacy field names
          organizationId: log.data.organizationId || log.data.localityId,
          organizationName: log.data.organizationName || log.data.localityName,
          // Keep original fields for backward compatibility
          ...(log.data.localityId && { localityId: log.data.localityId }),
          ...(log.data.localityName && { localityName: log.data.localityName }),
          // Add migration metadata
          _migratedAt: new Date().toISOString(),
          _migratedFrom: LEGACY_LOGS_PATH
        };
        
        batch.set(newDocRef, migratedData);
      }
      
      await batch.commit();
      migratedCount += batchLogs.length;
      batchCount++;
      
      console.log(`  Batch ${batchCount}: Migrated ${batchLogs.length} logs (${migratedCount}/${logs.length} total)`);
    }

    console.log('\n============================================');
    console.log('MIGRATION COMPLETE');
    console.log('============================================');
    console.log(`✓ Total logs migrated: ${migratedCount}`);
    console.log(`✓ Batches processed: ${batchCount}`);
    console.log('============================================\n');

    // Step 3: Summary by organization
    console.log('Summary by Organization:');
    const orgCounts = {};
    logs.forEach(log => {
      const orgId = log.data.organizationId || log.data.localityId || 'unknown';
      orgCounts[orgId] = (orgCounts[orgId] || 0) + 1;
    });
    
    Object.entries(orgCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([orgId, count]) => {
        console.log(`  - ${orgId}: ${count} logs`);
      });

    console.log('\n============================================');
    console.log('NEXT STEPS');
    console.log('============================================');
    console.log('1. The app is already configured to use the new "logs" path');
    console.log('2. Test the Archive component to verify logs display correctly');
    console.log('3. (Optional) Delete legacy logs after verification');
    console.log('============================================\n');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateLogs().then(() => {
  console.log('Script completed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
