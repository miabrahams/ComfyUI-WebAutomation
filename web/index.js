import { app } from '../../scripts/app.js';
import { $el } from '../../scripts/ui.js';

import { ComfyButtonGroup } from '../../scripts/ui/components/buttonGroup.js';
import { ComfyButton } from '../../scripts/ui/components/button.js';

console.log('Starting up!');

class ComfyRebase {
  storedNodeData = {};
  diffData = {};

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
          node.widgets.map((widget) => [widget.name, widget.value])
        ),
      };
    });
    console.log('Node values copied:', this.storedNodeData);
  }

  pasteNodeValues() {
    console.log("my comfyrebased", this);
    const graph = app.graph;
    const snd = this.storedNodeData;

    graph._nodes.forEach((node) => {
      if (
        node.widgets_values &&
        snd[node.id] &&
        snd[node.id].type === node.type
      ) {
        console.log('pasting node id', node.id);
        for (const widget of node.widgets) {
          const value = snd[node.id].values.get(widget.name);
          if (!value) {
            console.log('No value for ', node.id, widget.name);
          } else {
            widget.value = value;
          }
        }
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
    });
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

    const copyPasteButtons = new ComfyButtonGroup(copyButton, pasteButton, diffButton, applyDiffButton);
    app.menu.element.appendChild(copyPasteButtons.element);
  },
});
