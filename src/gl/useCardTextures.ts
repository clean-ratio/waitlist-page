import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { IMAGE_CARDS } from '../lib/content';

export type CardTexture = { texture: THREE.Texture; aspect: number };

/**
 * Loads the card images and uploads them to the GPU while the visitor is
 * still on the cover and the glass card.
 *
 * Loading is sequential, not parallel: cards 1 and 2 land first so the first
 * slide out of the form never waits, and the rest arrive behind them. Each one
 * gets `gl.initTexture()` immediately — without it the GPU upload happens on
 * the first frame the card is visible, which is exactly when it stutters.
 */
export function useCardTextures(): Record<string, CardTexture> {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [textures, setTextures] = useState<Record<string, CardTexture>>({});

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const loaded: THREE.Texture[] = [];

    const loadOne = (src: string) =>
      new Promise<THREE.Texture | null>((resolve) => {
        loader.load(
          src,
          (texture) => resolve(texture),
          undefined,
          () => {
            console.error('[deck] image failed to load', src);
            resolve(null);
          },
        );
      });

    (async () => {
      for (const card of IMAGE_CARDS) {
        const texture = await loadOne(card.src);
        if (cancelled) {
          texture?.dispose();
          return;
        }
        if (!texture) continue;

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;

        try {
          gl.initTexture(texture);
        } catch {
          // Older contexts do not expose initTexture; the upload just happens
          // later, on first use.
        }

        loaded.push(texture);
        const image = texture.image as { width: number; height: number };
        const aspect = image.width / image.height;
        setTextures((prev) => ({ ...prev, [card.id]: { texture, aspect } }));
        invalidate();
      }
    })();

    return () => {
      cancelled = true;
      for (const texture of loaded) texture.dispose();
    };
  }, [gl, invalidate]);

  return textures;
}

/**
 * Plain `<img>` preloading for the HTML fallback deck and the Now Playing
 * panel. Two cards ahead of `cardIndex`, so none ever arrives empty.
 */
export function preloadAhead(cardIndex: number): void {
  const from = Math.max(0, cardIndex);
  for (const card of IMAGE_CARDS.slice(from, from + 3)) {
    const img = new Image();
    img.src = card.src;
  }
}
