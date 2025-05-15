// app/routes/app.admin.dashboard.jsx
import { Page, Layout, Card } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import { useEffect } from 'react';

export default function AdminDashboard() {
  useEffect(() => {
    // Dynamically import and mount the component
    import('../components/time-tracking-admin.jsx').then((module) => {
      const TimeTrackingAdmin = module.default;
      const root = document.getElementById('time-tracking-admin-root');
      if (root) {
        const { createRoot } = require('react-dom/client');
        const rootElement = createRoot(root);
        rootElement.render(<TimeTrackingAdmin />);
      }
    });
  }, []);

  return (
    <Page>
      <TitleBar title="Time Tracking Admin" />
      <Layout>
        <Layout.Section>
          <Card>
            <div id="time-tracking-admin-root" style={{ minHeight: '600px' }}>
              {/* Component will mount here */}
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}