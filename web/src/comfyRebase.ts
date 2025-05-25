import { ComfyApp, ComfyApi, ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { LGraphEventMode, LiteGraph, LGraphNode } from '@comfyorg/litegraph'; // Import LGraphNode

import { DropModal } from './dropModal';
import { EvalBrowser } from './evalBrowser';
import { EvalRunner } from './evalRunner';
import { type Differ } from './types'

// --- Define structure for ComfyUI's global API ---
// May change over time
declare global {
  interface Window {
    comfyAPI: {
      app: { app: ComfyApp }; // App instance
      ui: { $el: (tag: string, ...args: any[]) => HTMLElement }; // helper to add element
      button: { ComfyButton: new (options: any) => any }; // helper to create Comfy styled button
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

class ComfyRebase implements Differ {
  storedNodeData: Map<string | number, NodeData> = new Map();
  diffData: Map<string | number, DiffNodeData> = new Map();

  dropModal: DropModal;
  evalBrowser: EvalBrowser;
  evalRunner: EvalRunner;

  constructor() {
    console.log("Initializing ComfyRebase");
    this.dropModal = new DropModal(this);
    this.evalRunner = new EvalRunner(this);
    this.evalBrowser = new EvalBrowser(this.evalRunner);
  }

  copyNodeValues() {
    const graph = app.graph;
    this.storedNodeData = new Map();

    graph._nodes.forEach((node) => {
      if (!node.widgets || typeof node.id === 'undefined') return;

      // Store widget values if they exist
      const widgetValues = new Map<string, any>();
      if (node.widgets) {
        node.widgets.forEach((widget) => {
          if (widget.name) {
            widgetValues.set(widget.name, widget.value);
          } else {
            console.warn('Widget without name found in node', node.id, widget);
          }
        });
      }

      this.storedNodeData.set(node.id, {
        type: node.type,
        values: widgetValues,
        mode: node.mode,
      });
    });
    console.log('Node values copied:', this.storedNodeData);
  }

  pasteNodeValues() {
    const graph = app.graph;
/*     this.storedNodeData.forEach((nodeData) => { */
    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return; // Skip nodes without ID

      const storedData = this.storedNodeData.get(node.id);

      if (
        node.widgets && // Check if node has widgets
        storedData &&
        storedData.type === node.type // Ensure node type matches
      ) {
        console.log('Pasting node id', node.id);
        for (const widget of node.widgets) {
          if (widget.name && storedData.values.has(widget.name)) {
            const value = storedData.values.get(widget.name);
            widget.value = value;
          } else if (widget.name) {
            console.log('No stored value for ', node.id, widget.name);
          }
        }
        if (typeof storedData.mode !== 'undefined') {
            node.mode = storedData.mode;
        }
      }
    });
    app.graph.setDirtyCanvas(true, true);
  }

  diffNodeValues() {
    console.log('Calculating diff (widget/mode based)');
    const graph = app.graph;
    this.diffData = new Map();

    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return; // Skip nodes without ID

      const storedData = this.storedNodeData.get(node.id);
      if (!node.widgets || !storedData) return;

      if (storedData.type !== node.type) {
        console.log(`Node ${node.id} type mismatch, skipping diff.`);
        return;
      }

      const storedValues = storedData.values;
      const currentValues = new Map<string, any>();
      node.widgets.forEach((widget) => {
        if (widget.name) {
          currentValues.set(widget.name, widget.value);
        }
      });

      const nodeDiff: DiffNodeData = {};

      // Diff widget values
      // Note: This doesn't capture widgets added/removed, only changed values
      for (const [name, currentValue] of currentValues.entries()) {
        if (storedValues.has(name)) {
          const storedValue = storedValues.get(name);
          if (JSON.stringify(storedValue) !== JSON.stringify(currentValue)) {
            console.log('Found value diff for', node.id, name);
            nodeDiff[name] = { old: storedValue, new: currentValue };
          }
        }
      }

      // Diff mode
      if (node.mode !== storedData.mode) {
        console.log('Found mode diff for', node.id);
        nodeDiff['_MODE'] = { old: storedData.mode, new: node.mode };
      }

      if (Object.keys(nodeDiff).length > 0) {
        this.diffData.set(node.id, nodeDiff);
      }
    });

    if (this.diffData.size > 0) {
      console.log('Diff calculated', this.diffData);
    } else {
      console.log('No differences found.');
      app.extensionManager.toast.add({
        severity: 'info',
        summary: 'No diff found',
        detail: 'Could not identify diff from saved',
        life: 3000,
      });
    }
  }

  applyDiff() {
    console.log("Applying diff (widget/mode based)");
    if (this.diffData.size === 0) {
        console.warn("No diff data to apply.");
        app.extensionManager.toast.add({
          severity: 'warn',
          summary: 'Apply failed',
          detail: 'No diff data to apply.',
          life: 3000,
        });
        return;
    }

    const graph = app.graph;
    let changesApplied = false;

    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return;

      const nodeDiffData = this.diffData.get(node.id);
      if (!nodeDiffData) return;

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
  }

  openEvalBrowser() {
    this.evalBrowser.openModal();
  }
}

let rebased: ComfyRebase;

const extension: ComfyExtension = {
  name: 'ComfyUI.Rebase',
  init() {},
  async setup() {
    rebased = new ComfyRebase();

    const copyButton = new ComfyButton({
      tooltip: 'Copy Node Values',
      app,
      enabled: true,
      content: $el("div", "C"),
      classList: 'comfyui-button primary',
      action: () => { rebased.copyNodeValues() },
    });

    const pasteButton = new ComfyButton({
      tooltip: 'Paste Node Values',
      app,
      enabled: true,
      content: $el("div", "P"),
      classList: 'comfyui-button primary',
      action: () => { rebased.pasteNodeValues() },
    });

    const diffButton = new ComfyButton({
      tooltip: 'Diff Current vs Copied Values',
      app,
      enabled: true,
      content: $el("div", "D"),
      classList: 'comfyui-button primary',
      action: () => { rebased.diffNodeValues() },
    });

    const applyDiffButton = new ComfyButton({
      tooltip: 'Apply Value/Mode Diff',
      app,
      enabled: true,
      content: $el("div", "A"),
      classList: 'comfyui-button primary',
      action: () => { rebased.applyDiff() },
    });

    const dropImageButton = new ComfyButton({
      tooltip: 'Drop Image, Apply Diff & Queue', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "🖼️"),
      classList: 'comfyui-button primary',
      action: () => { rebased.dropModal.openImageDropModal() },
    });

    const browseButton = new ComfyButton({
      tooltip: 'Browse Images',
      app,
      enabled: true,
      content: $el('div', '📁'),
      classList: 'comfyui-button primary',
      action: () => { rebased.openEvalBrowser() },
    })

    const rebaseButtons = new ComfyButtonGroup(
      copyButton,
      pasteButton,
      diffButton,
      applyDiffButton,
      dropImageButton
    );

    app.menu.element.appendChild(rebaseButtons.element);
    app.menu.element.appendChild(browseButton.element);
  },
  async afterConfigureGraph() {
    console.log("REBASE: afterConfigureGraph");
    rebased.evalRunner.notifyGraphConfigured();
  }

};

app.registerExtension(extension);
