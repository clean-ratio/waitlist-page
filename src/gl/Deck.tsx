import { useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useThree } from '@react-three/fiber';
import CardPlane, { createCardState, type CardState } from './CardPlane';
import Backdrop from './Backdrop';
import { useCardTextures } from './useCardTextures';
import { DECK_STEPS } from '../lib/content';
import type { DeckPhase } from '../lib/content';
import {
  MAX_VISIBLE,
  TRANSITION,
  targetProps,
  type DeckMetrics,
} from '../lib/deckLayout';

type Props = {
  metrics: DeckMetrics;
  /** Index into DECK_STEPS. Clamped by the caller. */
  activeIndex: number;
  /** Waiting off-frame down-right, on screen, or gone up-left. */
  phase: DeckPhase;
  reducedMotion: boolean;
  onStep: (slot: number) => void;
};

export default function Deck({
  metrics,
  activeIndex,
  phase,
  reducedMotion,
  onStep,
}: Props) {
  const invalidate = useThree((state) => state.invalidate);
  const textures = useCardTextures();

  // One plain object per card. GSAP tweens numbers; the meshes read them every
  // frame. No card owns any animation code.
  const cards = useRef<CardState[] | null>(null);
  if (!cards.current) {
    // Seeded at the right slots, so the deck opens as a stack rather than
    // fanning out from a pile on the first frame.
    cards.current = DECK_STEPS.map((_, i) => ({
      ...createCardState(),
      ...targetProps(phase, i - activeIndex, metrics),
    }));
  }
  const states = cards.current;

  const slots = useMemo(
    () => DECK_STEPS.map((_, i) => i - activeIndex),
    [activeIndex],
  );

  /** A whole-deck move: arriving from the questions, or leaving for the end. */
  const travelling = phase !== 'in';

  /** Where each card is headed this step. */
  const targetFor = (slot: number) => targetProps(phase, slot, metrics);

  useGSAP(
    () => {
      if (reducedMotion) {
        // Steps become a 300 ms opacity crossfade. The stack still reads; it
        // just does not travel.
        states.forEach((state, i) => {
          const target = targetFor(slots[i]);
          gsap.set(state, {
            x: target.x,
            y: target.y,
            scale: target.scale,
            dim: target.dim,
            zoom: 1,
          });
          gsap.to(state, {
            alpha: target.alpha,
            duration: TRANSITION.reducedDuration,
            ease: 'none',
            onUpdate: invalidate,
          });
        });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          duration: travelling ? TRANSITION.exitDuration : TRANSITION.duration,
          ease: TRANSITION.ease,
        },
        // With frameloop="demand" the canvas only redraws when asked. Asking
        // once per GSAP tick is the same thing as frameloop="always" for the
        // length of the step, without a mode flag to get out of sync.
        onUpdate: invalidate,
      });

      states.forEach((state, i) => {
        const slot = slots[i];
        const target = targetFor(slot);
        const leaving = slot < 0 || travelling;
        // 30 ms per slot. Enough that the deck feels like paper rather than
        // one rigid block; more than 50 ms and it starts to look sloppy.
        const at = Math.min(Math.abs(slot), MAX_VISIBLE) * TRANSITION.stagger;

        timeline.to(
          state,
          {
            x: target.x,
            y: target.y,
            scale: target.scale,
            dim: target.dim,
            // A card on its way out accelerates away instead of easing to a
            // stop somewhere nobody can see.
            ease: leaving ? TRANSITION.departEase : TRANSITION.ease,
          },
          at,
        );

        /*
         * Opacity is tweened separately so the card that is leaving stays
         * solid for most of its travel and only goes as it clears the edge.
         * Sharing one ease would dissolve it in mid-air, halfway across the
         * screen, which reads as a glitch rather than as an exit.
         */
        timeline.to(
          state,
          {
            alpha: target.alpha,
            ease: leaving ? 'power3.in' : 'power1.out',
            duration: leaving
              ? (travelling ? TRANSITION.exitDuration : TRANSITION.duration) * 0.85
              : TRANSITION.duration * 0.6,
          },
          at,
        );

        // The image inside the active card settles from 1.04 to 1.00. That
        // slow drift is most of what makes it feel expensive.
        if (slot === 0 && !travelling) {
          timeline.fromTo(
            state,
            { zoom: 1.04 },
            { zoom: 1, duration: 1.2, ease: 'power2.out' },
            0,
          );
        } else {
          timeline.set(state, { zoom: 1 }, 0);
        }
      });
    },
    { dependencies: [activeIndex, phase, reducedMotion, metrics], revertOnUpdate: false },
  );

  return (
    <>
      <Backdrop
        activeId={phase === 'in' ? (DECK_STEPS[activeIndex]?.id ?? null) : null}
        textures={textures}
        reducedMotion={reducedMotion}
        fogActive={false}
      />

      {DECK_STEPS.map((step, i) => {
        const slot = slots[i];

        return (
          <CardPlane
            key={step.id}
            state={states[i]}
            slot={slot}
            cardW={metrics.cardW}
            cardH={metrics.cardH}
            tone={step.tone}
            image={textures[step.id]}
            focal={step.focal}
            flex={!reducedMotion}
            // Off-screen cards are not clickable targets.
            onStep={phase === 'in' ? onStep : () => undefined}
            label={step.title}
          />
        );
      })}
    </>
  );
}
