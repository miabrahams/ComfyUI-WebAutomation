const LiteGraphInstance = window.LiteGraph;
import { type Differ } from './types'
import { queuePrompts } from './lib';


export class DropModal {
  dropModal: HTMLElement | undefined;
  differ: Differ

  constructor(differ: Differ) {
    this.differ = differ;
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

          if (Object.keys(this.differ.diffData).length > 0) {
            this.differ.applyDiff();
          } else {
            console.debug('No diff to apply');
          }

          queuePrompts(3);
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
}
