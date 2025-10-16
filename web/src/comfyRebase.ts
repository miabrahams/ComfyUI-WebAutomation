import { ComfyApp, ComfyApi, ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { LGraphEventMode, LiteGraph, LGraphNode } from '@comfyorg/litegraph';

import { DropModal } from './dropModal';
import { EvalBrowser } from './evalBrowser';
import { EvalRunner } from './evalRunner';
import { DiffPopup } from './diffPopup';
import { handleGenerateImages } from '@/eventHandlers/generateImages';
import { handlePromptReplace } from '@/eventHandlers/promptReplace';
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

// Interface for field remapping configuration
interface FieldRemap {
  sourceNodeId: NodeID;
  sourceField: string;
  targetNodeId: NodeID;
  targetField: string;
}

// Interface for remap storage structure
interface RemapStorage {
  remaps: FieldRemap[];
}

type NodeID = string | number;



class ComfyRebase implements Differ {
  storedNodeData: Map<NodeID, NodeData> = new Map();
  diffData: Map<NodeID, DiffNodeData> = new Map();
  previousDiffData: Map<NodeID, DiffNodeData> = new Map();
  remaps: FieldRemap[] = [];

  dropModal: DropModal;
  evalBrowser: EvalBrowser;
  evalRunner: EvalRunner;
  diffPopup: DiffPopup;

  private readonly WORKING_DIFF_KEY = 'comfyui-searchreplace-working-diff';
  private readonly WORKING_REMAPS_KEY = 'comfyui-searchreplace-working-remaps';

  constructor() {
    this.dropModal = new DropModal(this);
    this.evalRunner = new EvalRunner(this);
    this.evalBrowser = new EvalBrowser(this.evalRunner);
    this.diffPopup = new DiffPopup();

    // Callback for when diff is loaded
    this.diffPopup.onDiffLoaded = (diffData) => {
      this.diffData = new Map(Object.entries(diffData));
      this.saveWorkingDiff();
      this.applyDiff();

      app.extensionManager.toast.add({
        severity: 'success',
        summary: 'Diff Loaded',
        detail: 'Diff has been loaded and applied to the workflow',
        life: 3000,
      });
    };

    // Setup API event listener for promptReplace
    this.setupApiEventListeners();

    this.restoreWorkingDiff();
    this.restoreWorkingRemaps();
  }

  private setupApiEventListeners() {
    // @ts-ignore
    app.api.addEventListener('promptReplace', handlePromptReplace);
    // @ts-ignore
    app.api.addEventListener('generateImages', handleGenerateImages);
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
    console.debug('Node values copied:', this.storedNodeData);
  }

  pasteNodeValues() {
    const graph = app.graph;

    // First, apply regular node value pasting
    this.storedNodeData.forEach((nodeData, nodeID) => {
      const node = graph._nodes_by_id[nodeID];
      if (node === undefined) {
        console.warn('Node with ID', nodeID, 'not found in graph');
        return;
      }

      if (node.widgets && nodeData.type === node.type) {
        console.debug('Pasting node id', node.id);
        for (const widget of node.widgets) {
          if (widget.name && nodeData.values.has(widget.name)) {
            const value = nodeData.values.get(widget.name);
            widget.value = value;
          } else if (widget.name) {
            console.debug('No stored value for ', node.id, widget.name);
          }
        }
        if (typeof nodeData.mode !== 'undefined') {
          node.mode = nodeData.mode;
        }
      } else {
        console.warn(
          'Node type mismatch or no widgets found for node',
          node.id
        );
      }
    });

    // Second, apply field remappings
    this.applyFieldRemappings();

    app.graph.setDirtyCanvas(true, true);
  }

  private applyFieldRemappings() {
    const graph = app.graph;

    this.remaps.forEach((remap) => {
      const sourceNode = graph._nodes_by_id[remap.sourceNodeId];
      const targetNode = graph._nodes_by_id[remap.targetNodeId];

      if (!sourceNode) {
        console.warn(
          `Source node ${remap.sourceNodeId} not found for remapping`
        );
        return;
      }

      if (!targetNode) {
        console.warn(
          `Target node ${remap.targetNodeId} not found for remapping`
        );
        return;
      }

      // Find source value from stored data
      const sourceData = this.storedNodeData.get(remap.sourceNodeId);
      if (!sourceData || !sourceData.values.has(remap.sourceField)) {
        console.warn(
          `Source field ${remap.sourceField} not found in stored data for node ${remap.sourceNodeId}`
        );
        return;
      }

      // Find target widget and apply the value
      const targetWidget = targetNode.widgets?.find(
        (w) => w.name === remap.targetField
      );
      if (!targetWidget) {
        console.warn(
          `Target field ${remap.targetField} not found in node ${remap.targetNodeId}`
        );
        return;
      }

      const sourceValue = sourceData.values.get(remap.sourceField);
      targetWidget.value = sourceValue;
    });
  }

  // Note: This doesn't capture widgets added/removed, only changed values
  diffNodeValues() {
    const graph = app.graph;

    // Store the current diff as previous before calculating new one
    this.previousDiffData = new Map(this.diffData);
    this.diffData = new Map();

    graph._nodes.forEach((node) => {
      if (typeof node.id === 'undefined') return; // Skip nodes without ID

      const storedData = this.storedNodeData.get(node.id);
      if (!node.widgets || !storedData) return;

      if (storedData.type !== node.type) {
        console.debug(`Node ${node.id} type mismatch, skipping diff.`);
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
      for (const [name, currentValue] of currentValues.entries()) {
        if (storedValues.has(name)) {
          const storedValue = storedValues.get(name);
          if (JSON.stringify(storedValue) !== JSON.stringify(currentValue)) {
            console.debug('Found value diff for', node.id, name);
            nodeDiff[name] = { old: storedValue, new: currentValue };
          }
        }
      }

      // Diff mode
      if (node.mode !== storedData.mode) {
        console.debug('Found mode diff for', node.id);
        nodeDiff['_MODE'] = { old: storedData.mode, new: node.mode };
      }

      if (Object.keys(nodeDiff).length > 0) {
        this.diffData.set(node.id, nodeDiff);
      }
    });

    if (this.diffData.size > 0) {
      console.debug('Diff calculated', this.diffData);
      this.saveWorkingDiff();
    } else {
      this.clearWorkingDiff();
      app.extensionManager.toast.add({
        severity: 'info',
        summary: 'No diff found',
        detail: 'Could not identify diff from saved',
        life: 3000,
      });
    }
  }

  applyDiff() {
    if (this.diffData.size === 0) {
      console.warn('No diff data to apply.');
      app.extensionManager.toast.add({
        severity: 'warn',
        summary: 'Apply failed',
        detail: 'No diff data to apply.',
        life: 3000,
      });
      return;
    }

    let changesApplied = false;

    this.diffData.forEach((nodeDiffData, nodeID) => {
      const node = app.graph._nodes_by_id[nodeID];
      if (!node) {
        console.warn('Node with ID', nodeID, 'not found in graph');
        return;
      }

      if (node.widgets) {
        for (const widget of node.widgets) {
          if (widget.name && nodeDiffData[widget.name]) {
            widget.value = nodeDiffData[widget.name].new;
            changesApplied = true;
          }
        }
      }

      if (nodeDiffData['_MODE']) {
        node.mode = nodeDiffData['_MODE'].new;
        changesApplied = true;
      }
    });

    if (changesApplied) {
      app.graph.setDirtyCanvas(true, true); // Redraw graph
    } else {
      console.debug(
        'Diff data existed, but no matching nodes/widgets found to apply changes.'
      );
    }
  }

  // Restore previous diff
  undoDiff() {
    if (this.previousDiffData.size === 0) {
      app.extensionManager.toast.add({
        severity: 'warn',
        summary: 'No previous diff',
        detail: 'No previous diff available to restore',
        life: 3000,
      });
      return;
    }

    this.diffData = new Map(this.previousDiffData);
    this.previousDiffData = new Map();
    this.saveWorkingDiff();

    app.extensionManager.toast.add({
      severity: 'success',
      summary: 'Diff restored',
      detail: 'Previous diff has been restored',
      life: 3000,
    });
  }

  // Create merged diff by applying current diff on top of previous diff
  mergeDiffs() {
    if (this.previousDiffData.size === 0) {
      app.extensionManager.toast.add({
        severity: 'warn',
        summary: 'No previous diff',
        detail: 'No previous diff available to merge',
        life: 3000,
      });
      return;
    }

    const mergedDiff = new Map(this.previousDiffData);

    this.diffData.forEach((currentNodeDiff, nodeId) => {
      const existingNodeDiff = mergedDiff.get(nodeId) || {};
      const mergedNodeDiff = { ...existingNodeDiff };

      Object.assign(mergedNodeDiff, currentNodeDiff);

      mergedDiff.set(nodeId, mergedNodeDiff);
    });

    this.diffData = mergedDiff;
    this.previousDiffData = new Map();
    this.saveWorkingDiff();

    app.extensionManager.toast.add({
      severity: 'success',
      summary: 'Diff merged',
      detail: 'Current and previous diffs have been merged',
      life: 3000,
    });
  }

  openEvalBrowser() {
    this.evalBrowser.openModal();
  }

  private getCurrentDiffForPopup(): Map<NodeID, DiffNodeData> | null {
    return this.diffData.size > 0 ? this.diffData : null;
  }

  showDiffPopup() {
    // Convert our internal diff format to the format expected by the popup
    const currentDiff = this.getCurrentDiffForPopup();
    const diffForPopup = currentDiff ? Object.fromEntries(currentDiff) : null;
    const hasPreviousDiff = this.previousDiffData.size > 0;

    // Set up popup callbacks
    this.diffPopup.onUndo = () => {
      this.undoDiff();
      this.showDiffPopup(); // Refresh popup with updated diff
    };

    this.diffPopup.onMerge = () => {
      this.mergeDiffs();
      this.showDiffPopup(); // Refresh popup with updated diff
    };

    // Callback for when remaps are updated
    this.diffPopup.onRemapsChanged = (remaps) => {
      this.remaps = remaps;
      this.saveWorkingRemaps();
    };

    this.diffPopup.show(
      diffForPopup,
      hasPreviousDiff,
      this.remaps,
      this.storedNodeData
    );
  }

  private saveWorkingDiff() {
    try {
      if (this.diffData.size > 0) {
        const diffObject = Object.fromEntries(this.diffData);
        localStorage.setItem(this.WORKING_DIFF_KEY, JSON.stringify(diffObject));
      } else {
        // Clear localStorage if no diff data
        localStorage.removeItem(this.WORKING_DIFF_KEY);
      }
    } catch (error) {
      console.warn('Failed to save working diff to localStorage:', error);
    }
  }

  private restoreWorkingDiff() {
    try {
      const savedDiff = localStorage.getItem(this.WORKING_DIFF_KEY);
      if (savedDiff) {
        const parsedData = JSON.parse(savedDiff);

        // Handle legacy format (diff + remaps) and new format (just diff)
        if (parsedData.diff) {
          // Legacy format - extract just the diff part
          this.diffData = new Map(Object.entries(parsedData.diff));
        } else {
          // New format - just the diff object
          this.diffData = new Map(Object.entries(parsedData));
        }

        app.extensionManager.toast.add({
          severity: 'info',
          summary: 'Working diff restored',
          detail: 'Previous diff restored from browser storage',
          life: 3000,
        });
      }
    } catch (error) {
      console.warn('Failed to restore working diff from localStorage:', error);
      localStorage.removeItem(this.WORKING_DIFF_KEY);
    }
  }

  private saveWorkingRemaps() {
    try {
      if (this.remaps.length > 0) {
        const remapsData: RemapStorage = { remaps: this.remaps };
        localStorage.setItem(
          this.WORKING_REMAPS_KEY,
          JSON.stringify(remapsData)
        );
      } else {
        // Clear localStorage if no remap data
        localStorage.removeItem(this.WORKING_REMAPS_KEY);
      }
    } catch (error) {
      console.warn('Failed to save working remaps to localStorage:', error);
    }
  }

  private restoreWorkingRemaps() {
    try {
      const savedRemaps = localStorage.getItem(this.WORKING_REMAPS_KEY);
      if (savedRemaps) {
        const parsedData: RemapStorage = JSON.parse(savedRemaps);
        this.remaps = parsedData.remaps || [];

        if (this.remaps.length > 0) {
          app.extensionManager.toast.add({
            severity: 'info',
            summary: 'Working remaps restored',
            detail: `${this.remaps.length} field remap(s) restored from browser storage`,
            life: 3000,
          });
        }
      }
    } catch (error) {
      console.warn(
        'Failed to restore working remaps from localStorage:',
        error
      );
      localStorage.removeItem(this.WORKING_REMAPS_KEY);
    }
  }

  private clearWorkingDiff() {
    this.diffData.clear();
    this.saveWorkingDiff();
  }

  private clearWorkingRemaps() {
    this.remaps = [];
    this.saveWorkingRemaps();
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
      action: () => {
        rebased.diffNodeValues();
        // Show the diff popup after calculating diff
        rebased.showDiffPopup();
      },
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
      tooltip: 'Automated Evaluations',
      app,
      enabled: true,
      content: $el('div', '⏩'),
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
    rebased.evalRunner.notifyGraphConfigured();
  }

};

app.registerExtension(extension);
