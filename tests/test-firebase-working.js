// Load environment variables FIRST
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verify env vars are loaded
console.log('Environment check:');
console.log('FIREBASE_CREDENTIALS_BASE64:', process.env.FIREBASE_CREDENTIALS_BASE64 ? '✓ Loaded' : '✗ Missing');

// Now we can use dynamic import to load Firebase after env vars are set
async function runTest() {
  try {
    // Import Firebase service after env vars are loaded
    const { firestore } = await import('../app/services/firebase.server.js');
    
    console.log('Testing Firebase connection...');
    
    const db = firestore();
    if (!db) {
      throw new Error('Firestore not initialized');
    }
    
    console.log('✅ Firebase connected successfully!');
    
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
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    console.error('Error stack:', error.stack);
  }
}

runTest();