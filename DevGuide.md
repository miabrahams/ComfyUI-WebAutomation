

# Using React Components
You can mount React components in your application:

``` typescript
// Import React dependencies in your extension
import React from "react";
import ReactDOM from "react-dom/client";

// Simple React component
function TabContent() {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ padding: "10px" }}>
      <h3>React Component</h3>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

// Register the extension with React content
app.registerExtension({
  name: "ReactTabExample",
  bottomPanelTabs: [
    {
      id: "reactTab",
      title: "React Tab",
      type: "custom",
      render: (el) => {
        const container = document.createElement("div");
        container.id = "react-tab-container";
        el.appendChild(container);

        // Mount React component
        ReactDOM.createRoot(container).render(
          <React.StrictMode>
            <TabContent />
          </React.StrictMode>
        );
      }
    }
  ]
});
```

```typescript

  /**
   * Handles updates from the API socket
   */
  #addApiUpdateHandlers() {
    api.addEventListener('status', ({ detail }) => {
      this.ui.setStatus(detail)
    })

    api.addEventListener('progress', () => {
      this.graph.setDirtyCanvas(true, false)
    })

    api.addEventListener('executing', () => {
      this.graph.setDirtyCanvas(true, false)
    })

    api.addEventListener('executed', ({ detail }) => {
      const nodeOutputStore = useNodeOutputStore()
      const executionId = String(detail.display_node || detail.node)

      nodeOutputStore.setNodeOutputsByExecutionId(executionId, detail.output, {
        merge: detail.merge
      })

      const node = getNodeByExecutionId(this.graph, executionId)
      if (node && node.onExecuted) {
        node.onExecuted(detail.output)
      }
    })

    api.addEventListener('execution_start', () => {
      triggerCallbackOnAllNodes(this.graph, 'onExecutionStart')
    })

    api.addEventListener('execution_error', ({ detail }) => {
      // Check if this is an auth-related error or credits-related error
      if (
        detail.exception_message?.includes(
          'Unauthorized: Please login first to use this node.'
        )
      ) {
        useDialogService().showApiNodesSignInDialog([detail.node_type])
      } else if (
        detail.exception_message?.includes(
          'Payment Required: Please add credits to your account to use this node.'
        )
      ) {
        useDialogService().showTopUpCreditsDialog({
          isInsufficientCredits: true
        })
      } else {
        useDialogService().showExecutionErrorDialog(detail)
      }
      this.canvas.draw(true, true)
    })
```


# Sending from Python
``` python

# In ComfyUI
PromptServer:
    async def send_json(self, event, data, sid=None):
        message = {"type": event, "data": data}

        if sid is None:
            sockets = list(self.sockets.values())
            for ws in sockets:
                await send_socket_catch_exception(ws.send_json, message)
        elif sid in self.sockets:
            await send_socket_catch_exception(self.sockets[sid].send_json, message)


# In extension
import server
server.send_json(...)
```