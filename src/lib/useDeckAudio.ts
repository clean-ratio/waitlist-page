import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  audio,
  prime,
  readSoundPreference,
  watchVisibility,
  writeSoundPreference,
  type AudioSnapshot,
} from './audio';
import {
  IMAGE_CARDS,
  INTRO_TRACK,
  STEP_HERO,
  STEP_QUESTIONS,
  STEP_THANKS,
  imageCardAt,
} from './content';
import { useStore } from './store';
import { track } from './analytics';

/** The questions step keeps the last track, at 40% of its volume. */
const DUCK = 0.4;
const INTRO_ID = 'intro';

/** Keys that are not a user activation, so cannot unlock audio. */
const NON_ACTIVATING_KEYS = new Set(['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export function useAudioSnapshot(): AudioSnapshot {
  return useSyncExternalStore(
    (listener) => audio.subscribe(listener),
    () => audio.snapshot(),
    () => audio.snapshot(),
  );
}

/**
 * Wires the deck to the audio manager. Every rule from the plan lives here so
 * the components stay dumb: they dispatch, this decides what is heard.
 *
 * `heroAmbient`: the hero is the whole page, so it plays the intro track from
 * the visitor's first click, tap or key press, instead of staying silent.
 */
export function useDeckAudio({ heroAmbient = false }: { heroAmbient?: boolean } = {}): void {
  const { state, dispatch } = useStore();
  const { step, soundOn, audioUnlocked } = state;
  const primed = useRef(false);

  // Read the saved preference once, before anything can play.
  useEffect(() => {
    if (!readSoundPreference() && soundOn) dispatch({ type: 'TOGGLE_SOUND' });
    // Intentionally once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => watchVisibility(), []);

  // Nothing plays before a real gesture. Howler's code is fetched once the
  // page has loaded (no audio context yet), so the first gesture can unlock
  // synchronously, which Safari requires.
  useEffect(() => {
    if (!heroAmbient || audioUnlocked) return;
    const load = () => {
      primed.current = true;
      void prime();
    };
    if (document.readyState === 'complete') load();
    else window.addEventListener('load', load, { once: true });

    const onGesture = (event: Event) => {
      if (event instanceof KeyboardEvent && NON_ACTIVATING_KEYS.has(event.key)) return;
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      startAmbient(() => dispatch({ type: 'AUDIO_UNLOCKED' }));
    };
    const gestures = ['click', 'touchend', 'keydown'] as const;
    for (const type of gestures) window.addEventListener(type, onGesture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('load', load);
      for (const type of gestures) window.removeEventListener(type, onGesture, { capture: true });
    };
  }, [heroAmbient, audioUnlocked, dispatch]);

  // Howler must be in memory before the Submit click, because unlock has to be
  // synchronous. Load it on the first pointer down (which comes before any
  // Submit click), or once past the hero —
  // whichever comes first, since Play on the panel is a second unlock path.
  useEffect(() => {
    const load = () => {
      if (primed.current) return;
      primed.current = true;
      void prime();
    };
    if (step >= STEP_QUESTIONS) load();
    window.addEventListener('pointerdown', load, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', load);
  }, [step]);

  useEffect(() => {
    audio.setMuted(!soundOn);
    writeSoundPreference(soundOn);
  }, [soundOn]);

  useEffect(() => {
    if (audioUnlocked) track('audio_unlocked');
  }, [audioUnlocked]);

  useEffect(() => {
    if (!audioUnlocked) return;

    const card = imageCardAt(step);

    if (card) {
      const index = IMAGE_CARDS.findIndex((c) => c.id === card.id);
      audio.load(card.id, card.track);
      // One ahead, so the next card never arrives before its music.
      const next = IMAGE_CARDS[index + 1];
      if (next) audio.load(next.id, next.track);
      audio.duck(1);
      audio.play(card.id);
      return;
    }

    if (step === STEP_HERO && heroAmbient) {
      startIntro();
      return;
    }

    if (step === STEP_THANKS) {
      audio.fadeOutAndUnload();
      return;
    }

    // Hero and questions: the music is quiet under the questions and stops on
    // the hero, and picks up again on the way forward. No second unlock is
    // needed.
    if (step === STEP_QUESTIONS && audio.isUnlocked()) {
      audio.duck(DUCK);
      return;
    }
    audio.pause();
  }, [step, audioUnlocked, heroAmbient]);

  // Keep the reducer's flags in step with what is actually audible.
  const snapshot = useAudioSnapshot();

  useEffect(() => {
    if (snapshot.playing !== state.playing) {
      dispatch({ type: 'SET_PLAYING', playing: snapshot.playing });
    }
  }, [snapshot.playing, state.playing, dispatch]);

  // If the click landed before Howler had loaded, the unlock completes a
  // moment later. Catch it here, or the page stays silent for the whole visit.
  useEffect(() => {
    if (snapshot.unlocked && !audioUnlocked) dispatch({ type: 'AUDIO_UNLOCKED' });
  }, [snapshot.unlocked, audioUnlocked, dispatch]);
}

/**
 * The second unlock path: Play on the Now Playing panel, before the form.
 * Nobody has to hand over an email just to hear the page.
 */
export function unlockFromGesture(dispatchUnlocked: () => void): void {
  // Synchronous, before any await — this is the whole point.
  const ok = audio.unlock();
  if (ok) dispatchUnlocked();
}

/**
 * Call inside a gesture handler: unlocks audio and starts the intro track.
 * Idempotent, so a second gesture never restarts or doubles it. If Howler is
 * still loading, the unlock completes when it arrives and the step effect
 * above starts the track.
 */
export function startAmbient(dispatchUnlocked: () => void): void {
  if (!audio.unlock()) return;
  dispatchUnlocked();
  startIntro();
}

export function startIntro(): void {
  if (!audio.isUnlocked()) return;
  audio.load(INTRO_ID, INTRO_TRACK);
  audio.play(INTRO_ID);
}
