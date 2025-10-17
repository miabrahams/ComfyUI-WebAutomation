import { handleGenerateImages } from "@/eventHandlers/generateImages"
import { handlePromptReplace, handleLoadGraph } from "@/eventHandlers/promptReplace"
import { ComfyAppLike } from '@/lib';

export function installHandlers(app: ComfyAppLike) {
  // Install event listeners for websocket automation
  // @ts-ignore
  app.api.addEventListener('prompt_replace', handlePromptReplace);
  // @ts-ignore
  app.api.addEventListener('generate', handleGenerateImages);
  // @ts-ignore
  app.api.addEventListener('load_graph', handleLoadGraph);
};
