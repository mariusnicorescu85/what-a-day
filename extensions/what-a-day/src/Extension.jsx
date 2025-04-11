import { reactExtension, Button, useStorageState } from '@shopify/ui-extensions-react/pos';

export default reactExtension('pos.tile.render', () => {
  const [lastAction, setLastAction] = useStorageState('lastAction', 'clock_out');

  const toggleClock = async () => {
    const newAction = lastAction === 'clock_in' ? 'clock_out' : 'clock_in';

    // Replace this with your actual backend call
    await fetch('https://85e4-90-152-7-20.ngrok-free.app/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffId: 'john_doe',  // Replace with real logic later
        action: newAction,
      }),
    });

    setLastAction(newAction);
  };

  return (
    <Button onPress={toggleClock}>
      {lastAction === 'clock_in' ? 'Clock Out' : 'Clock In'}
    </Button>
  );
});
