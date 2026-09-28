import { useEffect, useState } from 'react';
import styles from './NowPlaying.module.css';
import { audio } from '../lib/audio';
import { useAudioSnapshot, startIntro } from '../lib/useDeckAudio';
import { useStore } from '../lib/store';
import { canAdvance } from '../lib/reducer';
import {
  INTRO_TRACK,
  STEP_QUESTIONS,
  STEP_THANKS,
  imageCardAt,
} from '../lib/content';

/**
 * Bottom-left, the corner the deck's diagonal never reaches.
 *
 * The panel holds no state of its own: it reads the step and the sound flag,
 * and its buttons dispatch the same actions a scroll does. So it can never
 * show a different item from the card in the centre, and Next cannot get
 * around the email gate.
 */
export default function NowPlaying({ isPhone }: { isPhone: boolean }) {
  const { state, dispatch } = useStore();
  const snapshot = useAudioSnapshot();
  const { step, soundOn, audioUnlocked, animating } = state;

  const card = imageCardAt(step);
  const collapsed = step === STEP_QUESTIONS;
  const leaving = step === STEP_THANKS;

  // Content crossfades 400 ms after the deck lands, not during the move.
  const [shown, setShown] = useState(card);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    if (card?.id === shown?.id) return;
    setFaded(true);
    const id = window.setTimeout(() => {
      setShown(card);
      setFaded(false);
    }, 400);
    return () => window.clearTimeout(id);
  }, [card, shown]);

  // M toggles sound, K toggles play — but never while a form field has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'm') {
        event.preventDefault();
        dispatch({ type: 'TOGGLE_SOUND' });
      } else if (key === 'k') {
        event.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, audioUnlocked, step]);

  /**
   * The second unlock path. Tapping Play before the form unlocks audio and
   * starts a quiet ambient intro, so nobody has to hand over an email just to
   * hear the page. Unlock runs synchronously inside this handler.
   */
  const onPlay = () => {
    if (!audioUnlocked) {
      if (audio.unlock()) {
        dispatch({ type: 'AUDIO_UNLOCKED' });
        const active = imageCardAt(state.step);
        if (active) {
          audio.load(active.id, active.track);
          audio.play(active.id);
        } else {
          startIntro();
        }
      }
      return;
    }
    audio.toggle();
  };

  const title = shown?.panelTitle ?? shown?.title ?? 'Before we begin';
  const subtitle = shown?.track.title ?? INTRO_TRACK.title;
  const kicker = audioUnlocked ? 'Now playing' : 'Sound — off';
  const trackMissing = shown ? snapshot.missing.includes(shown.id) : false;

  return (
    <div
      className={[
        styles.panel,
        animating ? styles.flat : '',
        collapsed ? styles.collapsed : '',
        leaving ? styles.leaving : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="Sound and deck controls"
    >
      <p className={`u-label ${styles.kicker}`}>{kicker}</p>

      <div className={`${styles.object} ${styles.fade} ${faded ? styles.fadeOut : ''}`}>
        {shown && (
          <>
            <div
              className={styles.objectBlur}
              style={{ backgroundImage: `url(${shown.src})` }}
              aria-hidden="true"
            />
            <img
              className={`${styles.thumb} ${shown.thumb ? '' : styles.thumbFallback}`}
              src={shown.thumb ?? shown.src}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </>
        )}
      </div>

      <div className={`${styles.meta} ${styles.fade} ${faded ? styles.fadeOut : ''}`}>
        <p className={styles.title}>{title}</p>
        <p className={`u-label ${styles.subtitle}`}>
          {trackMissing ? '—' : subtitle}
        </p>
      </div>

      <div className={styles.controls} role="group" aria-label="Controls">
        {!isPhone && (
          <button
            className={styles.button}
            type="button"
            aria-label="Previous card"
            disabled={step <= 0 || step >= STEP_THANKS}
            onClick={() => dispatch({ type: 'PREV' })}
          >
            <Chevron direction="left" />
          </button>
        )}

        {!isPhone && (
          <button
            className={styles.button}
            type="button"
            aria-label="Next card"
            // Still blocked by the glass and questions gates: a skip button
            // must not get around the email gate.
            disabled={!canAdvance(state)}
            onClick={() => dispatch({ type: 'NEXT' })}
          >
            <Chevron direction="right" />
          </button>
        )}

        <button
          className={styles.button}
          type="button"
          aria-label={snapshot.playing ? 'Pause music' : 'Play music'}
          aria-pressed={snapshot.playing}
          onClick={onPlay}
        >
          {snapshot.playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          className={styles.button}
          type="button"
          aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
          aria-pressed={!soundOn}
          onClick={() => dispatch({ type: 'TOGGLE_SOUND' })}
        >
          <Waveform animated={snapshot.playing && soundOn} />
        </button>
      </div>
    </div>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'left' ? 'M9 2 4 7l5 5' : 'M5 2l5 5-5 5';
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v9l7-4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="2.5" width="2.6" height="9" />
      <rect x="7.9" y="2.5" width="2.6" height="9" />
    </svg>
  );
}

/** Works as mute, and shows at a glance that the page has sound. */
function Waveform({ animated }: { animated: boolean }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="currentColor"
      aria-hidden="true"
      className={animated ? '' : styles.barsStill}
    >
      <rect className={styles.bar} x="2.2" y="3" width="2" height="8" />
      <rect className={styles.bar} x="6" y="3" width="2" height="8" />
      <rect className={styles.bar} x="9.8" y="3" width="2" height="8" />
    </svg>
  );
}
