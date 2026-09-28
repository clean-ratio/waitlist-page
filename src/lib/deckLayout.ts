/**
 * Every card's position comes from one number: its slot.
 *
 *   slot = cardIndex − activeIndex
 *
 * Slot 0 is the centre. Positive slots are still to come: they wait **down and
 * to the right**, a little smaller, and step up into the middle one at a time.
 * A card that has been passed does not join a stack behind — it **leaves**,
 * sliding up and to the left and out of the frame, one card per scroll.
 *
 * Change the active index and GSAP tweens each card to its new slot. No card
 * has animation code of its own.
 *
 * The direction is measured, not guessed. Tracking the reference clip
 * frame by frame (`Screen Recording 2026-09-25 173452.mp4`):
 *
 *   - the whole deck drifts at about (−30, −40) px/s, i.e. −127°, up-left;
 *   - the card that is about to become active sits down-right of centre and
 *     smaller, and travels up-left into the middle;
 *   - the outgoing card keeps going and leaves through the top-left.
 *
 * Slot offsets read off the same clip: the card is 243 × 304 px (4:5 exactly),
 * and successive cards are offset by a near-uniform 21 px in x and 24 px in y
 * — about 8% of the card's own width and height, so the stack runs along the
 * card's own diagonal.
 */

/** How many upcoming cards peek out behind the active one. */
export const MAX_VISIBLE = 3;

export type SlotProps = {
  x: number;
  y: number;
  scale: number;
  /** Brightness multiplier, 1 at the centre. */
  dim: number;
  alpha: number;
};

export type DeckMetrics = {
  cardW: number;
  cardH: number;
  /** Fraction of card width each slot steps sideways. Smaller on phones. */
  stepX: number;
  stepY: number;
  /** Viewport, so a leaving card can be sent exactly off-frame. */
  vw: number;
  vh: number;
};

/**
 * Where a card goes when it is done: far enough up the diagonal that its
 * trailing corner has cleared the corner of the screen, so it reads as having
 * left rather than as having been parked just out of sight.
 */
export function departure(m: DeckMetrics): { x: number; y: number } {
  const reach =
    Math.max(
      m.vw / 2 + m.cardW / 2,
      ((m.vh / 2 + m.cardH / 2) * m.cardW) / m.cardH,
    ) * 1.08;
  return { x: -reach, y: (-reach * m.cardH) / m.cardW };
}

/**
 * `x` and `y` are in CSS convention: +x is right, +y is **down**. The WebGL
 * layer negates y on its way to world space.
 */
export function slotProps(slot: number, m: DeckMetrics): SlotProps {
  if (slot < 0) {
    // Gone. Every passed card sits at the same point off-frame, so stepping
    // back brings it in over the same distance it left by.
    const away = departure(m);
    return { x: away.x, y: away.y, scale: 0.94, dim: 0.96, alpha: 0 };
  }

  const d = Math.min(slot, MAX_VISIBLE + 1);
  return {
    x: d * m.cardW * m.stepX, // upcoming wait to the right
    y: d * m.cardH * m.stepY, // upcoming wait below
    scale: 1 - d * 0.04,
    dim: 1 - d * 0.04,
    alpha: d > MAX_VISIBLE ? 0 : 1,
  };
}

/**
 * The deck handing over to the questions step: whatever is still on screen
 * follows the cards that already left, up the same diagonal.
 */
export function exitProps(m: DeckMetrics): SlotProps {
  const away = departure(m);
  return { x: away.x, y: away.y, scale: 0.9, dim: 0.92, alpha: 0 };
}

/**
 * Draw order comes from the slot, not from depth. A card on its way out stays
 * in front of the one taking its place — it was the card you were looking at.
 */
export function slotOrder(slot: number): number {
  return slot < 0 ? 200 + slot : 100 - Math.min(slot, MAX_VISIBLE + 1);
}

export const TRANSITION = {
  duration: 0.9,
  /** A long, soft landing. No bounce, no overshoot, no rotation. */
  ease: 'power3.inOut',
  /** The leaving card gets its own, so it accelerates away rather than easing
   *  to a halt at a position nobody can see. */
  departEase: 'power2.in',
  /** Per-slot stagger. Makes the deck feel like paper, not one rigid block. */
  stagger: 0.03,
  /** Reduced motion: a plain crossfade, no slide. */
  reducedDuration: 0.3,
  /** Deck exit into the questions step. */
  exitDuration: 0.9,
  /** Labels fade in after the card lands. */
  labelDelay: 0.2,
} as const;
