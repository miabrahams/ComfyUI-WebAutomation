import { ComfyApp } from '@comfyorg/comfyui-frontend-types';

declare global {
  interface Window {
    comfyAPI: {
      app: { app: ComfyApp }; // App instance
      ui: { $el: (tag: string, ...args: any[]) => HTMLElement }; // helper to add element
      button: { ComfyButton: new (options: any) => any }; // helper to create Comfy styled button
      buttonGroup: { ComfyButtonGroup: new (...buttons: any[]) => any }; // Basic constructor type
    };
  }
}

export const queuePrompts = async (count: number) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  for (let i = 0; i < count; i++) {
    await app.queuePrompt(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}



type PromptReplaceEvent = {
  type: "promptReplace",
  detail: {
      positive_prompt?: string
      negative_prompt?: string
      resolution?: {
        width: number,
        height: number,
      }
  },
}

const resolutionValues: Array<[number, number, number, string]> = [
  [1024, 1024, 1024/1024, "1:1 square 1024x1024"],
  [896, 1152, 896/1152, "3:4 portrait 896x1152"],
  [832, 1216, 832/1216, "5:8 portrait 832x1216"],
  [768, 1344, 768/1344, "9:16 portrait 768x1344"],
  [1152, 896, 1152/896, "4:3 landscape 1152x896"],
  [1216, 832, 1216/832, "3:2 landscape 1216x832"],
  [1344, 768, 1344/768, "16:9 landscape 1344x768"],
]

const matchClosestAspectRatio = (width: number, height: number) => {
  let bestMatch = Infinity;
  let bestFit = "1:1 square 1024x1024"
  const ar = width / height
  for (const [_, __, resAR, resValue] of resolutionValues) {
    if (Math.abs(ar / resAR - 1) < bestMatch) {
      bestMatch = Math.abs(resAR / ar - 1)
      bestFit = resValue
    }
  }
  return bestFit
}

export const replaceNodeValue = (node_id: number, widget_name: string, value: string) => {
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


type GraphType = {
  name: string,
  positive: number
  negative: number
  aspectRatio: number
}

const identifyGraphType = () => {
  const node = app.graph._nodes_by_id[74];
  if (node && node.type === "CLIPTextEncode") {
    return {
      name: "Chroma",
      positive: 74,
      negative: 75,
      aspectRatio: 95,
    };
  }
  return {
    name: "Illustrious",
    positive: 553,
    negative: -1,
    aspectRatio: 346,
  };
};


// Hard-code node values for the time being
export const handlePromptReplace = (event: PromptReplaceEvent) => {
  let graphType: GraphType = identifyGraphType();

  const { positive_prompt, resolution } = event.detail ?? {};
  if (positive_prompt && positive_prompt.length > 0) {
    replaceNodeValue(graphType.positive, 'text', positive_prompt);
  }

  if (resolution) {
    const { width, height } = resolution;
    if (typeof width === 'number' && typeof height === 'number') {
      const aspectRatio = matchClosestAspectRatio(width, height);
      console.debug('closest aspect_ratio:', aspectRatio);
      replaceNodeValue(graphType.aspectRatio, 'aspect_ratio', aspectRatio);
    } else {
      console.warn('Invalid resolution provided in promptReplace event');
    }
  }
};

export const handleResetGraph = (event: Event) => {
  let graphType: GraphType = identifyGraphType();
  replaceNodeValue(graphType.positive, 'text', '');
  replaceNodeValue(graphType.aspectRatio, 'aspect_ratio', '1:1 square 1024x1024');
};

type GenerateImagesEvent = {
  type: "generateImages",
  detail: {
    count?: number,
  },
}

export const handleGenerateImages = (event: GenerateImagesEvent) => {
  const { count } = event.detail ?? {};
  if (typeof count === 'number') {
    console.debug('Generating', count, 'images');
    if (count < 1 || count > 8) {
      console.warn('Invalid count provided in generateImages event: ', count);
      return;
    }
    queuePrompts(count);
  } else {
    console.warn('Invalid count provided in generateImages event');
  }
};