import { useEffect } from 'react';
import styles from './FallbackDeck.module.css';
import { DECK_STEPS, imageCardAt, type DeckPhase } from '../lib/content';
import { TRANSITION, slotOrder, targetProps } from '../lib/deckLayout';
import type { DeckMetrics } from '../lib/deckLayout';
import { track } from '../lib/analytics';

type Props = {
  metrics: DeckMetrics;
  activeIndex: number;
  phase: DeckPhase;
  step: number;
  onStep: (slot: number) => void;
};

export default function FallbackDeck({
  metrics,
  activeIndex,
  phase,
  step,
  onStep,
}: Props) {
  useEffect(() => {
    track('webgl_fallback');
  }, []);

  const ambient = imageCardAt(step);

  return (
    <div className={styles.deck}>
      <div
        className={styles.ambient}
        style={
          ambient ? { backgroundImage: `url(${ambient.src})` } : { opacity: 0 }
        }
        aria-hidden="true"
      />

      {DECK_STEPS.map((deckStep, i) => {
        const slot = i - activeIndex;
        const props = targetProps(phase, slot, metrics);
        const leaving = slot < 0 || phase !== 'in';
        const card = deckStep;

        return (
          <div
            key={deckStep.id}
            className={[
              styles.card,
              card.tone === 'dark' ? styles.cardDark : '',
              phase === 'in' && slot !== 0 && props.alpha > 0 ? styles.clickable : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--x': `${props.x}px`,
                '--y': `${props.y}px`,
                '--scale': props.scale,
                '--dim': props.dim,
                '--alpha': props.alpha,
                '--delay': `${Math.min(Math.abs(slot), 3) * TRANSITION.stagger}s`,
                ...(leaving
                  ? {
                      '--fade-duration': 'calc(var(--step-duration) * 0.85)',
                      '--fade-ease': 'cubic-bezier(0.6, 0, 0.9, 0.3)',
                    }
                  : null),
                zIndex: slotOrder(slot),
              } as React.CSSProperties
            }
            onClick={slot === 0 || phase !== 'in' ? undefined : () => onStep(slot)}
            aria-hidden="true"
          >
            <img
                className={styles.image}
                src={card.src}
                alt=""
                style={
                  {
                    '--focal-x': `${card.focal?.x ?? 50}%`,
                    '--focal-y': `${card.focal?.y ?? 50}%`,
                  } as React.CSSProperties
                }
                // The first cards are needed the moment the deck arrives.
                loading={i <= 1 ? 'eager' : 'lazy'}
                decoding="async"
              />
          </div>
        );
      })}
    </div>
  );
}
