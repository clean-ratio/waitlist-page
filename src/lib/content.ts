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
  | { kind: 'cover' }
  | { kind: 'glass' }
  | ImageCard
  | { kind: 'questions' }
  | { kind: 'thanks' };

export const WORDMARK = 'CLEAN RATIO';
export const LOCATION_LINE = 'EST. 2026';

export const COVER = {
  kicker: WORDMARK,
  line: 'A quieter kind',
  lineItalic: 'of living.',
  description:
    'Quiet places, familiar sounds, and a moment to yourself.',
  hint: 'SCROLL',
};

const CARD_CONTENT = [
  {
    kind: 'image',
    id: 'c01',
    src: '/images/beach-side.jpg',
    alt: 'Palms line a white sand beach beside turquoise water and green mountains.',
    title: 'Beach Side',
    caption: 'Nothing scheduled until the tide turns.',
    tone: 'light',
    focal: { x: 45, y: 55 },
    track: {
      src: ['/sounds/beach_side.mpeg'],
      title: 'Beach Side',
      volume: 0.5,
    },
  },
  {
    kind: 'image',
    id: 'c02',
    src: '/images/vacation.jpg',
    alt: 'A sea cave opens onto a sunlit beach, with hanging vines above calm turquoise water.',
    title: 'Vacation Vibe',
    caption: 'Somewhere with no reason to hurry.',
    tone: 'light',
    focal: { x: 40, y: 55 },
    track: {
      src: ['/sounds/vacation_vibe.mpeg'],
      title: 'Vacation Vibe',
      volume: 0.5,
    },
  },
  {
    kind: 'image',
    id: 'c03',
    src: '/images/river-side.jpg',
    alt: 'Deer stand in a rocky stream beneath a waterfall surrounded by green forest.',
    title: 'River Side',
    caption: 'Follow the water, forget the hour.',
    tone: 'dark',
    focal: { x: 50, y: 50 },
    track: {
      src: ['/sounds/river_side.mpeg'],
      title: 'River Side',
      volume: 0.45,
    },
  },
  {
    kind: 'image',
    id: 'c04',
    src: '/images/deep-dive.jpg',
    alt: 'A scuba diver explores a blue underwater cavern beneath shafts of sunlight.',
    title: 'Deep Dive',
    caption: 'Below the surface, everything slows.',
    tone: 'dark',
    focal: { x: 55, y: 50 },
    track: {
      src: ['/sounds/deep_dive.mpeg'],
      title: 'Deep Dive',
      volume: 0.45,
    },
  },
  {
    kind: 'image',
    id: 'c06',
    src: '/images/road_trip.jpg',
    alt: 'A coastal road curves between green hills and the ocean, seen through a car windshield.',
    title: 'Road Trip',
    caption: 'Take the long way along the coast.',
    tone: 'dark',
    focal: { x: 45, y: 50 },
    track: {
      src: ['/sounds/raod_trip.mpeg'],
      title: 'Road Trip',
      volume: 0.5,
    },
  },
  {
    kind: 'image',
    id: 'c07',
    src: '/images/calm_home.jpg',
    alt: 'A wooden cabin sits among pine trees beside a lake glowing in the evening sun.',
    title: 'Calm Home',
    caption: 'A little space to come back to yourself.',
    tone: 'dark',
    focal: { x: 55, y: 50 },
    track: {
      src: ['/sounds/calm_home.mpeg'],
      title: 'Calm Home',
      volume: 0.45,
    },
  },
  {
    kind: 'image',
    id: 'c08',
    src: '/images/coffee-Shop.jpg',
    alt: 'A cup of coffee rests on a cafe table, with musicians and warm hanging lights behind it.',
    title: 'Coffee Shop',
    caption: 'A warm cup and a moment of your own.',
    tone: 'dark',
    focal: { x: 50, y: 60 },
    track: {
      src: ['/sounds/coffee_shop.mpeg'],
      title: 'Coffee Shop',
      volume: 0.4,
    },
  },
  {
    kind: 'image',
    id: 'c09',
    src: '/images/work_space.jpg',
    alt: 'A wooden desk with a laptop and monitor faces tall windows overlooking a rainy street.',
    title: 'Work Space',
    caption: 'Room to think, space to make.',
    tone: 'dark',
    focal: { x: 50, y: 55 },
    track: {
      src: ['/sounds/work_space.mpeg'],
      title: 'Work Space',
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

export const STEPS: Step[] = [
  { kind: 'cover' },
  { kind: 'glass' },
  ...IMAGE_CARDS,
  { kind: 'questions' },
  { kind: 'thanks' },
];

/** Steps the deck itself owns: cover, glass, then the image cards. */
export const DECK_STEPS = STEPS.slice(0, 2 + IMAGE_CARDS.length);
export const DECK_LENGTH = DECK_STEPS.length;

export const STEP_COVER = 0;
export const STEP_GLASS = 1;
export const STEP_FIRST_CARD = 2;
export const STEP_QUESTIONS = STEPS.findIndex((s) => s.kind === 'questions');
export const STEP_THANKS = STEPS.length - 1;

export function imageCardAt(step: number): ImageCard | null {
  const s = STEPS[step];
  return s && s.kind === 'image' ? s : null;
}
