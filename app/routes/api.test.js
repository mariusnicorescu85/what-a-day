// app/routes/api.test.jsx
import { json } from "@remix-run/node";

export async function loader({ request }) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }
  
  return json({
    success: true,
    message: "API test endpoint is working",
    timestamp: new Date().toISOString(),
    method: request.method
  }, { headers });
}