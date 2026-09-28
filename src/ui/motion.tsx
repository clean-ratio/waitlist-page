import {
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Motion components have to be created once, not per render: `motion(tag)`
 * returns a brand new component type every call, so React would unmount and
 * remount the subtree on every render and restart the animation with it.
 */
const TAGS = {
  span: motion.span,
  p: motion.p,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  li: motion.li,
} as const;

export type MotionTag = keyof typeof TAGS;

/**
 * Shared motion vocabulary. One ease and one set of timings for the whole
 * page, so nothing anywhere moves in a way you have not already seen.
 *
 * Every helper collapses to a plain fade when the visitor asks for reduced
 * motion — never to nothing, so content still announces its arrival.
 */

/** The same long, soft landing the CSS uses. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const RISE: Transition = { duration: 0.85, ease: EASE };

/** Words arrive in sequence, close enough together to read as one phrase. */
const WORD_STAGGER = 0.045;

const wordContainer = (delay: number, stagger: number): Variants => ({
  hidden: {},
  shown: { transition: { delayChildren: delay, staggerChildren: stagger } },
});

const wordChild: Variants = {
  hidden: { opacity: 0, y: '0.5em', filter: 'blur(6px)' },
  shown: { opacity: 1, y: '0em', filter: 'blur(0px)', transition: RISE },
};

const fadeChild: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.4 } },
};

/**
 * Splits text into words, carrying italics through. `_like this_` marks a run
 * of any length, not just a single word.
 */
function parseWords(text: string): { word: string; italic: boolean }[] {
  const out: { word: string; italic: boolean }[] = [];
  // split with a capture group alternates plain, italic, plain, italic…
  text.split(/_([^_]+)_/g).forEach((chunk, index) => {
    const italic = index % 2 === 1;
    for (const word of chunk.split(/\s+/)) {
      if (word) out.push({ word, italic });
    }
  });
  return out;
}

type WordsProps = {
  /** Plain text. Wrap a run in _underscores_ to set it in italic. */
  text: string;
  className?: string;
  as?: MotionTag;
  delay?: number;
  stagger?: number;
  /** Set false to hold everything hidden until the card has landed. */
  play?: boolean;
};

/**
 * Text that assembles itself a word at a time. Each word rises from a blur —
 * the blur is what keeps it from looking like a list of things sliding.
 */
export function Words({
  text,
  className,
  as: Tag = 'span',
  delay = 0,
  stagger = WORD_STAGGER,
  play = true,
}: WordsProps) {
  const reduced = useReducedMotion();
  const Element = TAGS[Tag];
  const words = parseWords(text);

  return (
    <Element
      className={className}
      variants={wordContainer(delay, reduced ? 0 : stagger)}
      initial="hidden"
      animate={play ? 'shown' : 'hidden'}
      // One accessible string, so nothing reads it out a word at a time.
      aria-label={text.replace(/_/g, '')}
    >
      {words.map(({ word, italic }, i) => (
        <motion.span
          key={`${word}-${i}`}
          variants={reduced ? fadeChild : wordChild}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            fontStyle: italic ? 'var(--font-emphasis-style, italic)' : undefined,
            willChange: 'transform, opacity, filter',
          }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Element>
  );
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Distance travelled, in px. */
  y?: number;
  play?: boolean;
  as?: MotionTag;
};

/** A single block that fades up. The workhorse. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 14,
  play = true,
  as: Tag = 'div',
}: RevealProps) {
  const reduced = useReducedMotion();
  const Element = TAGS[Tag];

  return (
    <Element
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : y }}
      transition={{ ...RISE, delay }}
    >
      {children}
    </Element>
  );
}
