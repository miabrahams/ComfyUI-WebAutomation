import { app } from '../../scripts/app.js';
import { $el } from '../../scripts/ui.js';

import { ComfyButtonGroup } from '../../scripts/ui/components/buttonGroup.js';
import { ComfyButton } from '../../scripts/ui/components/button.js';

console.log('Starting up!');

class ComfyRebase {
  storedNodeData = {};
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
      console.log('data for node', node.id, this.storedNodeData[node.id]);
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

    console.log('Node values pasted');
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
    const copyPasteButtons = new ComfyButtonGroup(copyButton, pasteButton);
    app.menu.element.appendChild(copyPasteButtons.element);
  },
});
