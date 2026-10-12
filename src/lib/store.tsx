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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

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
