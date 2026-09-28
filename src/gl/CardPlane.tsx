import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { createCardMaterial, createShadowMaterial } from './cardMaterial';
import type { CardTexture } from './useCardTextures';
import type { Tone } from '../lib/content';
import { slotOrder } from '../lib/deckLayout';

/** One card's animated values. GSAP owns these; the mesh only reads them. */
export type CardState = {
  /** Screen-space offset in CSS pixels (y is positive downwards, like CSS). */
  x: number;
  y: number;
  scale: number;
  dim: number;
  alpha: number;
  /** The 1.04 → 1.00 settle of the image inside the active card. */
  zoom: number;
};

export function createCardState(): CardState {
  return { x: 0, y: 0, scale: 1, dim: 1, alpha: 1, zoom: 1 };
}

type Props = {
  state: CardState;
  slot: number;
  cardW: number;
  cardH: number;
  tone: Tone;
  glass?: boolean;
  image?: CardTexture;
  focal?: { x: number; y: number };
  flex: boolean;
  onStep: (slot: number) => void;
  label: string;
};

/** How fast a card has to move for the flex to reach full strength (px/s). */
const FULL_SPEED = 700;

const PLANE = new THREE.PlaneGeometry(1, 1, 24, 24);
const SHADOW_PLANE = new THREE.PlaneGeometry(1, 1);

export default function CardPlane({
  state,
  slot,
  cardW,
  cardH,
  tone,
  glass,
  image,
  focal,
  flex,
  onStep,
  label,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const previous = useRef({ x: 0, y: 0 });
  const velocity = useRef(new THREE.Vector2());

  const material = useMemo(
    () => createCardMaterial({ tone, glass }),
    [tone, glass],
  );
  const shadowMaterial = useMemo(() => createShadowMaterial(), []);

  useEffect(() => {
    return () => {
      material.dispose();
      shadowMaterial.dispose();
    };
  }, [material, shadowMaterial]);

  useEffect(() => {
    material.uniforms.uTex.value = image?.texture ?? null;
    material.uniforms.uHasTex.value = image ? 1 : 0;
    material.uniforms.uImageAspect.value = image?.aspect ?? 0.8;
    material.needsUpdate = true;
  }, [material, image]);

  useEffect(() => {
    material.uniforms.uFocal.value.set(
      (focal?.x ?? 50) / 100,
      1 - (focal?.y ?? 50) / 100, // focal y is measured from the top, like CSS
    );
  }, [material, focal]);

  useEffect(() => {
    material.uniforms.uFlex.value = flex ? 1 : 0;
    if (!flex) material.uniforms.uVelocity.value.set(0, 0);
  }, [material, flex]);

  useFrame((_, delta) => {
    const node = group.current;
    const card = mesh.current;
    if (!node || !card) return;

    const visible = state.alpha > 0.005;
    node.visible = visible;
    if (!visible) return;

    // CSS convention in, WebGL convention out: screen-down is world-down.
    node.position.set(state.x, -state.y, -Math.abs(slot));

    const w = cardW * state.scale;
    const h = cardH * state.scale;
    card.scale.set(w, h, 1);

    const dt = Math.max(delta, 1 / 240);
    velocity.current.set(
      (state.x - previous.current.x) / dt / FULL_SPEED,
      -(state.y - previous.current.y) / dt / FULL_SPEED,
    );
    velocity.current.clampScalar(-1, 1);
    previous.current.x = state.x;
    previous.current.y = state.y;

    const uniforms = material.uniforms;
    uniforms.uPlaneSize.value.set(w, h);
    uniforms.uDim.value = state.dim;
    /*
     * The glass slot is mostly a hole. When it is in front, the HTML form is
     * the card and this plane only needs to be there for the shadow; further
     * back it firms up so the stack still reads as a card.
     */
    uniforms.uAlpha.value = glass
      ? state.alpha * (slot === 0 ? 0.08 : 0.5)
      : state.alpha;
    uniforms.uZoom.value = state.zoom;
    if (flex) uniforms.uVelocity.value.copy(velocity.current);

    card.renderOrder = slotOrder(slot);

    if (shadow.current) {
      shadow.current.scale.set(w * 1.18, h * 1.18, 1);
      shadow.current.position.set(w * 0.01, -h * 0.03, -0.001);
      shadow.current.renderOrder = slotOrder(slot) - 0.5;
      shadowMaterial.uniforms.uAlpha.value = state.alpha * state.dim;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    // The centre card is the one you are looking at; only peeking cards step.
    if (slot !== 0) onStep(slot);
  };

  return (
    <group ref={group}>
      <mesh
        ref={shadow}
        geometry={SHADOW_PLANE}
        material={shadowMaterial}
        raycast={() => null}
      />
      <mesh
        ref={mesh}
        geometry={PLANE}
        material={material}
        onClick={handleClick}
        onPointerOver={() => {
          if (slot !== 0) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
        userData={{ label }}
      />
    </group>
  );
}
