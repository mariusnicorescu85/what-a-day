// app/routes/api.firebase-status.js
import { json } from "@remix-run/node";
// In api.time-tracking.clock.js and api.firebase-status.js
import { timeTrackingService } from "../services/firebase.server.js";

export async function loader() {
  const status = {
    env: {
      hasCredentials: !!process.env.FIREBASE_CREDENTIALS_BASE64,
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    },
    firebase: {
      initialized: false,
      error: null
    }
  };
  
  try {
    // Try a simple read operation
    const result = await timeTrackingService.getLastClockAction('test-user');
    status.firebase.initialized = true;
    status.lastAction = result;
  } catch (error) {
    status.firebase.error = error.message;
  }
  
  return json(status);
};