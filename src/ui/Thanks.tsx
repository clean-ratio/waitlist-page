import { useEffect } from 'react';
import styles from './Thanks.module.css';
import Signature from './Signature';
import { STEP_HERO, STEP_QUESTIONS, WORDMARK } from '../lib/content';
import { trackOnce } from '../lib/analytics';
import { useStore } from '../lib/store';
import { Reveal, Words } from './motion';

/**
 * The end of the page, after the deck has gone. It closes the loop on
 * whatever is still open: join if they have not, the profile if they skipped
 * it, or simply thank you.
 */
export default function Thanks({ active }: { active: boolean }) {
  const { state, dispatch } = useStore();
  const joined = state.lead.status === 'done';
  const profiled = state.answers.status === 'done';

  useEffect(() => {
    if (active) trackOnce('thanks_view');
  }, [active]);

  const line = joined
    ? `Thank you, _${state.lead.name}._`
    : 'Rituals for the _days in between._';

  return (
    <section
      className={`${styles.section} ${active ? styles.visible : ''}`}
      aria-label={joined ? 'Thank you' : 'Join the waitlist'}
      inert={!active}
    >
      <div className={styles.inner}>
        <h2 className={`u-serif ${styles.line}`}>
          {/* Keyed so it re-runs if they joined on the way here. */}
          <Words key={line} text={line} delay={0.45} stagger={0.08} play={active} />
        </h2>
        <Reveal delay={1.1} play={active}>
          <Signature title={`${WORDMARK} signature`} />
        </Reveal>

        <Reveal as="p" className={styles.note} delay={1.3} play={active}>
          {joined
            ? "You're on the list. We'll write when the first rituals are ready."
            : 'Be first to try the Cooling, Muscle Recovery and Skin Recovery collections.'}
        </Reveal>

        <Reveal className={styles.actions} delay={1.45} play={active}>
          {!joined && (
            <button
              type="button"
              className={styles.cta}
              onClick={() => dispatch({ type: 'GOTO', step: STEP_HERO })}
            >
              Join the waitlist
            </button>
          )}
          {joined && !profiled && (
            <button
              type="button"
              className={styles.cta}
              onClick={() => dispatch({ type: 'GOTO', step: STEP_QUESTIONS })}
            >
              Build your recovery profile
            </button>
          )}
          <button
            type="button"
            className={styles.link}
            onClick={() => dispatch({ type: 'GOTO', step: STEP_HERO })}
          >
            Back to the top
          </button>
        </Reveal>

        <p className={styles.fine}>
          This is a preview: details and answers stay in this visit only and
          are not saved yet.
        </p>
      </div>
    </section>
  );
}
