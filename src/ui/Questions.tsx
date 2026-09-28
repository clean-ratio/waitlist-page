import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './Questions.module.css';
import { EASE, RISE, Reveal, Words } from './motion';
import { useStore } from '../lib/store';
import { answersComplete } from '../lib/reducer';
import { track, trackOnce } from '../lib/analytics';
import {
  MAX_PERSONAS,
  PERSONAS,
  PERSONA_OTHER_MAX,
  RECOVERIES,
  type Persona,
  type Recovery,
} from '../lib/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What each answer to Q2 sounds like said back to you. */
const ECHO: Record<Recovery, string> = {
  ritual: 'Good. Keep the hour that is already yours.',
  trying: 'Working on it counts. Most of it is showing up.',
  not_yet: 'Knowing is most of the distance.',
  never: "Then let's start somewhere small.",
};

/**
 * Two questions, and neither of them looks like a form.
 *
 * Q1 is a plate of tiles that fill from the bottom as you pick them; Q2 is a
 * single line you place yourself on, which then says your answer back to you.
 * "Recovery" stays in the kicker only — the question itself is about rest, so
 * nobody reads it as a medical question.
 */
export default function Questions({ active }: { active: boolean }) {
  const { state, dispatch } = useStore();
  const reduced = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const personaBlock = useRef<HTMLDivElement>(null);
  const recoveryBlock = useRef<HTMLDivElement>(null);
  const nudgeSeen = useRef(state.nudge);
  const [error, setError] = useState<string | null>(null);

  const persona = state.answers.persona ?? [];
  const recovery = state.answers.recovery;
  const ready = answersComplete(state.answers);
  const sending = state.answers.status === 'sending';

  const answered = (persona.length > 0 ? 1 : 0) + (recovery ? 1 : 0);

  useEffect(() => {
    if (active) trackOnce('questions_view');
  }, [active]);

  // Move focus to the first question heading when the section takes over.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => headingRef.current?.focus(), 900);
    return () => window.clearTimeout(id);
  }, [active]);

  // The same 6 px nudge as the glass card, pointed at whatever is missing.
  useEffect(() => {
    if (state.nudge === nudgeSeen.current) return;
    nudgeSeen.current = state.nudge;
    if (!active) return;

    const target = persona.length === 0 ? personaBlock.current : recoveryBlock.current;
    if (!target) return;
    target.style.setProperty('--nudge', '1.012');
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const id = window.setTimeout(() => target.style.setProperty('--nudge', '1'), 260);
    return () => window.clearTimeout(id);
  }, [state.nudge, active, persona.length]);

  /*
   * The wrapper is marked data-scrollable, so Observer leaves it alone and it
   * scrolls natively on small phones. Stepping back out of it is handled here
   * instead, and only from the very top.
   */
  useEffect(() => {
    const node = scroller.current;
    if (!node || !active) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0 && node.scrollTop === 0) dispatch({ type: 'PREV' });
    };
    node.addEventListener('wheel', onWheel, { passive: true });
    return () => node.removeEventListener('wheel', onWheel);
  }, [active, dispatch]);

  const togglePersona = (value: Persona) => {
    const has = persona.includes(value);
    // Two picks fits someone who is both a founder and a runner, without
    // turning this into a survey.
    if (!has && persona.length >= MAX_PERSONAS) return;
    const next = has ? persona.filter((p) => p !== value) : [...persona, value];
    dispatch({ type: 'ANSWER', key: 'persona', value: next });
    if (has && value === 'other') {
      dispatch({ type: 'ANSWER', key: 'personaOther', value: undefined });
    }
  };

  const onSend = async () => {
    if (!ready || sending) return;
    setError(null);
    dispatch({ type: 'ANSWERS_SENDING' });

    const leadId = state.lead.id ?? '';
    if (!UUID.test(leadId)) {
      // The sign-up never came back with an id. Their answers have nowhere to
      // go, and making them retype them would be worse than losing them.
      console.warn('[answers] no lead id; skipping the request');
      dispatch({ type: 'ANSWERS_DONE' });
      dispatch({ type: 'NEXT' });
      return;
    }

    try {
      const response = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          leadId,
          persona,
          personaOther: state.answers.personaOther,
          recovery,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          fields?: Record<string, string>;
        };
        setError(
          Object.values(body.fields ?? {})[0] ??
            'We could not save that just now. Try again?',
        );
        dispatch({ type: 'ANSWERS_ERROR', message: 'failed' });
        return;
      }

      track('answers_submit', { persona: persona.join(','), recovery });
      dispatch({ type: 'ANSWERS_DONE' });
      dispatch({ type: 'NEXT' });
    } catch (err) {
      console.error('[answers] request failed', err);
      setError('We could not save your answers. Try again?');
      dispatch({ type: 'ANSWERS_ERROR', message: 'network' });
    }
  };

  const recoveryIndex = RECOVERIES.findIndex((r) => r.value === recovery);

  return (
    <section
      className={`${styles.section} ${active ? styles.visible : ''}`}
      aria-label="Two questions"
      inert={!active}
    >
      {/* How far through the two questions you are. */}
      <div className={styles.progress} aria-hidden="true">
        <motion.div
          className={styles.progressFill}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: answered / 2 }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>

      <div className={styles.scroller} ref={scroller} data-scrollable>
        <div className={styles.inner}>
          {/* ---------- 01 ---------- */}
          <div className={styles.block} ref={personaBlock}>
            <Reveal className={styles.head} delay={0.1} play={active}>
              <span className={styles.number}>01</span>
              <span className={`u-label ${styles.counter}`}>
                {persona.length} of {MAX_PERSONAS} chosen
              </span>
            </Reveal>

            {/* The heading stays a real element so focus can be moved to it
                when the section takes over; Words only animates its contents. */}
            <h2
              className={`u-serif ${styles.question}`}
              ref={headingRef}
              tabIndex={-1}
            >
              <Words text="Who are you, _mostly_?" delay={0.2} play={active} />
            </h2>

            <fieldset className={styles.rows}>
              <legend className={`u-label ${styles.legend}`}>
                Pick up to {MAX_PERSONAS}
              </legend>

              <div className={styles.tiles}>
                {PERSONAS.map((option, i) => {
                  const chosen = persona.includes(option.value);
                  const full = !chosen && persona.length >= MAX_PERSONAS;
                  return (
                    <motion.label
                      key={option.value}
                      data-vibe={'vibe' in option ? option.vibe : undefined}
                      className={[
                        styles.tile,
                        chosen ? styles.tileChosen : '',
                        full ? styles.tileFull : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                      animate={
                        active
                          ? { opacity: full ? 0.38 : 1, y: 0 }
                          : { opacity: 0, y: reduced ? 0 : 16 }
                      }
                      transition={{ ...RISE, delay: 0.34 + i * 0.035 }}
                      whileHover={full || reduced ? undefined : { y: -3 }}
                      whileTap={full || reduced ? undefined : { scale: 0.985 }}
                    >
                      {/* The fill sweeps up from the bottom as you choose. */}
                      <motion.span
                        className={styles.tileFill}
                        initial={false}
                        animate={{ scaleY: chosen ? 1 : 0 }}
                        transition={{ duration: reduced ? 0.15 : 0.5, ease: EASE }}
                        aria-hidden="true"
                      />
                      <span className={styles.tileContent}>
                        <span className={styles.tileIndex}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className={styles.tileLabel}>{option.label}</span>
                        <span className={styles.tileLine}>{option.line}</span>
                      </span>
                      <input
                        className={styles.input}
                        type="checkbox"
                        name="persona"
                        value={option.value}
                        checked={chosen}
                        disabled={full}
                        onChange={() => togglePersona(option.value)}
                      />
                      <span className={styles.tileFocus} aria-hidden="true" />
                    </motion.label>
                  );
                })}
              </div>
            </fieldset>

            <AnimatePresence initial={false}>
              {persona.includes('other') && (
                <motion.div
                  className={styles.other}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <label className="u-label" htmlFor="persona-other">
                    In a few words
                  </label>
                  <input
                    id="persona-other"
                    className={styles.otherInput}
                    type="text"
                    maxLength={PERSONA_OTHER_MAX}
                    value={state.answers.personaOther ?? ''}
                    onChange={(event) =>
                      dispatch({
                        type: 'ANSWER',
                        key: 'personaOther',
                        value: event.target.value,
                      })
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---------- 02 ---------- */}
          <div className={styles.block} ref={recoveryBlock}>
            <Reveal className={styles.head} delay={0.12} play={active}>
              <span className={styles.number}>02</span>
              <span className={`u-label ${styles.counter}`}>On recovery</span>
            </Reveal>

            <h2 className={`u-serif ${styles.question}`}>
              <Words
                text="Has rest been a _priority_ lately?"
                delay={0.24}
                play={active}
              />
            </h2>

            <fieldset className={styles.rows}>
              <legend className="u-visually-hidden">Pick one</legend>

              <div className={styles.scale}>
                <div className={styles.scaleRail} aria-hidden="true">
                  {/* Fills to wherever you put yourself. */}
                  <motion.div
                    className={styles.scaleTrack}
                    initial={{ scaleX: 0 }}
                    animate={{
                      // The rail runs "never" → "a ritual", so the fill is
                      // longest for the most restful answer.
                      scaleX:
                        recoveryIndex < 0
                          ? 0
                          : (RECOVERIES.length - recoveryIndex) / RECOVERIES.length,
                    }}
                    transition={{ duration: 0.7, ease: EASE }}
                  />
                </div>

                <div
                  className={styles.scaleStops}
                  style={{
                    gridTemplateColumns: `repeat(${RECOVERIES.length}, 1fr)`,
                  }}
                >
                  {RECOVERIES.map((option, i) => {
                    const chosen = recovery === option.value;
                    return (
                      <motion.label
                        key={option.value}
                        className={`${styles.stop} ${chosen ? styles.stopChosen : ''}`}
                        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                        animate={
                          active
                            ? { opacity: 1, y: 0 }
                            : { opacity: 0, y: reduced ? 0 : 12 }
                        }
                        transition={{ ...RISE, delay: 0.4 + i * 0.07 }}
                        whileHover={reduced ? undefined : { y: -2 }}
                      >
                        <motion.span
                          className={styles.stopDot}
                          animate={{ scale: chosen ? 1.25 : 1 }}
                          transition={{ duration: 0.4, ease: EASE }}
                          aria-hidden="true"
                        />
                        <span className={styles.stopLabel}>{option.label}</span>
                        <input
                          className={styles.input}
                          type="radio"
                          name="recovery"
                          value={option.value}
                          checked={chosen}
                          onChange={() =>
                            dispatch({
                              type: 'ANSWER',
                              key: 'recovery',
                              value: option.value as Recovery,
                            })
                          }
                        />
                        <span className={styles.stopFocus} aria-hidden="true" />
                      </motion.label>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            {/* Your answer, said back to you. */}
            <div className={styles.echo} aria-live="polite">
              <AnimatePresence mode="wait">
                {recovery && (
                  <motion.span
                    key={recovery}
                    initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduced ? 0 : -10 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    style={{ display: 'inline-block' }}
                  >
                    {ECHO[recovery]}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ---------- send ---------- */}
          <div className={styles.footer}>
            <AnimatePresence>
              {ready && (
                <motion.button
                  type="button"
                  className={styles.send}
                  onClick={onSend}
                  disabled={sending}
                  initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : 14 }}
                  transition={{ ...RISE, duration: 0.6 }}
                >
                  {sending ? 'Sending' : 'Send'}
                  <span aria-hidden="true">→</span>
                </motion.button>
              )}
            </AnimatePresence>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
