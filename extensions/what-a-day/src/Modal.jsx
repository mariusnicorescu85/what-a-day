import React, { useState, useEffect } from 'react'
import { 
  Text, 
  Button, 
  Navigator, 
  Screen, 
  ScrollView,
  reactExtension 
} from '@shopify/ui-extensions-react/point-of-sale'

// Constants for actions
const ACTIONS = {
  CLOCK_IN: 'clock_in',
  CLOCK_OUT: 'clock_out',
  BREAK: 'break',
  LUNCH: 'lunch'
}

// Use your current development URL
const APP_URL = 'https://what-a-day-pos-4c4447aa66ac.herokuapp.com';

// Test connection function
const testConnection = async () => {
  try {
    console.log('Testing connection to:', `${APP_URL}/api/test`);
    const response = await fetch(`${APP_URL}/api/test`);
    console.log('Test response status:', response.status);
    const data = await response.json();
    console.log('Test response data:', data);
    return data;
  } catch (error) {
    console.error('Test connection error:', error);
    return { success: false, error: error.toString() };
  }
};

// Enhanced timeTrackingService with better error handling
const timeTrackingService = {
  async recordClockEvent(staffId, action) {
    const url = `${APP_URL}/api/time-tracking/clock`;
    console.log('=== Starting Clock Event Request ===');
    console.log('URL:', url);
    console.log('Method: POST');
    console.log('Payload:', JSON.stringify({ staffId, action }));
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ staffId, action })
      });
      
      console.log('Response received');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        let errorText = 'Unknown error';
        try {
          errorText = await response.text();
          console.log('Error response body:', errorText);
        } catch (e) {
          console.error('Could not read error response:', e);
        }
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText} - ${errorText}` 
        };
      }
      
      const result = await response.json();
      console.log('Success response:', result);
      
      return result;
    } catch (error) {
      console.error('=== Fetch Error ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      
      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { 
          success: false, 
          error: `Network error: ${error.message}. Check if the URL is correct and accessible.` 
        };
      }
      
      return { 
        success: false, 
        error: `${error.name}: ${error.message}` 
      };
    }
  },
  
  async getLastClockAction(staffId) {
    const url = `${APP_URL}/api/time-tracking/status/${staffId}`;
    console.log('=== Getting Last Clock Action ===');
    console.log('URL:', url);
    
    try {
      const response = await fetch(url);
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Error response:', text);
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      const result = await response.json();
      console.log('Status response:', result);
      
      return result;
    } catch (error) {
      console.error('Status fetch error:', error);
      return { 
        success: false, 
        error: `Network error: ${error.message}` 
      };
    }
  }
};

const TimeTrackingModal = () => {
  const [lastAction, setLastAction] = useState('clock_out')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [debugMessage, setDebugMessage] = useState('')
  const [staffId] = useState('john_doe')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  
  const getCurrentTime = () => {
    const now = new Date()
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getCurrentDate = () => {
    const now = new Date()
    return now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
  }
  
  const [currentTime, setCurrentTime] = useState(getCurrentTime())
  const [currentDate, setCurrentDate] = useState(getCurrentDate())
  
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(getCurrentTime())
      setCurrentDate(getCurrentDate())
    }
    
    updateTime()
    const timerId = setInterval(updateTime, 60000)
    
    return () => clearInterval(timerId)
  }, [])
  
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        
        // Test connection first
        setDebugMessage('Testing connection...')
        const testResult = await testConnection()
        
        if (!testResult.success) {
          setDebugMessage(`Connection test failed: ${testResult.error}`)
          return
        }
        
        setDebugMessage('Connection OK, loading status...')
        
        const result = await timeTrackingService.getLastClockAction(staffId)
        if (result.success) {
          setLastAction(result.action)
          setDebugMessage('')
        } else {
          setDebugMessage(`Status error: ${result.error}`)
        }
      } catch (e) {
        console.error('Error loading initial data:', e)
        setDebugMessage(`Init error: ${e.toString()}`)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadInitialData()
  }, [staffId])
  
  const handleClockAction = async (action) => {
    if (action === ACTIONS.CLOCK_OUT && !showConfirmation) {
      setShowConfirmation(true)
      setPendingAction(action)
      return
    }
    
    if (showConfirmation) {
      setShowConfirmation(false)
      setPendingAction(null)
    }
    
    if (lastAction === action) {
      setStatusMessage(`You are already ${action.replace('_', ' ')}!`)
      setTimeout(() => setStatusMessage(''), 3000)
      return
    }
    
    setIsLoading(true)
    setStatusMessage('')
    setDebugMessage('Sending request...')
   
    try {
      const result = await timeTrackingService.recordClockEvent(staffId, action)
      
      if (result.success) {
        setLastAction(action)
        setDebugMessage('')
        
        let message = ''
        switch(action) {
          case ACTIONS.CLOCK_IN:
            message = `✅ Successfully clocked in at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            break
          case ACTIONS.CLOCK_OUT:
            message = `🏁 You have clocked out. Have a great day!`
            break
          case ACTIONS.BREAK:
            message = `⏸️ Break started. Remember to clock back in when you return.`
            break
          case ACTIONS.LUNCH:
            message = `🍽️ Enjoy your lunch! Don't forget to clock back in afterward.`
            break
          default:
            message = `Successfully ${action.replace('_', ' ')}!`
        }
        
        setStatusMessage(message)
        setTimeout(() => setStatusMessage(''), 5000)
      } else {
        setStatusMessage(`❌ Failed to ${action.replace('_', ' ')}. ${result.error}`)
        setDebugMessage(`Error details: ${result.error}`)
      }
    } catch (error) {
      setStatusMessage('❌ Error occurred. Please check your connection.')
      setDebugMessage(`Exception: ${error.toString()}`)
      console.error(`${action} error:`, error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const cancelClockOut = () => {
    setShowConfirmation(false)
    setPendingAction(null)
  }

  const handleClockIn = () => handleClockAction(ACTIONS.CLOCK_IN)
  const handleClockOut = () => handleClockAction(ACTIONS.CLOCK_OUT)
  const handleBreak = () => handleClockAction(ACTIONS.BREAK)
  const handleLunch = () => handleClockAction(ACTIONS.LUNCH)
  
  const getStatusText = () => {
    switch(lastAction) {
      case 'clock_in':
        return 'Clocked in'
      case 'clock_out':
        return 'Clocked out'
      case 'break':
        return 'On break'
      case 'lunch':
        return 'At lunch'
      default:
        return 'Unknown'
    }
  }
  
  const getStatusEmoji = () => {
    switch(lastAction) {
      case 'clock_in':
        return '✅ '
      case 'clock_out':
        return '🏁 '
      case 'break':
        return '⏸️ '
      case 'lunch':
        return '🍽️ '
      default:
        return '❓ '
    }
  }
  
  const handleTestConnection = async () => {
    setDebugMessage('Testing connection...')
    const result = await testConnection()
    if (result.success) {
      setDebugMessage(`Connection OK: ${result.message}`)
    } else {
      setDebugMessage(`Connection failed: ${result.error}`)
    }
  }
  
  return (
    <Navigator>
      <Screen title="Staff Time Tracking" name="TimeTracking">
        <ScrollView>
          <Text size="extraLarge" alignment="center">{currentTime}</Text>
          <Text alignment="center" appearance="subdued">{currentDate}</Text>
          <Text> </Text>
          <Text> </Text>
          
          <Text appearance="subdued">STAFF INFORMATION</Text>
          <Text size="medium">👤 {staffId}</Text>
          <Text> </Text>
          
          <Text appearance="subdued">CURRENT STATUS</Text>
          <Text size="large" appearance={
            lastAction === 'clock_in' ? 'success' :
            lastAction === 'break' || lastAction === 'lunch' ? 'warning' : 'subdued'
          }>
            {getStatusEmoji()}{getStatusText()}
          </Text>
          <Text> </Text>
          <Text> </Text>
          
          {statusMessage && (
            <>
              <Text appearance={
                statusMessage.includes('Successfully') || 
                statusMessage.includes('clocked out') || 
                statusMessage.includes('Break started') || 
                statusMessage.includes('Enjoy your lunch') 
                ? 'success' : 'critical'
              } size="medium">
                {statusMessage}
              </Text>
              <Text> </Text>
              <Text> </Text>
            </>
          )}
          
          {debugMessage && (
            <>
              <Text appearance="subdued" size="small">DEBUG INFO:</Text>
              <Text appearance="warning" size="small" wrap>
                {debugMessage}
              </Text>
              <Text appearance="subdued" size="small">
                URL: {APP_URL}
              </Text>
              <Text> </Text>
            </>
          )}
          
          {showConfirmation && (
            <>
              <Text appearance="critical" size="medium" alignment="center">
                ⚠️ Are you sure you want to clock out?
              </Text>
              <Text> </Text>
              
              <Button 
                title="✅  Yes, Clock Out"
                onPress={() => handleClockAction(ACTIONS.CLOCK_OUT)}
                primary
              />
              <Text> </Text>
              
              <Button 
                title="❌  Cancel"
                onPress={cancelClockOut}
              />
              <Text> </Text>
              <Text> </Text>
            </>
          )}
          
          {!showConfirmation && (
            <>
              <Text appearance="subdued">ACTIONS</Text>
              <Text> </Text>
              
              <Button 
                title="⏰  Clock In"
                onPress={handleClockIn}
                disabled={isLoading || lastAction === 'clock_in'}
                primary
                loading={isLoading && pendingAction === 'clock_in'}
              />
              <Text> </Text>
              
              <Button 
                title="🔚  Clock Out"
                onPress={handleClockOut}
                disabled={isLoading || lastAction === 'clock_out'}
                loading={isLoading && pendingAction === 'clock_out'}
              />
              <Text> </Text>
              
              <Button 
                title="🛑  Take Break"
                onPress={handleBreak}
                disabled={isLoading || lastAction === 'break' || lastAction === 'clock_out' || lastAction !== 'clock_in'}
                loading={isLoading && pendingAction === 'break'}
              />
              <Text> </Text>
              
              <Button 
                title="🍴  Lunch Break"
                onPress={handleLunch}
                disabled={isLoading || lastAction === 'lunch' || lastAction === 'clock_out' || lastAction !== 'clock_in'}
                loading={isLoading && pendingAction === 'lunch'}
              />
              <Text> </Text>
              <Text> </Text>
              
              <Button 
                title="🔧  Test Connection"
                onPress={handleTestConnection}
                disabled={isLoading}
              />
            </>
          )}
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension(
  'pos.home.modal.render',
  () => <TimeTrackingModal />,
)