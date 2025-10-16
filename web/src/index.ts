import { ComfyRebase } from './comfyRebase'

import { ComfyExtension } from '@comfyorg/comfyui-frontend-types';
const $el = window.comfyAPI.ui.$el;
const ComfyButton = window.comfyAPI.button.ComfyButton;
const ComfyButtonGroup = window.comfyAPI.buttonGroup.ComfyButtonGroup;

let rebased: ComfyRebase;

const extension: ComfyExtension = {
  name: 'ComfyUI.Rebase',
  init() {},
  async setup() {
    rebased = new ComfyRebase();

    // Install event listeners for websocket automation
    // @ts-ignore
    app.api.addEventListener('promptReplace', handlePromptReplace);
    // @ts-ignore
    app.api.addEventListener('generateImages', handleGenerateImages);


    // Install UI widgets
    const copyButton = new ComfyButton({
      tooltip: 'Copy Node Values',
      app,
      enabled: true,
      content: $el("div", "C"),
      classList: 'comfyui-button primary',
      action: () => { rebased.copyNodeValues() },
    });

    const pasteButton = new ComfyButton({
      tooltip: 'Paste Node Values',
      app,
      enabled: true,
      content: $el("div", "P"),
      classList: 'comfyui-button primary',
      action: () => { rebased.pasteNodeValues() },
    });

    const diffButton = new ComfyButton({
      tooltip: 'Diff Current vs Copied Values',
      app,
      enabled: true,
      content: $el("div", "D"),
      classList: 'comfyui-button primary',
      action: () => {
        rebased.diffNodeValues();
        // Show the diff popup after calculating diff
        rebased.showDiffPopup();
      },
    });

    const applyDiffButton = new ComfyButton({
      tooltip: 'Apply Value/Mode Diff',
      app,
      enabled: true,
      content: $el("div", "A"),
      classList: 'comfyui-button primary',
      action: () => { rebased.applyDiff() },
    });

    const dropImageButton = new ComfyButton({
      tooltip: 'Drop Image, Apply Diff & Queue', // Updated tooltip
      app,
      enabled: true,
      content: $el("div", "🖼️"),
      classList: 'comfyui-button primary',
      action: () => { rebased.dropModal.openImageDropModal() },
    });

    const browseButton = new ComfyButton({
      tooltip: 'Automated Evaluations',
      app,
      enabled: true,
      content: $el('div', '⏩'),
      classList: 'comfyui-button primary',
      action: () => { rebased.openEvalBrowser() },
    })

    const rebaseButtons = new ComfyButtonGroup(
      copyButton,
      pasteButton,
      diffButton,
      applyDiffButton,
      dropImageButton
    );

    app.menu.element.appendChild(rebaseButtons.element);
    app.menu.element.appendChild(browseButton.element);
  },
  async afterConfigureGraph() {
    rebased.evalRunner.notifyGraphConfigured();
  }

};

app.registerExtension(extension);