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
  STEP_QUESTIONS,
  STEP_THANKS,
  imageCardAt,
} from './content';
import { useStore } from './store';
import { track } from './analytics';

/** The questions step keeps the last track, at 40% of its volume. */
const DUCK = 0.4;
const INTRO_ID = 'intro';

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
 */
export function useDeckAudio(): void {
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
  }, [step, audioUnlocked]);

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

export function startIntro(): void {
  if (!audio.isUnlocked()) return;
  audio.load(INTRO_ID, INTRO_TRACK);
  audio.play(INTRO_ID);
}
