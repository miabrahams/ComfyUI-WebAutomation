import { ComfyApp, ComfyApi, ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { LGraphEventMode, LiteGraph, LGraphNode } from '@comfyorg/litegraph'; // Import LGraphNode

// --- Define structure for ComfyUI's global API ---
// Based on observations from index.js and common ComfyUI patterns
// These might need adjustments based on the actual ComfyUI version/API
declare global {
  interface Window {
    comfyAPI: {
      app: { app: ComfyApp }; // Assuming app instance is nested here
      ui: { $el: (tag: string, ...args: any[]) => HTMLElement }; // Basic type for $el
      button: { ComfyButton: new (options: any) => any }; // Basic constructor type
      buttonGroup: { ComfyButtonGroup: new (...buttons: any[]) => any }; // Basic constructor type
    };
    LiteGraph: typeof LiteGraph; // Make LiteGraph globally accessible if needed elsewhere
  }
}

// Access core objects via the global API
const app = window.comfyAPI.app.app;
const $el = window.comfyAPI.ui.$el;
const ComfyButton = window.comfyAPI.button.ComfyButton;
const ComfyButtonGroup = window.comfyAPI.buttonGroup.ComfyButtonGroup;
const LiteGraphInstance = window.LiteGraph;

// Interface for storing node data
interface NodeData {
  type: string;
  values: Map<string, any>;
  mode: LGraphEventMode;
}

// Interface for storing diff data per node
interface DiffNodeData {
  [widgetNameOrMode: string]: {
    old: any;
    new: any;
  };
}

class ComfyRebase {
  // Restore original state variable
  storedNodeData: Record<string, NodeData> = {};
  // Add diffData state
  diffData: Record<string, DiffNodeData> = {};
  dropModal: HTMLElement | undefined;

  constructor() {
    // Update log message if desired
    console.log("Initializing ComfyRebase (Value Copy/Paste + Diff)");
  }

  // Reimplement copyNodeValues based on original JS
  copyNodeValues() {
    const graph = app.graph;
    this.storedNodeData = {};

    graph._nodes.forEach((node) => {
      // Ensure widgets exist and node has an id
      if (!node.widgets || typeof node.id === 'undefined') return;

      // Store widget values if they exist
      const widgetValues = new Map<string, any>();
      if (node.widgets) {
        node.widgets.forEach((widget) => {
          // Ensure widget has a name before storing
          if (widget.name) {
            widgetValues.set(widget.name, widget.value);
          }
        });
      }

      this.storedNodeData[node.id] = {
        type: node.type,
        values: widgetValues,
        mode: node.mode,
      };
    });
    console.log('Node values copied:', this.storedNodeData);
    // Clear diff data when copying new values
    this.diffData = {};
    console.log('Diff data cleared.');
  }

  // Reimplement pasteNodeValues based on original JS
  pasteNodeValues() {
    const graph = app.graph;
    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return; // Skip nodes without ID

      const storedData = this.storedNodeData[node.id];

      if (
        node.widgets && // Check if node has widgets
        storedData &&
        storedData.type === node.type // Ensure node type matches
      ) {
        console.log('Pasting node id', node.id);
        for (const widget of node.widgets) {
          // Ensure widget has a name before attempting to paste
          if (widget.name && storedData.values.has(widget.name)) {
            const value = storedData.values.get(widget.name);
            // Avoid pasting undefined/null if not intended, though original code allowed it
            widget.value = value;
          } else if (widget.name) {
            console.log('No stored value for ', node.id, widget.name);
          }
        }
        // Restore mode
        if (typeof storedData.mode !== 'undefined') {
            node.mode = storedData.mode;
        }
      }
    });
    // Trigger redraw or update if necessary
    app.graph.setDirtyCanvas(true, true);
  }

  // Add diffNodeValues based on comfyRebase_orig.js
  diffNodeValues() {
    console.log("Calculating diff (widget/mode based)");
    const graph = app.graph;
    this.diffData = {}; // Clear previous diff

    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return; // Skip nodes without ID

      const storedData = this.storedNodeData[node.id];
      // Check if we have stored data for this node and it has widgets
      if (!node.widgets || !storedData) return;

      // Ensure type matches before diffing
      if (storedData.type !== node.type) {
          console.log(`Node ${node.id} type mismatch, skipping diff.`);
          return;
      }

      const storedValues = storedData.values;
      const currentValues = new Map<string, any>();
      node.widgets.forEach(widget => {
          if (widget.name) {
              currentValues.set(widget.name, widget.value);
          }
      });

      const nodeDiff: DiffNodeData = {};

      // Diff widget values
      for (const [name, currentValue] of currentValues.entries()) {
        if (storedValues.has(name)) {
          const storedValue = storedValues.get(name);
          // Basic comparison, might need deep comparison for objects/arrays
          if (JSON.stringify(storedValue) !== JSON.stringify(currentValue)) {
            console.log('Found value diff for', node.id, name);
            nodeDiff[name] = { old: storedValue, new: currentValue };
          }
        }
        // Note: This doesn't capture widgets added/removed, only changed values
      }

      // Diff mode
      if (node.mode !== storedData.mode) {
        console.log('Found mode diff for', node.id);
        nodeDiff["_MODE"] = { old: storedData.mode, new: node.mode };
      }

      if (Object.keys(nodeDiff).length > 0) {
        this.diffData[node.id] = nodeDiff;
      }
    });

    if (Object.keys(this.diffData).length > 0) {
        console.log("Diff calculated", this.diffData);
    } else {
        console.log("No differences found.");
        // TODO: Look up alert in ComfyUI API
    }
  }

  // Add applyDiff based on comfyRebase_orig.js
  applyDiff() {
    console.log("Applying diff (widget/mode based)");
    if (Object.keys(this.diffData).length === 0) {
        console.warn("No diff data to apply.");
        // TODO: Look up alert in ComfyUI API
        // alert("No diff data to apply. Use 'Diff' first.");
        return;
    }

    const graph = app.graph;
    let changesApplied = false;

    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return; // Skip nodes without ID

      const nodeDiffData = this.diffData[node.id];
      if (!nodeDiffData) return; // No diff for this node

      if (node.widgets) {
          for (const widget of node.widgets) {
            if (widget.name && nodeDiffData[widget.name]) {
              console.log('Applying value diff to', node.id, widget.name);
              widget.value = nodeDiffData[widget.name].new;
              changesApplied = true;
            }
          }
      }

      if (nodeDiffData["_MODE"]) {
        console.log('Applying mode diff to', node.id);
        node.mode = nodeDiffData["_MODE"].new;
        changesApplied = true;
      }
    });

    if (changesApplied) {
        console.log("Diff applied.");
        app.graph.setDirtyCanvas(true, true); // Redraw graph
    } else {
        console.log("Diff data existed, but no matching nodes/widgets found to apply changes.");
    }
    // Optional: Clear diff after applying?
    // this.diffData = {};
  }

  // Reimplement openImageDropModal (can copy from previous version)
  openImageDropModal() {
    // Remove existing modal if it exists
    if (this.dropModal) {
      document.body.removeChild(this.dropModal);
    }

    // Create modal container
    this.dropModal = document.createElement('div');
    this.dropModal.style.position = 'fixed';
    this.dropModal.style.top = '0';
    this.dropModal.style.left = '0';
    this.dropModal.style.width = '100%';
    this.dropModal.style.height = '100%';
    this.dropModal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    this.dropModal.style.zIndex = '1000';
    this.dropModal.style.display = 'flex';
    this.dropModal.style.flexDirection = 'column';
    this.dropModal.style.alignItems = 'center';
    this.dropModal.style.justifyContent = 'center';

    // Create drop target
    const dropTarget = document.createElement('div');
    dropTarget.style.width = '80%';
    dropTarget.style.height = '60%';
    dropTarget.style.backgroundColor = 'rgba(30,30,30,0.7)';
    dropTarget.style.border = '3px dashed #888';
    dropTarget.style.borderRadius = '10px';
    dropTarget.style.display = 'flex';
    dropTarget.style.alignItems = 'center';
    dropTarget.style.justifyContent = 'center';
    dropTarget.style.color = 'white';
    dropTarget.style.fontSize = '24px';
    dropTarget.innerHTML = '<div>Drop image here</div>';

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.marginTop = '20px';
    closeButton.style.padding = '8px 16px';
    closeButton.style.fontSize = '16px';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
      if (this.dropModal) {
        document.body.removeChild(this.dropModal);
        this.dropModal = undefined;
      }
    });

    // Setup drag and drop events
    dropTarget.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropTarget.style.backgroundColor = 'rgba(50,50,50,0.9)';
      dropTarget.style.border = '3px dashed #aaa';
    });

    dropTarget.addEventListener('dragleave', () => {
      dropTarget.style.backgroundColor = 'rgba(30,30,30,0.7)';
      dropTarget.style.border = '3px dashed #888';
    });

    dropTarget.addEventListener('drop', (e) => {
      e.preventDefault();
      dropTarget.style.backgroundColor = 'rgba(30,30,30,0.7)';
      dropTarget.style.border = '3px dashed #888';

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];

        // Check if it's an image
        if (file.type.startsWith('image/')) {
          this.handleImageDrop(file);
        } else {
          // alert('Please drop an image file');
          console.error('Dropped file is not an image:', file.type);
        }
      }
    });

    // Add all elements
    this.dropModal.appendChild(dropTarget);
    this.dropModal.appendChild(closeButton);
    document.body.appendChild(this.dropModal);
  }

  // Reimplement handleImageDrop without applyDiff
  async handleImageDrop(file: File) {
    console.log('Loading image:', file.name);

    try {
      // Close the modal
      if (this.dropModal) {
        document.body.removeChild(this.dropModal);
        this.dropModal = undefined;
      }

      // Create an image node in the graph using LiteGraphInstance
      const imageNode = LiteGraphInstance.createNode("LoadImage");
      app.graph.add(imageNode);

      // Position the node in a visible area
      imageNode.pos = [window.innerWidth / 3, window.innerHeight / 3];

      // Upload the image to ComfyUI and set it in the node
      const formData = new FormData();
      formData.append('image', file);
      formData.append('overwrite', 'true');

      const response = await fetch('/upload/image', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // Set the image name in the first widget of the LoadImage node
        if (imageNode.widgets && imageNode.widgets.length > 0) {
          imageNode.widgets[0].value = data.name || file.name;
          console.log('Image loaded successfully');

          // *** ADDED applyDiff CALL ***
          if (Object.keys(this.diffData).length > 0) {
            console.log("Applying stored diff after image load...");
            this.applyDiff(); // Apply the widget/mode diff
          } else {
            console.log('No diff to apply');
          }

          // Wait and queue prompts
          await new Promise((resolve) => setTimeout(resolve, 1000));
          for (let i = 0; i < 3; i++) {
            console.log("Queueing prompt", i);
            await app.queuePrompt(-1, 1);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      } else {
        console.error('Failed to upload image:', response.statusText);
        alert('Failed to upload image');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image: ' + (error as Error).message);
    }
  }

  async openImageBrowser() {
    try {
      const res = await fetch('/rebase/data/folders');
      const data = await res.json();
      console.log('Available folders:', data.folders);
    } catch(e) {
      console.error('Failed to load folders', e);
    }
  }
}

const extension: ComfyExtension = {
  name: 'ComfyUI.Rebase',
  init() {},
  async setup() {
    const rebased = new ComfyRebase();
    // Copy Button
    const copyButton = new ComfyButton({
      tooltip: 'Copy Node Values',
      app,
      enabled: true,
      content: $el("div", "C"),
      classList: 'comfyui-button primary',
      action: () => { rebased.copyNodeValues() },
    });

    // Paste Button
    const pasteButton = new ComfyButton({
      tooltip: 'Paste Node Values',
      app,
      enabled: true,
      content: $el("div", "P"),
      classList: 'comfyui-button primary',
      action: () => { rebased.pasteNodeValues() },
    });

    // Add Diff button back
    const diffButton = new ComfyButton({
      tooltip: 'Diff Current vs Copied Values', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "D"),
      classList: 'comfyui-button primary',
      action: () => { rebased.diffNodeValues() }, // Connect to new method
    });

    // Add Apply Diff button back
    const applyDiffButton = new ComfyButton({
      tooltip: 'Apply Value/Mode Diff', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "A"), // 'A' for Apply
      classList: 'comfyui-button primary',
      action: () => { rebased.applyDiff() }, // Connect to new method
    });

    // Drop Image Button
    const dropImageButton = new ComfyButton({
      tooltip: 'Drop Image, Apply Diff & Queue', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "🖼️"),
      classList: 'comfyui-button primary',
      action: () => { rebased.openImageDropModal() },
    });

    // New: Browse Images button
    const browseButton = new ComfyButton({
      tooltip: 'Browse Images',
      app,
      enabled: true,
      content: $el("div","📁"),
      classList: 'comfyui-button primary',
      action: () => { rebased.openImageBrowser() },
    });

    // Update ButtonGroup to include all buttons
    const copyPasteButtons = new ComfyButtonGroup(
      copyButton,
      pasteButton,
      diffButton,       // Added back
      applyDiffButton,  // Added back
      dropImageButton
    );

    app.menu.element.appendChild(copyPasteButtons.element);
    app.menu.element.appendChild(browseButton.element);
  },
};

app.registerExtension(extension);
