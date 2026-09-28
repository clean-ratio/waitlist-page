import { STEPS, STEP_GLASS, STEP_QUESTIONS } from './content';
import type { Persona, Recovery } from './schema';

export type LeadStatus = 'idle' | 'sending' | 'done' | 'error';

export type State = {
  /** Index into STEPS. */
  step: number;
  /** True for the length of a transition. */
  animating: boolean;
  lead: {
    id?: string;
    name?: string;
    already?: boolean;
    status: LeadStatus;
    error?: string;
  };
  answers: {
    persona?: Persona[];
    personaOther?: string;
    recovery?: Recovery;
    status: LeadStatus;
  };
  soundOn: boolean;
  playing: boolean;
  audioUnlocked: boolean;
  /**
   * Bumped whenever a gate refuses a step. The UI watches it and nudges
   * whatever is missing — a blocked scroll should never feel broken.
   */
  nudge: number;
};

export type Action =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'ANIM_START' }
  | { type: 'ANIM_END' }
  | { type: 'LEAD_SENDING' }
  | { type: 'LEAD_DONE'; id: string; name: string; already: boolean }
  | { type: 'LEAD_ERROR'; message: string }
  | { type: 'ANSWER'; key: 'persona' | 'personaOther' | 'recovery'; value: unknown }
  | { type: 'ANSWERS_SENDING' }
  | { type: 'ANSWERS_DONE' }
  | { type: 'ANSWERS_ERROR'; message: string }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'AUDIO_UNLOCKED' };

export const initialState: State = {
  step: 0,
  animating: false,
  lead: { status: 'idle' },
  answers: { status: 'idle' },
  soundOn: true,
  playing: false,
  audioUnlocked: false,
  nudge: 0,
};

export function answersComplete(answers: State['answers']): boolean {
  const personaOk =
    !!answers.persona &&
    answers.persona.length > 0 &&
    (!answers.persona.includes('other') || !!answers.personaOther?.trim());
  return personaOk && !!answers.recovery;
}

/**
 * Steps that no longer apply to this visitor and are stepped straight over,
 * in both directions.
 *
 * The glass card is the only one: it is a gate, and once somebody is through
 * it, it is done. Scrolling back to the cover and forward again must not ask
 * a second time.
 */
export function skipped(step: number, state: State): boolean {
  return step === STEP_GLASS && state.lead.status === 'done';
}

/** The next step in `dir` that is actually shown. */
function seek(state: State, dir: 1 | -1): number {
  let step = state.step + dir;
  // The guards keep the search inside the deck: the cover and the thanks step
  // are never skipped, so this always terminates.
  while (step > 0 && step < STEPS.length - 1 && skipped(step, state)) {
    step += dir;
  }
  return step;
}

/**
 * Gates live here, not in the UI. A skip button, a swipe and a key press all
 * go through this function, so none of them can get around the email gate.
 */
export function canAdvance(state: State): boolean {
  if (state.step === STEP_GLASS) return state.lead.status === 'done';
  if (state.step === STEP_QUESTIONS) return answersComplete(state.answers);
  return state.step < STEPS.length - 1;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT': {
      if (state.animating) return state;
      if (state.step >= STEPS.length - 1) return state;
      if (!canAdvance(state)) return { ...state, nudge: state.nudge + 1 };
      return { ...state, step: seek(state, 1) };
    }

    case 'PREV': {
      if (state.animating) return state;
      // Step 0 has nowhere to go, and the thanks step is the end of the road.
      if (state.step <= 0 || state.step >= STEPS.length - 1) return state;
      return { ...state, step: seek(state, -1) };
    }

    case 'ANIM_START':
      return { ...state, animating: true };

    case 'ANIM_END':
      return { ...state, animating: false };

    case 'LEAD_SENDING':
      return { ...state, lead: { ...state.lead, status: 'sending', error: undefined } };

    case 'LEAD_DONE':
      return {
        ...state,
        lead: {
          id: action.id,
          name: action.name,
          already: action.already,
          status: 'done',
        },
      };

    case 'LEAD_ERROR':
      return {
        ...state,
        lead: { ...state.lead, status: 'error', error: action.message },
      };

    case 'ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.key]: action.value, status: 'idle' },
      };

    case 'ANSWERS_SENDING':
      return { ...state, answers: { ...state.answers, status: 'sending' } };

    case 'ANSWERS_DONE':
      return { ...state, answers: { ...state.answers, status: 'done' } };

    case 'ANSWERS_ERROR':
      return { ...state, answers: { ...state.answers, status: 'error' } };

    case 'TOGGLE_SOUND':
      return { ...state, soundOn: !state.soundOn };

    case 'SET_PLAYING':
      return { ...state, playing: action.playing };

    case 'AUDIO_UNLOCKED':
      return { ...state, audioUnlocked: true };

    default:
      return state;
  }
}
