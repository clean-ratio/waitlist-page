import styles from './Overlay.module.css';
import type { ImageCard } from '../lib/content';
import { IMAGE_CARDS } from '../lib/content';
import { Reveal, Words } from './motion';
import useLanded from './useLanded';

/**
 * Title, kicker and index for the card in the centre. Positioned over the
 * centre rectangle, because the active card is always exactly there — and
 * held back until the card has stopped travelling, since text sliding across
 * the screen is what makes these decks feel cheap.
 */
export default function CardLabels({
  card,
  active,
}: {
  card: ImageCard;
  active: boolean;
}) {
  const landed = useLanded(active);
  const index = IMAGE_CARDS.findIndex((c) => c.id === card.id) + 1;
  const total = IMAGE_CARDS.length;

  return (
    <div
      className={`${styles.labels} ${card.tone === 'dark' ? styles.labelsDark : ''}`}
      inert={!active}
    >
      <Reveal className={styles.labelsTop} play={landed} y={8}>
        <p className={`u-label ${styles.kicker}`}>{card.kicker}</p>
        <p className={`u-label ${styles.index}`}>
          {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </p>
      </Reveal>

      <div />

      <div>
        {/* Keyed on the card, so the words re-run on every step. */}
        <h2 key={card.id} className={`u-serif ${styles.title}`}>
          <Words text={card.title} play={landed} stagger={0.07} />
        </h2>
        {card.caption && (
          <Reveal as="p" className={styles.caption} play={landed} delay={0.18} y={8}>
            {card.caption}
          </Reveal>
        )}
      </div>
    </div>
  );
}
