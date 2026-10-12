import { WORDMARK } from '../lib/content';

/**
 * The mark from the favicon (sun over three lines of water) beside the
 * wordmark. Drawn in currentColor so it sits on the photograph or the page.
 *
 * Swap the paths for the final brand mark when it arrives.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        viewBox="6 10 52 48"
        width="30"
        height="28"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="44" cy="20" r="6" fill="currentColor" stroke="none" opacity="0.85" />
        <path d="M9 35c6-7 13-7 20 0s14 7 26 0" strokeWidth="2.5" />
        <path d="M10 45c6-5 12-5 18 0s12 5 18 0 9-4 9-4" strokeWidth="2.5" opacity="0.8" />
        <path d="M13 53c5-3 9-3 14 0s9 3 14 0 9-3 13 0" strokeWidth="2" opacity="0.55" />
      </svg>
      <span className="u-label" style={{ color: 'inherit', letterSpacing: '0.22em' }}>
        {WORDMARK}
      </span>
    </span>
  );
}
