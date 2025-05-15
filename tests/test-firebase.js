import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Now use environment variables
const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!API_KEY || !PROJECT_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Rest of your test code using the environment variables...

// Try loading from root
const rootEnvPath = path.resolve(__dirname, '../.env');
console.log('Attempting to load .env from:', rootEnvPath);

const result = dotenv.config({ path: rootEnvPath });

if (result.error) {
  console.error('Error loading .env:', result.error);
} else {
  console.log('Successfully loaded .env');
}

// Check what we have
console.log('\nEnvironment variables:');
console.log('SHOPIFY_API_KEY:', process.env.SHOPIFY_API_KEY ? '✓ Found' : '✗ Not found');
console.log('FIREBASE_CREDENTIALS_BASE64:', process.env.FIREBASE_CREDENTIALS_BASE64 ? '✓ Found' : '✗ Not found');
console.log('FIREBASE_API_KEY:', process.env.FIREBASE_API_KEY ? '✓ Found' : '✗ Not found');

// Try to decode Firebase credentials
if (process.env.FIREBASE_CREDENTIALS_BASE64) {
  try {
    const decoded = Buffer.from(process.env.FIREBASE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    console.log('\nFirebase credentials decoded successfully:');
    console.log('Project ID:', parsed.project_id);
    console.log('Client Email:', parsed.client_email);
  } catch (error) {
    console.error('\nError decoding Firebase credentials:', error.message);
  }
} else {
  console.error('\nNo Firebase credentials found in environment');
}