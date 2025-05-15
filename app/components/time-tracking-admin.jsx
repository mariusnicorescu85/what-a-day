import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, orderBy } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function TimeTrackingAdmin() {
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeEntries();
  }, []);

  const loadTimeEntries = async () => {
    try {
      const q = query(collection(db, 'timeEntries'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const entries = [];
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      setTimeEntries(entries);
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h3>Recent Time Entries</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Staff ID</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Action</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Date</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {timeEntries.map(entry => (
            <tr key={entry.id}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.staffId}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.action}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.date}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {entry.timestamp && new Date(entry.timestamp.seconds * 1000).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}