// app/routes/api.time-tracking.status.$staffId.js
import { json } from "@remix-run/node";
import { timeTrackingService } from "../services/firebase.server.js";

export async function loader({ params, request }) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { staffId } = params;
    console.log('Status request for staffId:', staffId);
    
    if (!staffId) {
      return json(
        { success: false, error: "Missing staffId" },
        { status: 400, headers }
      );
    }

    const result = await timeTrackingService.getLastClockAction(staffId);
    console.log('Status result:', result);
    
    return json(result, { headers });
  } catch (error) {
    console.error("Get status error:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
}