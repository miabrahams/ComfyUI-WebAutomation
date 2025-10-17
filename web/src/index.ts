import { ComfyRebase } from './comfyRebase'

import { ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { installHandlers } from './eventHandlers/installHandlers';
import { installWidgets } from './installWidgets';
import { resolveApp } from "./lib";

const app = resolveApp();

const extension: ComfyExtension = {
  name: 'ComfyUI.Rebase',
  rebased: new ComfyRebase(),
  init() {},
  async setup() {
    installHandlers(app);
    installWidgets(app, this.rebased);
  },
  async afterConfigureGraph() {
    this.rebased.evalRunner.notifyGraphConfigured();
  }

};

app.registerExtension(extension);