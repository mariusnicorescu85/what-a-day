import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { timeTrackingService } from "~/services/firebase.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  
  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId, action } = await request.json();
  
  if (!staffId || !action) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await timeTrackingService.recordClockEvent(staffId, action);
    return json(result);
  } catch (error) {
    console.error("Clock event error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function loader() {
  return json({ error: "Method not allowed" }, { status: 405 });
}