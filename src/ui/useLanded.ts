import { useEffect, useState } from 'react';
import { TRANSITION } from '../lib/deckLayout';

/**
 * True once the card has finished travelling. Labels fade in after this, never
 * during the move — text sliding across the screen is what makes these decks
 * feel cheap.
 */
export default function useLanded(active: boolean, delay = TRANSITION.duration * 1000) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!active) {
      setLanded(false);
      return;
    }
    const id = window.setTimeout(() => setLanded(true), delay * 0.55);
    return () => window.clearTimeout(id);
  }, [active, delay]);

  return landed;
}
