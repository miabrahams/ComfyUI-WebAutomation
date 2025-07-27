/**
 * Demo code showing how to use the ComfyApi class for listening to websocket events
 * This file demonstrates various ways extensions can interact with the ComfyUI API
 */

import { api } from '@/scripts/api'
import type { NodeId } from '@/schemas/comfyWorkflowSchema'
import type { StatusWsMessageStatus, ProgressWsMessage } from '@/schemas/apiSchema'

// Example 1: Basic event listeners for workflow execution
export function setupBasicEventListeners() {
  // Listen for when execution starts
  api.addEventListener('execution_start', (event) => {
    console.log('Workflow execution started:', event.detail)

    // Show loading indicator
    const loadingEl = document.getElementById('loading-indicator')
    if (loadingEl) {
      loadingEl.style.display = 'block'
    }
  })

  // Listen for execution progress
  api.addEventListener('progress', (event) => {
    const progressData = event.detail
    console.log(`Progress: ${progressData.value}/${progressData.max}`)

    // Update progress bar
    const progressBar = document.getElementById('progress-bar') as HTMLProgressElement
    if (progressBar) {
      progressBar.value = progressData.value
      progressBar.max = progressData.max
    }
  })

  // Listen for when a specific node is executing
  api.addEventListener('executing', (event) => {
    const nodeId: NodeId = event.detail
    console.log('Currently executing node:', nodeId)

    // Highlight the executing node in the UI
    document.querySelectorAll('.node').forEach(node => {
      node.classList.remove('executing')
    })

    const executingNode = document.querySelector(`[data-node-id="${nodeId}"]`)
    if (executingNode) {
      executingNode.classList.add('executing')
    }
  })

  // Listen for when execution completes successfully
  api.addEventListener('execution_success', (event) => {
    console.log('Workflow completed successfully:', event.detail)

    // Hide loading indicator
    const loadingEl = document.getElementById('loading-indicator')
    if (loadingEl) {
      loadingEl.style.display = 'none'
    }

    // Show success notification
    showNotification('Workflow completed successfully!', 'success')
  })

  // Listen for execution errors
  api.addEventListener('execution_error', (event) => {
    console.error('Workflow execution failed:', event.detail)

    // Hide loading indicator
    const loadingEl = document.getElementById('loading-indicator')
    if (loadingEl) {
      loadingEl.style.display = 'none'
    }

    // Show error notification
    showNotification('Workflow execution failed', 'error')
  })
}

// Example 2: Advanced progress tracking with custom UI
export function setupAdvancedProgressTracking() {
  let currentExecutionId: string | null = null
  let startTime: number | null = null
  const nodeExecutionTimes: Record<string, { start: number; end?: number }> = {}

  api.addEventListener('execution_start', (event) => {
    currentExecutionId = event.detail.prompt_id
    startTime = Date.now()
    nodeExecutionTimes = {}

    console.log('Starting execution tracking for:', currentExecutionId)
    updateExecutionStatus('Running', 0)
  })

  api.addEventListener('executing', (event) => {
    const nodeId = event.detail
    const now = Date.now()

    // End timing for previous node
    Object.keys(nodeExecutionTimes).forEach(id => {
      if (!nodeExecutionTimes[id].end) {
        nodeExecutionTimes[id].end = now
      }
    })

    // Start timing for current node
    if (nodeId) {
      nodeExecutionTimes[nodeId] = { start: now }
      console.log(`Node ${nodeId} started executing`)
    }
  })

  api.addEventListener('progress', (event) => {
    const { value, max, node } = event.detail
    const percentage = max > 0 ? (value / max) * 100 : 0

    updateExecutionStatus('Running', percentage)

    if (node) {
      console.log(`Node ${node}: ${value}/${max} (${percentage.toFixed(1)}%)`)
    }
  })

  api.addEventListener('execution_success', (event) => {
    const endTime = Date.now()
    const totalTime = startTime ? endTime - startTime : 0

    console.log(`Execution completed in ${totalTime}ms`)
    console.log('Node execution times:', nodeExecutionTimes)

    updateExecutionStatus('Completed', 100)
    showExecutionSummary(totalTime, nodeExecutionTimes)
  })

  function updateExecutionStatus(status: string, progress: number) {
    const statusEl = document.getElementById('execution-status')
    const progressEl = document.getElementById('execution-progress')

    if (statusEl) statusEl.textContent = status
    if (progressEl) progressEl.style.width = `${progress}%`
  }

  function showExecutionSummary(totalTime: number, nodeTimes: Record<string, any>) {
    const summaryEl = document.getElementById('execution-summary')
    if (summaryEl) {
      summaryEl.innerHTML = `
        <h3>Execution Summary</h3>
        <p>Total time: ${totalTime}ms</p>
        <p>Nodes executed: ${Object.keys(nodeTimes).length}</p>
      `
    }
  }
}

// Example 3: Real-time image preview handling
export function setupImagePreviewHandling() {
  api.addEventListener('b_preview', (event) => {
    const imageBlob: Blob = event.detail

    // Create object URL for the image blob
    const imageUrl = URL.createObjectURL(imageBlob)

    // Update preview image
    const previewImg = document.getElementById('preview-image') as HTMLImageElement
    if (previewImg) {
      // Clean up previous object URL
      if (previewImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(previewImg.src)
      }

      previewImg.src = imageUrl
      previewImg.onload = () => {
        console.log('Preview image updated')
      }
    }

    // Store in preview history
    addToPreviewHistory(imageUrl)
  })

  function addToPreviewHistory(imageUrl: string) {
    const historyContainer = document.getElementById('preview-history')
    if (historyContainer) {
      const img = document.createElement('img')
      img.src = imageUrl
      img.className = 'preview-thumbnail'
      img.onclick = () => {
        const mainPreview = document.getElementById('preview-image') as HTMLImageElement
        if (mainPreview) {
          mainPreview.src = imageUrl
        }
      }

      historyContainer.appendChild(img)
    }
  }
}

// Example 4: Queue and status monitoring
export function setupQueueMonitoring() {
  api.addEventListener('status', (event) => {
    const status: StatusWsMessageStatus | null = event.detail

    if (status) {
      console.log('Queue status update:', status)
      updateQueueDisplay(status)
    } else {
      console.log('Connection lost')
      showConnectionStatus(false)
    }
  })

  api.addEventListener('promptQueued', (event) => {
    const { number, batchCount } = event.detail
    console.log(`Prompt queued at position ${number}, batch count: ${batchCount}`)

    showNotification(`Prompt queued at position ${number}`, 'info')
  })

  function updateQueueDisplay(status: StatusWsMessageStatus) {
    const queueInfoEl = document.getElementById('queue-info')
    if (queueInfoEl) {
      queueInfoEl.innerHTML = `
        <div>Queue Size: ${status.exec_info?.queue_remaining || 0}</div>
      `
    }
  }

  function showConnectionStatus(connected: boolean) {
    const statusEl = document.getElementById('connection-status')
    if (statusEl) {
      statusEl.textContent = connected ? 'Connected' : 'Disconnected'
      statusEl.className = connected ? 'status-connected' : 'status-disconnected'
    }
  }
}

// Example 5: Custom extension event handling
export function setupCustomExtensionEvents() {
  // Extensions can dispatch custom events that other extensions can listen to

  // Listen for custom events from other extensions
  api.addEventListener('custom_extension_event' as any, (event) => {
    console.log('Received custom extension event:', event.detail)
  })

  // Function to dispatch custom events (for extension developers)
  function dispatchCustomEvent(eventType: string, data: any) {
    // Note: This uses the internal dispatchEvent which is deprecated
    // Extensions should use the official event system or their own EventTarget
    const customEvent = new CustomEvent(eventType, { detail: data })
    api.dispatchEvent(customEvent as never)
  }

  // Example usage
  setTimeout(() => {
    dispatchCustomEvent('custom_extension_event', {
      message: 'Hello from custom extension!',
      timestamp: Date.now()
    })
  }, 5000)
}

// Example 6: Workflow change detection
export function setupWorkflowChangeTracking() {
  let lastWorkflowHash: string | null = null

  api.addEventListener('graphChanged', (event) => {
    const workflow = event.detail
    console.log('Workflow changed:', workflow)

    // Calculate a simple hash of the workflow
    const workflowString = JSON.stringify(workflow)
    const currentHash = simpleHash(workflowString)

    if (lastWorkflowHash && lastWorkflowHash !== currentHash) {
      console.log('Workflow structure changed')
      showNotification('Workflow modified', 'info')
    }

    lastWorkflowHash = currentHash

    // Save workflow to local storage for recovery
    localStorage.setItem('last_workflow', workflowString)
  })

  function simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }
}

// Example 7: Error handling and debugging
export function setupErrorHandling() {
  api.addEventListener('execution_error', (event) => {
    const errorData = event.detail

    // Create detailed error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      promptId: errorData.prompt_id,
      nodeErrors: errorData.node_errors,
      traceback: errorData.traceback,
      userAgent: navigator.userAgent
    }

    console.error('Detailed error report:', errorReport)

    // Show user-friendly error message
    showErrorDialog(errorData)

    // Optionally send error report to analytics
    // sendErrorReport(errorReport)
  })

  api.addEventListener('execution_interrupted', (event) => {
    console.log('Execution was interrupted:', event.detail)
    showNotification('Execution was cancelled', 'warning')
  })

  function showErrorDialog(errorData: any) {
    const errorDialog = document.getElementById('error-dialog')
    if (errorDialog) {
      const errorMessage = document.getElementById('error-message')
      if (errorMessage) {
        errorMessage.textContent = errorData.exception_message || 'An error occurred during execution'
      }
      errorDialog.style.display = 'block'
    }
  }
}

// Utility functions
function showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info') {
  // Simple notification implementation
  const notification = document.createElement('div')
  notification.className = `notification notification-${type}`
  notification.textContent = message

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.remove()
  }, 3000)
}

// Example 8: Complete setup function for a typical extension
export function setupComfyUIExtension() {
  console.log('Setting up ComfyUI extension...')

  // Initialize the API connection
  api.init()

  // Set up all event listeners
  setupBasicEventListeners()
  setupAdvancedProgressTracking()
  setupImagePreviewHandling()
  setupQueueMonitoring()
  setupWorkflowChangeTracking()
  setupErrorHandling()

  // Handle reconnection events
  api.addEventListener('reconnecting', () => {
    console.log('Attempting to reconnect to ComfyUI...')
    showNotification('Connection lost, reconnecting...', 'warning')
  })

  api.addEventListener('reconnected', () => {
    console.log('Reconnected to ComfyUI')
    showNotification('Reconnected successfully', 'success')
  })

  console.log('ComfyUI extension setup complete')
}

// Example usage in an extension
// setupComfyUIExtension()
