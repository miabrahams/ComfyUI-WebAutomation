/**
 * EvalRunner - Automated workflow evaluation
 * Manages sequential processing of workflows with batch execution
 */

const app = window.comfyAPI.app.app;

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

  constructor() {
    // Create a status display element
    this.createStatusElement();
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

    this.updateStatus(`Starting batch evaluation...<br>Total images: ${images.length}<br>Runs per image: ${batchSize}`);

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
      this.isRunning = false;
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  async cancelEvaluation() {
    if (!this.isRunning) return;

    this.currentQueue = [];
    this.isRunning = false;

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

      // Apply any diffs if available
      const rebaseExtension = app.extensions['ComfyUI.Rebase'];
      if (rebaseExtension?.instance?.applyDiff) {
        console.log('Applying diff to workflow');
        rebaseExtension.instance.applyDiff();
      }

      // Wait a moment for the diff to be applied
      await new Promise(resolve => setTimeout(resolve, 500));

      // Run the workflow multiple times
      await this.runBatch();

      // Process next item after a short delay
      setTimeout(() => {
        this.processNextItem();
      }, 1000);

    } catch (error) {
      console.error(`Error processing ${currentItem.filename}:`, error);

      app.extensionManager.toast.add({
        severity: 'error',
        summary: 'Processing Error',
        detail: `Error with ${currentItem.filename}: ${(error as Error).message}`,
        life: 3000,
      });

      // Continue with next item
      setTimeout(() => {
        this.processNextItem();
      }, 1000);
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
      // simplified: submit all runs in one batch
      await app.queuePrompt(-1, this.runsPerImage);
    } catch (error) {
      console.error('Error queueing prompt:', error);
    }
    // brief pause after submission
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
