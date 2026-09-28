import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from 'react';
import { initialState, reducer, type Action, type State } from './reducer';
import { readLead, writeLead } from './lead';

type Store = {
  state: State;
  dispatch: Dispatch<Action>;
  /**
   * The same state, in a ref. GSAP Observer callbacks are created once and
   * would otherwise read a stale closure — the animation lock depends on this.
   */
  stateRef: RefObject<State>;
};

const StoreContext = createContext<Store | null>(null);

/**
 * Picks up a sign-up from earlier in the visit, so a reload does not put the
 * gate back. Runs once, before the first render.
 */
function boot(): State {
  const remembered = readLead();
  if (!remembered) return initialState;
  return {
    ...initialState,
    lead: {
      id: remembered.id,
      name: remembered.name,
      already: true,
      status: 'done',
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, boot);
  const stateRef = useRef(state);

  // Remember the sign-up for the rest of the visit.
  useEffect(() => {
    if (state.lead.status === 'done' && state.lead.name) {
      writeLead({ id: state.lead.id ?? '', name: state.lead.name });
    }
  }, [state.lead.status, state.lead.id, state.lead.name]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Also keep it correct within the current render, before effects run.
  stateRef.current = state;

  const value = useMemo<Store>(
    () => ({ state, dispatch, stateRef }),
    [state, dispatch],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

export function useAppState(): State {
  return useStore().state;
}

export function useAppDispatch(): Dispatch<Action> {
  return useStore().dispatch;
}
