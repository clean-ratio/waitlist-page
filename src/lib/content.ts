export type Tone = 'light' | 'dark';

export type Track = {
  /**
   * Sources in order of preference; the first the browser can play wins.
   * The supplied MPEG audio files live in public/sounds.
   */
  src: string[];
  title: string;
  /** 0–1. Normalise by ear after loudness-matching to about −16 LUFS. */
  volume: number;
  /** Seconds. Skips a slow intro so the card lands on music. */
  startAt?: number;
};

export type ImageCard = {
  kind: 'image';
  id: string;
  src: `/images/${string}`;
  /** A real description. Screen readers read this. */
  alt: string;
  title: string;
  kicker: string;
  caption?: string;
  /** Card stock behind the image. */
  tone: Tone;
  track: Track;
  /** object-position equivalent, 0–100. Keeps the subject in frame on any crop. */
  focal?: { x: number; y: number };
  /**
   * Cut-out PNG of the subject for the Now Playing panel (transparent, ~600 px
   * tall, under 150 KB). Optional: the panel falls back to the card image.
   */
  thumb?: `/images/cutouts/${string}.png`;
  panelTitle?: string;
};

export type Step =
  | { kind: 'hero' }
  | { kind: 'questions' }
  | ImageCard
  | { kind: 'thanks' };

export const WORDMARK = 'CLEAN RATIO';
export const LOCATION_LINE = 'EST. 2026';

/**
 * The first screen: one photograph, slowly moving, with the waitlist form on
 * it. Everything below it is for people who choose to keep scrolling.
 */
export const HERO = {
  kicker: 'Waitlist — now open',
  line: 'Return to your',
  lineItalic: 'natural rhythm.',
  description: 'Nature-led rituals for recovery, healing, and the days in between.',
  hint: 'Scroll to build your recovery profile',
  image: {
    /** 16:9, cut from the 1904 × 2544 original. */
    wide: '/images/hero/glacier-wide.webp',
    /** 3:4, for portrait screens. */
    tall: '/images/hero/glacier-tall.webp',
    alt: 'A glacier lagoon: walls of blue ice around a natural arch, with floating ice in still water.',
  },
  /**
   * Optional looping clip. Leave undefined and the still above is animated in
   * CSS instead; drop an MP4/WebM path in here and the hero plays it, with the
   * still as its poster.
   */
  video: undefined as string | undefined,
};

const CARD_CONTENT = [
  {
    kind: 'image',
    id: 'c01',
    src: '/images/collection/cooling-pink-salt.webp',
    alt: 'Rose-pink salt shoreline meets still blue-green water.',
    title: 'Cooling',
    caption: 'A cool breath. A softer landing.',
    tone: 'light',
    focal: { x: 55, y: 52 },
    track: {
      src: ['/sounds/deep_dive.mpeg'],
      title: 'A Cooler Breath',
      volume: 0.45,
    },
  },
  {
    kind: 'image',
    id: 'c02',
    src: '/images/collection/muscle-recovery-sage-img-2711.webp',
    alt: 'Soft sage grasses across a quiet, open landscape.',
    title: 'Muscle Recovery',
    caption: 'Make room to settle back in.',
    tone: 'light',
    focal: { x: 50, y: 60 },
    track: {
      src: ['/sounds/river_side.mpeg'],
      title: 'Under Open Sky',
      volume: 0.45,
    },
  },
  {
    kind: 'image',
    id: 'c04',
    src: '/images/collection/skin-recovery-lilac-img-2806.webp',
    alt: 'Cherry blossoms arch over a softly lit woodland path.',
    title: 'Skin Recovery',
    caption: 'Let a little softness return.',
    tone: 'light',
    focal: { x: 50, y: 48 },
    track: {
      src: ['/sounds/calm_home.mpeg'],
      title: 'Return to Stillness',
      volume: 0.4,
    },
  },
] satisfies Omit<ImageCard, 'kicker'>[];

export const IMAGE_CARDS: ImageCard[] = CARD_CONTENT.map((card, index) => ({
  ...card,
  kicker: `Collection ${String(index + 1).padStart(2, '0')} / ${String(CARD_CONTENT.length).padStart(2, '0')}`,
}));

/**
 * Plays quietly on the cover if someone presses Play before the form — the
 * second unlock path, so nobody has to give an email to hear the page.
 *
 * Shares the beach recording with the first card and loads on demand.
 */
export const INTRO_TRACK: Track = {
  src: ['/sounds/beach_side.mpeg'],
  title: 'Before we begin',
  volume: 0.28,
};

/**
 * The page, top to bottom: the hero with the form, the optional profile
 * questions, the diagonal deck, and a closing step.
 */
export const STEPS: Step[] = [
  { kind: 'hero' },
  { kind: 'questions' },
  ...IMAGE_CARDS,
  { kind: 'thanks' },
];

/** The deck owns the image cards only. */
export const DECK_STEPS = IMAGE_CARDS;
export const DECK_LENGTH = DECK_STEPS.length;

export const STEP_HERO = 0;
export const STEP_QUESTIONS = 1;
export const STEP_FIRST_CARD = 2;
export const STEP_LAST_CARD = STEP_FIRST_CARD + IMAGE_CARDS.length - 1;
export const STEP_THANKS = STEPS.length - 1;

/** Where the deck is relative to the visitor: still to come, on screen, or done. */
export type DeckPhase = 'before' | 'in' | 'after';

export function deckPhase(step: number): DeckPhase {
  if (step < STEP_FIRST_CARD) return 'before';
  if (step > STEP_LAST_CARD) return 'after';
  return 'in';
}

export function imageCardAt(step: number): ImageCard | null {
  const s = STEPS[step];
  return s && s.kind === 'image' ? s : null;
}
