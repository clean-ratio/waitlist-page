import { useEffect, useState } from 'react';
import type { DeckMetrics } from './deckLayout';

export type Viewport = DeckMetrics & {
  vw: number;
  vh: number;
  /** Under 640 px: the Now Playing panel collapses and the stack tightens. */
  isPhone: boolean;
  /** Under 480 px: card width leads and height follows. */
  isNarrow: boolean;
};

const CARD_ASPECT = 4 / 5;

function measure(vw: number, vh: number): Viewport {
  const isPhone = vw < 640;
  const isNarrow = vw < 480;

  const cardW = isNarrow
    ? Math.round(vw * 0.78)
    : Math.round(Math.min(vh * 0.64, 720) * CARD_ASPECT);
  const cardH = Math.round(cardW / CARD_ASPECT);

  return {
    vw,
    vh,
    cardW,
    cardH,
    // 8% of the card's own width and height, read off the reference clip
    // (21 px on a 243 px card, 24 px on a 304 px one). Tighter on phones, so
    // the peeking cards stay on screen.
    stepX: isPhone ? 0.06 : 0.086,
    stepY: isPhone ? 0.055 : 0.079,
    isPhone,
    isNarrow,
  };
}

function initial(): Viewport {
  if (typeof window === 'undefined') return measure(1280, 800);
  return measure(window.innerWidth, window.innerHeight);
}

/**
 * Card geometry in CSS pixels, shared by the WebGL layer and the HTML layer so
 * the two can never drift apart.
 *
 * Height is read like `svh`: when the mobile URL bar or the on-screen keyboard
 * shrinks the viewport, the deck keeps the size it had. Resizing the deck
 * mid-animation is the thing `svh` exists to prevent.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(initial);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const typing =
          document.activeElement instanceof HTMLElement &&
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

        setViewport((prev) => {
          // A height-only change while a field has focus is the keyboard
          // opening. GlassForm handles that by moving itself, not by resizing
          // the deck.
          if (typing && vw === prev.vw) return prev;
          if (vw === prev.vw && vh === prev.vh) return prev;
          return measure(vw, vh);
        });
      });
    };

    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return viewport;
}

/** Motion and sound are separate settings; this only governs motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
