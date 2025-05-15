import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  // Skip authentication for now
  return json({});
};

export default function AdminDashboardPage() {
  return (
    <iframe
      src="http://localhost:5174"
      style={{
        width: '100%',
        height: 'calc(100vh - 60px)',
        border: 'none',
        margin: 0,
        padding: 0
      }}
      title="Time Tracking Admin Dashboard"
    />
  );
}

export function ErrorBoundary() {
  return <div>An error occurred loading the admin dashboard.</div>;
}