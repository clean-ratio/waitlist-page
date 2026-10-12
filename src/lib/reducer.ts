import { STEPS } from './content';
import type { ProfileKey, Rest } from './schema';

export type LeadStatus = 'idle' | 'sending' | 'done' | 'error';

export type Answers = {
  [K in ProfileKey]: string[];
} & {
  lifestyleOther?: string;
  rest?: Rest;
  status: LeadStatus;
};

export type State = {
  /** Index into STEPS. */
  step: number;
  /** True for the length of a transition. */
  animating: boolean;
  lead: {
    id?: string;
    name?: string;
    email?: string;
    status: LeadStatus;
    error?: string;
  };
  answers: Answers;
  soundOn: boolean;
  playing: boolean;
  audioUnlocked: boolean;
  /**
   * Bumped whenever a step is refused. The UI watches it and nudges whatever
   * is missing — a blocked scroll should never feel broken.
   */
  nudge: number;
};

export type AnswerKey = ProfileKey | 'lifestyleOther' | 'rest';

export type Action =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'GOTO'; step: number }
  | { type: 'ANIM_START' }
  | { type: 'ANIM_END' }
  | { type: 'LEAD_SENDING' }
  | { type: 'LEAD_DONE'; id: string; name: string; email: string }
  | { type: 'LEAD_ERROR'; message: string }
  | { type: 'ANSWER'; key: AnswerKey; value: unknown }
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
  answers: { lifestyle: [], approach: [], focus: [], status: 'idle' },
  soundOn: true,
  playing: false,
  audioUnlocked: false,
  nudge: 0,
};

/** How many of the four profile questions have an answer. */
export function answeredCount(answers: Answers): number {
  return (
    (answers.lifestyle.length > 0 ? 1 : 0) +
    (answers.approach.length > 0 ? 1 : 0) +
    (answers.focus.length > 0 ? 1 : 0) +
    (answers.rest ? 1 : 0)
  );
}

/**
 * Nothing on the page is gated. The form sits on the first screen for
 * everyone; the questions and the deck are for whoever keeps scrolling.
 */
export function canAdvance(state: State): boolean {
  return state.step < STEPS.length - 1;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT': {
      if (state.animating) return state;
      if (!canAdvance(state)) return { ...state, nudge: state.nudge + 1 };
      return { ...state, step: state.step + 1 };
    }

    case 'PREV': {
      if (state.animating) return state;
      if (state.step <= 0) return state;
      return { ...state, step: state.step - 1 };
    }

    case 'GOTO': {
      if (state.animating || action.step === state.step) return state;
      const step = Math.max(0, Math.min(STEPS.length - 1, action.step));
      return { ...state, step };
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
          email: action.email,
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
