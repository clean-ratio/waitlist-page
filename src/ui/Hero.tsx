import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import styles from './Hero.module.css';
import { EASE, Reveal, Words } from './motion';
import { audio } from '../lib/audio';
import { track, trackOnce } from '../lib/analytics';
import { useStore } from '../lib/store';
import { useEdgeStep } from '../lib/useEdgeStep';
import { HERO } from '../lib/content';
import { normalisePhone } from '../lib/phone';
import { CONSENT_TEXT, PHONE_INVALID, waitlistSchema } from '../lib/schema';
import { submitWaitlistEntry } from '../lib/submitWaitlistEntry';
import { startAmbient } from '../lib/useDeckAudio';
import { useWaitlistRegistration } from '../lib/useWaitlistRegistration';

/** How long after page load the waitlist form floats in. */
const FORM_APPEAR_DELAY_MS = 1300;
/** How long the confirmation stays readable before the form fades away. */
const SUCCESS_MESSAGE_DURATION_MS = 5500;

const WAITLIST_FORM_COPY = {
  title: 'Join the waitlist',
  description: 'Early access, and nothing else in your inbox.',
  nameLabel: 'Name',
  emailLabel: 'Email',
  phoneLabel: 'Phone',
  optionalTag: 'Optional',
  consent: CONSENT_TEXT,
  privacyNotice: 'Privacy notice',
  close: 'Close waitlist form',
  submit: 'Join the waitlist',
  submitting: 'One moment',
  successGreeting: (name: string) => `Welcome, ${name}.`,
  successMessage: 'You’re on the list. We’ll be in touch when the ice breaks.',
  submitError: 'The ice shifted on our end. Please try again in a moment.',
  errors: {
    nameRequired: 'Please tell us your name.',
    nameTooLong: 'That is longer than we can store.',
    emailRequired: 'Please enter your email address.',
    emailInvalid: 'That email address does not look right.',
    phoneInvalid: PHONE_INVALID,
    consentRequired: 'Please agree to the privacy notice to continue.',
  },
} as const;

type ErrorField = 'name' | 'email' | 'phone' | 'consent' | 'form';
type FormErrors = Partial<Record<ErrorField, string>>;

function validateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return WAITLIST_FORM_COPY.errors.nameRequired;
  if (name.length > 60) return WAITLIST_FORM_COPY.errors.nameTooLong;
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return WAITLIST_FORM_COPY.errors.emailRequired;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? undefined
    : WAITLIST_FORM_COPY.errors.emailInvalid;
}

/** Optional: an empty field is fine, anything else must be a real number. */
function validatePhone(value: string): string | undefined {
  return normalisePhone(value) === undefined ? WAITLIST_FORM_COPY.errors.phoneInvalid : undefined;
}

export default function Hero({ active, stepping }: { active: boolean; stepping: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const triggerCleanup = useRef<(() => void) | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardMounted, setCardMounted] = useState(false);
  const { state, dispatch } = useStore();
  const { registered, markRegistered } = useWaitlistRegistration();
  const reducedMotion = useReducedMotion();

  const openCard = useCallback(() => {
    if (registered) return;
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
    triggerCleanup.current?.();
    setCardMounted(true);
    setCardOpen(true);
  }, [registered]);

  const closeCard = useCallback(() => {
    setCardOpen(false);
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setCardMounted(false);
      closeTimer.current = undefined;
    }, reducedMotion ? 200 : 850);
  }, [reducedMotion]);

  useEffect(() => () => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
  }, []);

  // Only step out of the hero when there are sections below it to step to.
  useEdgeStep(scroller, stepping && active && !cardOpen);

  useEffect(() => {
    if (active) trackOnce('hero_view');
  }, [active]);

  useEffect(() => {
    if (registered) return;

    let timer: number | undefined;
    let loadListenerAttached = false;

    const scheduleTimer = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const elapsedSinceLoad = navigation?.loadEventEnd
        ? performance.now() - navigation.loadEventEnd
        : 0;
      timer = window.setTimeout(openCard, Math.max(0, FORM_APPEAR_DELAY_MS - elapsedSinceLoad));
    };
    const onLoad = () => scheduleTimer();

    const cleanup = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (loadListenerAttached) window.removeEventListener('load', onLoad);
      if (triggerCleanup.current === cleanup) triggerCleanup.current = null;
    };
    if (document.readyState === 'complete') {
      scheduleTimer();
    } else {
      loadListenerAttached = true;
      window.addEventListener('load', onLoad, { once: true });
    }
    triggerCleanup.current = cleanup;
    return cleanup;
  }, [registered, openCard]);

  // The icon shows what is audible. Muting only ever happens from here.
  const onSoundClick = () => {
    if (state.playing) {
      dispatch({ type: 'TOGGLE_SOUND' });
      return;
    }
    if (!state.soundOn) dispatch({ type: 'TOGGLE_SOUND' });
    startAmbient(() => dispatch({ type: 'AUDIO_UNLOCKED' }));
  };

  return (
    <section className={`${styles.hero} ${active ? '' : styles.away}`} aria-label="Join the waitlist" inert={!active}>
      <HeroMedia playing={active} />
      <div className={styles.scroller} ref={scroller} data-scrollable>
        <div className={styles.frame}>
          <header className={styles.header}>
            <Reveal className={styles.wordmark} delay={0.1} y={6}>
              <img src="/logo_files/White_Wordmark.png" alt="Clean Ratio" />
            </Reveal>
            <button type="button" className={styles.soundToggle} aria-label={state.playing ? 'Mute sound' : 'Play sound'} aria-pressed={state.playing} onClick={onSoundClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 10v4h3l4 3V7l-4 3H4Z" />
                {state.playing && <path d="M15 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11" />}
              </svg>
            </button>
          </header>
          <div className={styles.body}>
            <div className={styles.copy}>
              <Reveal as="p" className={`u-label ${styles.kicker}`} delay={0.2} y={8}>{HERO.kicker}</Reveal>
              <h1 className={`u-serif ${styles.line}`}>
                <Words text={`${HERO.line} _${HERO.lineItalic}_`} delay={0.3} stagger={0.07} />
              </h1>
              <Reveal as="p" className={styles.description} delay={0.8}>{HERO.description}</Reveal>
              <Reveal className={styles.engagement} delay={1.05} y={8}>
                <div className={styles.divider} />
                <div className={styles.actions}>
                  {registered ? (
                    <span className={`${styles.submit} ${styles.heroJoin} ${styles.registered}`} role="status">You’re on the list</span>
                  ) : (
                    <button type="button" className={`${styles.submit} ${styles.heroJoin}`} aria-haspopup="dialog" aria-expanded={cardOpen} onClick={openCard}>{WAITLIST_FORM_COPY.submit}</button>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
      {createPortal(cardMounted && <HeroForm key="waitlist" open={cardOpen} onClose={closeCard} onRegistered={markRegistered} />, document.body)}
    </section>
  );
}

function HeroMedia({ playing }: { playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (playing) void node.play().catch(() => undefined);
    else node.pause();
  }, [playing]);

  return (
    <div className={`${styles.media} ${playing ? '' : styles.paused}`} aria-hidden="true">
      {HERO.video ? (
        <video ref={video} className={styles.still} src={HERO.video} poster={HERO.image.wide} autoPlay muted loop playsInline preload="auto" />
      ) : (
        <picture>
          <source media="(max-aspect-ratio: 1/1)" srcSet={HERO.image.tall} />
          <img className={`${styles.still} ${styles.drift}`} src={HERO.image.wide} alt="" fetchPriority="high" decoding="async" />
        </picture>
      )}
      <div className={styles.shimmer} />
      <div className={styles.mist} />
      <div className={styles.shade} />
    </div>
  );
}

function InvalidFieldIcon() {
  return <span className={styles.invalidIcon} aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" /><path d="M8 4.2v4.2M8 11.2v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></span>;
}

function HeroForm({ open, onClose, onRegistered }: { open: boolean; onClose: () => void; onRegistered: () => void }) {
  const { state, dispatch } = useStore();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const reducedMotion = useReducedMotion();
  const busy = state.lead.status === 'sending';
  const joined = state.lead.status === 'done';

  useEffect(() => {
    const app = document.getElementById('root');
    const wasInert = app?.inert ?? false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    if (app) app.inert = true;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown, true);
    nameRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (app) app.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      else app?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus({ preventScroll: true });
    };
  }, [onClose]);

  // Scroll only the overlay when the mobile keyboard reduces the visible area.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const keepFieldVisible = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const visibleTop = viewport?.offsetTop ?? 0;
        const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
        dialog.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - visibleBottom)}px`);
        const focused = document.activeElement;
        if (!(focused instanceof HTMLInputElement) || !dialog.contains(focused)) return;
        const bounds = focused.getBoundingClientRect();
        if (bounds.bottom > visibleBottom - 24) {
          dialog.scrollBy({ top: bounds.bottom - visibleBottom + 24, behavior: 'instant' });
        } else if (bounds.top < visibleTop + 24) {
          dialog.scrollBy({ top: bounds.top - visibleTop - 24, behavior: 'instant' });
        }
      });
    };
    dialog.addEventListener('focusin', keepFieldVisible);
    viewport?.addEventListener('resize', keepFieldVisible);
    viewport?.addEventListener('scroll', keepFieldVisible);
    window.addEventListener('resize', keepFieldVisible);
    keepFieldVisible();
    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener('focusin', keepFieldVisible);
      viewport?.removeEventListener('resize', keepFieldVisible);
      viewport?.removeEventListener('scroll', keepFieldVisible);
      window.removeEventListener('resize', keepFieldVisible);
    };
  }, []);

  useEffect(() => {
    if (!joined) return;
    closeRef.current?.focus({ preventScroll: true });
    const id = window.setTimeout(onClose, SUCCESS_MESSAGE_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [joined, onClose]);

  const validateField = (field: ErrorField, value: string): string | undefined => {
    if (field === 'name') return validateName(value);
    if (field === 'email') return validateEmail(value);
    if (field === 'phone') return validatePhone(value);
    return undefined;
  };
  const updateFieldError = (field: ErrorField, value: string, onBlur: boolean) => {
    const error = validateField(field, value);
    setErrors(current => {
      if (!current[field] && !onBlur) return current;
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (audio.unlock()) dispatch({ type: 'AUDIO_UNLOCKED' });
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '');
    const email = String(data.get('email') ?? '');
    const phone = String(data.get('phone') ?? '');
    const consent = data.get('consent') !== null;
    const nextErrors: FormErrors = {
      name: validateName(name),
      email: validateEmail(email),
      phone: validatePhone(phone),
      consent: consent ? undefined : WAITLIST_FORM_COPY.errors.consentRequired,
    };
    const parsed = waitlistSchema.safeParse({ name, email, phone, consent, company: data.get('company') });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' && !nextErrors.name) nextErrors.name = name.trim() ? WAITLIST_FORM_COPY.errors.nameTooLong : WAITLIST_FORM_COPY.errors.nameRequired;
        if (field === 'email' && !nextErrors.email) nextErrors.email = email.trim() ? WAITLIST_FORM_COPY.errors.emailInvalid : WAITLIST_FORM_COPY.errors.emailRequired;
        if (field === 'phone' && !nextErrors.phone) nextErrors.phone = WAITLIST_FORM_COPY.errors.phoneInvalid;
        if (field === 'consent' && !nextErrors.consent) nextErrors.consent = WAITLIST_FORM_COPY.errors.consentRequired;
      }
    }
    setErrors(nextErrors);
    const firstInvalid = nextErrors.name ? nameRef.current : nextErrors.email ? emailRef.current : nextErrors.phone ? phoneRef.current : nextErrors.consent ? consentRef.current : null;
    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });
      return;
    }
    if (!parsed.success) return;

    dispatch({ type: 'LEAD_SENDING' });
    void (async () => {
      try {
        // Honeypot filled: show success but do not send a database request.
        const id = parsed.data.company?.trim()
          ? ''
          : await submitWaitlistEntry(parsed.data.name, parsed.data.email, parsed.data.phone);
        dispatch({ type: 'LEAD_DONE', id, name: parsed.data.name, email: parsed.data.email });
        onRegistered();
        track('waitlist_ready');
      } catch (err) {
        // The real error stays in the console; the form, and what was typed, stay put.
        console.error('[waitlist] request failed', err);
        setErrors({ form: WAITLIST_FORM_COPY.submitError });
        dispatch({ type: 'LEAD_ERROR', message: 'network' });
        track('waitlist_error');
      }
    })();
  };

  const renderError = (id: string, error?: string) => <div className={styles.errorSlot} aria-live="polite">{error && <p id={id} className={styles.error}><InvalidFieldIcon />{error}</p>}</div>;

  const floatingItem = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 12 },
    shown: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0.15 : 0.5, ease: EASE } },
    closed: { opacity: 0, y: 0, transition: { duration: reducedMotion ? 0.15 : 0.25 } },
  };

  return (
    <motion.div ref={dialogRef} className={styles.dialogBackdrop} role="dialog" aria-modal="true" aria-labelledby={joined ? 'wl-success-title' : 'wl-dialog-title'} aria-describedby={joined ? 'wl-success-message' : 'wl-dialog-description'} aria-busy={busy} tabIndex={-1} initial={{ opacity: 0 }} animate={{ opacity: open ? 1 : 0 }} transition={{ duration: reducedMotion ? 0.15 : 0.8, ease: 'easeOut' }}>
      <button ref={closeRef} type="button" className={styles.closeButton} aria-label={WAITLIST_FORM_COPY.close} onClick={onClose}><span className={styles.closeIcon} aria-hidden="true" /></button>
      <div className={styles.floatingForm}>
        <AnimatePresence mode="wait">
          {joined ? (
            <motion.div key="joined" className={styles.joined} role="status" initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }} animate={{ opacity: open ? 1 : 0, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.15 : 0.45, ease: EASE }}>
              <p id="wl-success-title" className={`u-serif ${styles.joinedLine}`}>{WAITLIST_FORM_COPY.successGreeting(state.lead.name?.trim() ?? '')}</p>
              <span className={styles.joinedRule} aria-hidden="true" />
              <p id="wl-success-message" className={styles.statusMessage}>{WAITLIST_FORM_COPY.successMessage}</p>
            </motion.div>
          ) : (
            <motion.form key="form" className={styles.fields} onSubmit={onSubmit} noValidate initial="hidden" animate={open ? 'shown' : 'closed'} variants={{ hidden: {}, shown: { transition: { delayChildren: reducedMotion ? 0 : 0.8, staggerChildren: reducedMotion ? 0 : 0.1 } }, closed: {} }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.15 : 0.25, ease: EASE }}>
              <motion.div className={styles.formHead} variants={floatingItem}>
                <p id="wl-dialog-title" className={`u-serif ${styles.formTitle}`}>{WAITLIST_FORM_COPY.title}</p>
                <p id="wl-dialog-description" className={styles.formSub}>{WAITLIST_FORM_COPY.description}</p>
              </motion.div>
              <motion.div className={styles.field} variants={floatingItem}>
                <div className={styles.inputWrap}>
                  <input ref={nameRef} id="wl-name" name="name" className={styles.input} placeholder=" " type="text" autoComplete="name" enterKeyHint="next" maxLength={60} required aria-required="true" aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'wl-name-error' : undefined} onBlur={event => updateFieldError('name', event.target.value, true)} onChange={event => updateFieldError('name', event.target.value, false)} />
                  <label className={`u-label ${styles.floatingLabel}`} htmlFor="wl-name">{WAITLIST_FORM_COPY.nameLabel}</label>
                </div>
                {renderError('wl-name-error', errors.name)}
              </motion.div>
              <motion.div className={styles.field} variants={floatingItem}>
                <div className={styles.inputWrap}>
                  <input ref={emailRef} id="wl-email" name="email" className={styles.input} placeholder=" " type="email" inputMode="email" autoComplete="email" enterKeyHint="next" maxLength={254} required aria-required="true" aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? 'wl-email-error' : undefined} onBlur={event => updateFieldError('email', event.target.value, true)} onChange={event => updateFieldError('email', event.target.value, false)} />
                  <label className={`u-label ${styles.floatingLabel}`} htmlFor="wl-email">{WAITLIST_FORM_COPY.emailLabel}</label>
                </div>
                {renderError('wl-email-error', errors.email)}
              </motion.div>
              <motion.div className={styles.field} variants={floatingItem}>
                <div className={styles.inputWrap}>
                  <input ref={phoneRef} id="wl-phone" name="phone" className={styles.input} placeholder=" " type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" maxLength={32} aria-invalid={errors.phone ? 'true' : undefined} aria-describedby={errors.phone ? 'wl-phone-error' : undefined} onBlur={event => updateFieldError('phone', event.target.value, true)} onChange={event => updateFieldError('phone', event.target.value, false)} />
                  <label className={`u-label ${styles.floatingLabel}`} htmlFor="wl-phone">{WAITLIST_FORM_COPY.phoneLabel}<span className={styles.optionalTag}>{WAITLIST_FORM_COPY.optionalTag}</span></label>
                </div>
                {renderError('wl-phone-error', errors.phone)}
              </motion.div>
              <motion.div className={styles.consentBlock} variants={floatingItem}>
                <label className={styles.consent}>
                  <input ref={consentRef} type="checkbox" name="consent" value="true" required aria-required="true" aria-invalid={errors.consent ? 'true' : undefined} aria-describedby={errors.consent ? 'wl-consent-error' : undefined} onChange={event => setErrors(current => ({ ...current, consent: event.target.checked ? undefined : current.consent }))} />
                  <span>{WAITLIST_FORM_COPY.consent}{' '}<a href="/privacy.html" target="_blank" rel="noreferrer">{WAITLIST_FORM_COPY.privacyNotice}</a></span>
                </label>
                <div className={styles.consentErrorSlot} aria-live="polite">{errors.consent && <p id="wl-consent-error" className={styles.error}><InvalidFieldIcon />{errors.consent}</p>}</div>
              </motion.div>
              <div className={styles.honeypot} aria-hidden="true"><label htmlFor="wl-company">Company</label><input id="wl-company" name="company" type="text" tabIndex={-1} autoComplete="off" /></div>
              <motion.button className={styles.submit} type="submit" disabled={busy} variants={floatingItem}>{busy && <span className={styles.submitSpinner} aria-hidden="true" />}{busy ? WAITLIST_FORM_COPY.submitting : WAITLIST_FORM_COPY.submit}<span className={styles.submitArrow} aria-hidden="true">→</span></motion.button>
              <div className={styles.formErrorSlot} aria-live="polite">{errors.form && <p className={styles.statusMessage}>{errors.form}</p>}</div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
