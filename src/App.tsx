import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './App.module.css';
import overlay from './ui/Overlay.module.css';
import CornerLabels from './ui/CornerLabels';
import Hero from './ui/Hero';
import CardLabels from './ui/CardLabels';
import NowPlaying from './ui/NowPlaying';
import Questions from './ui/Questions';
import Thanks from './ui/Thanks';
import FallbackDeck from './ui/FallbackDeck';
import { useStore } from './lib/store';
import { useViewport, useReducedMotion } from './lib/useViewport';
import { useStepInput, useStepTo } from './lib/useStepInput';
import { useDeckAudio } from './lib/useDeckAudio';
import { TRANSITION } from './lib/deckLayout';
import {
  DECK_LENGTH,
  IMAGE_CARDS,
  STEP_FIRST_CARD,
  STEP_HERO,
  STEP_QUESTIONS,
  STEP_THANKS,
  deckPhase,
  imageCardAt,
} from './lib/content';
import { preloadAhead } from './gl/useCardTextures';

// Temporary hero-only mask; flip to true to restore the complete page.
const SHOW_SECTIONS_BELOW_HERO = false;

// Lazy so the first paint is HTML text over a CSS background, not a WebGL boot.
const Stage = lazy(() => import('./gl/Stage'));

/** WebGL2 has to be there before we commit to the canvas path. */
function webglAvailable(): boolean {
  try {
    if (!('WebGL2RenderingContext' in window)) return false;
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export default function App() {
  const { state, dispatch } = useStore();
  const viewport = useViewport();
  const reducedMotion = useReducedMotion();
  const stepTo = useStepTo();

  useStepInput(SHOW_SECTIONS_BELOW_HERO);
  useDeckAudio({ heroAmbient: !SHOW_SECTIONS_BELOW_HERO });

  const [useWebGL, setUseWebGL] = useState(webglAvailable);
  const [stageReady, setStageReady] = useState(false);

  // Boot the scene once the hero photograph has had the network to itself.
  // The deck is two scrolls away, so there is time; scrolling boots it at once.
  useEffect(() => {
    if (!SHOW_SECTIONS_BELOW_HERO || !useWebGL) return;
    if (state.step > 0) {
      setStageReady(true);
      return;
    }
    const id = window.setTimeout(() => setStageReady(true), 1500);
    return () => window.clearTimeout(id);
  }, [useWebGL, state.step]);

  const onContextLost = useCallback(() => {
    console.warn('[deck] WebGL context lost; falling back to HTML');
    setUseWebGL(false);
  }, []);

  const { step } = state;
  const phase = deckPhase(step);
  const activeIndex = Math.max(0, Math.min(step - STEP_FIRST_CARD, DECK_LENGTH - 1));
  // A whole-deck move (arriving, leaving) runs on the longer timing.
  const travelling = phase !== 'in' || step === STEP_FIRST_CARD;

  /*
   * The animation lock, in one place, so it holds on both the WebGL and the
   * HTML path. Everything that could move is finished by the time this clears.
   */
  const firstStep = useRef(true);
  useEffect(() => {
    // Nothing travels on mount — the cards are seeded at their slots — so
    // locking here would just ignore the first scroll of the visit.
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    dispatch({ type: 'ANIM_START' });
    const duration = reducedMotion
      ? TRANSITION.reducedDuration
      : (travelling ? TRANSITION.exitDuration : TRANSITION.duration) +
        TRANSITION.stagger * 4;
    const id = window.setTimeout(
      () => dispatch({ type: 'ANIM_END' }),
      duration * 1000,
    );
    return () => window.clearTimeout(id);
  }, [step, travelling, reducedMotion, dispatch]);

  // Two cards ahead, so none ever arrives empty. From the questions step on,
  // so the deck is ready the moment it is scrolled to.
  useEffect(() => {
    if (SHOW_SECTIONS_BELOW_HERO && step >= STEP_QUESTIONS) {
      preloadAhead(step - STEP_FIRST_CARD);
    }
  }, [step]);

  const metrics = useMemo(
    () => ({
      cardW: viewport.cardW,
      cardH: viewport.cardH,
      stepX: viewport.stepX,
      stepY: viewport.stepY,
      vw: viewport.vw,
      vh: viewport.vh,
    }),
    [
      viewport.cardW,
      viewport.cardH,
      viewport.stepX,
      viewport.stepY,
      viewport.vw,
      viewport.vh,
    ],
  );

  const card = imageCardAt(step);
  const cardIndex = card ? IMAGE_CARDS.findIndex((c) => c.id === card.id) + 1 : 0;

  const announcement = card
    ? `Card ${cardIndex} of ${IMAGE_CARDS.length}: ${card.title}`
    : step === STEP_HERO
      ? 'Join the waitlist'
      : step === STEP_QUESTIONS
        ? 'Lifestyle and recovery profile'
        : 'Thank you';

  return (
    <div
      className={styles.app}
      style={
        {
          '--card-w': `${viewport.cardW}px`,
          '--card-h': `${viewport.cardH}px`,
        } as React.CSSProperties
      }
    >
      {SHOW_SECTIONS_BELOW_HERO && (
        <>
          <div className={styles.stage}>
            {useWebGL ? (
              <Suspense fallback={null}>
                {stageReady && (
                  <Stage
                    metrics={metrics}
                    activeIndex={activeIndex}
                    phase={phase}
                    reducedMotion={reducedMotion}
                    onStep={stepTo}
                    onContextLost={onContextLost}
                  />
                )}
              </Suspense>
            ) : (
              <FallbackDeck
                metrics={metrics}
                activeIndex={activeIndex}
                phase={phase}
                step={step}
                onStep={stepTo}
              />
            )}
          </div>

          <section
            className={styles.overlay}
            aria-roledescription="carousel"
            aria-label={`An invitation, in ${IMAGE_CARDS.length} cards`}
          >
            <CornerLabels step={step} />

            {/* The active card always sits at screen centre, so its text simply
                sits over that rectangle. */}
            <div
              className={overlay.cardBox}
              style={{ display: phase === 'in' ? undefined : 'none' }}
            >
              {card && <CardLabels card={card} active />}
            </div>

            <p className={styles.liveRegion} role="status" aria-live="polite">
              {announcement}
            </p>
          </section>
        </>
      )}

      <Hero active={!SHOW_SECTIONS_BELOW_HERO || step === STEP_HERO} stepping={SHOW_SECTIONS_BELOW_HERO} />
      {SHOW_SECTIONS_BELOW_HERO && (
        <>
          <Questions active={step === STEP_QUESTIONS} />
          <Thanks active={step === STEP_THANKS} />

          {/* Outside the overlay: the overlay is its own stacking context, and the
              panel has to stay above the questions page. */}
          <NowPlaying isPhone={viewport.isPhone} />
        </>
      )}

    </div>
  );
}
