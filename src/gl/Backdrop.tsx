import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useFrame, useThree } from '@react-three/fiber';
import { createBackdropMaterial } from './cardMaterial';
import type { CardTexture } from './useCardTextures';
import { TRANSITION } from '../lib/deckLayout';

type Props = {
  /** The active image card, or null on the cover, glass and exit steps. */
  activeId: string | null;
  textures: Record<string, CardTexture>;
  reducedMotion: boolean;
  /** The fog drifts behind the cover and the glass card, and nowhere else. */
  fogActive: boolean;
};

const PLANE = new THREE.PlaneGeometry(1, 1);

/**
 * The room behind the deck. It is the active card's own image, blurred hard
 * and held at 14% opacity, so the light in the room changes with each photo.
 * It crossfades on the same 0.8 s as the step.
 */
export default function Backdrop({
  activeId,
  textures,
  reducedMotion,
  fogActive,
}: Props) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const material = useMemo(() => createBackdropMaterial(), []);
  const shown = useRef<string | null>(null);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    if (activeId === shown.current) return;

    const next = activeId ? textures[activeId] : undefined;
    const uniforms = material.uniforms;

    // Nothing to show yet (the texture is still loading): wait for it rather
    // than crossfading to an empty slot.
    if (activeId && !next) return;

    uniforms.uTexB.value = next?.texture ?? null;
    uniforms.uHasB.value = next ? 1 : 0;

    const finish = () => {
      uniforms.uTexA.value = uniforms.uTexB.value;
      uniforms.uHasA.value = uniforms.uHasB.value;
      uniforms.uMix.value = 0;
      shown.current = activeId;
      invalidate();
    };

    gsap.to(uniforms.uMix, {
      value: 1,
      duration: reducedMotion ? TRANSITION.reducedDuration : TRANSITION.duration,
      ease: reducedMotion ? 'none' : TRANSITION.ease,
      overwrite: true,
      onUpdate: invalidate,
      onComplete: finish,
    });
  }, [activeId, textures, material, invalidate, reducedMotion]);

  // Keep asking for frames only while the fog is actually drifting. GSAP's
  // ticker is rAF-driven, so this stops on its own when the tab is hidden.
  useEffect(() => {
    if (!fogActive || reducedMotion) return;
    // Wrapped: the ticker passes its own arguments, and invalidate() reads the
    // first one as a frame count.
    const tick = () => invalidate();
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [fogActive, reducedMotion, invalidate]);

  useFrame((state) => {
    if (fogActive && !reducedMotion) {
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh
      geometry={PLANE}
      material={material}
      scale={[size.width, size.height, 1]}
      position={[0, 0, -200]}
      renderOrder={0}
      raycast={() => null}
    />
  );
}
