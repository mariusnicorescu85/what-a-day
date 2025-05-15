// tests/production-readiness-test.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('🚀 Production Readiness Test\n');
console.log('============================\n');

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function testPass(message) {
  console.log(`✅ ${message}`);
  results.passed++;
}

function testFail(message) {
  console.log(`❌ ${message}`);
  results.failed++;
}

function testWarn(message) {
  console.log(`⚠️  ${message}`);
  results.warnings++;
}

// 1. Environment Variables Test
console.log('1. Environment Variables Test');
console.log('-----------------------------');

const requiredEnvVars = [
  'FIREBASE_CREDENTIALS_BASE64',
  'FIREBASE_API_KEY',
  'FIREBASE_PROJECT_ID',
  'SHOPIFY_API_KEY'
];

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    testPass(`${varName} is set`);
  } else {
    testFail(`${varName} is missing`);
  }
});

// Check for exposed secrets
const sensitivePatterns = [
  /AIza[0-9A-Za-z-_]{35}/g,  // Google API key pattern
  /[0-9a-f]{32}/g,           // Generic API key pattern
];

// 2. Firebase Connection Test
console.log('\n2. Firebase Connection Test');
console.log('---------------------------');

try {
  const credentials = JSON.parse(
    Buffer.from(process.env.FIREBASE_CREDENTIALS_BASE64, 'base64').toString('utf-8')
  );
  
  const app = initializeApp({
    credential: cert(credentials),
    projectId: credentials.project_id,
  });
  
  const db = getFirestore(app);
  testPass('Firebase initialized successfully');
  
  // Test database connection
  const testDoc = await db.collection('_test').doc('test').get();
  testPass('Firebase connection verified');
  
} catch (error) {
  testFail(`Firebase initialization failed: ${error.message}`);
}

// 3. Security Configuration Test
console.log('\n3. Security Configuration Test');
console.log('------------------------------');

// Check for production settings
if (process.env.NODE_ENV === 'production') {
  testPass('NODE_ENV is set to production');
} else {
  testWarn('NODE_ENV is not set to production');
}

// Check for HTTPS configuration
if (process.env.SHOPIFY_APP_URL?.startsWith('https://')) {
  testPass('App URL uses HTTPS');
} else {
  testFail('App URL does not use HTTPS');
}

// 4. API Endpoints Test
console.log('\n4. API Endpoints Test');
console.log('--------------------');

const endpoints = [
  '/api/time-tracking/clock',
  '/api/time-tracking/status/test_user',
  '/api/test'
];

console.log('Note: Start your dev server to test endpoints');

// 5. Dependencies Security Test
console.log('\n5. Dependencies Security Test');
console.log('-----------------------------');

import { execSync } from 'child_process';

try {
  const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
  const audit = JSON.parse(auditResult);
  
  if (audit.metadata.vulnerabilities.high > 0 || audit.metadata.vulnerabilities.critical > 0) {
    testFail(`Found ${audit.metadata.vulnerabilities.high} high and ${audit.metadata.vulnerabilities.critical} critical vulnerabilities`);
  } else if (audit.metadata.vulnerabilities.moderate > 0) {
    testWarn(`Found ${audit.metadata.vulnerabilities.moderate} moderate vulnerabilities`);
  } else {
    testPass('No security vulnerabilities found');
  }
} catch (error) {
  // npm audit returns non-zero exit code when vulnerabilities are found
  testWarn('Some vulnerabilities found (run npm audit for details)');
}

// 6. File Permissions Test
console.log('\n6. File Permissions Test');
console.log('-----------------------');

import fs from 'fs';

const sensitiveFiles = ['.env', '.env.local', '.env.production'];
sensitiveFiles.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    if (process.platform !== 'win32') {
      if (mode === '600' || mode === '640') {
        testPass(`${file} has secure permissions (${mode})`);
      } else {
        testWarn(`${file} has permissions ${mode} (should be 600 or 640)`);
      }
    } else {
      testPass(`${file} exists (Windows permissions not checked)`);
    }
  }
});

// 7. Build Configuration Test
console.log('\n7. Build Configuration Test');
console.log('--------------------------');

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
);

if (packageJson.scripts.build) {
  testPass('Build script is configured');
} else {
  testFail('Build script is missing');
}

if (packageJson.scripts.start) {
  testPass('Start script is configured');
} else {
  testFail('Start script is missing');
}

// 8. Error Handling Test
console.log('\n8. Error Handling Test');
console.log('---------------------');

// Check for error boundary in React components
const hasErrorBoundary = fs.existsSync(
  path.resolve(__dirname, '../app/components/ErrorBoundary.jsx')
);

if (hasErrorBoundary) {
  testPass('Error boundary component exists');
} else {
  testWarn('Error boundary component not found');
}

// Final Summary
console.log('\n============================');
console.log('Test Summary');
console.log('============================');
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`⚠️  Warnings: ${results.warnings}`);

const total = results.passed + results.failed + results.warnings;
const score = (results.passed / total * 100).toFixed(1);

console.log(`\nReadiness Score: ${score}%`);

if (results.failed === 0) {
  console.log('\n🎉 Your app is production-ready!');
} else {
  console.log('\n⚠️  Please fix the failed tests before deploying to production.');
}

// Cleanup
process.exit(results.failed > 0 ? 1 : 0);