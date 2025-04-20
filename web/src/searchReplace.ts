import { ComfyApp, ComfyApi } from '@comfyorg/comfyui-frontend-types';

import { $el } from '../../scripts/ui.js';

import { ComfyButtonGroup } from '../../scripts/ui/components/buttonGroup.js';
import { ComfyButton } from '../../scripts/ui/components/button.js';

console.log('Starting up!');

class ComfyRebase {
  storedNodeData = {};
  diffData = {};
  dropModal: HTMLElement | undefined;

  constructor() {
    console.log("making thing")
  }

  copyNodeValues() {
    const graph = app.graph;
    this.storedNodeData = {};

    graph._nodes.forEach((node) => {
      if (!node.widgets_values) return;

      this.storedNodeData[node.id] = {
        type: node.type,
        values: new Map(
          node.widgets?.map((widget) => [widget.name, widget.value])
        ),
        mode: node.mode,
      };
    });
    console.log('Node values copied:', this.storedNodeData);
  }

  pasteNodeValues() {
    console.log("my comfyrebased", this);
    const graph = app.graph;
    graph._nodes.forEach((node) => {
      if (
        node.widgets_values &&
        this.storedNodeData[node.id] &&
        this.storedNodeData[node.id].type === node.type
      ) {
        console.log('pasting node id', node.id);
        for (const widget of node.widgets) {
          const value = this.storedNodeData[node.id].values.get(widget.name);
          if (!value) {
            console.log('No value for ', node.id, widget.name);
          } else {
            widget.value = value;
          }
        }
        node.mode = this.storedNodeData[node.id].mode;
      }
    });
  }

  diffNodeValues() {
    console.log("Calculating diff");
    const graph = app.graph;
    this.diffData = {};

    graph._nodes.forEach((node) => {
      if (!node.widgets_values || !this.storedNodeData[node.id]) return;

      const storedValues = this.storedNodeData[node.id].values;
      const currentValues = new Map(
        node.widgets.map((widget) => [widget.name, widget.value])
      );

      const nodeDiff = {};
      for (const [name, value] of currentValues.entries()) {
        if (storedValues.has(name) && storedValues.get(name) !== value) {
          console.log('Found diff for', node.id, name);
          nodeDiff[name] = { old: storedValues.get(name), new: value };
        }
      }

      if (node.mode !== this.storedNodeData[node.id].mode) {
        console.log('Found mode diff for', node.id);
        nodeDiff["_MODE"] = { old: this.storedNodeData[node.id].mode, new: node.mode };
      }

      if (Object.keys(nodeDiff).length > 0) {
        this.diffData[node.id] = nodeDiff;
      }
    });

    console.log("Diff calculated", this.diffData);
  }

  applyDiff() {
    console.log("Applying diff");
    const graph = app.graph;

    graph._nodes.forEach((node) => {
      if (!this.diffData[node.id]) return;

      for (const widget of node.widgets) {
        if (this.diffData[node.id][widget.name]) {
          console.log('Applying diff to', node.id, widget.name);
          widget.value = this.diffData[node.id][widget.name].new;
        }
      }
      if (this.diffData[node.id]["_MODE"]) {
        console.log('Applying mode diff to', node.id);
        node.mode = this.diffData[node.id]["_MODE"].new;
      }
    });
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
      this.dropModal = null;
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

      const files = e.dataTransfer.files;
      if (files.length > 0) {
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

  async handleImageDrop(file) {
    console.log('Loading image:', file.name);

    try {
      // Close the modal
      if (this.dropModal) {
        document.body.removeChild(this.dropModal);
        this.dropModal = null;
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
          if (Object.keys(this.diffData).length > 0) {
            this.applyDiff();
          } else {
            console.log('No diff to apply');
          }

          // Wait 300ms and then queue three prompts.
          await new Promise((resolve) => setTimeout(resolve, 1000));
          for (let i = 0; i < 3; i++) {
            console.log("Queueing prompt", i);
            await app.queuePrompt(-1, 1);
            // Would be nice to wait until app.#processingQueue is falsy
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      } else {
        console.error('Failed to upload image:', response.statusText);
        alert('Failed to upload image');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image: ' + error.message);
    }
  }
}

app.registerExtension({
  name: 'ComfyUI.Rebase',
  init() {},
  async setup() {
    const rebased = new ComfyRebase();
    const copyButton = new ComfyButton({
      tooltip: 'Copy',
      app,
      enabled: true,
      content: $el("div", "C"),
      classList: 'comfyui-button primary',
      action: () => { rebased.copyNodeValues() },
    });

    const pasteButton = new ComfyButton({
      textContent: 'Paste Node Values',
      app,
      enabled: true,
      content: $el("div", "P"),
      classList: 'comfyui-button primary',
      action: () => { rebased.pasteNodeValues() },
    });

    const diffButton = new ComfyButton({
      tooltip: 'Diff',
      app,
      enabled: true,
      content: $el("div", "D"),
      classList: 'comfyui-button primary',
      action: () => { rebased.diffNodeValues() },
    });

    const applyDiffButton = new ComfyButton({
      tooltip: 'Apply Diff',
      app,
      enabled: true,
      content: $el("div", "T"),
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
});
