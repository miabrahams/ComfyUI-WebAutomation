interface DiffData {
  [nodeId: string]: {
    [widgetNameOrMode: string]: {
      old: any;
      new: any;
    };
  };
}

interface SavedDiff {
  filename: string;
  name: string;
  created: number;
}

export class DiffPopup {
  private popup: HTMLElement | null = null;
  private currentDiff: DiffData | null = null;
  private hasPreviousDiff: boolean = false;
  public onDiffLoaded?: (diffData: DiffData) => void;
  public onUndo?: () => void;
  public onMerge?: () => void;

  async show(currentDiff: DiffData | null = null, hasPreviousDiff: boolean = false): Promise<void> {
    this.currentDiff = currentDiff;
    this.hasPreviousDiff = hasPreviousDiff;
    this.createPopup();
    await this.loadSavedDiffs();
    this.updateDiffDisplay();
  }

  private createPopup(): void {
    // Remove existing popup
    if (this.popup) {
      this.popup.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'diff-popup-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const popup = document.createElement('div');
    popup.className = 'diff-popup';
    popup.style.cssText = `
      background: #2a2a2a;
      border-radius: 8px;
      width: 80%;
      max-width: 800px;
      max-height: 80%;
      padding: 20px;
      color: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    popup.innerHTML = `
      <div class="diff-popup-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0;">Diff Manager</h3>
        <button class="close-btn" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">&times;</button>
      </div>

      <div class="diff-controls" style="margin-bottom: 15px;">
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
          <button class="undo-diff-btn" style="padding: 5px 10px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer;">Undo</button>
          <button class="merge-diff-btn" style="padding: 5px 10px; background: #9C27B0; color: white; border: none; border-radius: 3px; cursor: pointer;">Merge</button>
          <div style="flex: 1;"></div>
        </div>

        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
          <select class="saved-diffs-select" style="flex: 1; padding: 5px; background: #1a1a1a; color: #fff; border: 1px solid #555;">
            <option value="">Select saved diff...</option>
          </select>
          <button class="load-diff-btn" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Load</button>
          <button class="delete-diff-btn" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" class="diff-name-input" placeholder="Enter diff name..." style="flex: 1; padding: 5px; background: #1a1a1a; color: #fff; border: 1px solid #555;">
          <button class="save-diff-btn" style="padding: 5px 10px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">Save Current</button>
        </div>
      </div>

      <div class="diff-content" style="flex: 1; overflow: auto;">
        <h4 style="margin-bottom: 10px;">Current Diff JSON:</h4>
        <pre class="diff-json" style="background: #1a1a1a; padding: 10px; border-radius: 4px; overflow: auto; max-height: 400px; font-family: monospace; font-size: 12px; white-space: pre-wrap;"></pre>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    this.popup = overlay;

    // Event listeners
    popup.querySelector('.close-btn')?.addEventListener('click', () => this.close());
    popup.querySelector('.save-diff-btn')?.addEventListener('click', () => this.saveDiff());
    popup.querySelector('.load-diff-btn')?.addEventListener('click', () => this.loadDiff());
    popup.querySelector('.delete-diff-btn')?.addEventListener('click', () => this.deleteDiff());
    popup.querySelector('.undo-diff-btn')?.addEventListener('click', () => this.undoDiff());
    popup.querySelector('.merge-diff-btn')?.addEventListener('click', () => this.mergeDiff());

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Update button states based on hasPreviousDiff
    this.updateButtonStates();
  }

  private updateDiffDisplay(): void {
    const jsonElement = this.popup?.querySelector('.diff-json') as HTMLElement;
    if (jsonElement) {
      if (this.currentDiff) {
        jsonElement.textContent = JSON.stringify(this.currentDiff, null, 2);
      } else {
        jsonElement.textContent = 'No diff data available';
      }
    }
  }

  private async loadSavedDiffs(): Promise<void> {
    try {
      const response = await fetch('/rebase/diff/list');
      const data = await response.json();

      const select = this.popup?.querySelector('.saved-diffs-select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = '<option value="">Select saved diff...</option>';

        data.diffs.forEach((diff: SavedDiff) => {
          const option = document.createElement('option');
          option.value = diff.filename;
          option.textContent = `${diff.name} (${new Date(diff.created * 1000).toLocaleDateString()})`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load saved diffs:', error);
    }
  }

  private async saveDiff(): Promise<void> {
    const nameInput = this.popup?.querySelector('.diff-name-input') as HTMLInputElement;
    const name = nameInput?.value.trim();

    if (!name) {
      alert('Please enter a name for the diff');
      return;
    }

    if (!this.currentDiff) {
      alert('No diff data to save');
      return;
    }

    try {
      const response = await fetch('/rebase/diff/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, diff: this.currentDiff })
      });

      const result = await response.json();

      if (result.success) {
        if (nameInput) nameInput.value = '';
        await this.loadSavedDiffs();
        alert('Diff saved successfully!');
      } else {
        alert(`Failed to save diff: ${result.error}`);
      }
    } catch (error) {
      alert(`Error saving diff: ${(error as Error).message}`);
    }
  }

  private async loadDiff(): Promise<void> {
    const select = this.popup?.querySelector('.saved-diffs-select') as HTMLSelectElement;
    const filename = select?.value;

    if (!filename) {
      alert('Please select a diff to load');
      return;
    }

    try {
      const response = await fetch(`/rebase/diff/load/${filename}`);
      const data = await response.json();

      if (data.diff) {
        this.currentDiff = data.diff;
        this.updateDiffDisplay();

        // Trigger diff application if there's a callback
        if (this.onDiffLoaded) {
          this.onDiffLoaded(data.diff);
        }
      } else {
        alert(`Failed to load diff: ${data.error}`);
      }
    } catch (error) {
      alert(`Error loading diff: ${(error as Error).message}`);
    }
  }

  private async deleteDiff(): Promise<void> {
    const select = this.popup?.querySelector('.saved-diffs-select') as HTMLSelectElement;
    const filename = select?.value;

    if (!filename) {
      alert('Please select a diff to delete');
      return;
    }

    if (!confirm('Are you sure you want to delete this diff?')) {
      return;
    }

    try {
      const response = await fetch(`/rebase/diff/delete/${filename}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await this.loadSavedDiffs();
        alert('Diff deleted successfully!');
      } else {
        alert(`Failed to delete diff: ${result.error}`);
      }
    } catch (error) {
      alert(`Error deleting diff: ${(error as Error).message}`);
    }
  }

  private undoDiff(): void {
    if (this.onUndo) {
      this.onUndo();
    }
  }

  private mergeDiff(): void {
    if (this.onMerge) {
      this.onMerge();
    }
  }

  private updateButtonStates(): void {
    const undoBtn = this.popup?.querySelector('.undo-diff-btn') as HTMLButtonElement;
    const mergeBtn = this.popup?.querySelector('.merge-diff-btn') as HTMLButtonElement;
    
    if (undoBtn) {
      undoBtn.disabled = !this.hasPreviousDiff;
      undoBtn.style.opacity = this.hasPreviousDiff ? '1' : '0.5';
      undoBtn.style.cursor = this.hasPreviousDiff ? 'pointer' : 'not-allowed';
    }
    
    if (mergeBtn) {
      mergeBtn.disabled = !this.hasPreviousDiff;
      mergeBtn.style.opacity = this.hasPreviousDiff ? '1' : '0.5';
      mergeBtn.style.cursor = this.hasPreviousDiff ? 'pointer' : 'not-allowed';
    }
  }

  close(): void {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }
}
