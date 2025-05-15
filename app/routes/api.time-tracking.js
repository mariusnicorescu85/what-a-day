// app/routes/api.time-tracking.jsx
import { json } from "@remix-run/node";

export async function loader() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  return json(
    { 
      success: true, 
      message: "Time tracking API is running",
      endpoints: {
        clock: "/api/time-tracking/clock",
        status: "/api/time-tracking/status/:staffId"
      }
    },
    { headers }
  );
}