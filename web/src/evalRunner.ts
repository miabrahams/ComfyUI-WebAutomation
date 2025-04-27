/**
 * EvalRunner - Automated workflow evaluation
 * Manages sequential processing of workflows with batch execution
 */

import { exec } from 'child_process';
import { type Differ } from './types'
import { LGraphNode } from "@comfyorg/litegraph"

const app = window.comfyAPI.app.app;

export function executeWidgetsCallback(
  nodes: LGraphNode[],
  callbackName: 'onRemove' | 'beforeQueued' | 'afterQueued'
) {
  for (const node of nodes) {
    for (const widget of node.widgets ?? []) {
      widget[callbackName]?.()
    }
  }
}



interface ImageItem {
  filename: string;
  url: string;
  has_workflow?: boolean;
}

export class EvalRunner {
  private isRunning: boolean = false;
  private currentQueue: ImageItem[] = [];
  private runsPerImage: number = 4;
  private graphConfiguredResolver: (() => void) | null = null;
  private statusElement: HTMLElement | null = null;
  private differ: Differ;

  constructor(differ: Differ) {
    // Create a status display element
    this.createStatusElement();
    this.differ = differ;
  }

  // called by comfyRebase.afterConfigureGraph()
  public notifyGraphConfigured() {
    if (this.graphConfiguredResolver) {
      this.graphConfiguredResolver();
      this.graphConfiguredResolver = null;
    }
  }

  private createStatusElement() {
    this.statusElement = document.createElement('div');
    Object.assign(this.statusElement.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: '1000',
      display: 'none',
      fontFamily: 'monospace',
      fontSize: '12px',
      maxWidth: '300px'
    });
    document.body.appendChild(this.statusElement);
  }

  private updateStatus(message: string) {
    console.log("eval status: ", message)
    if (this.statusElement) {
      this.statusElement.innerHTML = message;
      this.statusElement.style.display = 'block';
    }
  }

  private hideStatus() {
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
  }

  async startEvaluation(images: ImageItem[], batchSize: number) {
    if (this.isRunning) {
      console.warn('Evaluation already running');
      return;
    }

    if (images.length === 0) {
      console.warn('No images provided for evaluation');
      return;
    }

    this.isRunning = true;
    this.currentQueue = [...images];
    this.runsPerImage = batchSize;

    // Show toast notification
    app.extensionManager.toast.add({
      severity: 'info',
      summary: 'Starting Evaluation',
      detail: `Processing ${images.length} images with ${batchSize} runs each`,
      life: 3000,
    });

    this.updateStatus(`Starting batch evaluation...\nTotal images: ${images.length}\nRuns per image: ${batchSize}`);

    try {
      await this.processNextItem();
    } catch (error) {
      console.error('Evaluation error:', error);
      app.extensionManager.toast.add({
        severity: 'error',
        summary: 'Evaluation Failed',
        detail: (error as Error).message,
        life: 5000,
      });
    } finally {
      console.log("startEvaluation finished!")
      this.isRunning = false;
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  async cancelEvaluation() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.currentQueue = [];

    app.extensionManager.toast.add({
      severity: 'info',
      summary: 'Evaluation Cancelled',
      detail: 'Evaluation process has been cancelled',
      life: 3000,
    });

    this.updateStatus('Evaluation cancelled');
    setTimeout(() => this.hideStatus(), 3000);
  }

  private async processNextItem() {
    console.log("processNextItem called", this.isRunning, this.currentQueue)
    if (!this.isRunning || this.currentQueue.length === 0) {
      // All done
      app.extensionManager.toast.add({
        severity: 'success',
        summary: 'Evaluation Complete',
        detail: 'All items processed',
        life: 3000,
      });
      this.updateStatus('Evaluation complete!');
      setTimeout(() => this.hideStatus(), 3000);
      this.isRunning = false;
      return;
    }

    const currentItem = this.currentQueue.shift();
    if (!currentItem) return;

    const remaining = this.currentQueue.length;
    this.updateStatus(`Processing: ${currentItem.filename}<br>Remaining: ${remaining} images<br>Runs: ${this.runsPerImage}`);

    app.extensionManager.toast.add({
      severity: 'info',
      summary: 'Processing Image',
      detail: `Loading ${currentItem.filename}`,
      life: 2000,
    });

    try {
      // Load the workflow
      await this.loadWorkflow(currentItem);

      // Wait for graph to be configured
      await this.waitForGraphConfigured();

      // Randomize seed. Could make this an option later
      executeWidgetsCallback(app.graph.nodes, 'beforeQueued')

      // Apply any diffs if available
      console.log('Applying diff to workflow');
      this.differ.applyDiff();

      // Wait a moment for the diff to be applied
      await new Promise(resolve => setTimeout(resolve, 500));

      // Run the workflow multiple times
      await this.runBatch();

    } catch (error) {
      console.error(`Error processing ${currentItem.filename}:`, error);

      app.extensionManager.toast.add({
        severity: 'error',
        summary: 'Processing Error',
        detail: `Error with ${currentItem.filename}: ${(error as Error).message}`,
        life: 3000,
      });
    } finally {
      // Process next item after a short delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      await this.processNextItem()
    }
  }

  private waitForGraphConfigured(): Promise<void> {
    return new Promise(resolve => {
      this.graphConfiguredResolver = resolve;
      // Add timeout as fallback
      setTimeout(resolve, 5000);
    });
  }

  private async loadWorkflow(img: ImageItem): Promise<void> {
    const infoUrl = img.url;
    const res = await fetch(infoUrl);

    if (!res.ok) {
      throw new Error(`No workflow data found for ${img.filename}`);
    }

    const blob = await res.blob();
    const file = new File([blob], img.filename, {
      type: res.headers.get('Content-Type') || '',
    });

    // Load workflow into ComfyUI
    await app.handleFile(file);
    console.log('Workflow loaded from', img.filename);
  }

  private async runBatch(): Promise<void> {
    console.log(`Running workflow batch of size ${this.runsPerImage}`);
    try {
      await app.queuePrompt(0, this.runsPerImage);
    } catch (error) {
      console.error('Error queueing prompt:', error);
      throw error;
    }
    // brief pause
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
