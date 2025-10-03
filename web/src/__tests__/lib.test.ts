import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleGenerateImages, handlePromptReplace, setAppInstance, __test__ } from '../lib';

type Widget = { name?: string; value?: unknown };

const createAppStub = () => {
  const positiveNode = { type: 'CLIPTextEncode', widgets: [{ name: 'text', value: '' } as Widget] };
  const aspectNode = { widgets: [{ name: 'aspect_ratio', value: '' } as Widget] };

  return {
    queuePrompt: vi.fn().mockResolvedValue(undefined),
    graph: {
      _nodes_by_id: {
        74: positiveNode,
        75: { widgets: [] },
        95: aspectNode,
        553: { widgets: [{ name: 'text', value: '' }] },
        346: { widgets: [{ name: 'aspect_ratio', value: '' }] },
      },
      setDirtyCanvas: vi.fn(),
    },
  };
};

beforeEach(() => {
  setAppInstance(undefined);
});

afterEach(() => {
  setAppInstance(undefined);
  vi.useRealTimers();
});

describe('matchClosestAspectRatio', () => {
  it('returns the closest named aspect ratio', () => {
    const { matchClosestAspectRatio } = __test__;
    expect(matchClosestAspectRatio(1344, 768)).toBe('16:9 landscape 1344x768');
    expect(matchClosestAspectRatio(1024, 1000)).toBe('1:1 square 1024x1024');
  });
});

describe('handlePromptReplace', () => {
  it('updates prompt and aspect ratio widgets when provided', () => {
    const app = createAppStub();
    setAppInstance(app as any);

    handlePromptReplace({
      type: 'promptReplace',
      detail: {
        positive_prompt: 'Hello World',
        resolution: { width: 1344, height: 768 },
      },
    });

    expect(app.graph._nodes_by_id[74].widgets[0].value).toBe('Hello World');
    expect(app.graph._nodes_by_id[95].widgets[0].value).toBe('16:9 landscape 1344x768');
  });
});

describe('queuePrompts / handleGenerateImages', () => {
  it('queues prompts respecting count', async () => {
    const app = createAppStub();
    setAppInstance(app as any);

    vi.useFakeTimers();
    const promise = handleGenerateImages({ type: 'generateImages', detail: { count: 3 } });

    await vi.runAllTimersAsync();
    await promise;

    expect(app.queuePrompt).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('rejects invalid counts', () => {
    const app = createAppStub();
    setAppInstance(app as any);

    const result = handleGenerateImages({ type: 'generateImages', detail: { count: 0 } });

    expect(result).toBeUndefined();
    expect(app.queuePrompt).not.toHaveBeenCalled();
  });
});
