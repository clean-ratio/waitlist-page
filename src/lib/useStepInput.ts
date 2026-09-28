import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { useStore } from './store';

gsap.registerPlugin(Observer);

/** Layer 2: quiet time after a step lands, to swallow trackpad inertia. */
const COOLDOWN_MS = 350;
/** Layer 3: a wheel burst this quiet counts as a new gesture. */
const QUIET_MS = 180;
/** …or a deltaY this much larger than the last one. Inertia only ever decays. */
const SPIKE = 1.5;
/**
 * How long after a step the inertia filter stays armed. A MacBook's inertia
 * runs for about a second; nothing decays for longer than this. Past it, any
 * wheel event is a new gesture, so a steady scroll never feels dead.
 */
const INERTIA_WINDOW_MS = 1500;

/**
 * The page never scrolls. Every wheel, swipe and key press becomes exactly one
 * NEXT or PREV, and a three-layer lock drops everything else.
 *
 * Layer 1 alone (the animation lock) fails on MacBook trackpads: one swipe
 * sends 30–100 wheel events and inertia keeps sending them for about a second,
 * which would skip four cards.
 */
export function useStepInput(enabled = true): void {
  const { dispatch, stateRef } = useStore();
  /** Earliest time the next step may be accepted. */
  const readyAt = useRef(0);
  /** When the last step was accepted, for arming the inertia filter. */
  const steppedAt = useRef(-Infinity);
  /** Time and size of the previous wheel event, for the inertia filter. */
  const lastWheel = useRef({ t: 0, d: 0 });

  useEffect(() => {
    if (!enabled) return;

    /**
     * Records every wheel event and reports whether it starts a new gesture.
     *
     * The recording has to happen even when the step is then refused: the
     * filter measures the quiet time between *events*, not between accepted
     * steps. Miss that and one swipe's tail looks like a fresh gesture the
     * moment the animation lock lets go, and the deck moves two cards.
     */
    const isFreshGesture = (event: Event | null | undefined): boolean => {
      // Touch and keyboard have real end events; only wheel needs the filter.
      if (!event || !('deltaY' in event)) return true;

      const now = performance.now();
      const d = Math.abs((event as WheelEvent).deltaY);
      const previous = lastWheel.current;
      lastWheel.current = { t: now, d };

      // Nothing decays for longer than the inertia window, so past it every
      // event counts.
      if (now - steppedAt.current > INERTIA_WINDOW_MS) return true;

      return now - previous.t > QUIET_MS || d > previous.d * SPIKE;
    };

    const tryStep = (type: 'NEXT' | 'PREV', event?: Event | null) => {
      // Layer 3 runs first so that it sees every event, not just the ones the
      // other two layers let through.
      const fresh = isFreshGesture(event);
      // Layer 1: never interrupt a transition.
      if (stateRef.current.animating) return;
      // Layer 2: cooldown after the last one.
      if (performance.now() < readyAt.current) return;
      if (!fresh) return;

      steppedAt.current = performance.now();
      readyAt.current = steppedAt.current + COOLDOWN_MS;
      dispatch({ type });
    };

    const observer = Observer.create({
      target: window,
      type: 'wheel,touch,pointer',
      wheelSpeed: -1, // same convention as GSAP's full-screen demo
      tolerance: 12, // px of travel before a gesture counts
      preventDefault: true,
      // preventDefault would otherwise swallow the click that follows a tap,
      // which is how checkboxes and buttons are operated on a phone.
      allowClicks: true,
      // Form fields and the questions wrapper scroll natively.
      ignore: 'input, textarea, select, label, button, a, [data-scrollable]',
      onUp: (self) => tryStep('NEXT', self.event),
      onDown: (self) => tryStep('PREV', self.event),
    });

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown':
          event.preventDefault();
          tryStep('NEXT');
          break;
        case ' ':
          event.preventDefault();
          tryStep(event.shiftKey ? 'PREV' : 'NEXT');
          break;
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault();
          tryStep('PREV');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      observer.kill();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dispatch, stateRef, enabled]);
}

/**
 * Clicking a peeking card steps the deck. Shares the same cooldown as the
 * scroll path so a fast double-click cannot skip a card.
 */
export function useStepTo() {
  const { dispatch, stateRef } = useStore();
  const readyAt = useRef(0);

  return (slot: number) => {
    if (slot === 0) return;
    if (stateRef.current.animating) return;
    if (performance.now() < readyAt.current) return;
    readyAt.current = performance.now() + COOLDOWN_MS;
    dispatch({ type: slot > 0 ? 'NEXT' : 'PREV' });
  };
}
