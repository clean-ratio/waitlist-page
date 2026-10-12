import styles from './Overlay.module.css';
import {
  IMAGE_CARDS,
  LOCATION_LINE,
  WORDMARK,
  imageCardAt,
} from '../lib/content';

/**
 * Four tiny mono labels hold the corners. Nothing else is fixed on screen: no
 * nav, no cart, no cookie banner over the deck.
 *
 * Bottom-left belongs to the Now Playing panel — a corner the deck never
 * reaches, since it travels the up-left / down-right diagonal.
 */
export default function CornerLabels({ step }: { step: number }) {
  const card = imageCardAt(step);
  const index = card ? IMAGE_CARDS.findIndex((c) => c.id === card.id) + 1 : 0;

  return (
    <>
      <p className={`u-label ${styles.corner} ${styles.cornerTopLeft}`}>
        {WORDMARK}
      </p>
      <p className={`u-label ${styles.corner} ${styles.cornerTopRight}`}>
        {LOCATION_LINE}
      </p>
      <div className={`${styles.corner} ${styles.cornerBottomRight}`}>
        {card && (
          <p className="u-label">
            {String(index).padStart(2, '0')} — {String(IMAGE_CARDS.length).padStart(2, '0')}
          </p>
        )}
      </div>
    </>
  );
}
