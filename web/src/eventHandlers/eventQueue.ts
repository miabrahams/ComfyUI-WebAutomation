export type EventHandler<TEvent> = (event: TEvent) => void | Promise<void>;

type QueuedTask = () => Promise<void>;

/**
 * Lightweight queue to ensure websocket events are processed sequentially.
 */
export class EventQueue {
  private readonly queue: QueuedTask[] = [];
  private isProcessing = false;

  enqueue<TEvent>(handler: EventHandler<TEvent>, event: TEvent): Promise<void> {
    return new Promise((resolve) => {
      const task: QueuedTask = async () => {
        try {
          await handler(event);
        } catch (error) {
          console.error('EventQueue handler failed', error);
        } finally {
          resolve();
        }
      };

      this.queue.push(task);
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length) {
      const task = this.queue.shift();
      if (!task) continue;
      await task();
    }

    this.isProcessing = false;
  }
}
