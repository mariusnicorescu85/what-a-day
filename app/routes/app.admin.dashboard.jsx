import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  // Skip authentication for now
  return json({});
};

export default function AdminDashboardPage() {

  const dashboardUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5174' 
    : 'https://what-a-day-pos.herokuapp.com/extensions/admin';
  return (
    <iframe
      src={dashboardUrl}
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