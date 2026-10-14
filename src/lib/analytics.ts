/**
 * Funnel events. The waitlist adapter is intentionally not connected yet.
 *
 * Works with Plausible or PostHog if either is on the page; otherwise it is a
 * no-op (and a console line in dev). No vendor script is bundled.
 */

type Props = Record<string, string | number | boolean | undefined>;

export type AnalyticsEvent =
  | 'hero_view'
  | 'waitlist_ready'
  | 'waitlist_error'
  | 'waitlist_duplicate'
  | 'card_view'
  | 'questions_view'
  | 'answers_ready'
  | 'thanks_view'
  | 'audio_unlocked'
  | 'webgl_fallback';

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Props }) => void;
    posthog?: { capture: (event: string, props?: Props) => void };
  }
}

const sent = new Set<string>();

export function track(event: AnalyticsEvent, props?: Props): void {
  try {
    window.plausible?.(event, props ? { props } : undefined);
    window.posthog?.capture(event, props);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', event, props ?? '');
    }
  } catch {
    // Analytics must never take the page down.
  }
}

/** For view events that should count once per visit. */
export function trackOnce(event: AnalyticsEvent, props?: Props): void {
  const key = event + JSON.stringify(props ?? {});
  if (sent.has(key)) return;
  sent.add(key);
  track(event, props);
}

/** UTM tags and referrer, captured once on load and stored with the lead. */
export function campaign(): { utm?: Record<string, string>; referrer?: string } {
  const utm: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = params.get(key);
      if (value) utm[key] = value.slice(0, 200);
    }
  } catch {
    /* ignore */
  }
  const referrer = document.referrer ? document.referrer.slice(0, 500) : undefined;
  return { utm: Object.keys(utm).length ? utm : undefined, referrer };
}
