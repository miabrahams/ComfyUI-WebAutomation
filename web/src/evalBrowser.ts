import { type EvalRunner } from './evalRunner';
import { shuffleArray } from './lib';

interface ImageItem {
  filename: string;
  url: string;
  has_workflow?: boolean;
}

export class EvalBrowser {
  private modal?: HTMLElement;
  private escListener?: (e: KeyboardEvent) => void;
  private currentFolder?: string;
  private currentType: string = 'evals';
  private batchSize: number = 4;
  private randomize: boolean = false;
  private selectedImages: Set<ImageItem> = new Set();
  private currentImages?: ImageItem[];
  private evalRunner: EvalRunner;

  constructor(runner: EvalRunner) {
    this.evalRunner = runner;
  }

  async openModal() {
    // Remove existing modal if it exists
    this.closeModal();

    // Create modal container
    this.modal = document.createElement('div');
    Object.assign(this.modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: '1000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      overflow: 'auto',
    });

    // Header
    const header = document.createElement('div');
    header.style.marginBottom = '20px';
    header.style.display = 'flex';
    header.style.width = '80%';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Image Browser';
    title.style.color = 'white';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => this.closeModal();

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.modal.appendChild(header);

    // Content container
    const content = document.createElement('div');
    content.style.width = '80%';
    content.style.backgroundColor = 'rgba(30,30,30,0.8)';
    content.style.borderRadius = '8px';
    content.style.padding = '20px';
    content.style.color = 'white';
    content.style.maxHeight = '80%';
    content.style.overflow = 'auto';
    this.modal.appendChild(content);

    document.body.appendChild(this.modal);

    // Setup ESC key to close
    this.escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeModal();
    };
    window.addEventListener('keydown', this.escListener);

    // Fetch and display folders
    await this.loadFolders(content);
  }

  private closeModal() {
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = undefined;
    }
    if (this.escListener) {
      window.removeEventListener('keydown', this.escListener);
      this.escListener = undefined;
    }
    // Clear selected images when closing
    this.selectedImages.clear();
  }

  private async loadFolders(container: HTMLElement) {
    try {
      container.innerHTML = '<h3>Loading folders...</h3>';
      const res = await fetch(`/rebase/data/folders?type=${this.currentType}`);

      if (!res.ok) {
        container.innerHTML = '<h3>Error loading folders</h3>';
        return;
      }

      const data = await res.json();

      if (!data.folders || data.folders.length === 0) {
        container.innerHTML = `
          <h3>No folders found</h3>
          <p>Create subfolders in the data/${this.currentType} directory to get started.</p>
        `;
        return;
      }

      // Display folders
      container.innerHTML = '<h3>Select a folder:</h3>';
      const list = document.createElement('ul');
      list.style.listStyleType = 'none';
      list.style.padding = '0';

      data.folders.forEach((folder: string) => {
        const li = document.createElement('li');
        li.style.padding = '10px 5px';
        li.style.margin = '5px 0';
        li.style.backgroundColor = 'rgba(60,60,60,0.5)';
        li.style.borderRadius = '4px';
        li.style.cursor = 'pointer';
        li.textContent = folder;

        li.onclick = () => {
          this.currentFolder = folder;
          this.loadImages(container);
        };

        list.appendChild(li);
      });

      container.appendChild(list);
    } catch (error) {
      container.innerHTML = `<h3>Error: ${(error as Error).message}</h3>`;
      console.error('Failed to load folders:', error);
    }
  }

  private async loadImages(container: HTMLElement) {
    if (!this.currentFolder) return;

    try {
      container.innerHTML = `<h3>Loading images from "${this.currentFolder}"...</h3>`;

      const url = `/rebase/data/images?type=${
        this.currentType
      }&folder=${encodeURIComponent(this.currentFolder)}`;
      const res = await fetch(url);

      if (!res.ok) {
        container.innerHTML = `<h3>Error loading images from "${this.currentFolder}"</h3>`;
        return;
      }

      const data = await res.json();
      this.currentImages = data.images; // track current list

      // Add back button
      const backButton = document.createElement('button');
      backButton.textContent = '← Back to folders';
      backButton.style.marginBottom = '15px';
      backButton.onclick = () => this.loadFolders(container);

      container.innerHTML = '';
      container.appendChild(backButton);

      const header = document.createElement('h3');
      header.textContent = `${this.currentFolder} (${data.images.length} images)`;
      container.appendChild(header);

      if (data.images.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = 'No images found in this folder.';
        container.appendChild(msg);
        return;
      }

      // Add batch controls
      const controlsDiv = document.createElement('div');
      controlsDiv.style.marginBottom = '15px';
      controlsDiv.style.display = 'flex';
      controlsDiv.style.alignItems = 'center';
      controlsDiv.style.gap = '10px';

      // Batch size input
      const batchLabel = document.createElement('label');
      batchLabel.textContent = 'Runs per image:';
      batchLabel.style.marginRight = '5px';

      const batchInput = document.createElement('input');
      batchInput.type = 'number';
      batchInput.min = '1';
      batchInput.max = '10';
      batchInput.value = String(this.batchSize);
      batchInput.style.width = '50px';
      batchInput.onchange = (e) => {
        this.batchSize = parseInt((e.target as HTMLInputElement).value) || 4;
      };

      // Run Eval button
      const runEvalButton = document.createElement('button');
      runEvalButton.textContent = '▶️ Run Evaluation';
      runEvalButton.style.marginLeft = '10px';
      runEvalButton.style.backgroundColor = '#4CAF50';
      runEvalButton.style.color = 'white';
      runEvalButton.style.border = 'none';
      runEvalButton.style.padding = '8px 16px';
      runEvalButton.style.borderRadius = '4px';
      runEvalButton.onclick = () => this.runEvaluation();

      controlsDiv.appendChild(batchLabel);
      controlsDiv.appendChild(batchInput);
      controlsDiv.appendChild(runEvalButton);
      container.appendChild(controlsDiv);

      // Selection controls
      const selectionControls = document.createElement('div');
      selectionControls.style.marginBottom = '10px';

      const selectAllBtn = document.createElement('button');
      selectAllBtn.textContent = 'Select All';
      selectAllBtn.style.marginRight = '10px';
      selectAllBtn.onclick = () => {
        this.selectedImages = new Set(this.currentImages);
        container
          .querySelectorAll('.image-checkbox input')
          .forEach((cb: any) => (cb.checked = true));
      };

      const clearSelectionBtn = document.createElement('button');
      clearSelectionBtn.textContent = 'Clear Selection';
      clearSelectionBtn.onclick = () => {
        this.selectedImages.clear();
        container
          .querySelectorAll('.image-checkbox input')
          .forEach((cb: any) => (cb.checked = false));
      };

      selectionControls.appendChild(selectAllBtn);
      selectionControls.appendChild(clearSelectionBtn);

      // Random selection controls
      const randomLabel = document.createElement('label');
      randomLabel.textContent = ' Random:';
      randomLabel.style.marginRight = '5px';

      const randomInput = document.createElement('input');
      randomInput.type = 'number';
      randomInput.min = '1';
      randomInput.max = String(data.images.length);
      randomInput.value = '100';
      randomInput.style.width = '50px';
      randomInput.style.marginRight = '10px';

      const randomSelectBtn = document.createElement('button');
      randomSelectBtn.textContent = 'Random Select';
      randomSelectBtn.onclick = () => {
        this.selectedImages.clear();
        const shuffleIdx = [...this.currentImages.keys()];
        shuffleArray(shuffleIdx);
        const n = Math.min(
          parseInt(randomInput.value) || 0,
          this.currentImages.length
        );
        const selectedIdx = shuffleIdx.slice(0, n);
        selectedIdx.forEach((idx) =>
          this.selectedImages.add(this.currentImages[idx])
        );
        container
          .querySelectorAll('.image-checkbox input')
          .forEach((cb: any, idx: number) => {
            cb.checked = selectedIdx.includes(idx);
          });
      };

      // Batch size input
      const randomizeLabel = document.createElement('label');
      randomizeLabel.textContent = 'Randomize:';
      randomizeLabel.style.marginRight = '5px';

      // Batch size input
      const randomizeCheckbox = document.createElement('input');
      randomizeCheckbox.type = 'checkbox';
      randomizeCheckbox.title = 'Randomize?';
      randomizeCheckbox.checked = false;
      randomizeCheckbox.onclick = (e) => {
        e.stopPropagation(); // Prevent image click when clicking checkbox
        this.randomize = randomizeCheckbox.checked;
      };

      selectionControls.appendChild(randomLabel);
      selectionControls.appendChild(randomInput);
      selectionControls.appendChild(randomSelectBtn);
      selectionControls.appendChild(randomizeLabel);
      selectionControls.appendChild(randomizeCheckbox);

      container.appendChild(selectionControls);

      // Create grid for images
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
      grid.style.gap = '10px';

      data.images.forEach((img: ImageItem) => {
        const item = document.createElement('div');
        item.style.cursor = 'pointer';
        item.style.position = 'relative';
        item.style.borderRadius = '4px';
        item.style.overflow = 'hidden';

        // Create thumbnail
        const thumbnail = document.createElement('img');
        thumbnail.src = img.url;
        thumbnail.alt = img.filename;
        thumbnail.style.width = '100%';
        thumbnail.style.height = '150px';
        thumbnail.style.objectFit = 'cover';

        // Add checkbox for selection
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'image-checkbox';
        checkboxWrapper.style.position = 'absolute';
        checkboxWrapper.style.top = '5px';
        checkboxWrapper.style.left = '5px';
        checkboxWrapper.style.backgroundColor = 'rgba(0,0,0,0.6)';
        checkboxWrapper.style.borderRadius = '3px';
        checkboxWrapper.style.padding = '3px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.title = 'Select for batch evaluation';
        checkbox.checked = this.selectedImages.has(img);
        checkbox.onclick = (e) => {
          e.stopPropagation(); // Prevent image click when clicking checkbox

          if (checkbox.checked) {
            // Add to selection if not already there
            this.selectedImages.add(img);
          } else {
            // Remove from selection
            this.selectedImages.delete(img);
          }
        };

        checkboxWrapper.appendChild(checkbox);
        item.appendChild(checkboxWrapper);

        // Add workflow badge if available
        if (img.has_workflow) {
          const badge = document.createElement('span');
          badge.textContent = '⚙️';
          badge.title = 'Has embedded workflow';
          badge.style.position = 'absolute';
          badge.style.top = '5px';
          badge.style.right = '5px';
          badge.style.backgroundColor = 'rgba(0,0,0,0.6)';
          badge.style.borderRadius = '50%';
          badge.style.padding = '3px';
          item.appendChild(badge);
        }

        // Add filename
        const caption = document.createElement('div');
        caption.textContent = img.filename;
        caption.style.padding = '5px';
        caption.style.textOverflow = 'ellipsis';
        caption.style.overflow = 'hidden';
        caption.style.whiteSpace = 'nowrap';
        caption.style.fontSize = '12px';
        caption.style.backgroundColor = 'rgba(0,0,0,0.6)';

        // Handle click
        item.onclick = () => {
          // Toggle selection when clicking the item
          checkbox.checked = !checkbox.checked;

          if (checkbox.checked) {
            this.selectedImages.add(img);
          } else {
            this.selectedImages.delete(img);
          }
        };

        item.appendChild(thumbnail);
        item.appendChild(caption);
        grid.appendChild(item);
      });

      container.appendChild(grid);
    } catch (error) {
      container.innerHTML = `<h3>Error: ${(error as Error).message}</h3>`;
      console.error('Failed to load images:', error);
    }
  }

  private runEvaluation() {
    console.log('runEvaluation → selectedImages:', this.selectedImages);
    if (this.selectedImages.size === 0) {
      alert('Please select at least one image for evaluation');
      return;
    }

    const imagesArray = Array.from(this.selectedImages);
    if (this.randomize) {
      console.log('Randomizing image order');
      imagesArray.sort(() => Math.random() - 0.5);
    }
    this.closeModal();
    this.evalRunner.startEvaluation(imagesArray, this.batchSize);
  }
}
