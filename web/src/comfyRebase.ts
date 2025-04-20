import { ComfyApp, ComfyApi, ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { LiteGraph } from '@comfyorg/litegraph';
import * as jsondiffpatch from 'jsondiffpatch';


// XXX: These imports will NOT WORK in the browser. We will have to fix them.
import { app } from './scripts/app';
import { $el } from './scripts/ui';
import { ComfyButtonGroup } from './scripts/ui/components/buttonGroup';
import { ComfyButton } from './scripts/ui/components/button';

// Create a jsondiffpatch instance
// We can configure this later if needed (e.g., for ignoring certain properties)
const differ = jsondiffpatch.create({
  // Example: Ignore node position changes if desired
  // nodeDeltaFilter: function(context) {
  //   if (context.path.includes('pos')) {
  //     return false; // Don't diff position
  //   }
  //   return true;
  // },
});

// Remove unused interfaces
// interface NodeData { ... }
// interface DiffNodeData { ... }

class ComfyRebase {
  // Store the full serialized graph state
  storedGraphState: any | null = null;
  // Store the diff patch object
  diffPatch: jsondiffpatch.Delta | null = null;
  dropModal: HTMLElement | undefined;

  constructor() {
    console.log("Initializing ComfyRebase with jsondiffpatch");
  }

  currentGraphState() {
    return JSON.stringify(app.graph.asSerialisable());
  }

  // Renamed from copyNodeValues
  copyGraphState() {
    this.storedGraphState = this.currentGraphState();
    console.log('Graph state copied:', this.storedGraphState);
  }

  // Renamed from pasteNodeValues
  async restoreGraphState() {
    if (!this.storedGraphState) {
      console.warn('No graph state stored to restore.');
      alert('No graph state stored. Use "Copy" first.');
      return;
    }
    console.log('Restoring graph state...');
    // Use app.loadGraphData to load the entire state
    // Ensure we handle potential errors during loading
    try {
      await app.loadGraphData(this.storedGraphState);
      console.log('Graph state restored.');
    } catch (error) {
      console.error('Error restoring graph state:', error);
      alert('Failed to restore graph state: ' + (error as Error).message);
    }
  }

  diffNodeValues() {
    console.log("Calculating diff using jsondiffpatch");
    if (!this.storedGraphState) {
      console.warn('No stored graph state to diff against. Use "Copy" first.');
      alert('No graph state stored. Use "Copy" first to set a base state.');
      return;
    }

    const currentState = this.currentGraphState();
    this.diffPatch = differ.diff(this.storedGraphState, currentState);

    if (this.diffPatch) {
      console.log("Diff calculated:", this.diffPatch);
    } else {
      console.log("No differences found.");
      alert("No differences found between the stored state and the current state.");
    }
  }

  async applyDiff() {
    console.log("Applying diff using jsondiffpatch");
    if (!this.diffPatch) {
      console.warn('No diff calculated to apply. Use "Diff" first.');
      alert('No diff calculated. Use "Diff" first.');
      return;
    }

    console.log("Applying patch...");
    const patchedState = jsondiffpatch.patch(this.currentGraphState(), this.diffPatch);
    console.log("Patched state:", patchedState);

    try {
      // Load the patched state
      await app.loadGraphData(patchedState);
      console.log("Diff applied successfully.");
    } catch (error) {
      console.error('Error applying diff:', error);
      alert('Failed to apply diff: ' + (error as Error).message);
    }
  }

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
      document.body.removeChild(this.dropModal);
      this.dropModal = undefined;
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
          alert('Please drop an image file');
        }
      }
    });

    // Add all elements
    this.dropModal.appendChild(dropTarget);
    this.dropModal.appendChild(closeButton);
    document.body.appendChild(this.dropModal);
  }

  async handleImageDrop(file: File) {
    console.log('Loading image:', file.name);

    try {
      // Close the modal
      if (this.dropModal) {
        document.body.removeChild(this.dropModal);
        this.dropModal = undefined;
      }

      // Create an image node in the graph
      const imageNode = LiteGraph.createNode("LoadImage");
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

          // Apply diff if exists
          // This will apply the last calculated diff onto the original stored state
          // and load that result, potentially overwriting the newly added LoadImage node
          // if it wasn't part of the state when the diff was *calculated*.
          // This behavior might need refinement depending on the desired workflow.
          // Perhaps the diff should be applied *before* adding the image node?
          // Or the diff logic needs to be smarter about integrating the new node.
          // For now, keeping the original flow: load image, then apply diff.
          if (this.diffPatch) {
             console.log("Applying stored diff after image load...");
             await this.applyDiff(); // Make sure applyDiff is async if loadGraphData is
          } else {
            console.log('No diff to apply');
          }

          // Wait and queue prompts
          await new Promise((resolve) => setTimeout(resolve, 1000));
          for (let i = 0; i < 3; i++) {
            console.log("Queueing prompt", i);
            // Ensure queuePrompt is awaited if it returns a promise
            await app.queuePrompt(-1, 1);
            // Would be nice to wait until app.#processingQueue is falsy
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      } else {
        console.error('Failed to upload image:', response.statusText);
        // TODO: Find toast alternative
        alert('Failed to upload image');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      // TODO: Find toast alternative
      alert('Error processing image: ' + (error as Error).message);
    }
  }
}

const extension: ComfyExtension = {
  name: 'ComfyUI.Rebase',
  init() {},
  async setup() {
    const rebased = new ComfyRebase();
    const copyButton = new ComfyButton({
      tooltip: 'Copy Graph State', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "C"),
      classList: 'comfyui-button primary',
      action: () => { rebased.copyGraphState() }, // Updated action
    });

    const pasteButton = new ComfyButton({
      tooltip: 'Restore Graph State', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "P"),
      classList: 'comfyui-button primary',
      action: () => { rebased.restoreGraphState() },
    });

    const diffButton = new ComfyButton({
      tooltip: 'Diff Current vs Copied State',
      app,
      enabled: true,
      content: $el("div", "D"),
      classList: 'comfyui-button primary',
      action: () => { rebased.diffNodeValues() },
    });

    const applyDiffButton = new ComfyButton({
      tooltip: 'Apply Diff to Current Graph',
      app,
      enabled: true,
      content: $el("div", "A"),
      classList: 'comfyui-button primary',
      action: () => { rebased.applyDiff() },
    });

    const dropImageButton = new ComfyButton({
      tooltip: 'Drop Image & Apply Diff',
      app,
      enabled: true,
      content: $el("div", "🖼️"),
      classList: 'comfyui-button primary',
      action: () => { rebased.openImageDropModal() },
    });

    const copyPasteButtons = new ComfyButtonGroup(
      copyButton,
      pasteButton,
      diffButton,
      applyDiffButton,
      dropImageButton
    );

    app.menu.element.appendChild(copyPasteButtons.element);
  },
};

app.registerExtension(extension);
