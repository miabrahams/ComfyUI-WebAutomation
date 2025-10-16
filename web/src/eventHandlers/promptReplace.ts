import { resolveApp, replaceNodeValue, enableNode, bypassNode } from '@/lib';



type PromptReplaceEvent = {
  type: "prompt_replace",
  detail: {
      positive_prompt?: string
      negative_prompt?: string
      resolution?: {
        width: number,
        height: number,
      }
      loras?: string
      sampler?: {
        steps?: number
        cfg?: number
        sampler_name?: string
        scheduler?: string
      }
      name?: string
      rescaleCfg?: boolean
      perpNeg?: boolean
      ipAdapter?: {
        image?: string
        weight?: number
        enabled?: boolean
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

type GraphType = {
  name: string,
  positive: number
  negative: number
  aspectRatio: number
}

const identifyGraphType = () => {
  const app = resolveApp();
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


// Helpers for conditional set and enabling/disabling nodes
const setIfProvided = (nodeId: number, field: string, value: any) => {
  if (value !== undefined && value !== null) {
    replaceNodeValue(nodeId, field, value);
  }
};

const enableNodes = (nodeIds: number[], enabled: boolean) => {
  nodeIds.forEach((id) => enableNode(id));
};

// Hard-code node values for the time being
export const handlePromptReplace = (event: PromptReplaceEvent) => {
  let graphType = identifyGraphType();

  const {
    positive_prompt,
    negative_prompt,
    resolution,
    loras,
    sampler,
    name,
    rescaleCfg,
    perpNeg,
    ipAdapter,
  } = event.detail ?? {};

  // Prompts
  if (positive_prompt && positive_prompt.length > 0) {
    replaceNodeValue(graphType.positive, 'text', positive_prompt);
  }
  if (negative_prompt && graphType.negative && graphType.negative > 0) {
    replaceNodeValue(graphType.negative, 'text', negative_prompt);
  }

  // Resolution -> aspect ratio
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

  // LoRAs (treat as text)
  setIfProvided(340, 'text', loras);

  // Sampler settings (#445)
  if (sampler) {
    setIfProvided(445, 'steps', sampler.steps);
    setIfProvided(445, 'cfg', sampler.cfg);
    setIfProvided(445, 'sampler_name', sampler.sampler_name);
    setIfProvided(445, 'scheduler', sampler.scheduler);
  }

  // Name / Filename (#302)
  if (typeof name === 'string' && name.length > 0) {
    // Try both common widget names
    replaceNodeValue(302, 'name', name);
    replaceNodeValue(302, 'filename', name);
  }

  // RescaleCFG enable/disable (#585)
  if (typeof rescaleCfg === 'boolean') {
    enableNode(585);
  }

  // PerpNeg enable/disable (#576, #577)
  if (typeof perpNeg === 'boolean') {
    enableNodes([576, 577], perpNeg);
  }

  // IPAdapter
  if (ipAdapter) {
    const enable = ipAdapter.enabled !== false; // default to enabling when provided
    // Enable/disable the chain
    enableNodes([572, 560, 562, 570, 571, 569], enable);

    // Set fields
    setIfProvided(572, 'image', ipAdapter.image);
    setIfProvided(569, 'weight', ipAdapter.weight);
  }
};

type LoadGraphEvent = {
  type: "load_graph",
  graph: string,
}
export const handleLoadGraph = (event: LoadGraphEvent) => {
  app.loadGraphData(
    JSON.parse(event.graph),
    true,
    false,
    null,
    {},
  )
  let graphType: GraphType = identifyGraphType();
  replaceNodeValue(graphType.positive, 'text', '');
  replaceNodeValue(graphType.aspectRatio, 'aspect_ratio', '1:1 square 1024x1024');
};
