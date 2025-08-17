interface DiffData {
  [nodeId: string]: {
    [widgetNameOrMode: string]: {
      old: any;
      new: any;
    };
  };
}

interface FieldRemap {
  sourceNodeId: string | number;
  sourceField: string;
  targetNodeId: string | number;
  targetField: string;
}

interface NodeData {
  type: string;
  values: Map<string, any>;
  mode: number;
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
  private remaps: FieldRemap[] = [];
  private storedNodeData: Map<string | number, NodeData> = new Map();
  public onDiffLoaded?: (diffData: DiffData) => void;
  public onUndo?: () => void;
  public onMerge?: () => void;
  public onRemapsChanged?: (remaps: FieldRemap[]) => void;

  async show(currentDiff: DiffData | null = null, hasPreviousDiff: boolean = false, remaps: FieldRemap[] = [], storedNodeData?: Map<string | number, NodeData>): Promise<void> {
    this.currentDiff = currentDiff;
    this.hasPreviousDiff = hasPreviousDiff;
    this.remaps = remaps;
    this.storedNodeData = storedNodeData || new Map();
    this.createPopup();
    await Promise.all([this.loadSavedDiffs(), this.loadSavedRemaps()]);
    this.updateDiffDisplay();
    this.updateRemapsDisplay();
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

      <div class="remaps-section" style="margin-bottom: 15px; border-top: 1px solid #555; padding-top: 15px;">
        <h4 style="margin-bottom: 10px;">Field Remapping Configuration</h4>
        <p style="font-size: 12px; color: #bbb; margin-bottom: 10px;">Configure field remappings to copy values from one node's field to another during paste operations.</p>
        
        <div class="remaps-controls" style="margin-bottom: 10px;">
          <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
            <select class="saved-remaps-select" style="flex: 1; padding: 5px; background: #1a1a1a; color: #fff; border: 1px solid #555;">
              <option value="">Select saved remaps...</option>
            </select>
            <button class="load-remaps-btn" style="padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">Load</button>
            <button class="delete-remaps-btn" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
            <input type="text" class="remaps-name-input" placeholder="Enter remaps name..." style="flex: 1; padding: 5px; background: #1a1a1a; color: #fff; border: 1px solid #555;">
            <button class="save-remaps-btn" style="padding: 5px 10px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">Save Current</button>
          </div>
        </div>

        <div class="remaps-list" style="margin-bottom: 10px;">
        </div>
        <div class="add-remap-section" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 5px; align-items: center;">
          <select class="source-node-select" style="padding: 3px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
            <option value="">Source Node</option>
          </select>
          <select class="source-field-select" style="padding: 3px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
            <option value="">Source Field</option>
          </select>
          <input type="text" class="target-node-input" placeholder="Target Node ID" style="padding: 3px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
          <input type="text" class="target-field-input" placeholder="Target Field" style="padding: 3px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
          <button class="add-remap-btn" style="padding: 3px 8px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Add</button>
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
    
    // Remap-specific listeners
    popup.querySelector('.save-remaps-btn')?.addEventListener('click', () => this.saveRemaps());
    popup.querySelector('.load-remaps-btn')?.addEventListener('click', () => this.loadRemaps());
    popup.querySelector('.delete-remaps-btn')?.addEventListener('click', () => this.deleteRemaps());
    popup.querySelector('.add-remap-btn')?.addEventListener('click', () => this.addRemap());
    popup.querySelector('.source-node-select')?.addEventListener('change', () => this.updateSourceFields());

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

  private updateRemapsDisplay(): void {
    this.updateSourceNodeOptions();
    this.renderRemapsList();
  }

  private updateSourceNodeOptions(): void {
    const select = this.popup?.querySelector('.source-node-select') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Source Node</option>';
    
    this.storedNodeData.forEach((nodeData, nodeId) => {
      const option = document.createElement('option');
      option.value = String(nodeId);
      option.textContent = `Node ${nodeId} (${nodeData.type})`;
      select.appendChild(option);
    });
  }

  private updateSourceFields(): void {
    const sourceSelect = this.popup?.querySelector('.source-node-select') as HTMLSelectElement;
    const fieldSelect = this.popup?.querySelector('.source-field-select') as HTMLSelectElement;
    
    if (!sourceSelect || !fieldSelect) return;

    fieldSelect.innerHTML = '<option value="">Source Field</option>';
    
    const selectedNodeId = sourceSelect.value;
    if (!selectedNodeId) return;

    const nodeData = this.storedNodeData.get(selectedNodeId);
    if (!nodeData) return;

    nodeData.values.forEach((value, fieldName) => {
      const option = document.createElement('option');
      option.value = fieldName;
      option.textContent = `${fieldName} = ${JSON.stringify(value).substring(0, 30)}${JSON.stringify(value).length > 30 ? '...' : ''}`;
      fieldSelect.appendChild(option);
    });
  }

  private renderRemapsList(): void {
    const listContainer = this.popup?.querySelector('.remaps-list') as HTMLElement;
    if (!listContainer) return;

    listContainer.innerHTML = '';

    this.remaps.forEach((remap, index) => {
      const remapRow = document.createElement('div');
      remapRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 5px; align-items: center; padding: 5px; border: 1px solid #333; border-radius: 3px; margin-bottom: 5px; background: #222;';
      
      remapRow.innerHTML = `
        <span style="font-size: 12px; color: #ccc;">Node ${remap.sourceNodeId}.${remap.sourceField}</span>
        <span style="font-size: 12px; color: #888;">→</span>
        <span style="font-size: 12px; color: #ccc;">Node ${remap.targetNodeId}</span>
        <span style="font-size: 12px; color: #ccc;">.${remap.targetField}</span>
        <button data-index="${index}" class="remove-remap-btn" style="padding: 2px 6px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Remove</button>
      `;

      remapRow.querySelector('.remove-remap-btn')?.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0');
        this.removeRemap(index);
      });

      listContainer.appendChild(remapRow);
    });
  }

  private addRemap(): void {
    const sourceNodeSelect = this.popup?.querySelector('.source-node-select') as HTMLSelectElement;
    const sourceFieldSelect = this.popup?.querySelector('.source-field-select') as HTMLSelectElement;
    const targetNodeInput = this.popup?.querySelector('.target-node-input') as HTMLInputElement;
    const targetFieldInput = this.popup?.querySelector('.target-field-input') as HTMLInputElement;

    const sourceNodeId = sourceNodeSelect?.value;
    const sourceField = sourceFieldSelect?.value;
    const targetNodeId = targetNodeInput?.value.trim();
    const targetField = targetFieldInput?.value.trim();

    if (!sourceNodeId || !sourceField || !targetNodeId || !targetField) {
      alert('Please fill in all fields for the remapping');
      return;
    }

    // Check if remap already exists
    const exists = this.remaps.some(r => 
      r.sourceNodeId == sourceNodeId && 
      r.sourceField === sourceField && 
      r.targetNodeId == targetNodeId && 
      r.targetField === targetField
    );

    if (exists) {
      alert('This remapping already exists');
      return;
    }

    const remap: FieldRemap = {
      sourceNodeId: isNaN(Number(sourceNodeId)) ? sourceNodeId : Number(sourceNodeId),
      sourceField,
      targetNodeId: isNaN(Number(targetNodeId)) ? targetNodeId : Number(targetNodeId),
      targetField
    };

    this.remaps.push(remap);
    this.renderRemapsList();
    
    // Clear inputs
    targetNodeInput.value = '';
    targetFieldInput.value = '';
    sourceNodeSelect.value = '';
    sourceFieldSelect.innerHTML = '<option value="">Source Field</option>';

    // Notify of changes
    if (this.onRemapsChanged) {
      this.onRemapsChanged(this.remaps);
    }
  }

  private removeRemap(index: number): void {
    this.remaps.splice(index, 1);
    this.renderRemapsList();
    
    if (this.onRemapsChanged) {
      this.onRemapsChanged(this.remaps);
    }
  }

  private async loadSavedRemaps(): Promise<void> {
    try {
      const response = await fetch('/rebase/remaps/list');
      const data = await response.json();

      const select = this.popup?.querySelector('.saved-remaps-select') as HTMLSelectElement;
      if (select) {
        select.innerHTML = '<option value="">Select saved remaps...</option>';

        data.remaps.forEach((remap: any) => {
          const option = document.createElement('option');
          option.value = remap.filename;
          option.textContent = `${remap.name} (${remap.count} remaps, ${new Date(remap.created * 1000).toLocaleDateString()})`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load saved remaps:', error);
    }
  }

  private async saveRemaps(): Promise<void> {
    const nameInput = this.popup?.querySelector('.remaps-name-input') as HTMLInputElement;
    const name = nameInput?.value.trim();

    if (!name) {
      alert('Please enter a name for the remaps');
      return;
    }

    if (this.remaps.length === 0) {
      alert('No remaps data to save');
      return;
    }

    try {
      const response = await fetch('/rebase/remaps/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, remaps: this.remaps })
      });

      const result = await response.json();

      if (result.success) {
        if (nameInput) nameInput.value = '';
        await this.loadSavedRemaps();
        alert('Remaps saved successfully!');
      } else {
        alert(`Failed to save remaps: ${result.error}`);
      }
    } catch (error) {
      alert(`Error saving remaps: ${(error as Error).message}`);
    }
  }

  private async loadRemaps(): Promise<void> {
    const select = this.popup?.querySelector('.saved-remaps-select') as HTMLSelectElement;
    const filename = select?.value;

    if (!filename) {
      alert('Please select remaps to load');
      return;
    }

    try {
      const response = await fetch(`/rebase/remaps/load/${filename}`);
      const data = await response.json();

      if (data.remaps) {
        this.remaps = data.remaps;
        this.updateRemapsDisplay();

        // Notify of changes
        if (this.onRemapsChanged) {
          this.onRemapsChanged(this.remaps);
        }
        
        alert('Remaps loaded successfully!');
      } else {
        alert(`Failed to load remaps: ${data.error}`);
      }
    } catch (error) {
      alert(`Error loading remaps: ${(error as Error).message}`);
    }
  }

  private async deleteRemaps(): Promise<void> {
    const select = this.popup?.querySelector('.saved-remaps-select') as HTMLSelectElement;
    const filename = select?.value;

    if (!filename) {
      alert('Please select remaps to delete');
      return;
    }

    if (!confirm('Are you sure you want to delete these remaps?')) {
      return;
    }

    try {
      const response = await fetch(`/rebase/remaps/delete/${filename}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        await this.loadSavedRemaps();
        alert('Remaps deleted successfully!');
      } else {
        alert(`Failed to delete remaps: ${result.error}`);
      }
    } catch (error) {
      alert(`Error deleting remaps: ${(error as Error).message}`);
    }
  }

  close(): void {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }
}
