const imageCache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

export function getCachedImage(src: string): HTMLImageElement | undefined {
  return imageCache.get(src);
}

export function loadSketchImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = loading.get(src);
  if (pending) return pending;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      imageCache.set(src, image);
      loading.delete(src);
      resolve(image);
    };
    image.onerror = () => {
      loading.delete(src);
      reject(new Error('Image load failed'));
    };
    image.src = src;
  });
  loading.set(src, promise);
  return promise;
}

export async function preloadSketchImages(sources: string[]): Promise<void> {
  await Promise.all(sources.filter(Boolean).map((src) => loadSketchImage(src).catch(() => undefined)));
}
