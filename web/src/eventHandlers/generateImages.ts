import { queuePrompts } from '@/lib';

type GenerateImagesEvent = {
  type: 'generate';
  detail: {
    count?: number;
  };
};

export const handleGenerateImages = (event: GenerateImagesEvent) => {
  const { count } = event.detail ?? {};
  if (typeof count === 'number') {
    console.debug('Generating', count, 'images');
    if (count < 1 || count > 8) {
      console.warn('Invalid count provided in generateImages event: ', count);
      return;
    }
    return queuePrompts(count);
  } else {
    console.warn('Invalid count provided in generateImages event');
  }
};
