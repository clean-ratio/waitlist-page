import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from './Questions.module.css';
import { EASE, RISE, Reveal, Words } from './motion';
import { useStore } from '../lib/store';
import { answeredCount } from '../lib/reducer';
import { useEdgeStep } from '../lib/useEdgeStep';
import { track, trackOnce } from '../lib/analytics';
import { STEP_HERO } from '../lib/content';
import { submitErrorMessage, submitProfile } from '../lib/submitWaitlistEntry';
import {
  LIFESTYLE_OTHER_MAX,
  PROFILE_QUESTIONS,
  REST_SCALE,
  answersSchema,
  fieldErrors,
  type ProfileQuestion,
  type Rest,
} from '../lib/schema';

const TOTAL = PROFILE_QUESTIONS.length + 1;

/** What each answer to the last question sounds like said back to you. */
const ECHO: Record<Rest, string> = {
  ritual: 'Good. Keep the hour that is already yours.',
  trying: 'Working on it counts. Most of it is showing up.',
  not_yet: 'Knowing is most of the distance.',
  never: "Then let's start somewhere small.",
};

/**
 * The Lifestyle & Recovery Profile, for people who keep scrolling past the
 * form. Four questions, all optional, and none of them looks like a form:
 * three plates of tiles that fill as you pick them, and one line you place
 * yourself on.
 */
export default function Questions({ active }: { active: boolean }) {
  const { state, dispatch } = useStore();
  const reduced = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { answers, lead } = state;
  const answered = answeredCount(answers);
  const joined = lead.status === 'done';
  const saved = answers.status === 'done';
  const sending = answers.status === 'sending';

  useEdgeStep(scroller, active);

  useEffect(() => {
    if (active) trackOnce('questions_view');
  }, [active]);

  // Move focus to the heading when the section takes over, and start at the top.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 900);
    return () => window.clearTimeout(id);
  }, [active]);

  const onSave = () => {
    if (sending || answered === 0) return;
    const parsed = answersSchema.safeParse({
      email: lead.email,
      lifestyle: answers.lifestyle,
      lifestyleOther: answers.lifestyleOther || undefined,
      approach: answers.approach,
      focus: answers.focus,
      rest: answers.rest,
    });
    if (!parsed.success) {
      setError(Object.values(fieldErrors(parsed.error))[0] ?? 'Please check your answers.');
      return;
    }
    setError(null);
    dispatch({ type: 'ANSWERS_SENDING' });
    void (async () => {
      try {
        await submitProfile(lead.id ?? '', parsed.data);
        track('answers_ready', {
          lifestyle: parsed.data.lifestyle.join(','),
          approach: parsed.data.approach.join(','),
          focus: parsed.data.focus.join(','),
          rest: parsed.data.rest,
        });
        dispatch({ type: 'ANSWERS_DONE' });
      } catch (err) {
        console.error('[profile] request failed', err);
        setError(submitErrorMessage(err));
        dispatch({ type: 'ANSWERS_ERROR', message: 'network' });
      }
    })();
  };

  const restIndex = REST_SCALE.findIndex((r) => r.value === answers.rest);

  return (
    <section
      className={`${styles.section} ${active ? styles.visible : ''}`}
      aria-label="Lifestyle and recovery profile"
      inert={!active}
    >
      {/* How far through the questions you are. */}
      <div className={styles.progress} aria-hidden="true">
        <motion.div
          className={styles.progressFill}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: answered / TOTAL }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>

      <div className={styles.scroller} ref={scroller} data-scrollable>
        <div className={styles.inner}>
          {/* ---------- intro ---------- */}
          <div className={styles.intro}>
            <Reveal as="p" className="u-label" delay={0.1} play={active} y={8}>
              Lifestyle &amp; Recovery Profile
            </Reveal>
            <h2
              className={`u-serif ${styles.title}`}
              ref={headingRef}
              tabIndex={-1}
            >
              <Words text="Tell us how your _days_ run." delay={0.18} play={active} />
            </h2>
            <Reveal as="p" className={styles.lede} delay={0.4} play={active}>
              Four quick questions so we can shape rituals around real lives.
              All optional — answer as many as you like.
            </Reveal>
          </div>

          {PROFILE_QUESTIONS.map((question, qi) => (
            <TileQuestion
              key={question.key}
              question={question}
              number={qi + 1}
              active={active}
              reduced={!!reduced}
            />
          ))}

          {/* ---------- rest scale ---------- */}
          <div className={styles.block}>
            <Reveal className={styles.head} delay={0.12} play={active}>
              <span className={styles.number}>{String(TOTAL).padStart(2, '0')}</span>
              <span className={`u-label ${styles.counter}`}>On rest</span>
            </Reveal>

            <h3 className={`u-serif ${styles.question}`}>
              <Words text="Has rest been a _priority_ lately?" delay={0.24} play={active} />
            </h3>

            <fieldset className={styles.rows}>
              <legend className="u-visually-hidden">Pick one</legend>

              <div className={styles.scale}>
                <div className={styles.scaleRail} aria-hidden="true">
                  {/* The rail runs "never" → "a ritual", so the fill is
                      longest for the most restful answer. */}
                  <motion.div
                    className={styles.scaleTrack}
                    initial={{ scaleX: 0 }}
                    animate={{
                      scaleX:
                        restIndex < 0
                          ? 0
                          : (REST_SCALE.length - restIndex) / REST_SCALE.length,
                    }}
                    transition={{ duration: 0.7, ease: EASE }}
                  />
                </div>

                <div
                  className={styles.scaleStops}
                  style={{ gridTemplateColumns: `repeat(${REST_SCALE.length}, 1fr)` }}
                >
                  {REST_SCALE.map((option, i) => {
                    const chosen = answers.rest === option.value;
                    return (
                      <motion.label
                        key={option.value}
                        className={`${styles.stop} ${chosen ? styles.stopChosen : ''}`}
                        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                        animate={
                          active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : 12 }
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
                          name="rest"
                          value={option.value}
                          checked={chosen}
                          onChange={() =>
                            dispatch({ type: 'ANSWER', key: 'rest', value: option.value })
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
                {answers.rest && (
                  <motion.span
                    key={answers.rest}
                    initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduced ? 0 : -10 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    style={{ display: 'inline-block' }}
                  >
                    {ECHO[answers.rest]}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ---------- footer ---------- */}
          <div className={styles.footer}>
            {saved ? (
              <p className={styles.status} role="status">
                Thank you{lead.name ? `, ${lead.name}` : ''}. Your profile is
                saved with your place on the list.
              </p>
            ) : !joined ? (
              <p className={styles.status}>
                Join the waitlist first and we’ll keep your profile with your
                place in line.
              </p>
            ) : null}

            <div className={styles.actions}>
              {!joined ? (
                <button
                  type="button"
                  className={styles.send}
                  onClick={() => dispatch({ type: 'GOTO', step: STEP_HERO })}
                >
                  <span aria-hidden="true">↑</span> Join the waitlist
                </button>
              ) : !saved ? (
                <button
                  type="button"
                  className={styles.send}
                  onClick={onSave}
                  disabled={sending || answered === 0}
                >
                  {sending ? 'One moment' : 'Save my profile'}
                  <span aria-hidden="true">→</span>
                </button>
              ) : null}

              <button
                type="button"
                className={saved ? styles.send : styles.skip}
                onClick={() => dispatch({ type: 'NEXT' })}
              >
                {saved ? 'Explore the collection' : 'Skip to the collection'}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/** One plate of tiles: pick up to `question.max`. */
function TileQuestion({
  question,
  number,
  active,
  reduced,
}: {
  question: ProfileQuestion;
  number: number;
  active: boolean;
  reduced: boolean;
}) {
  const { state, dispatch } = useStore();
  const picked = state.answers[question.key];
  const hasOther = question.key === 'lifestyle';

  const toggle = (value: string) => {
    const has = picked.includes(value);
    if (!has && picked.length >= question.max) return;
    const next = has ? picked.filter((p) => p !== value) : [...picked, value];
    dispatch({ type: 'ANSWER', key: question.key, value: next });
    if (has && value === 'other') {
      dispatch({ type: 'ANSWER', key: 'lifestyleOther', value: undefined });
    }
  };

  return (
    <div className={styles.block}>
      <Reveal className={styles.head} delay={0.1} play={active}>
        <span className={styles.number}>{String(number).padStart(2, '0')}</span>
        <span className={`u-label ${styles.kickerLabel}`}>{question.kicker}</span>
        <span className={`u-label ${styles.counter}`}>
          {picked.length} of {question.max} chosen
        </span>
      </Reveal>

      <h3 className={`u-serif ${styles.question}`}>
        <Words text={question.question} delay={0.2} play={active} />
      </h3>

      <fieldset className={styles.rows}>
        <legend className={`u-label ${styles.legend}`}>Pick up to {question.max}</legend>

        <div className={styles.tiles}>
          {question.options.map((option, i) => {
            const chosen = picked.includes(option.value);
            const full = !chosen && picked.length >= question.max;
            return (
              <motion.label
                key={option.value}
                className={[styles.tile, chosen ? styles.tileChosen : '', full ? styles.tileFull : '']
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
                  <span className={styles.tileIndex}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.tileLabel}>{option.label}</span>
                  <span className={styles.tileLine}>{option.line}</span>
                </span>
                <input
                  className={styles.input}
                  type="checkbox"
                  name={question.key}
                  value={option.value}
                  checked={chosen}
                  disabled={full}
                  onChange={() => toggle(option.value)}
                />
                <span className={styles.tileFocus} aria-hidden="true" />
              </motion.label>
            );
          })}
        </div>
      </fieldset>

      {hasOther && (
        <AnimatePresence initial={false}>
          {picked.includes('other') && (
            <motion.div
              className={styles.other}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <label className="u-label" htmlFor="lifestyle-other">
                In a few words
              </label>
              <input
                id="lifestyle-other"
                className={styles.otherInput}
                type="text"
                maxLength={LIFESTYLE_OTHER_MAX}
                value={state.answers.lifestyleOther ?? ''}
                onChange={(event) =>
                  dispatch({ type: 'ANSWER', key: 'lifestyleOther', value: event.target.value })
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
