import { useEffect, useState } from 'react';
import { getSvgAspectRatio, loadSvgAsImage } from '../utils/svg.js';

export function getLogoImageKey(logo) {
  return `${logo.id}:${logo.sha1 || logo.sourceUrl || logo.svg.length}`;
}

export function useLogoImageCache(logos) {
  const [imageCache, setImageCache] = useState({});

  useEffect(() => {
    const missingLogos = logos.filter((logo) => imageCache[logo.id]?.key !== getLogoImageKey(logo));
    if (missingLogos.length === 0) return undefined;

    let isCancelled = false;

    async function cacheMissingImages() {
      const loadedEntries = await Promise.all(
        missingLogos.map(async (logo) => {
          try {
            const image = await loadSvgAsImage(logo.svg);
            return [logo.id, { key: getLogoImageKey(logo), image, aspectRatio: getSvgAspectRatio(logo.svg) }];
          } catch (error) {
            console.error(`Failed caching SVG: ${logo.id}`, error);
            return null;
          }
        })
      );

      if (isCancelled) return;

      const nextEntries = loadedEntries.filter(Boolean);
      if (nextEntries.length > 0) {
        setImageCache((current) => ({ ...current, ...Object.fromEntries(nextEntries) }));
      }
    }

    cacheMissingImages();

    return () => {
      isCancelled = true;
    };
  }, [logos, imageCache]);

  return imageCache;
}
