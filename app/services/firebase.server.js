// app/services/firebase.server.js
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let db = null;
let initialized = false;

function initFirebase() {
  if (initialized) return db;
  
  try {
    // Check if already initialized
    const apps = getApps();
    let app;
    
    if (apps.length > 0) {
      app = apps[0];
      console.log('Using existing Firebase app');
    } else {
      const base64Credentials = process.env.FIREBASE_CREDENTIALS_BASE64;
      
      if (!base64Credentials) {
        console.error('FIREBASE_CREDENTIALS_BASE64 not found');
        throw new Error('Firebase credentials not found in environment');
      }
      
      const credentialsJson = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const credentials = JSON.parse(credentialsJson);
      
      app = initializeApp({
        credential: cert(credentials),
        projectId: credentials.project_id,
      });
      
      console.log('Firebase initialized with project:', credentials.project_id);
    }
    
    db = getFirestore(app);
    initialized = true;
    console.log('Firestore ready');
    
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    throw error;
  }
  
  return db;
}

// Lazy initialization wrapper
const getDb = () => {
  if (!db) {
    return initFirebase();
  }
  return db;
};

export const timeTrackingService = {
  async recordClockEvent(staffId, action) {
    console.log('=== recordClockEvent called ===');
    console.log('Staff ID:', staffId);
    console.log('Action:', action);
    
    try {
      const database = getDb();
      
      if (!database) {
        console.error('Database not available');
        return { success: false, error: 'Database connection failed' };
      }
      
      const timeEntry = {
        staffId,
        action,
        timestamp: FieldValue.serverTimestamp(),
        date: new Date().toISOString().split('T')[0]
      };
      
      console.log('Saving to Firestore:', timeEntry);
      const result = await database.collection('timeEntries').add(timeEntry);
      console.log('Successfully saved with ID:', result.id);
      
      return { success: true, id: result.id };
    } catch (error) {
      console.error('Error in recordClockEvent:', error);
      return { success: false, error: error.message };
    }
  },
  
  async getLastClockAction(staffId) {
    console.log('=== getLastClockAction called ===');
    console.log('Staff ID:', staffId);
    
    try {
      const database = getDb();
      
      if (!database) {
        console.error('Database not available');
        return { success: false, error: 'Database connection failed' };
      }
      
      console.log('Querying Firestore for:', staffId);
      
      const snapshot = await database.collection('timeEntries')
        .where('staffId', '==', staffId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const action = doc.data().action;
        console.log('Found last action:', action);
        return { success: true, action };
      }
      
      console.log('No previous actions found, returning default');
      return { success: true, action: 'clock_out' }; // Default
    } catch (error) {
      console.error('Error in getLastClockAction:', error);
      
      if (error.code === 'failed-precondition' || error.code === 9) {
        console.log('Index not ready, returning default');
        return { success: true, action: 'clock_out' };
      }
      
      return { success: false, error: error.message };
    }
  }
};