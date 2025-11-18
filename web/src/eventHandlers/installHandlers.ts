import { handleGenerateImages } from '@/eventHandlers/generateImages';
import {
  handlePromptReplace,
  handleLoadGraph,
} from '@/eventHandlers/promptReplace';
import { EventQueue, EventHandler } from '@/eventHandlers/eventQueue';
import { ComfyAppLike } from '@/lib';

export function installHandlers(app: ComfyAppLike) {
  const eventQueue = new EventQueue();

  const enqueue =
    <TEvent>(handler: EventHandler<TEvent>) =>
    (event: TEvent) => {
      void eventQueue.enqueue(handler, event);
    };

  // Install event listeners for websocket automation
  // @ts-ignore
  app.api.addEventListener('prompt_replace', enqueue(handlePromptReplace));
  // @ts-ignore
  app.api.addEventListener('generate', enqueue(handleGenerateImages));
  // @ts-ignore
  app.api.addEventListener('load_graph', enqueue(handleLoadGraph));
}
