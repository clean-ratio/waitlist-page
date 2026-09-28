import { useEffect } from 'react';
import styles from './FallbackDeck.module.css';
import { DECK_STEPS, imageCardAt } from '../lib/content';
import { TRANSITION, exitProps, slotOrder, slotProps } from '../lib/deckLayout';
import type { DeckMetrics } from '../lib/deckLayout';
import { track } from '../lib/analytics';

type Props = {
  metrics: DeckMetrics;
  activeIndex: number;
  exiting: boolean;
  retireGlass: boolean;
  step: number;
  onStep: (slot: number) => void;
};

export default function FallbackDeck({
  metrics,
  activeIndex,
  exiting,
  retireGlass,
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
        // A retired gate counts as already passed, wherever the deck is.
        const slot =
          retireGlass && deckStep.kind === 'glass' ? -1 : i - activeIndex;
        const props = exiting ? exitProps(metrics) : slotProps(slot, metrics);
        const leaving = slot < 0 || exiting;
        const card = deckStep.kind === 'image' ? deckStep : null;

        return (
          <div
            key={deckStep.kind === 'image' ? deckStep.id : deckStep.kind}
            className={[
              styles.card,
              card?.tone === 'dark' ? styles.cardDark : '',
              slot !== 0 && props.alpha > 0 ? styles.clickable : '',
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
            onClick={slot === 0 ? undefined : () => onStep(slot)}
            aria-hidden="true"
          >
            {card ? (
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
                // Cards 1 and 2 are needed the moment the form is submitted.
                loading={i <= 3 ? 'eager' : 'lazy'}
                decoding="async"
              />
            ) : deckStep.kind === 'glass' ? (
              <div className={styles.glass} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
