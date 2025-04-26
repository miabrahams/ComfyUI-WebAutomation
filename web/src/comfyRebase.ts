import { ComfyApp, ComfyApi, ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { LGraphEventMode, LiteGraph, LGraphNode } from '@comfyorg/litegraph'; // Import LGraphNode

import { DropModal } from './dropModal';
import { EvalBrowser } from './evalBrowser'

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

  dropModal: DropModal;
  evalBrowser: EvalBrowser

  constructor() {
    // Update log message if desired
    console.log("Initializing ComfyRebase (Value Copy/Paste + Diff)");
    this.dropModal = new DropModal(this)
    this.evalBrowser = new EvalBrowser()
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

  // replace old openEvalBrowser
  openEvalBrowser() {
    this.evalBrowser.openModal()
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
      action: () => { rebased.dropModal.openImageDropModal() },
    });

    // New: Browse Images button (uses openEvalBrowser)
    const browseButton = new ComfyButton({
      tooltip: 'Browse Images',
      app,
      enabled: true,
      content: $el('div', '📁'),
      classList: 'comfyui-button primary',
      action: () => { rebased.openEvalBrowser() },
    })

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
