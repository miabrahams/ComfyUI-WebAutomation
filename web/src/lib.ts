import { ComfyApp } from '@comfyorg/comfyui-frontend-types';
import { LGraph, LGraphEventMode } from '@comfyorg/litegraph';

declare global {
  interface Window {
    comfyAPI: {
      app: { app: ComfyApp };
      ui: { $el: (tag: string, ...args: any[]) => HTMLElement };
      button: { ComfyButton: new (options: any) => any };
      buttonGroup: { ComfyButtonGroup: new (...buttons: any[]) => any };
    };
  }
}

type ComfyGraph = Pick<ComfyApp['graph'], '_nodes_by_id'> & {
  setDirtyCanvas?: (dirty: boolean, dirty2: boolean) => void;
};

export type ComfyAppLike = Pick<ComfyApp, 'queuePrompt'> & { graph: ComfyGraph };

let appInstance: ComfyAppLike | undefined;

export const resolveApp = (): ComfyAppLike => {
  if (appInstance) {
    return appInstance;
  }

  if (typeof window !== 'undefined' && window.comfyAPI?.app?.app) {
    appInstance = window.comfyAPI.app.app as unknown as ComfyAppLike;
    return appInstance;
  }

  throw new Error('Comfy app instance is not available');
};

export const setAppInstance = (app: ComfyAppLike | undefined) => {
  appInstance = app;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const queuePrompts = async (count: number) => {
  const app = resolveApp();
  await wait(1000);
  for (let i = 0; i < count; i++) {
    await app.queuePrompt(0, 1);
    await wait(300);
  }
};


export const replaceNodeValue = (node_id: number, widget_name: string, value: string) => {
  const app = resolveApp();
  const node = app.graph._nodes_by_id[node_id];
  if (!node) {
    console.warn('Node with ID', node_id, 'not found in graph');
    return;
  }
  for (const widget of node.widgets) {
    if (widget.name && widget.name === widget_name) {
      widget.value = value;
    }
  }
}

const setNodeMode = (node_id: number, mode: LGraphEventMode) => {
  const node = resolveApp().graph._nodes_by_id[node_id]
  if (!node) {
    console.warn("Node with ID", node_id, "not found in graph");
    return;
  }
  node.mode = mode;
}

export const bypassNode  = (node_id: number) => {setNodeMode(node_id, LGraphEventMode.BYPASS)}
export const disableNode = (node_id: number) => {setNodeMode(node_id, LGraphEventMode.NEVER)}
export const enableNode  = (node_id: number) => {setNodeMode(node_id, LGraphEventMode.ALWAYS)}