import React, { useState, useEffect } from 'react'
import { 
  Text, 
  Screen, 
  ScrollView, 
  Navigator, 
  reactExtension, 
  Button
} from '@shopify/ui-extensions-react/point-of-sale'

const Modal = () => {
  const [lastAction, setLastAction] = useState('clock_out')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // Load last action when component mounts
  useEffect(() => {
    try {
      const savedAction = window.localStorage?.getItem('lastClockAction')
      if (savedAction) {
        setLastAction(savedAction)
      }
    } catch (e) {
      // Local storage might not be available in all contexts
      console.warn('Could not access localStorage:', e)
    }
  }, [])

  const toggleClock = async () => {
    const newAction = lastAction === 'clock_in' ? 'clock_out' : 'clock_in'
    setIsLoading(true)
    setStatusMessage('')
    
    try {
      // Replace with your actual backend URL
      const response = await fetch('https://85e4-90-152-7-20.ngrok-free.app/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: 'john_doe', // Replace with real staff ID
          action: newAction,
        }),
      })
      
      if (response.ok) {
        setLastAction(newAction)
        try {
          window.localStorage?.setItem('lastClockAction', newAction)
        } catch (e) {
          console.warn('Could not save to localStorage:', e)
        }
        setStatusMessage(newAction === 'clock_in' ? 'Successfully clocked in!' : 'Successfully clocked out!')
      } else {
        setStatusMessage('Failed to record time. Please try again.')
      }
    } catch (error) {
      setStatusMessage('Network error. Please check your connection and try again.')
      console.error('Clock in/out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Navigator>
      <Screen name="ClockInOut" title="Staff Time Tracking">
        <ScrollView>
          <Text>Manage your work hours</Text>
          
          {statusMessage && (
            <Text>{statusMessage}</Text>
          )}
          
          {isLoading ? (
            <Text>Loading...</Text>
          ) : (
            <Button
              onPress={toggleClock}
            >
              {lastAction === 'clock_in' ? 'Clock Out' : 'Clock In'}
            </Button>
          )}
          
          <Text>
            Current status: {lastAction === 'clock_in' ? 'Clocked in' : 'Clocked out'}
          </Text>
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />)