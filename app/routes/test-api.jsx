import { useState } from "react";

export default function TestAPI() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const testClockIn = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/time-tracking/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: "test_user",
          action: "clock_in"
        })
      });
      const data = await response.json();
      setStatus(`Clock In Result: ${JSON.stringify(data)}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  const testStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/time-tracking/status/test_user");
      const data = await response.json();
      setStatus(`Status Result: ${JSON.stringify(data)}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>API Test Page</h1>
      
      <button 
        onClick={testClockIn}
        disabled={loading}
        style={{ marginRight: "10px", padding: "10px" }}
      >
        Test Clock In
      </button>
      
      <button 
        onClick={testStatus}
        disabled={loading}
        style={{ padding: "10px" }}
      >
        Test Get Status
      </button>
      
      {loading && <p>Loading...</p>}
      
      {status && (
        <div style={{ marginTop: "20px", padding: "10px", background: "#f0f0f0" }}>
          <pre>{status}</pre>
        </div>
      )}
    </div>
  );
}