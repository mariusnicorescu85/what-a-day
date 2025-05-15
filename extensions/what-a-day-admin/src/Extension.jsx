import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Firebase REST API service
const firebaseRESTService = {
  baseUrl: 'https://firestore.googleapis.com/v1/projects/pos-time-tracking/databases/(default)/documents',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  
  async getAllTimeEntries(startDate, endDate) {
    try {
      const url = `${this.baseUrl}/timeEntries?key=${this.apiKey}`;
      
      console.log('Fetching entries for date range:', startDate, 'to', endDate);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Firebase response:', result);
      
      if (result.documents) {
        const allEntries = result.documents.map(doc => {
          const fields = doc.fields;
          return {
            id: doc.name.split('/').pop(),
            action: fields.action?.stringValue || '',
            timestamp: fields.timestamp?.timestampValue || '',
            date: fields.date?.stringValue || '',
            staffId: fields.staffId?.stringValue || ''
          };
        });
        
        console.log('All entries dates:', allEntries.map(e => e.date));
        console.log('Looking for dates between:', startDate, 'and', endDate);
        
        const filteredEntries = allEntries.filter(entry => {
          const isInRange = entry.date >= startDate && entry.date <= endDate;
          if (!isInRange) {
            console.log(`Filtered out: ${entry.date} (${entry.staffId})`);
          }
          return isInRange;
        });
        
        console.log('Filtered entries count:', filteredEntries.length);
        console.log('Sample filtered entries:', filteredEntries.slice(0, 5));
        return filteredEntries;
      }
      return [];
    } catch (error) {
      console.error('Error fetching time entries:', error);
      return [];
    }
  },
  
  async getAnalytics(startDate, endDate) {
    const entries = await this.getAllTimeEntries(startDate, endDate);
    console.log('Analytics received entries:', entries.length, entries);
    
    const analytics = {
      totalEntries: entries.length,
      uniqueStaff: new Set(entries.map(e => e.staffId)).size,
      totalHours: 0,
      byStaff: {},
      byAction: {
        clock_in: 0,
        clock_out: 0,
        break: 0,
        lunch: 0
      },
      byDay: {}
    };
    
    // Group entries by staff for tracking active sessions
    const staffSessions = {};
    
    entries.forEach(entry => {
      console.log('Processing entry:', entry);
      
      // Count by action
      if (analytics.byAction[entry.action] !== undefined) {
        analytics.byAction[entry.action]++;
      }
      
      // Count by day
      const day = entry.date;
      if (!analytics.byDay[day]) {
        analytics.byDay[day] = 0;
      }
      analytics.byDay[day]++;
      
      // Initialize staff session tracking
      if (!staffSessions[entry.staffId]) {
        staffSessions[entry.staffId] = [];
      }
      staffSessions[entry.staffId].push(entry);
    });
    
    // Calculate hours for each staff member
    Object.keys(staffSessions).forEach(staffId => {
      const staffEntries = staffSessions[staffId].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      console.log(`Calculating hours for ${staffId}:`, staffEntries);
      
      let clockIn = null;
      let totalHours = 0;
      
      staffEntries.forEach(entry => {
        if (entry.action === 'clock_in') {
          clockIn = new Date(entry.timestamp);
          console.log(`Clock in for ${staffId} at ${clockIn}`);
        } else if (entry.action === 'clock_out' && clockIn) {
          const clockOut = new Date(entry.timestamp);
          const hours = (clockOut - clockIn) / (1000 * 60 * 60);
          totalHours += hours;
          analytics.totalHours += hours;
          console.log(`Clock out for ${staffId} at ${clockOut}, hours: ${hours}`);
          clockIn = null;
        }
      });
      
      analytics.byStaff[staffId] = {
        hours: totalHours,
        entries: staffEntries.length
      };
      
      console.log(`Total hours for ${staffId}: ${totalHours}`);
    });
    
    console.log('Final analytics:', analytics);
    return analytics;
  },
  
  async generateStaffReport(staffId, startDate, endDate) {
    const entries = await this.getAllTimeEntries(startDate, endDate);
    const staffEntries = entries.filter(e => e.staffId === staffId);
    
    let totalHours = 0;
    let currentClockIn = null;
    let breaks = 0;
    let lunchBreaks = 0;
    let dailyHours = {};
    
    staffEntries.forEach(entry => {
      const date = entry.date;
      if (!dailyHours[date]) {
        dailyHours[date] = {
          clockIn: null,
          clockOut: null,
          breaks: 0,
          lunch: 0,
          hours: 0
        };
      }
      
      switch(entry.action) {
        case 'clock_in':
          currentClockIn = new Date(entry.timestamp);
          dailyHours[date].clockIn = currentClockIn;
          break;
        case 'clock_out':
          if (currentClockIn) {
            const clockOut = new Date(entry.timestamp);
            const duration = (clockOut - currentClockIn) / (1000 * 60 * 60);
            totalHours += duration;
            dailyHours[date].hours += duration;
            dailyHours[date].clockOut = clockOut;
            currentClockIn = null;
          }
          break;
        case 'break':
          breaks++;
          dailyHours[date].breaks++;
          break;
        case 'lunch':
          lunchBreaks++;
          dailyHours[date].lunch++;
          break;
      }
    });
    
    return {
      staffId,
      period: { startDate, endDate },
      totalHours: totalHours.toFixed(2),
      averageHours: Object.keys(dailyHours).length ? (totalHours / Object.keys(dailyHours).length).toFixed(2) : '0',
      breaksTaken: breaks,
      lunchBreaks: lunchBreaks,
      dailyBreakdown: dailyHours,
      entries: staffEntries
    };
  },
  
  // Fixed update method
  async updateTimeEntry(entryId, updates) {
    try {
      const url = `${this.baseUrl}/timeEntries/${entryId}?key=${this.apiKey}&updateMask.fieldPaths=staffId&updateMask.fieldPaths=action&updateMask.fieldPaths=date&updateMask.fieldPaths=timestamp`;
      
      const fields = {};
      if (updates.staffId) fields.staffId = { stringValue: updates.staffId };
      if (updates.action) fields.action = { stringValue: updates.action };
      if (updates.date) fields.date = { stringValue: updates.date };
      if (updates.timestamp) fields.timestamp = { timestampValue: updates.timestamp };
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      
      console.log('Update response:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        throw new Error(`Update failed: ${response.status} - ${responseText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating time entry:', error);
      throw error;
    }
  },
  
  async deleteTimeEntry(entryId) {
    try {
      const url = `${this.baseUrl}/timeEntries/${entryId}?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting time entry:', error);
      throw error;
    }
  },
  
  // Fixed add staff member method
  async addStaffMember(staffId, name, role) {
    try {
      const url = `${this.baseUrl}/staff?documentId=${staffId}&key=${this.apiKey}`;
      
      const fields = {
        id: { stringValue: staffId },
        name: { stringValue: name },
        role: { stringValue: role },
        active: { booleanValue: true },
        createdAt: { timestampValue: new Date().toISOString() }
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      
      console.log('Add staff response:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        throw new Error(`Failed to add staff: ${response.status} - ${responseText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error adding staff member:', error);
      throw error;
    }
  },
  
  async getAllStaff() {
    try {
      const url = `${this.baseUrl}/staff?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch staff: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.documents) {
        return result.documents.map(doc => {
          const fields = doc.fields;
          return {
            id: fields.id?.stringValue || '',
            name: fields.name?.stringValue || '',
            role: fields.role?.stringValue || '',
            active: fields.active?.booleanValue !== false
          };
        });
      }
      return [];
    } catch (error) {
      console.error('Error fetching staff:', error);
      return [];
    }
  },
  
  // Fixed add time entry method
  async addTimeEntry(staffId, action, date, timestamp) {
    try {
      const documentId = `${Date.now()}_${staffId}_${action}`.replace(/[\/\s]/g, '_');
      const url = `${this.baseUrl}/timeEntries?documentId=${documentId}&key=${this.apiKey}`;
      
      const fields = {
        staffId: { stringValue: staffId },
        action: { stringValue: action },
        date: { stringValue: date },
        timestamp: { timestampValue: timestamp || new Date().toISOString() }
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      
      console.log('Add time entry response:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        throw new Error(`Failed to add time entry: ${response.status} - ${responseText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error adding time entry:', error);
      throw error;
    }
  }
};

const EnhancedAdminDashboard = () => {
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  const [staffList, setStaffList] = useState([
    { id: 'john_doe', name: 'John Doe', role: 'Floor Manager' },
    { id: 'jane_smith', name: 'Jane Smith', role: 'Sales Associate' }
  ]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffReport, setStaffReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // States for editing time entries
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editEntryData, setEditEntryData] = useState({
    id: '',
    staffId: '',
    action: '',
    date: '',
    timestamp: ''
  });
  
  // States for adding staff
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffData, setNewStaffData] = useState({ id: '', name: '', role: '' });
  
  // States for clock in/out functionality
  const [showClockModal, setShowClockModal] = useState(false);
  const [clockActionData, setClockActionData] = useState({
    staffId: '',
    action: 'clock_in'
  });
  
  const [successMessage, setSuccessMessage] = useState('');
  
  // States for filtering entries
  const [filters, setFilters] = useState({
    staffId: '',
    action: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '',
    timeTo: ''
  });
  
  const [filteredEntries, setFilteredEntries] = useState([]);
  
  // Initial load
  useEffect(() => {
    loadData();
  }, []); // Only run once on mount
  
  // Load data when date range changes
  useEffect(() => {
    loadTimeEntries();
  }, [dateRange.startDate, dateRange.endDate]);
  
  useEffect(() => {
    if (selectedStaff) {
      generateStaffReport(selectedStaff);
    }
  }, [selectedStaff, dateRange]);
  
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Effect to filter entries when filters or timeEntries change
  useEffect(() => {
    let filtered = [...timeEntries];
    
    // Filter by staff member
    if (filters.staffId) {
      filtered = filtered.filter(entry => entry.staffId === filters.staffId);
    }
    
    // Filter by action
    if (filters.action) {
      filtered = filtered.filter(entry => entry.action === filters.action);
    }
    
    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter(entry => entry.date >= filters.dateFrom);
    }
    if (filters.dateTo) {
      filtered = filtered.filter(entry => entry.date <= filters.dateTo);
    }
    
    // Filter by time range
    if (filters.timeFrom || filters.timeTo) {
      filtered = filtered.filter(entry => {
        const entryTime = new Date(entry.timestamp).toTimeString().slice(0, 5);
        if (filters.timeFrom && entryTime < filters.timeFrom) return false;
        if (filters.timeTo && entryTime > filters.timeTo) return false;
        return true;
      });
    }
    
    setFilteredEntries(filtered);
  }, [timeEntries, filters]);
  
  const clearFilters = () => {
    setFilters({
      staffId: '',
      action: '',
      dateFrom: '',
      dateTo: '',
      timeFrom: '',
      timeTo: ''
    });
  };
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [staffResponse, entriesResponse] = await Promise.all([
        firebaseRESTService.getAllStaff(),
        firebaseRESTService.getAllTimeEntries(dateRange.startDate, dateRange.endDate)
      ]);
      
      // Set staff list with fallback defaults
      setStaffList(staffResponse.length > 0 ? staffResponse : [
        { id: 'john_doe', name: 'John Doe', role: 'Floor Manager' },
        { id: 'jane_smith', name: 'Jane Smith', role: 'Sales Associate' }
      ]);
      
      setTimeEntries(entriesResponse);
      
      const analyticsData = await firebaseRESTService.getAnalytics(
        dateRange.startDate,
        dateRange.endDate
      );
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data: ' + err.message);
      // Set default staff on error
      setStaffList([
        { id: 'john_doe', name: 'John Doe', role: 'Floor Manager' },
        { id: 'jane_smith', name: 'Jane Smith', role: 'Sales Associate' }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  const loadTimeEntries = async () => {
    try {
      const entries = await firebaseRESTService.getAllTimeEntries(
        dateRange.startDate, 
        dateRange.endDate
      );
      setTimeEntries(entries);
      
      const data = await firebaseRESTService.getAnalytics(
        dateRange.startDate, 
        dateRange.endDate
      );
      setAnalytics(data);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load time entries: ' + err.message);
    }
  };
  
  const loadStaffList = async () => {
    try {
      const staff = await firebaseRESTService.getAllStaff();
      setStaffList(staff.length > 0 ? staff : [
        { id: 'john_doe', name: 'John Doe', role: 'Floor Manager' },
        { id: 'jane_smith', name: 'Jane Smith', role: 'Sales Associate' }
      ]);
    } catch (err) {
      console.error('Error loading staff:', err);
      // Keep existing staff list on error
    }
  };
  
  const generateStaffReport = async (staffId) => {
    try {
      const report = await firebaseRESTService.generateStaffReport(
        staffId, 
        dateRange.startDate, 
        dateRange.endDate
      );
      setStaffReport(report);
    } catch (err) {
      setError('Failed to generate staff report: ' + err.message);
    }
  };
  
  const handleEditEntry = async () => {
    if (!editEntryData.id) {
      setError('Invalid entry data');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const updates = {};
      if (editEntryData.staffId) updates.staffId = editEntryData.staffId;
      if (editEntryData.action) updates.action = editEntryData.action;
      if (editEntryData.date) updates.date = editEntryData.date;
      
      // Ensure timestamp is properly formatted
      if (editEntryData.timestamp) {
        const date = new Date(editEntryData.date);
        const [hours, minutes] = editEntryData.timestamp.split(':');
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        updates.timestamp = date.toISOString();
      }
      
      await firebaseRESTService.updateTimeEntry(editEntryData.id, updates);
      
      await loadTimeEntries();
      setShowEditEntryModal(false);
      setEditEntryData({ id: '', staffId: '', action: '', date: '', timestamp: '' });
      setSuccessMessage('Entry updated successfully');
    } catch (err) {
      setError('Failed to update entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      await firebaseRESTService.deleteTimeEntry(entryId);
      
      await loadTimeEntries();
      setSuccessMessage('Entry deleted successfully');
    } catch (err) {
      setError('Failed to delete entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddStaff = async () => {
    if (!newStaffData.id || !newStaffData.name || !newStaffData.role) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const staffId = newStaffData.id.toLowerCase().replace(/\s+/g, '_');
      await firebaseRESTService.addStaffMember(
        staffId,
        newStaffData.name,
        newStaffData.role
      );
      
      await loadStaffList();
      setShowAddStaffModal(false);
      setNewStaffData({ id: '', name: '', role: '' });
      setSuccessMessage('Staff member added successfully');
    } catch (err) {
      setError('Failed to add staff member: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClockAction = async () => {
    if (!clockActionData.staffId || !clockActionData.action) {
      setError('Please select a staff member and action');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      await firebaseRESTService.addTimeEntry(
        clockActionData.staffId,
        clockActionData.action,
        today,
        now.toISOString()
      );
      
      await loadTimeEntries();
      setShowClockModal(false);
      setClockActionData({ staffId: '', action: 'clock_in' });
      setSuccessMessage(`${clockActionData.action.replace('_', ' ')} recorded successfully`);
    } catch (err) {
      setError('Failed to record time action: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to format hours to human-readable format
  const formatHours = (decimalHours) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    if (hours === 0 && minutes === 0) return '0h 0m';
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };
  
  // Helper function to format hours for CSV export (keeps decimal format)
  const formatHoursDecimal = (hours) => hours.toFixed(2);
  
  const exportToCSV = (data, filename) => {
    let csvContent;
    
    if (Array.isArray(data) && data.length > 0) {
      if ('staffId' in data[0] && 'action' in data[0]) {
        csvContent = data.map(row => [
          row.staffId,
          row.action,
          row.date,
          new Date(row.timestamp).toLocaleString()
        ].join(','));
        csvContent.unshift(['Staff ID', 'Action', 'Date', 'Time'].join(','));
      }
    } else if (data && typeof data === 'object') {
      csvContent = [
        ['Report Type', 'Staff Report'],
        ['Staff ID', data.staffId],
        ['Period Start', data.period.startDate],
        ['Period End', data.period.endDate],
        ['Total Hours', data.totalHours],
        ['Average Hours', data.averageHours],
        ['Breaks Taken', data.breaksTaken],
        ['Lunch Breaks', data.lunchBreaks],
        [''],
        ['Daily Breakdown'],
        ['Date', 'Clock In', 'Clock Out', 'Hours', 'Breaks', 'Lunch']
      ];
      
      Object.entries(data.dailyBreakdown).forEach(([date, dailyData]) => {
        csvContent.push([
          date,
          dailyData.clockIn ? new Date(dailyData.clockIn).toLocaleTimeString() : '',
          dailyData.clockOut ? new Date(dailyData.clockOut).toLocaleTimeString() : '',
          dailyData.hours.toFixed(2),
          dailyData.breaks,
          dailyData.lunch
        ].join(','));
      });
    }
    
    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  
  const getActionIcon = (action) => {
    switch(action) {
      case 'clock_in': return '🟢';
      case 'clock_out': return '🔴';
      case 'break': return '🟡';
      case 'lunch': return '🔵';
      default: return '⚪';
    }
  };
  
  // Modal Component
  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    
    const handleBackgroundClick = (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    };
    
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={handleBackgroundClick}
      >
        <div 
          className="bg-white rounded-lg p-6 shadow-lg max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  };
  
  // Add Staff Form Component that handles input focus properly
  const AddStaffForm = () => {
    // Use local state for the form to prevent re-renders affecting input focus
    const [localFormData, setLocalFormData] = useState({ id: '', name: '', role: '' });
    
    const handleLocalSubmit = async () => {
      if (!localFormData.id || !localFormData.name || !localFormData.role) {
        setError('Please fill in all fields');
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const staffId = localFormData.id.toLowerCase().replace(/\s+/g, '_');
        await firebaseRESTService.addStaffMember(
          staffId,
          localFormData.name,
          localFormData.role
        );
        
        await loadStaffList();
        setShowAddStaffModal(false);
        setNewStaffData({ id: '', name: '', role: '' });
        setLocalFormData({ id: '', name: '', role: '' }); // Reset local form
        setSuccessMessage('Staff member added successfully');
      } catch (err) {
        setError('Failed to add staff member: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={localFormData.name}
            onChange={e => setLocalFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g. John Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Staff ID
          </label>
          <input
            type="text"
            value={localFormData.id}
            onChange={e => setLocalFormData(prev => ({ ...prev, id: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g. john_smith"
          />
          <p className="text-xs text-gray-500 mt-1">
            ID will be automatically formatted with lowercase and underscores when saved
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={localFormData.role}
            onChange={e => setLocalFormData(prev => ({ ...prev, role: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">Select a role</option>
            <option value="Manager">Manager</option>
            <option value="Floor Manager">Floor Manager</option>
            <option value="Sales Associate">Sales Associate</option>
            <option value="Cashier">Cashier</option>
            <option value="Stock Clerk">Stock Clerk</option>
            <option value="Customer Service">Customer Service</option>
          </select>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => {
              setShowAddStaffModal(false);
              setLocalFormData({ id: '', name: '', role: '' }); // Reset on cancel
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLocalSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Staff Member
          </button>
        </div>
      </div>
    );
  };
  
  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Time Tracking Admin Dashboard</h1>
          <div className="text-center py-8">
            <p className="text-gray-500">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Time Tracking Admin Dashboard</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowClockModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Clock In/Out Staff
            </button>
            <button
              onClick={() => exportToCSV(activeTab === 'entries' && filteredEntries.length > 0 ? filteredEntries : timeEntries, 'time-entries.csv')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Export CSV
            </button>
          </div>
        </div>
        
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 relative">
            {successMessage}
            <button 
              onClick={() => setSuccessMessage('')}
              className="absolute top-0 right-0 mt-3 mr-3"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {['overview', 'staff', 'entries', 'reports'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quick Select
              </label>
              <select
                onChange={e => {
                  const value = e.target.value;
                  const today = new Date();
                  let start, end;
                  
                  switch(value) {
                    case 'today':
                      start = end = today.toISOString().split('T')[0];
                      break;
                    case 'week':
                      start = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
                      end = new Date().toISOString().split('T')[0];
                      break;
                    case 'month':
                      start = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
                      end = new Date().toISOString().split('T')[0];
                      break;
                    default:
                      return;
                  }
                  
                  setDateRange({ startDate: start, endDate: end });
                }}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select range</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 relative">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="absolute top-0 right-0 mt-3 mr-3"
            >
              ×
            </button>
          </div>
        )}
        
        {loading && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        )}
        
        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Hours</h3>
                <p className="text-3xl font-bold text-blue-600">{formatHours(analytics.totalHours)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Active Staff</h3>
                <p className="text-3xl font-bold text-green-600">{analytics.uniqueStaff}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Entries</h3>
                <p className="text-3xl font-bold text-purple-600">{analytics.totalEntries}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Avg Hours/Staff</h3>
                <p className="text-3xl font-bold text-yellow-600">
                  {analytics.uniqueStaff ? formatHours(analytics.totalHours / analytics.uniqueStaff) : '0h 0m'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Hours by Staff</h3>
                <BarChart
                  width={500}
                  height={300}
                  data={Object.entries(analytics.byStaff || {}).map(([staff, data]) => ({
                    name: staff.replace('_', ' '),
                    hours: data.hours || 0,
                    displayHours: formatHours(data.hours || 0)
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis 
                    tickFormatter={(value) => formatHours(value)}
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'hours') {
                        return [formatHours(value), 'Hours'];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend 
                    formatter={(value) => value === 'hours' ? 'Hours' : value}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" />
                </BarChart>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Actions Distribution</h3>
                <PieChart width={500} height={300}>
                  <Pie
                    data={Object.entries(analytics.byAction || {}).map(([action, count]) => ({
                      name: action.replace('_', ' '),
                      value: count
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {Object.keys(analytics.byAction || {}).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'staff' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">Staff Members</h3>
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add Staff Member
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffList.map(staff => (
                    <tr key={staff.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{staff.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {analytics?.byStaff[staff.id]?.hours ? formatHours(analytics.byStaff[staff.id].hours) : '0h 0m'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setClockActionData({ staffId: staff.id, action: 'clock_in' });
                              setShowClockModal(true);
                            }}
                            className="px-3 py-1 bg-green-100 border border-green-500 text-green-700 rounded hover:bg-green-200"
                          >
                            Clock In
                          </button>
                          <button
                            onClick={() => {
                              setClockActionData({ staffId: staff.id, action: 'clock_out' });
                              setShowClockModal(true);
                            }}
                            className="px-3 py-1 bg-red-100 border border-red-500 text-red-700 rounded hover:bg-red-200"
                          >
                            Clock Out
                          </button>
                          <button
                            onClick={() => {
                              setSelectedStaff(staff.id);
                              setActiveTab('reports');
                            }}
                            className="px-3 py-1 bg-blue-100 border border-blue-500 text-blue-700 rounded hover:bg-blue-200"
                          >
                            View Report
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 'entries' && (
          <div className="space-y-6">
            {/* Filter Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium mb-4">Filter Entries</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Staff Member
                  </label>
                  <select
                    value={filters.staffId}
                    onChange={e => setFilters(prev => ({ ...prev, staffId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">All Staff</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action
                  </label>
                  <select
                    value={filters.action}
                    onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">All Actions</option>
                    <option value="clock_in">Clock In</option>
                    <option value="clock_out">Clock Out</option>
                    <option value="break">Break</option>
                    <option value="lunch">Lunch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time From
                  </label>
                  <input
                    type="time"
                    value={filters.timeFrom}
                    onChange={e => setFilters(prev => ({ ...prev, timeFrom: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time To
                  </label>
                  <input
                    type="time"
                    value={filters.timeTo}
                    onChange={e => setFilters(prev => ({ ...prev, timeTo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing {filteredEntries.length} of {timeEntries.length} entries
                </p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Clear Filters
                </button>
              </div>
            </div>
            
            {/* Entries Table */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium">Time Entries</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEntries.slice(0, 50).map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {entry.staffId.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center">
                            {getActionIcon(entry.action)}
                            <span className="ml-2 text-sm">{entry.action.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedEntry(entry);
                                setEditEntryData({
                                  id: entry.id,
                                  staffId: entry.staffId,
                                  action: entry.action,
                                  date: entry.date,
                                  timestamp: new Date(entry.timestamp).toISOString().slice(11, 16)
                                });
                                setShowEditEntryModal(true);
                              }}
                              className="px-3 py-1 bg-blue-100 border border-blue-500 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="px-3 py-1 bg-red-100 border border-red-500 text-red-700 rounded hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'reports' && selectedStaff && staffReport && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">
                {staffList.find(s => s.id === selectedStaff)?.name || selectedStaff} Report
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="text-sm font-medium text-gray-500">Total Hours</h3>
                  <p className="text-2xl font-bold text-blue-600">{formatHours(parseFloat(staffReport.totalHours))}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="text-sm font-medium text-gray-500">Breaks Taken</h3>
                  <p className="text-2xl font-bold text-yellow-600">{staffReport.breaksTaken}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="text-sm font-medium text-gray-500">Lunch Breaks</h3>
                  <p className="text-2xl font-bold text-purple-600">{staffReport.lunchBreaks}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded">
                  <h3 className="text-sm font-medium text-gray-500">Average Hours/Day</h3>
                  <p className="text-2xl font-bold text-green-600">{formatHours(parseFloat(staffReport.averageHours))}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Daily Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clock In
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Clock Out
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Breaks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(staffReport.dailyBreakdown || {}).map(([date, data]) => (
                      <tr key={date}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {data.clockIn ? new Date(data.clockIn).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {data.clockOut ? new Date(data.clockOut).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatHours(data.hours)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {data.breaks} ({data.lunch} lunch)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => exportToCSV(staffReport, `staff-report-${selectedStaff}.csv`)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export Report
              </button>
            </div>
          </div>
        )}
        
        {/* Edit Entry Modal */}
        <Modal
          isOpen={showEditEntryModal}
          onClose={() => setShowEditEntryModal(false)}
          title="Edit Time Entry"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Staff Member
              </label>
              <select
                value={editEntryData.staffId}
                onChange={e => setEditEntryData(prev => ({ ...prev, staffId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              >
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={editEntryData.action}
                onChange={e => setEditEntryData(prev => ({ ...prev, action: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="clock_in">Clock In</option>
                <option value="clock_out">Clock Out</option>
                <option value="break">Break</option>
                <option value="lunch">Lunch</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={editEntryData.date}
                onChange={e => setEditEntryData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <input
                type="time"
                value={editEntryData.timestamp}
                onChange={e => setEditEntryData(prev => ({ ...prev, timestamp: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditEntryModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditEntry}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
        
        {/* Add Staff Modal */}
        <Modal
          isOpen={showAddStaffModal}
          onClose={() => setShowAddStaffModal(false)}
          title="Add New Staff Member"
        >
          <AddStaffForm />
        </Modal>
        
        {/* Clock In/Out Modal */}
        <Modal
          isOpen={showClockModal}
          onClose={() => setShowClockModal(false)}
          title="Record Time Action"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Staff Member
              </label>
              <select
                value={clockActionData.staffId}
                onChange={e => setClockActionData(prev => ({ ...prev, staffId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select staff member</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setClockActionData(prev => ({ ...prev, action: 'clock_in' }))}
                  className={`py-2 px-4 rounded-md flex items-center justify-center ${
                    clockActionData.action === 'clock_in'
                      ? 'bg-green-100 border-2 border-green-500 text-green-700'
                      : 'bg-white border border-gray-300 text-gray-700'
                  }`}
                >
                  🟢 Clock In
                </button>
                <button
                  type="button"
                  onClick={() => setClockActionData(prev => ({ ...prev, action: 'clock_out' }))}
                  className={`py-2 px-4 rounded-md flex items-center justify-center ${
                    clockActionData.action === 'clock_out'
                      ? 'bg-red-100 border-2 border-red-500 text-red-700'
                      : 'bg-white border border-gray-300 text-gray-700'
                  }`}
                >
                  🔴 Clock Out
                </button>
                <button
                  type="button"
                  onClick={() => setClockActionData(prev => ({ ...prev, action: 'break' }))}
                  className={`py-2 px-4 rounded-md flex items-center justify-center ${
                    clockActionData.action === 'break'
                      ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-700'
                      : 'bg-white border border-gray-300 text-gray-700'
                  }`}
                >
                  🟡 Break
                </button>
                <button
                  type="button"
                  onClick={() => setClockActionData(prev => ({ ...prev, action: 'lunch' }))}
                  className={`py-2 px-4 rounded-md flex items-center justify-center ${
                    clockActionData.action === 'lunch'
                      ? 'bg-blue-100 border-2 border-blue-500 text-blue-700'
                      : 'bg-white border border-gray-300 text-gray-700'
                  }`}
                >
                  🔵 Lunch
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mt-4">
                Current time: {new Date().toLocaleTimeString()}
              </p>
              <p className="text-sm text-gray-500">
                Current date: {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowClockModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClockAction}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Record {clockActionData.action?.replace('_', ' ')}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default EnhancedAdminDashboard;