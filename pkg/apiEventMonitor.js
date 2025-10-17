// "execution_cached" event looks like a good place to validate the event was submitted.

/**
 * ComfyUI API Event Monitor
 * Copy and paste this into browser console to observe all API events
 */
const ComfyApiMonitor = (() => {
  // List of known ComfyUI API events to monitor
  const knownEvents = [
    'status', 'execution_start', 'executing', 'progress',
    'executed', 'execution_error', 'execution_cached',
    'prompt', 'queue_updated', 'reconnecting', 'reconnected',
    'download', 'workflow_loaded'
  ];

  // Storage for our event listeners so we can remove them later
  const listeners = new Map();
  let isMonitoring = false;
  let eventFilter = null;

  // Format event data for cleaner console output
  const formatEventData = (detail) => {
    if (!detail) return 'No details';

    // Create a clean copy to avoid circular references in console
    const cleanDetail = {};
    Object.keys(detail).forEach(key => {
      // Skip large objects like full prompt data for cleaner output
      if (key === 'output' || key === 'prompt') {
        cleanDetail[key] = '[Large Object - See full event]';
      } else {
        cleanDetail[key] = detail[key];
      }
    });

    return cleanDetail;
  };

  // Handler function that logs events
  const eventHandler = (eventName) => (event) => {
    // Skip if we have a filter and this event doesn't match
    if (eventFilter && eventName !== eventFilter) return;

    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.group(`%c${timestamp} - ComfyAPI Event: ${eventName}`, 'color: #2c7fb8; font-weight: bold');
    console.log('Details:', formatEventData(event.detail));
    console.log('Full Event:', event);
    console.groupEnd();
  };

  return {
    // Start monitoring API events
    start: (specificEvent = null) => {
      if (isMonitoring) {
        console.log('Already monitoring API events. Call stop() first to restart.');
        return;
      }

      eventFilter = specificEvent;

      // Register listeners for all known events
      knownEvents.forEach(eventName => {
        const handler = eventHandler(eventName);
        comfyAPI.api.api.addEventListener(eventName, handler);
        listeners.set(eventName, handler);
      });

      isMonitoring = true;
      console.log(`%cAPI Event Monitor started${eventFilter ? ` (filtering for: ${eventFilter})` : ''}`,
                 'color: green; font-weight: bold');
    },

    // Stop monitoring API events
    stop: () => {
      if (!isMonitoring) {
        console.log('Not currently monitoring API events.');
        return;
      }

      // Remove all registered listeners
      listeners.forEach((handler, eventName) => {
        api.removeEventListener(eventName, handler);
      });

      listeners.clear();
      isMonitoring = false;
      eventFilter = null;
      console.log('%cAPI Event Monitor stopped', 'color: orange; font-weight: bold');
    },

    // Filter for a specific event
    filter: (eventName) => {
      if (!isMonitoring) {
        console.log('Start monitoring first with start()');
        return;
      }

      eventFilter = eventName;
      console.log(`%cNow filtering for event: ${eventName || 'None (showing all)'}`, 'color: purple');
    },

    // Show available events
    showEvents: () => {
      console.log('Available events to monitor:', knownEvents);
    }
  };
})();

// Instructions for usage
console.log(`
%cComfyUI API Event Monitor
%c
Usage:
- ComfyApiMonitor.start()      - Start monitoring all events
- ComfyApiMonitor.start("progress") - Monitor only "progress" events
- ComfyApiMonitor.stop()       - Stop monitoring
- ComfyApiMonitor.filter("executing") - Filter for specific event
- ComfyApiMonitor.filter(null) - Show all events again
- ComfyApiMonitor.showEvents() - List available events
`,
'color: #4CAF50; font-size: 14px; font-weight: bold',
'color: #555; font-size: 12px');

// Auto-start if you want (comment this out if you prefer manual start)
ComfyApiMonitor.start();
