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
  // Wait and queue prompts
  await new Promise((resolve) => setTimeout(resolve, 1000));
  for (let i = 0; i < count; i++) {
    console.log("Queueing prompt", i);
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


export const handlePromptReplace = (event: PromptReplaceEvent) => {
      console.log('Received promptReplace event:', event);
      const { positive_prompt, resolution } = event.detail ?? {};
      if (positive_prompt && positive_prompt.length > 0) {
        const node = app.graph._nodes_by_id[553]; // hard-code for now
        if (!node) {
          console.warn('Node with ID', 553, 'not found in graph');
          return;
        }

        for (const widget of node.widgets) {
          if (widget.name && widget.name === 'text') {
            widget.value = positive_prompt;
            console.log('applied positive_prompt');
          }
        }
      } else {
        console.log('No positive_prompt provided in promptReplace event');
      }

      if (resolution) {
        const { width, height } = resolution;
        if (typeof width === 'number' && typeof height === 'number') {
          const aspectRatio = matchClosestAspectRatio(width, height);
          console.log("closest aspect_ratio:", aspectRatio)
          const node = app.graph._nodes_by_id[346]; // hard-code for now
          if (!node) {
            console.warn('Node with ID', 346, 'not found in graph');
            return;
          }
          for (const widget of node.widgets) {
            if (widget.name && widget.name === 'aspect_ratio') {
              widget.value = aspectRatio;
              console.log('applied aspect_ratio', widget.value);
            }
          }
          // Optionally, set a default resolution value
        } else {
          console.warn('Invalid resolution provided in promptReplace event');
        }
      }
};


type GenerateImagesEvent = {
  type: "generateImages",
  detail: {
    count?: number,
  },
}

export const handleGenerateImages = (event: GenerateImagesEvent) => {
  console.log('Received generateImages event:', event);
  const { count } = event.detail ?? {};
  if (typeof count === 'number') {
    console.log('Generating', count, 'images');
    if (count < 1 || count > 8) {
      console.warn('Invalid count provided in generateImages event: ', count);
      return;
    }
    queuePrompts(count);
  } else {
    console.warn('Invalid count provided in generateImages event');
  }
};