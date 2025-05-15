// test-firebase-correct.js
// Load environment variables FIRST
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verify env vars are loaded
console.log('Environment check:');
console.log('FIREBASE_CREDENTIALS_BASE64:', process.env.FIREBASE_CREDENTIALS_BASE64 ? '✓ Loaded' : '✗ Missing');

async function runTest() {
  try {
    const base64Credentials = process.env.FIREBASE_CREDENTIALS_BASE64;
    
    if (!base64Credentials) {
      throw new Error('FIREBASE_CREDENTIALS_BASE64 not found');
    }
    
    // Decode credentials
    const credentialsJson = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const credentials = JSON.parse(credentialsJson);
    
    console.log('Firebase credentials decoded successfully');
    console.log('Project ID:', credentials.project_id);
    
    // Initialize Firebase Admin
    const app = initializeApp({
      credential: cert(credentials),
      projectId: credentials.project_id,
    });
    
    console.log('Firebase app initialized');
    
    // Get Firestore instance
    const db = getFirestore(app);
    console.log('✅ Firestore instance created successfully!');
    
    // Test write
    const testData = {
      test: true,
      timestamp: new Date(),
      message: 'Firebase is working!'
    };
    
    const docRef = await db.collection('test').add(testData);
    console.log('✅ Test document written with ID:', docRef.id);
    
    // Test read
    const snapshot = await db.collection('test').doc(docRef.id).get();
    console.log('✅ Test document read:', snapshot.data());
    
    // Clean up
    await db.collection('test').doc(docRef.id).delete();
    console.log('✅ Test document deleted');
    
    console.log('\n🎉 All tests passed! Firebase is working correctly.');
    
    // Now test your actual service
    console.log('\nTesting your timeTrackingService...');
    const { timeTrackingService } = await import('../app/services/firebase.server.js');
    
    const lastAction = await timeTrackingService.getLastClockAction('test-user');
    console.log('Last action result:', lastAction);
    
    if (lastAction.success) {
      console.log('✅ timeTrackingService is working!');
    } else {
      console.log('⚠️ timeTrackingService returned an error:', lastAction.error);
    }
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error.message);
    console.error('Error stack:', error.stack);
  }
}

runTest();