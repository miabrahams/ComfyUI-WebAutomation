class DiffPopup {
    constructor() {
        this.popup = null;
        this.currentDiff = null;
    }

    async show(currentDiff = null) {
        this.currentDiff = currentDiff;
        this.createPopup();
        await this.loadSavedDiffs();
        this.updateDiffDisplay();
    }

    createPopup() {
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
        popup.querySelector('.close-btn').addEventListener('click', () => this.close());
        popup.querySelector('.save-diff-btn').addEventListener('click', () => this.saveDiff());
        popup.querySelector('.load-diff-btn').addEventListener('click', () => this.loadDiff());
        popup.querySelector('.delete-diff-btn').addEventListener('click', () => this.deleteDiff());

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
    }

    updateDiffDisplay() {
        const jsonElement = this.popup.querySelector('.diff-json');
        if (this.currentDiff) {
            jsonElement.textContent = JSON.stringify(this.currentDiff, null, 2);
        } else {
            jsonElement.textContent = 'No diff data available';
        }
    }

    async loadSavedDiffs() {
        try {
            const response = await fetch('/searchreplace/list_diffs');
            const data = await response.json();

            const select = this.popup.querySelector('.saved-diffs-select');
            select.innerHTML = '<option value="">Select saved diff...</option>';

            data.diffs.forEach(diff => {
                const option = document.createElement('option');
                option.value = diff.filename;
                option.textContent = `${diff.name} (${new Date(diff.created * 1000).toLocaleDateString()})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load saved diffs:', error);
        }
    }

    async saveDiff() {
        const nameInput = this.popup.querySelector('.diff-name-input');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a name for the diff');
            return;
        }

        if (!this.currentDiff) {
            alert('No diff data to save');
            return;
        }

        try {
            const response = await fetch('/searchreplace/save_diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, diff: this.currentDiff })
            });

            const result = await response.json();

            if (result.success) {
                nameInput.value = '';
                await this.loadSavedDiffs();
                alert('Diff saved successfully!');
            } else {
                alert(`Failed to save diff: ${result.error}`);
            }
        } catch (error) {
            alert(`Error saving diff: ${error.message}`);
        }
    }

    async loadDiff() {
        const select = this.popup.querySelector('.saved-diffs-select');
        const filename = select.value;

        if (!filename) {
            alert('Please select a diff to load');
            return;
        }

        try {
            const response = await fetch(`/searchreplace/load_diff/${filename}`);
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
            alert(`Error loading diff: ${error.message}`);
        }
    }

    async deleteDiff() {
        const select = this.popup.querySelector('.saved-diffs-select');
        const filename = select.value;

        if (!filename) {
            alert('Please select a diff to delete');
            return;
        }

        if (!confirm('Are you sure you want to delete this diff?')) {
            return;
        }

        try {
            const response = await fetch(`/searchreplace/delete_diff/${filename}`, {
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
            alert(`Error deleting diff: ${error.message}`);
        }
    }

    close() {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
    }
}

// Export for use in other modules
window.DiffPopup = DiffPopup;
