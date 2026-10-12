import { useEffect, type RefObject } from 'react';
import { useStore } from './store';

/** The panel must have been still this long before an edge gesture counts. */
const SETTLE_MS = 220;
/** Px of swipe at an edge before it counts as wanting the next section. */
const SWIPE_PX = 48;

/**
 * Full-screen panels that scroll natively (the hero on a short phone, the
 * profile questions) are marked `data-scrollable`, so the deck's Observer
 * leaves them alone. This steps out of them instead — but only from an edge,
 * and only once the panel has stopped moving, so the momentum that carried
 * someone to the bottom does not also carry them into the next section.
 */
export function useEdgeStep(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  const { dispatch } = useStore();

  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;

    let lastScroll = 0;
    let touchY: number | null = null;
    let touchAtTop = false;
    let touchAtBottom = false;

    const atTop = () => node.scrollTop <= 1;
    const atBottom = () =>
      node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    const settled = () => performance.now() - lastScroll > SETTLE_MS;

    const onScroll = () => {
      lastScroll = performance.now();
    };

    const onWheel = (event: WheelEvent) => {
      if (!settled()) return;
      if (event.deltaY > 4 && atBottom()) dispatch({ type: 'NEXT' });
      else if (event.deltaY < -4 && atTop()) dispatch({ type: 'PREV' });
    };

    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
      // Measured at the start: a swipe that scrolls the panel to its edge is
      // a scroll, not a request to leave.
      touchAtTop = atTop();
      touchAtBottom = atBottom();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - (event.changedTouches[0]?.clientY ?? touchY);
      touchY = null;
      if (dy > SWIPE_PX && touchAtBottom) dispatch({ type: 'NEXT' });
      else if (dy < -SWIPE_PX && touchAtTop) dispatch({ type: 'PREV' });
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    node.addEventListener('wheel', onWheel, { passive: true });
    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, active, dispatch]);
}
