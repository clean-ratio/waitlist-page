/**
 * Remembering that someone has already joined.
 *
 * The glass card is a gate, not a page: once a visitor is through it they
 * should never be asked again — including after scrolling back to the cover,
 * and including after a reload.
 *
 * `sessionStorage`, not `localStorage`: it survives a refresh and the rest of
 * the visit, and goes when the tab does. Keeping a name and an id on disk
 * indefinitely is more personal data than a waitlist needs, and this page is
 * as likely to be opened on a shared machine as any other. Swap the two calls
 * below if you decide a returning visitor next week should be remembered too.
 */

const KEY = 'deck:lead';

export type RememberedLead = { id: string; name: string };

export function readLead(): RememberedLead | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedLead>;
    // A name is enough to greet them; the id may be missing if the network
    // was slow when they signed up, and the deck still has to open.
    if (typeof parsed?.name !== 'string') return null;
    return { id: typeof parsed.id === 'string' ? parsed.id : '', name: parsed.name };
  } catch {
    // Private mode, blocked storage, or somebody else's JSON in our key.
    return null;
  }
}

export function writeLead(lead: RememberedLead): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(lead));
  } catch {
    // Not worth a crash: the visit still works, they just get asked again.
  }
}

export function forgetLead(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
