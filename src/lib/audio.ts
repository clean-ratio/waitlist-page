import type { Howl as HowlType, HowlerGlobal } from 'howler';
import type { Track } from './content';

/**
 * One manager owns all card tracks. React only ever tells it "the active card
 * is now c03"; the crossfade, the preloading and the mute live in here.
 *
 * The part that breaks if it is skipped: a scroll does not unlock audio.
 * Browsers only allow sound after a user activation — a click, a key press or
 * a touch end. `unlock()` must therefore be called inside a click handler and
 * *before any await*, or Safari will have expired the activation by the time
 * it runs.
 */

const FADE_OUT_MS = 900;
const FADE_IN_MS = 1200;
const DUCK_MS = 600;
const END_FADE_MS = 3000;

type Howler = { Howl: typeof HowlType; Howler: HowlerGlobal };

let howlerModule: Howler | null = null;
let howlerLoading: Promise<Howler | null> | null = null;

/**
 * Howler is ~30 KB and nothing before the glass step needs it, so it is loaded
 * on demand. It must be in memory *before* the Submit click, because unlock
 * has to be synchronous — `prime()` is called as soon as the visitor reaches
 * the glass step, and on the first pointer down anywhere.
 */
export function prime(): Promise<Howler | null> {
  if (howlerModule) return Promise.resolve(howlerModule);
  if (!howlerLoading) {
    howlerLoading = import('howler')
      .then((mod) => {
        howlerModule = { Howl: mod.Howl, Howler: mod.Howler };
        return howlerModule;
      })
      .catch((err) => {
        console.error('[audio] howler failed to load', err);
        return null;
      });
  }
  return howlerLoading;
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export type AudioSnapshot = {
  unlocked: boolean;
  /** Something is audible right now (not paused, not muted). */
  playing: boolean;
  currentId: string | null;
  /** Ids whose files could not be loaded. The UI shows a dash, not an error. */
  missing: string[];
};

type Listener = (snapshot: AudioSnapshot) => void;

class DeckAudio {
  private howls = new Map<string, HowlType>();
  private targets = new Map<string, number>();
  private missing = new Set<string>();
  private listeners = new Set<Listener>();

  private current: string | null = null;
  private unlocked = false;
  private muted = false;
  private paused = false;
  private duckFactor = 1;
  /** Set when unlock was asked for before Howler had finished loading. */
  private unlockPending = false;

  /**
   * Cached, and only rebuilt when something actually changes. React's
   * useSyncExternalStore re-renders until the snapshot stops changing
   * identity, so handing it a fresh object every read is an infinite loop.
   */
  private cached: AudioSnapshot = {
    unlocked: false,
    playing: false,
    currentId: null,
    missing: [],
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): AudioSnapshot {
    return this.cached;
  }

  private emit() {
    const next: AudioSnapshot = {
      unlocked: this.unlocked,
      playing: Boolean(this.current) && !this.paused && !this.muted,
      currentId: this.current,
      missing: [...this.missing],
    };
    const previous = this.cached;
    if (
      next.unlocked === previous.unlocked &&
      next.playing === previous.playing &&
      next.currentId === previous.currentId &&
      next.missing.length === previous.missing.length
    ) {
      return;
    }
    this.cached = next;
    for (const listener of this.listeners) listener(next);
  }

  /**
   * Call this synchronously inside a click/touch handler, before any await.
   * Returns true if the audio context was resumed there and then.
   */
  unlock(): boolean {
    if (this.unlocked) return true;

    if (!howlerModule) {
      // Howler has not arrived yet. Resume a throwaway context so the
      // activation is used now, and finish the job the moment it loads.
      this.unlockPending = true;
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          void ctx.resume();
          void ctx.close();
        }
      } catch {
        /* ignore */
      }
      void prime().then(() => {
        if (this.unlockPending) this.unlock();
      });
      return false;
    }

    const { Howler } = howlerModule;
    try {
      void Howler.ctx?.resume();
      // A 50 ms silent buffer: the cheapest proof the context really is awake.
      if (Howler.ctx) {
        const buffer = Howler.ctx.createBuffer(1, 1, 22050);
        const source = Howler.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(Howler.ctx.destination);
        source.start(0);
      }
    } catch (err) {
      console.error('[audio] unlock failed', err);
      return false;
    }

    this.unlocked = true;
    this.unlockPending = false;
    this.emit();
    return true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Idempotent. Safe to call on every step for "one ahead" preloading. */
  load(id: string, track: Track): void {
    if (!howlerModule || this.howls.has(id) || this.missing.has(id)) return;
    const { Howl } = howlerModule;

    const howl = new Howl({
      src: [...track.src],
      loop: true,
      volume: 0,
      // Web Audio goes silent when an iPhone's ring/silent switch is on.
      // HTML5 audio does not, at the cost of slightly coarser fades.
      html5: isIOS(),
      preload: true,
      onloaderror: () => {
        this.missing.add(id);
        this.howls.delete(id);
        if (this.current === id) this.current = null;
        this.emit();
      },
      onplayerror: () => {
        // Usually the context suspending under us. Retry once it is awake.
        howl.once('unlock', () => {
          if (this.current === id && !this.paused) howl.play();
        });
      },
    });

    this.targets.set(id, track.volume);
    this.howls.set(id, howl);
    if (track.startAt) howl.seek(track.startAt);
  }

  hasTrack(id: string): boolean {
    return this.howls.has(id);
  }

  isMissing(id: string): boolean {
    return this.missing.has(id);
  }

  /**
   * Crossfade to `id`. Fast stepping is safe: earlier fades are cancelled
   * rather than stacked, so only the latest target is ever audible.
   */
  play(id: string): void {
    if (!this.unlocked || this.missing.has(id)) return;
    if (id === this.current && !this.paused) return;

    const previous = this.current && this.howls.get(this.current);
    if (previous && this.current !== id) {
      previous.off('fade');
      previous.fade(previous.volume(), 0, FADE_OUT_MS);
      previous.once('fade', () => previous.pause());
    }

    const next = this.howls.get(id);
    this.current = id;
    this.paused = false;
    if (!next) {
      this.emit();
      return;
    }

    // Drop any pending "pause when the fade ends" from a previous exit.
    next.off('fade');
    if (!next.playing()) next.play();
    next.fade(next.volume(), this.volumeFor(id), FADE_IN_MS);
    this.emit();
  }

  private volumeFor(id: string): number {
    return (this.targets.get(id) ?? 0.5) * this.duckFactor;
  }

  /** Used on the questions step: the last track keeps playing, quieter. */
  duck(factor: number): void {
    if (this.duckFactor === factor) return;
    this.duckFactor = factor;
    const howl = this.current && this.howls.get(this.current);
    if (howl && !this.paused) {
      howl.off('fade');
      howl.fade(howl.volume(), this.volumeFor(this.current!), DUCK_MS);
    }
  }

  /**
   * Pause, never stop. Walking back to card 2 then continues where it left
   * off, instead of restarting the playlist.
   */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const howl = this.current && this.howls.get(this.current);
    if (howl) {
      howl.off('fade');
      howl.fade(howl.volume(), 0, 400);
      howl.once('fade', () => howl.pause());
    }
    this.emit();
  }

  resume(): void {
    if (!this.paused || !this.current) return;
    this.paused = false;
    const howl = this.howls.get(this.current);
    if (howl) {
      howl.off('fade');
      if (!howl.playing()) howl.play();
      howl.fade(howl.volume(), this.volumeFor(this.current), 600);
    }
    this.emit();
  }

  toggle(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  isPaused(): boolean {
    return this.paused;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    howlerModule?.Howler.mute(muted);
    this.emit();
  }

  /** Thanks step: down to silence over three seconds, then let it all go. */
  fadeOutAndUnload(): void {
    const howl = this.current && this.howls.get(this.current);
    if (howl) {
      howl.off('fade');
      howl.fade(howl.volume(), 0, END_FADE_MS);
      howl.once('fade', () => this.unloadAll());
    } else {
      this.unloadAll();
    }
  }

  unloadAll(): void {
    for (const howl of this.howls.values()) {
      howl.off();
      howl.unload();
    }
    this.howls.clear();
    this.current = null;
    this.paused = false;
    this.emit();
  }
}

export const audio = new DeckAudio();

/**
 * Fade out when the tab is hidden, come back when it returns. Stops music
 * playing from a tab nobody is looking at.
 */
export function watchVisibility(): () => void {
  let pausedByUs = false;

  const onChange = () => {
    if (document.hidden) {
      if (!audio.isPaused()) {
        pausedByUs = true;
        audio.pause();
      }
    } else if (pausedByUs) {
      pausedByUs = false;
      audio.resume();
    }
  };

  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const SOUND_KEY = 'deck:sound';

export function readSoundPreference(): boolean {
  try {
    return sessionStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeSoundPreference(on: boolean): void {
  try {
    sessionStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode and locked-down browsers throw here. Not worth a crash.
  }
}
