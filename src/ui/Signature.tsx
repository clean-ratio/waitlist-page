import styles from './Overlay.module.css';

/**
 * The handwritten mark. Drawn once as a path, not set in a script font — a
 * font would look like everyone else's. It appears exactly twice: on the cover
 * and on the thanks step.
 *
 * Replace this path with the real hand-drawn mark when it arrives; nothing
 * else needs to change.
 */
export default function Signature({ title }: { title: string }) {
  return (
    <svg
      className={styles.signature}
      viewBox="0 0 220 64"
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M7 45C25 11 45 5 52 21c6 14-16 28-23 16C22 25 47 17 73 29c18 8 30 14 46 6
           16-8 9-24-3-20-11 4-7 24 13 28 22 5 48-3 82-23"
      />
      <path d="M96 56c34-6 68-8 102-4" opacity="0.5" strokeWidth="1.4" />
    </svg>
  );
}
