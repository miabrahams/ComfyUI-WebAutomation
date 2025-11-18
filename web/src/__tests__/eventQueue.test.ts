import { describe, expect, it, vi } from 'vitest';

import { EventQueue } from '../eventHandlers/eventQueue';

describe('EventQueue', () => {
  it('processes events sequentially in order received', async () => {
    vi.useFakeTimers();
    const queue = new EventQueue();
    const calls: string[] = [];

    const handler = async (label: string) => {
      calls.push(`start-${label}`);
      await new Promise((resolve) => setTimeout(resolve, label === 'one' ? 20 : 5));
      calls.push(`end-${label}`);
    };

    const promises = [
      queue.enqueue(handler, 'one'),
      queue.enqueue(handler, 'two'),
      queue.enqueue(handler, 'three'),
    ];

    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(calls).toEqual([
      'start-one',
      'end-one',
      'start-two',
      'end-two',
      'start-three',
      'end-three',
    ]);

    vi.useRealTimers();
  });

  it('continues processing when a handler throws', async () => {
    const queue = new EventQueue();
    const calls: string[] = [];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await queue.enqueue(() => {
      throw new Error('boom');
    }, undefined);

    await queue.enqueue((label: string) => {
      calls.push(label);
    }, 'next');

    expect(calls).toEqual(['next']);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
