import { ComfyApp } from '@comfyorg/comfyui-frontend-types';
import { LGraphEventMode } from '@comfyorg/litegraph';

declare global {
  interface Window {
    comfyAPI: {
      app: { app: ComfyAppLike };
      ui: { $el: (tag: string, ...args: any[]) => HTMLElement };
      button: { ComfyButton: new (options: any) => any };
      buttonGroup: { ComfyButtonGroup: new (...buttons: any[]) => any };
    };
  }
}

// Record the parts we need here
export type ComfyAppLike = Pick<
  ComfyApp,
  'queuePrompt' | 'registerExtension' | 'extensionManager' | 'graph' | 'menu'
>;

let appInstance: ComfyAppLike | undefined;

// todo: call once, pass as dependency
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
    if (i < count - 1) {
      await wait(300);
    }
  }
};

export const replaceNodeValue = (
  node_id: number,
  widget_name: string,
  value: string
) => {
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
};

const setNodeMode = (node_id: number, mode: LGraphEventMode) => {
  const node = resolveApp().graph._nodes_by_id[node_id];
  if (!node) {
    console.warn('Node with ID', node_id, 'not found in graph');
    return;
  }
  node.mode = mode;
};

export const bypassNode = (node_id: number) => {
  setNodeMode(node_id, LGraphEventMode.BYPASS);
};
export const disableNode = (node_id: number) => {
  setNodeMode(node_id, LGraphEventMode.NEVER);
};
export const enableNode = (node_id: number) => {
  setNodeMode(node_id, LGraphEventMode.ALWAYS);
};

export interface ImageItem {
  filename: string;
  url: string;
  has_workflow?: boolean;
}

export async function loadWorkflow(img: ImageItem): Promise<void> {
  const infoUrl = img.url;
  const res = await fetch(infoUrl);

  if (!res.ok) {
    throw new Error(`No workflow data found for ${img.filename}`);
  }

  const blob = await res.blob();
  const file = new File([blob], img.filename, {
    type: res.headers.get('Content-Type') || '',
  });

  // Load workflow into ComfyUI
  await app.handleFile(file);
  console.debug('Workflow loaded from', img.filename);
}

export function shuffleArray<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export interface Differ {
  diffData: Record<string, any>;
  applyDiff: Function;
}
