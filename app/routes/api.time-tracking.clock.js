// app/routes/api.time-tracking.clock.jsx (Alternative cleaner version)
import { json } from "@remix-run/node";
import { timeTrackingService } from "../services/firebase.server.js";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }) {
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  // For GET requests, return API info
  return json(
    { 
      message: "Use POST method to clock in/out",
      endpoint: "/api/time-tracking/clock",
      required: { staffId: "string", action: "string" }
    }, 
    { headers: corsHeaders }
  );
}

export async function action({ request }) {
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const data = await request.json();
    const { staffId, action } = data;

    console.log('Clock action request:', { staffId, action });

    if (!staffId || !action) {
      return json(
        { success: false, error: "Missing staffId or action" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate action
    const validActions = ['clock_in', 'clock_out', 'break', 'lunch'];
    if (!validActions.includes(action)) {
      return json(
        { success: false, error: "Invalid action" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Record the clock event
    const result = await timeTrackingService.recordClockEvent(staffId, action);
    
    console.log('Clock action result:', result);
    
    return json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("Clock action error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}