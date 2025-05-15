#!/usr/bin/env node

/**
 * Production Security Checker Script (ES Module version)
 * Thoroughly checks your app folder for security concerns before production deployment
 * 
 * Usage: node security-check.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

class SecurityChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
    this.fileCount = 0;
    this.checkedFiles = new Set();
    
    // Patterns to check for
    this.sensitivePatterns = {
      apiKeys: [
        /api[_-]?key\s*[:=]\s*["']([^"']+)["']/gi,
        /apiKey\s*[:=]\s*["']([^"']+)["']/gi,
        /REACT_APP_[A-Z_]*API[_-]?KEY\s*=\s*["']?([^"'\s]+)["']?/gi,
        /VITE_[A-Z_]*API[_-]?KEY\s*=\s*["']?([^"'\s]+)["']?/gi,
        /AIzaSy[a-zA-Z0-9-_]{33}/g, // Google API key pattern
      ],
      secrets: [
        /secret\s*[:=]\s*["']([^"']+)["']/gi,
        /password\s*[:=]\s*["']([^"']+)["']/gi,
        /token\s*[:=]\s*["']([^"']+)["']/gi,
        /auth[_-]?token\s*[:=]\s*["']([^"']+)["']/gi,
        /private[_-]?key\s*[:=]\s*["']([^"']+)["']/gi,
      ],
      urls: [
        /https?:\/\/[^\s"']+/gi,
        /firebase\.googleapis\.com/gi,
        /firestore\.googleapis\.com/gi,
      ],
      emails: [
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      ],
      comments: [
        /\/\/\s*TODO:?\s*(.*)/gi,
        /\/\/\s*FIXME:?\s*(.*)/gi,
        /\/\/\s*HACK:?\s*(.*)/gi,
        /\/\*\s*TODO:?\s*([\s\S]*?)\*\//gi,
      ]
    };
    
    // Files to check specifically
    this.importantFiles = [
      '.env',
      '.env.local',
      '.env.production',
      '.env.development',
      'package.json',
      'vite.config.js',
      'vite.config.ts',
      'webpack.config.js',
      '.gitignore',
      'firebase.json',
      '.firebaserc'
    ];
    
    // Directories to skip
    this.skipDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      '.cache',
      '.parcel-cache'
    ];
    
    // File extensions to check
    this.checkExtensions = [
      '.js', '.jsx', '.ts', '.tsx',
      '.json', '.env', '.config',
      '.md', '.txt', '.yml', '.yaml'
    ];
  }
  
  log(message, type = 'info') {
    const prefix = {
      error: `${colors.red}✗ ERROR:${colors.reset}`,
      warning: `${colors.yellow}⚠ WARNING:${colors.reset}`,
      success: `${colors.green}✓ PASSED:${colors.reset}`,
      info: `${colors.blue}ℹ INFO:${colors.reset}`,
      header: `${colors.blue}▶${colors.reset}`
    };
    
    console.log(`${prefix[type] || prefix.info} ${message}`);
  }
  
  async checkAll() {
    this.log('Starting Security Check...', 'header');
    console.log('─'.repeat(50));
    
    const checks = [
      { name: 'Environment Variables', fn: () => this.checkEnvFiles() },
      { name: 'Git Security', fn: () => this.checkGitignore() },
      { name: 'Dependencies', fn: () => this.checkDependencies() },
      { name: 'Source Code', fn: () => this.checkSourceCode() },
      { name: 'Configuration Files', fn: () => this.checkConfigFiles() },
      { name: 'Build Output', fn: () => this.checkBuildOutput() },
      { name: 'Firebase Configuration', fn: () => this.checkFirebaseConfig() },
      { name: 'API Endpoints', fn: () => this.checkAPIEndpoints() },
      { name: 'HTTPS Usage', fn: () => this.checkHTTPSUsage() },
      { name: 'File Permissions', fn: () => this.checkFilePermissions() },
    ];
    
    for (const check of checks) {
      console.log(`\n${colors.blue}▶ ${check.name}${colors.reset}`);
      console.log('─'.repeat(30));
      await check.fn();
    }
    
    this.generateReport();
  }
  
  checkEnvFiles() {
    const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
    
    envFiles.forEach(envFile => {
      const filePath = path.join(process.cwd(), envFile);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for hardcoded sensitive values
          if (line.includes('=') && !line.startsWith('#')) {
            const [key, value] = line.split('=');
            
            // Check for actual API keys (not placeholders)
            if (value && !value.includes('your_') && !value.includes('xxx')) {
              if (key.toLowerCase().includes('key') || 
                  key.toLowerCase().includes('secret') ||
                  key.toLowerCase().includes('password')) {
                this.warnings.push({
                  file: envFile,
                  line: index + 1,
                  issue: `Sensitive value found: ${key}`,
                  severity: 'high'
                });
              }
            }
            
            // Check for proper prefixes (only for client-side variables)
            if (envFile === '.env' || envFile === '.env.production') {
              // Server-side variables don't need prefixes
              const serverVars = [
                'SHOPIFY_', 
                'FIREBASE_CREDENTIALS', 
                'FIREBASE_API_KEY',  // This is server-side
                'FIREBASE_PROJECT_ID',  // This is server-side
                'DATABASE_', 
                'SESSION_', 
                'APP_', 
                'SCOPES'
              ];
              const isServerVar = serverVars.some(prefix => key.startsWith(prefix));
              
              // Only check client-side variables for proper prefixes
              if (!isServerVar && !key.startsWith('VITE_') && !key.startsWith('REACT_APP_')) {
                this.warnings.push({
                  file: envFile,
                  line: index + 1,
                  issue: `Client-side variable '${key}' should start with VITE_ or REACT_APP_`,
                  severity: 'medium'
                });
              }
            }
          }
        });
        
        // Check if env file is in gitignore
        this.checkIfIgnored(envFile);
      }
    });
    
    // Check for .env.example
    if (!fs.existsSync(path.join(process.cwd(), '.env.example'))) {
      this.warnings.push({
        file: '.env.example',
        issue: 'Missing .env.example file for documentation',
        severity: 'low'
      });
    }
  }
  
  checkGitignore() {
    // Check both current directory and parent directory
    let gitignorePath = path.join(process.cwd(), '.gitignore');
    
    // If running from a subdirectory (like tests/), check parent directory
    if (!fs.existsSync(gitignorePath)) {
      const parentDir = path.dirname(process.cwd());
      gitignorePath = path.join(parentDir, '.gitignore');
    }
    
    if (!fs.existsSync(gitignorePath)) {
      this.issues.push({
        file: '.gitignore',
        issue: 'Missing .gitignore file',
        severity: 'critical'
      });
      return;
    }
    
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const shouldIgnore = [
      '.env',
      '.env.local',
      '.env.production',
      'node_modules',
      'dist',
      'build',
      '*.log',
      '.DS_Store',
      'coverage',
      '.vscode',
      '.idea'
    ];
    
    shouldIgnore.forEach(pattern => {
      if (!content.includes(pattern)) {
        this.warnings.push({
          file: '.gitignore',
          issue: `Missing pattern: ${pattern}`,
          severity: 'medium'
        });
      }
    });
    
    this.passed.push('.gitignore configuration checked');
  }
  
  checkDependencies() {
    try {
      // Look for package.json in current or parent directory
      let packagePath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packagePath)) {
        packagePath = path.join(path.dirname(process.cwd()), 'package.json');
      }
      
      // Change to the directory containing package.json before running audit
      const originalDir = process.cwd();
      process.chdir(path.dirname(packagePath));
      
      // Check for vulnerable dependencies
      const auditResult = execSync('npm audit --json', { encoding: 'utf-8' });
      const audit = JSON.parse(auditResult);
      
      // Change back to original directory
      process.chdir(originalDir);
      
      if (audit.metadata.vulnerabilities.total > 0) {
        const vulns = audit.metadata.vulnerabilities;
        this.issues.push({
          file: 'package.json',
          issue: `Found ${vulns.total} vulnerabilities (${vulns.critical} critical, ${vulns.high} high, ${vulns.moderate} moderate, ${vulns.low} low)`,
          severity: vulns.critical > 0 ? 'critical' : 'high'
        });
      } else {
        this.passed.push('No vulnerable dependencies found');
      }
    } catch (error) {
      this.warnings.push({
        file: 'package.json',
        issue: 'Could not run npm audit',
        severity: 'low'
      });
    }
    
    // Check package.json
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      
      // Check for suspicious scripts
      if (packageJson.scripts) {
        Object.entries(packageJson.scripts).forEach(([script, command]) => {
          if (command.includes('rm -rf') || command.includes('sudo')) {
            this.warnings.push({
              file: 'package.json',
              issue: `Potentially dangerous script: ${script}`,
              severity: 'medium'
            });
          }
        });
      }
      
      // Check for private flag
      if (!packageJson.private) {
        this.warnings.push({
          file: 'package.json',
          issue: 'Package is not marked as private',
          severity: 'low'
        });
      }
    }
  }
  
  checkSourceCode(dir = process.cwd()) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!this.skipDirs.includes(file)) {
          this.checkSourceCode(filePath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(file);
        if (this.checkExtensions.includes(ext)) {
          this.checkFile(filePath);
        }
      }
    });
  }
  
  checkFile(filePath) {
    // Skip if already checked
    if (this.checkedFiles.has(filePath)) return;
    this.checkedFiles.add(filePath);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.relative(process.cwd(), filePath);
    
    // Skip security-related files and test files for certain checks
    const isSecurityFile = fileName.includes('security-') || 
                         fileName.includes('security.') ||
                         fileName.includes('test-') ||
                         fileName.includes('test.') ||
                         fileName.includes('security-report') ||
                         fileName.endsWith('.json'); // Skip JSON reports
    
    // Skip logger.js for console checks
    const isLoggerFile = fileName.includes('logger.js');
    
    this.fileCount++;
    
    // Check for sensitive patterns
    Object.entries(this.sensitivePatterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Skip if it's a placeholder or example
            if (match.includes('your_') || 
                match.includes('xxx') || 
                match.includes('example') ||
                match.includes('placeholder') ||
                match.includes('process.env') ||
                match.includes('import.meta.env')) {
              return;
            }
            
            const lineNumber = this.getLineNumber(content, match);
            
            if (category === 'apiKeys' || category === 'secrets') {
              this.issues.push({
                file: fileName,
                line: lineNumber,
                issue: `Hardcoded ${category}: ${match.substring(0, 30)}...`,
                severity: 'critical'
              });
            } else if (category === 'comments') {
              const todoMatch = match.match(/TODO:?\s*(.*)/i);
              if (todoMatch && todoMatch[1]) {
                this.warnings.push({
                  file: fileName,
                  line: lineNumber,
                  issue: `TODO comment: ${todoMatch[1].substring(0, 50)}`,
                  severity: 'low'
                });
              }
            }
          });
        }
      });
    });
    
    // Check for console.log statements (skip logger files)
    if (!isLoggerFile) {
      const consoleMatches = content.match(/console\.(log|warn|error|debug)/g);
      if (consoleMatches) {
        this.warnings.push({
          file: fileName,
          issue: `Found ${consoleMatches.length} console statements`,
          severity: 'low'
        });
      }
    }
    
    // Check for eval() usage (exclude security check files)
    if (content.includes('eval(') && !isSecurityFile) {
      this.issues.push({
        file: fileName,
        issue: 'Usage of eval() detected',
        severity: 'high'
      });
    }
    
    // Check for dangerouslySetInnerHTML (exclude security check files)
    if (content.includes('dangerouslySetInnerHTML') && !isSecurityFile) {
      this.warnings.push({
        file: fileName,
        issue: 'Usage of dangerouslySetInnerHTML detected',
        severity: 'medium'
      });
    }
  }
  
  checkConfigFiles() {
    const configFiles = [
      'vite.config.js',
      'vite.config.ts',
      'webpack.config.js',
      'rollup.config.js',
      'firebase.json',
      '.firebaserc'
    ];
    
    configFiles.forEach(configFile => {
      const filePath = path.join(process.cwd(), configFile);
      if (fs.existsSync(filePath)) {
        this.checkFile(filePath);
      }
    });
  }
  
  checkBuildOutput() {
    const buildDirs = ['dist', 'build', '.next', 'out'];
    
    buildDirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        this.warnings.push({
          file: dir,
          issue: `Build directory exists - ensure it's not committed to git`,
          severity: 'medium'
        });
        
        // Check if it's in gitignore
        this.checkIfIgnored(dir);
      }
    });
  }
  
  checkFirebaseConfig() {
    // Check firebase.json
    const firebaseConfigPath = path.join(process.cwd(), 'firebase.json');
    if (fs.existsSync(firebaseConfigPath)) {
      const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
      
      // Check hosting configuration
      if (config.hosting) {
        if (!config.hosting.headers) {
          this.warnings.push({
            file: 'firebase.json',
            issue: 'Missing security headers configuration',
            severity: 'medium'
          });
        }
        
        // Check for proper caching
        if (!config.hosting.headers?.find(h => h.source === '**/*.@(js|css|map)')) {
          this.warnings.push({
            file: 'firebase.json',
            issue: 'Missing caching headers for static assets',
            severity: 'low'
          });
        }
      }
      
      // Check Firestore rules
      if (config.firestore && !fs.existsSync('firestore.rules')) {
        this.issues.push({
          file: 'firestore.rules',
          issue: 'Missing Firestore security rules file',
          severity: 'critical'
        });
      }
    }
    
    // Check .firebaserc
    const firebasercPath = path.join(process.cwd(), '.firebaserc');
    if (fs.existsSync(firebasercPath)) {
      this.checkFile(firebasercPath);
    }
  }
  
  checkAPIEndpoints() {
    // Scan for API endpoint definitions
    const apiPatterns = [
      /fetch\s*\(\s*["'`]([^"'`]+)["'`]/g,
      /axios\.\w+\s*\(\s*["'`]([^"'`]+)["'`]/g,
      /\$\.ajax\s*\(\s*{[^}]*url\s*:\s*["'`]([^"'`]+)["'`]/g
    ];
    
    this.checkedFiles.forEach(file => {
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(file, 'utf-8');
        
        apiPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach(match => {
              // Check if it's using HTTP instead of HTTPS
              if (match.includes('http://') && !match.includes('localhost')) {
                this.issues.push({
                  file: path.relative(process.cwd(), file),
                  issue: `Insecure HTTP endpoint: ${match}`,
                  severity: 'high'
                });
              }
            });
          }
        });
      }
    });
  }
  
  checkHTTPSUsage() {
    // Already covered in checkAPIEndpoints
    this.passed.push('HTTPS usage checked in API endpoints');
  }
  
  checkFilePermissions() {
    // Skip file permissions check on Windows
    if (process.platform === 'win32') {
      this.passed.push('File permissions check skipped on Windows');
      return;
    }
    
    // Check if sensitive files have proper permissions (Unix-like systems only)
    const sensitiveFiles = ['.env', '.env.local', '.env.production'];
    
    sensitiveFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const mode = '0' + (stats.mode & parseInt('777', 8)).toString(8);
        
        if (mode !== '0600' && mode !== '0400') {
          this.warnings.push({
            file: file,
            issue: `File has loose permissions: ${mode} (should be 0600 or 0400)`,
            severity: 'medium'
          });
        }
      }
    });
  }
  
  checkIfIgnored(filename) {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes(filename)) {
        this.warnings.push({
          file: filename,
          issue: 'File is not in .gitignore',
          severity: 'high'
        });
      }
    }
  }
  
  getLineNumber(content, match) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) {
        return i + 1;
      }
    }
    return 0;
  }
  
  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log(`${colors.blue}SECURITY CHECK REPORT${colors.reset}`);
    console.log('='.repeat(50));
    
    console.log(`\nFiles checked: ${this.fileCount}`);
    console.log(`Critical issues: ${this.issues.filter(i => i.severity === 'critical').length}`);
    console.log(`High severity issues: ${this.issues.filter(i => i.severity === 'high').length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Passed checks: ${this.passed.length}`);
    
    if (this.issues.length > 0) {
      console.log(`\n${colors.red}CRITICAL ISSUES:${colors.reset}`);
      this.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🚨' : '❗';
        console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        console.log(`   ${issue.issue}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}WARNINGS:${colors.reset}`);
      this.warnings.forEach(warning => {
        console.log(`⚠️  [${warning.severity.toUpperCase()}] ${warning.file}${warning.line ? `:${warning.line}` : ''}`);
        console.log(`   ${warning.issue}`);
      });
    }
    
    if (this.passed.length > 0) {
      console.log(`\n${colors.green}PASSED CHECKS:${colors.reset}`);
      this.passed.forEach(pass => {
        console.log(`✅ ${pass}`);
      });
    }
    
    // Generate recommendations
    console.log(`\n${colors.blue}RECOMMENDATIONS:${colors.reset}`);
    const recommendations = this.generateRecommendations();
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Final verdict
    console.log('\n' + '='.repeat(50));
    if (this.issues.filter(i => i.severity === 'critical').length > 0) {
      console.log(`${colors.red}❌ FAILED: Critical security issues found!${colors.reset}`);
      console.log('Fix all critical issues before deploying to production.');
    } else if (this.issues.length > 0) {
      console.log(`${colors.yellow}⚠️  WARNING: High severity issues found.${colors.reset}`);
      console.log('Consider fixing these issues before production deployment.');
    } else {
      console.log(`${colors.green}✅ PASSED: No critical security issues found!${colors.reset}`);
      console.log('Remember to review warnings and follow best practices.');
    }
    console.log('='.repeat(50));
    
    // Save report to file
    this.saveReport();
  }
  
  generateRecommendations() {
    const recommendations = [];
    
    if (!fs.existsSync('.env.example')) {
      recommendations.push('Create a .env.example file with placeholder values for documentation');
    }
    
    if (this.issues.some(i => i.issue.includes('Hardcoded'))) {
      recommendations.push('Move all hardcoded secrets to environment variables');
    }
    
    if (this.warnings.some(w => w.issue.includes('console'))) {
      recommendations.push('Remove or conditionally disable console statements for production');
    }
    
    if (!fs.existsSync('firestore.rules')) {
      recommendations.push('Add Firestore security rules to protect your database');
    }
    
    recommendations.push('Run this security check regularly during development');
    recommendations.push('Set up automated security scanning in your CI/CD pipeline');
    recommendations.push('Enable GitHub security alerts for your repository');
    recommendations.push('Use HTTPS for all external API calls');
    recommendations.push('Implement proper error handling without exposing sensitive information');
    recommendations.push('Add Content Security Policy headers to your application');
    
    return recommendations;
  }
  
  saveReport() {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const reportPath = path.join(process.cwd(), `security-report-${timestamp}.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesChecked: this.fileCount,
        criticalIssues: this.issues.filter(i => i.severity === 'critical').length,
        highIssues: this.issues.filter(i => i.severity === 'high').length,
        warnings: this.warnings.length,
        passed: this.passed.length
      },
      issues: this.issues,
      warnings: this.warnings,
      passed: this.passed,
      recommendations: this.generateRecommendations()
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);
  }
}

// Run the security check
const checker = new SecurityChecker();
checker.checkAll().catch(error => {
  console.error(`${colors.red}Error running security check:${colors.reset}`, error);
  process.exit(1);
});