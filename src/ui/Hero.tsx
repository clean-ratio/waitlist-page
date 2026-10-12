import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Hero.module.css';
import Logo from './Logo';
import { EASE, RISE, Reveal, Words } from './motion';
import { audio } from '../lib/audio';
import { track, trackOnce } from '../lib/analytics';
import { useStore } from '../lib/store';
import { useEdgeStep } from '../lib/useEdgeStep';
import { HERO, LOCATION_LINE } from '../lib/content';
import { CONSENT_TEXT, fieldErrors, waitlistSchema } from '../lib/schema';
import { submitWaitlistEntry } from '../lib/submitWaitlistEntry';

/**
 * The first screen, and the only one everybody sees: one slowly moving
 * photograph, the mark, a line, and a two-field waitlist form.
 *
 * Nothing below it is gated. Joining is the point of the page, but anybody can
 * keep scrolling into the profile questions and the collection.
 */
export default function Hero({ active }: { active: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEdgeStep(scroller, active);

  useEffect(() => {
    if (active) trackOnce('hero_view');
  }, [active]);

  return (
    <section
      className={`${styles.hero} ${active ? '' : styles.away}`}
      aria-label="Join the waitlist"
      inert={!active}
    >
      <HeroMedia playing={active} />

      <div className={styles.scroller} ref={scroller} data-scrollable>
        <header className={styles.header}>
          <Reveal delay={0.1} y={6}>
            <Logo />
          </Reveal>
          <Reveal as="p" className={`u-label ${styles.est}`} delay={0.15} y={6}>
            {LOCATION_LINE}
          </Reveal>
        </header>

        <div className={styles.body}>
          <div className={styles.copy}>
            <Reveal as="p" className={`u-label ${styles.kicker}`} delay={0.2} y={8}>
              {HERO.kicker}
            </Reveal>
            <h1 className={`u-serif ${styles.line}`}>
              <Words
                text={`${HERO.line} _${HERO.lineItalic}_`}
                delay={0.3}
                stagger={0.07}
              />
            </h1>
            <Reveal as="p" className={styles.description} delay={0.8}>
              {HERO.description}
            </Reveal>
          </div>

          <HeroForm active={active} />
        </div>

        <footer className={styles.footer}>
          <ScrollHint />
        </footer>
      </div>
    </section>
  );
}

/**
 * The scenery. A still, given the slow drift of a long camera take, with mist
 * and a light sweep over it. If a real clip is configured it plays instead,
 * with the still as its poster.
 */
function HeroMedia({ playing }: { playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null);

  // Nothing animates behind a panel nobody can see.
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (playing) void node.play().catch(() => undefined);
    else node.pause();
  }, [playing]);

  return (
    <div
      className={`${styles.media} ${playing ? '' : styles.paused}`}
      aria-hidden="true"
    >
      {HERO.video ? (
        <video
          ref={video}
          className={styles.still}
          src={HERO.video}
          poster={HERO.image.wide}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      ) : (
        <picture>
          <source media="(max-aspect-ratio: 1/1)" srcSet={HERO.image.tall} />
          <img
            className={`${styles.still} ${styles.drift}`}
            src={HERO.image.wide}
            alt=""
            // The LCP element: fetch it before anything else.
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      )}
      <div className={styles.shimmer} />
      <div className={styles.mist} />
      <div className={styles.shade} />
    </div>
  );
}

function ScrollHint() {
  const { state, dispatch } = useStore();
  return (
    <button
      type="button"
      className={styles.hint}
      onClick={() => dispatch({ type: 'NEXT' })}
      disabled={state.animating}
    >
      <span className="u-label">{HERO.hint}</span>
      <span className={styles.hintLine} aria-hidden="true" />
    </button>
  );
}

function HeroForm({ active }: { active: boolean }) {
  const { state, dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const busy = state.lead.status === 'sending';
  const joined = state.lead.status === 'done';

  // Keyboard users land in the form; phones do not get a keyboard thrown at
  // them on arrival.
  useEffect(() => {
    if (!active || joined) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const id = window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 1200);
    return () => window.clearTimeout(id);
  }, [active, joined]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    /*
     * Unlock audio here, synchronously, before anything that could await.
     * This click is the user activation; after an `await fetch()` Safari has
     * already expired it and the whole page stays silent.
     */
    if (audio.unlock()) dispatch({ type: 'AUDIO_UNLOCKED' });

    const data = new FormData(event.currentTarget);
    const parsed = waitlistSchema.safeParse({
      name: data.get('name'),
      email: data.get('email'),
      consent: data.get('consent'),
      company: data.get('company'),
    });

    if (!parsed.success) {
      // Inline, under the field. Never a toast, and never a request.
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    dispatch({ type: 'LEAD_SENDING' });

    void (async () => {
      try {
        await submitWaitlistEntry(parsed.data.name, parsed.data.email);
        dispatch({
          type: 'LEAD_DONE',
          id: '',
          name: parsed.data.name,
          email: parsed.data.email,
        });
        track('waitlist_ready');
      } catch (err) {
        console.error('[waitlist] request failed', err);
        setErrors({ form: 'We could not add you just now. Please try again.' });
        dispatch({ type: 'LEAD_ERROR', message: 'network' });
        track('waitlist_error');
      }
    })();
  };

  return (
    <motion.div
      className={`glass ${styles.card}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...RISE, delay: 0.55 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {joined ? (
          <motion.div
            key="joined"
            className={styles.joined}
            role="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <p className="u-label">You’re on the list</p>
            <p className={`u-serif ${styles.joinedLine}`}>
              <Words text={`Thank you, _${state.lead.name}._`} delay={0.1} />
            </p>
            <p className={styles.joinedNote}>
              We’ll write when the first rituals are ready. Your details have
              not been saved yet — this is a preview.
            </p>
            <button
              type="button"
              className={styles.submit}
              onClick={() => dispatch({ type: 'NEXT' })}
            >
              Build your recovery profile
              <span className={styles.submitArrow} aria-hidden="true">↓</span>
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            className={styles.fields}
            onSubmit={onSubmit}
            noValidate
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className={styles.formHead}>
              <p className={`u-serif ${styles.formTitle}`}>Join the waitlist</p>
              <p className={styles.formSub}>Early access, and nothing else in your inbox.</p>
            </div>

            <div className={styles.field}>
              <label className="u-label" htmlFor="wl-name">
                Name
              </label>
              <input
                ref={nameRef}
                id="wl-name"
                name="name"
                className={styles.input}
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                maxLength={60}
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'wl-name-error' : undefined}
              />
              {errors.name && (
                <p id="wl-name-error" className={styles.error}>
                  {errors.name}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label className="u-label" htmlFor="wl-email">
                Email
              </label>
              <input
                id="wl-email"
                name="email"
                className={styles.input}
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="go"
                maxLength={254}
                aria-invalid={errors.email ? 'true' : undefined}
                aria-describedby={errors.email ? 'wl-email-error' : undefined}
              />
              {errors.email && (
                <p id="wl-email-error" className={styles.error}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Never pre-ticked. Storing an email next to recovery answers
                needs clear, specific consent under India's DPDP Act. */}
            <label className={styles.consent}>
              <input
                type="checkbox"
                name="consent"
                value="true"
                required
                aria-invalid={errors.consent ? 'true' : undefined}
                aria-describedby={errors.consent ? 'wl-consent-error' : undefined}
              />
              <span>
                {CONSENT_TEXT}{' '}
                <a href="/privacy.html" target="_blank" rel="noreferrer">
                  Privacy notice
                </a>
              </span>
            </label>
            {errors.consent && (
              <p id="wl-consent-error" className={styles.error}>
                {errors.consent}
              </p>
            )}

            <div className={styles.honeypot} aria-hidden="true">
              <label htmlFor="wl-company">Company</label>
              <input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? 'One moment' : 'Join the waitlist'}
              <span className={styles.submitArrow} aria-hidden="true">→</span>
            </button>
            {errors.form && <p className={styles.error}>{errors.form}</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
