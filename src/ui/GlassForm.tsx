import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './GlassForm.module.css';
import { EASE, RISE, Reveal, Words } from './motion';
import { audio } from '../lib/audio';
import { campaign, track, trackOnce } from '../lib/analytics';
import { useStore } from '../lib/store';
import { CONSENT_TEXT, fieldErrors, waitlistSchema } from '../lib/schema';

/** The welcome plate stays up at least this long before the deck moves on. */
const WELCOME_MS = 900;
/** If the network has not answered by now, let them through anyway. */
const PATIENCE_MS = 6000;

type Props = { active: boolean };

/**
 * The most important card in the deck: it is the only screen everyone sees.
 * Two fields plus consent, browser autofill, no skip link.
 */
export default function GlassForm({ active }: Props) {
  const { state, dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [welcome, setWelcome] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [advanceAt, setAdvanceAt] = useState<number | null>(null);
  const nudgeSeen = useRef(state.nudge);

  useEffect(() => {
    if (active) trackOnce('glass_view');
  }, [active]);

  // Preserve keyboard access without opening a phone keyboard on arrival.
  useEffect(() => {
    if (!active || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const id = window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 400);
    return () => window.clearTimeout(id);
  }, [active]);

  // A blocked scroll must not feel broken: nudge the card and raise the hint.
  useEffect(() => {
    if (state.nudge === nudgeSeen.current) return;
    nudgeSeen.current = state.nudge;
    if (!active) return;

    setHintVisible(true);
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--nudge', '1.012');
    const id = window.setTimeout(
      () => card.style.setProperty('--nudge', '1'),
      260,
    );
    return () => window.clearTimeout(id);
  }, [state.nudge, active]);

  /*
   * When the on-screen keyboard opens, the visual viewport shrinks and the
   * Email field can end up underneath it. Lift the card instead of resizing
   * the deck.
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !active) return;

    const onResize = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height);
      const lift = hidden > 120 ? Math.min(hidden * 0.42, 180) : 0;
      cardRef.current?.style.setProperty('--lift', `${-lift}px`);
    };

    vv.addEventListener('resize', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      cardRef.current?.style.setProperty('--lift', '0px');
    };
  }, [active]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.lead.status === 'sending' || welcome) return;

    /*
     * Unlock audio here, synchronously, before anything that could await.
     * This click is the user activation; after an `await fetch()` Safari has
     * already expired it and the whole page stays silent.
     */
    const unlocked = audio.unlock();
    if (unlocked) dispatch({ type: 'AUDIO_UNLOCKED' });

    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = waitlistSchema.safeParse({
      name: data.get('name'),
      email: data.get('email'),
      consent: data.get('consent'),
      company: data.get('company'),
      ...campaign(),
    });

    if (!parsed.success) {
      // Inline, under the field. Never a toast, and never a request.
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    dispatch({ type: 'LEAD_SENDING' });
    setWelcome(`Welcome, ${parsed.data.name}.`);

    const started = performance.now();
    const payload = parsed.data;

    void (async () => {
      let settled = false;
      const giveUp = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        console.warn('[waitlist] slow response; opening the deck anyway');
        dispatch({
          type: 'LEAD_DONE',
          id: '',
          name: payload.name,
          already: false,
        });
        advance(started);
      }, PATIENCE_MS);

      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => ({}))) as {
          leadId?: string;
          already?: boolean;
          fields?: Record<string, string>;
          error?: string;
        };

        if (settled) return;
        settled = true;
        window.clearTimeout(giveUp);

        if (!response.ok) {
          setWelcome(null);
          setErrors(
            body.fields ?? {
              form:
                response.status === 429
                  ? 'That was a lot of tries. Give it a minute.'
                  : 'We could not save that just now. Try again?',
            },
          );
          dispatch({ type: 'LEAD_ERROR', message: body.error ?? 'failed' });
          track('waitlist_error', { status: response.status });
          return;
        }

        if (body.already) setWelcome(`Welcome back, ${payload.name}.`);
        dispatch({
          type: 'LEAD_DONE',
          id: body.leadId ?? '',
          name: payload.name,
          already: Boolean(body.already),
        });
        track('waitlist_submit', { already: Boolean(body.already) });
        advance(started);
      } catch (err) {
        if (settled) return;
        settled = true;
        window.clearTimeout(giveUp);
        console.error('[waitlist] request failed', err);
        setWelcome(null);
        setErrors({ form: 'We could not save your details. Try again?' });
        dispatch({ type: 'LEAD_ERROR', message: 'network' });
        track('waitlist_error', { status: 0 });
      }
    })();
  };

  /** The welcome plate holds for at least WELCOME_MS, then the deck moves on. */
  const advance = (started: number) => setAdvanceAt(started + WELCOME_MS);

  /*
   * A NEXT dispatched while the deck is mid-transition is dropped on the
   * floor, which would leave the visitor stranded on the welcome plate. So
   * this waits for the lock to clear rather than firing once and hoping.
   */
  useEffect(() => {
    if (advanceAt === null || !active || state.animating) return;
    const wait = Math.max(0, advanceAt - performance.now());
    const id = window.setTimeout(() => dispatch({ type: 'NEXT' }), wait);
    return () => window.clearTimeout(id);
  }, [advanceAt, active, state.animating, dispatch]);

  const busy = state.lead.status === 'sending';

  return (
    <div
      ref={cardRef}
      // The glass recipe is shared with the Now Playing panel. It only works
      // because the upcoming cards peek out at bottom-right behind it: the
      // blur turns them into soft colour, a preview of what the form unlocks.
      className={`glass ${styles.card}`}
      // Only the active card is reachable by tab and screen reader.
      inert={!active}
    >
      <div className={styles.scroller} data-scrollable>
        <div className={styles.content}>
          <Reveal as="p" className={`u-label ${styles.kicker}`} delay={0.1} y={8}>
            An invitation — 01
          </Reveal>
          <div className={styles.heading}>
            <Words
              as="h1"
              className={`u-serif ${styles.line}`}
              text="Before we begin,"
              delay={0.22}
            />
            <Reveal as="p" className={styles.subtitle} delay={0.3} y={6}>
              Who are we speaking with?
            </Reveal>
          </div>

          <motion.form
            className={styles.fields}
            onSubmit={onSubmit}
            noValidate
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...RISE, delay: 0.5 }}
          >
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

            {/* Never pre-ticked. Storing an email next to a recovery answer needs
                clear, specific consent under India's DPDP Act. */}
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

            <div className={styles.actions}>
              <button className={styles.submit} type="submit" disabled={busy}>
                {busy ? 'One moment' : 'Continue'}
                <span className={styles.submitArrow} aria-hidden="true">
                  →
                </span>
              </button>
              {errors.form && <p className={styles.error}>{errors.form}</p>}
            </div>
          </motion.form>

          {hintVisible && (
            <p className={`u-label ${styles.hint}`}>
              Enter your name and email to continue
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {welcome && (
          <motion.div
            className={styles.welcome}
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Words text={welcome} delay={0.15} stagger={0.06} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
