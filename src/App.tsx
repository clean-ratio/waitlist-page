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
import CoverText from './ui/CoverText';
import GlassForm from './ui/GlassForm';
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
  STEP_COVER,
  STEP_FIRST_CARD,
  STEP_GLASS,
  STEP_QUESTIONS,
  STEP_THANKS,
  imageCardAt,
} from './lib/content';
import { preloadAhead } from './gl/useCardTextures';

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

  useStepInput();
  useDeckAudio();

  const [useWebGL, setUseWebGL] = useState(webglAvailable);
  const [stageReady, setStageReady] = useState(false);

  // Boot the scene after the first paint, never before it.
  useEffect(() => {
    if (!useWebGL) return;
    const id = window.setTimeout(() => setStageReady(true), 0);
    return () => window.clearTimeout(id);
  }, [useWebGL]);

  const onContextLost = useCallback(() => {
    console.warn('[deck] WebGL context lost; falling back to HTML');
    setUseWebGL(false);
  }, []);

  const { step } = state;
  const activeIndex = Math.min(step, DECK_LENGTH - 1);
  const exiting = step >= STEP_QUESTIONS;

  /*
   * Once they are on the list the gate is retired: the reducer steps over it
   * and the deck treats it as already passed. Not while they are still
   * standing on it, though — the welcome plate is on screen for a moment
   * after the submit, and pulling the card out from under it looks like a
   * bug.
   */
  const retireGlass = state.lead.status === 'done' && step !== STEP_GLASS;

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
      : (exiting ? TRANSITION.exitDuration : TRANSITION.duration) +
        TRANSITION.stagger * 4;
    const id = window.setTimeout(
      () => dispatch({ type: 'ANIM_END' }),
      duration * 1000,
    );
    return () => window.clearTimeout(id);
  }, [step, exiting, reducedMotion, dispatch]);

  // Two cards ahead, so none ever arrives empty.
  useEffect(() => {
    preloadAhead(step - STEP_FIRST_CARD);
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
    : step === STEP_COVER
      ? 'Cover'
      : step === STEP_GLASS
        ? 'Enter your name and email'
        : step === STEP_QUESTIONS
          ? 'Two questions'
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
      <div className={styles.stage}>
        {useWebGL ? (
          <Suspense fallback={null}>
            {stageReady && (
              <Stage
                metrics={metrics}
                activeIndex={activeIndex}
                exiting={exiting}
                retireGlass={retireGlass}
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
            exiting={exiting}
            retireGlass={retireGlass}
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
          className={`${overlay.cardBox} ${
            step === STEP_GLASS ? overlay.cardBoxInteractive : ''
          }`}
          style={{ display: exiting ? 'none' : undefined }}
        >
          {step === STEP_COVER && <CoverText active />}
          {step === STEP_GLASS && <GlassForm active />}
          {card && <CardLabels card={card} active />}
        </div>

        <p className={styles.liveRegion} role="status" aria-live="polite">
          {announcement}
        </p>
      </section>

      <Questions active={step === STEP_QUESTIONS} />
      <Thanks active={step === STEP_THANKS} />

      {/* Outside the overlay: the overlay is its own stacking context, and the
          panel has to stay above the questions page. */}
      <NowPlaying isPhone={viewport.isPhone} />

    </div>
  );
}
