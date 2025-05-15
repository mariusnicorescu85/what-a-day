// Production-safe console wrapper
// Use this instead of direct console.log in your code

const isDevelopment = process.env.NODE_ENV === 'development' || import.meta.env?.DEV;

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Always log errors, but in production you might want to send to error tracking service
    console.error(...args);
    
    // In production, send to error tracking service
    if (!isDevelopment && window.sentryOrBugsnag) {
      // window.sentryOrBugsnag.captureMessage(args.join(' '));
    }
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  }
};

// Example usage:
// import { logger } from './utils/logger';
// logger.log('Debug message');
// logger.error('Error message');