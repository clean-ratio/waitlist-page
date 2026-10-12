import { useEffect, useState } from 'react';
import { Canvas, useThree, type RootState } from '@react-three/fiber';
import Deck from './Deck';
import type { DeckMetrics } from '../lib/deckLayout';
import type { DeckPhase } from '../lib/content';

type Props = {
  metrics: DeckMetrics;
  activeIndex: number;
  phase: DeckPhase;
  reducedMotion: boolean;
  onStep: (slot: number) => void;
  onContextLost: () => void;
};

function RenderVisibility({ canvas }: { canvas: HTMLCanvasElement | null }) {
  const setFrameloop = useThree((state) => state.setFrameloop);

  useEffect(() => {
    const syncVisibility = () => {
      setFrameloop(document.hidden ? 'never' : 'demand');
    };
    const observer = new IntersectionObserver(([entry]) => {
      setFrameloop(entry.isIntersecting && !document.hidden ? 'demand' : 'never');
    });

    if (canvas) observer.observe(canvas);
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
      setFrameloop('demand');
    };
  }, [canvas, setFrameloop]);

  return null;
}

/**
 * The WebGL stage. It stays mounted for the whole visit — remounting the
 * Canvas throws away the context and every uploaded texture, which shows up as
 * a visible flash.
 *
 * Camera: orthographic, 1 unit = 1 CSS pixel, origin at screen centre. That is
 * what lets `slotProps` work in pixels and the HTML labels sit exactly over
 * the cards with no projection maths.
 */
export default function Stage({
  metrics,
  activeIndex,
  phase,
  reducedMotion,
  onStep,
  onContextLost,
}: Props) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas) return;
    const onLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [canvas, onContextLost]);

  const onCreated = (state: RootState) => {
    setCanvas(state.gl.domElement);
  };

  return (
    <Canvas
      // Nothing moves most of the time. Renders are requested explicitly:
      // GSAP asks for one per tick during a step, the fog asks while it drifts.
      frameloop="demand"
      orthographic
      camera={{ position: [0, 0, 1000], near: 0.1, far: 2000, zoom: 1 }}
      // Caps the retina cost. Above 1.75 there is nothing left to see.
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={onCreated}
      style={{ position: 'fixed', inset: 0 }}
      aria-hidden="true"
    >
      <RenderVisibility canvas={canvas} />
      <Deck
        metrics={metrics}
        activeIndex={activeIndex}
        phase={phase}
        reducedMotion={reducedMotion}
        onStep={onStep}
      />
    </Canvas>
  );
}
