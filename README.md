# Scroll Card Stack

A diagonal 3D card deck that collects waitlist sign-ups. Twelve steps, one scroll
gesture per step, a gate on the glass form that nobody gets past without
joining the list.

Built from `Scroll Card Stack — Implementation Plan.pdf`.

```
npm install
npm run dev        # http://localhost:5173, /api routes included
npm run build      # typecheck + production bundle
npm run images     # 1600 px WebP + 600 px JPEG from public/images
```

## Typography

The reference uses Cezanne Regular and Cantoria Semibold. The site uses
self-hosted, open-source alternatives: Mr De Haviland Regular for expressive
headings and Lora for supporting text. These are visual substitutes,
not the exact commercial fonts. All pages share `public/typography.css`;
font sources, licenses, and replacement instructions are in `public/fonts/README.md`.

## Image and sound mapping

`src/lib/content.ts` pairs all eight supplied images with the eight recordings
in `public/sounds`. The WebGL deck, HTML fallback, backdrop, and Now Playing
panel use the same card data. Collection labels are derived from the card count.

| Image in `public/images` | Sound in `public/sounds` |
| --- | --- |
| `beach-side.jpg` | `beach_side.mpeg` |
| `vacation.jpg` | `vacation_vibe.mpeg` |
| `river-side.jpg` | `river_side.mpeg` |
| `deep-dive.jpg` | `deep_dive.mpeg` |
| `road_trip.jpg` | `raod_trip.mpeg` |
| `calm_home.jpg` | `calm_home.mpeg` |
| `coffee-Shop.jpg` | `coffee_shop.mpeg` |
| `work_space.jpg` | `work_space.mpeg` |

The road trip sound keeps its supplied filename (`raod_trip.mpeg`).

## How it fits together

Two layers, driven by the same numbers so they cannot drift apart:

- **WebGL** (`src/gl`) draws the card images, the paper frames, the shadows and
  the blurred backdrop. Orthographic camera, 1 unit = 1 CSS pixel, origin at
  screen centre — so card positions are in pixels and HTML labels sit over the
  cards without any projection maths.
- **HTML** (`src/ui`) draws everything you read or type: the cover, the form,
  the labels, the Now Playing panel, the questions, the thanks.

Every card's position comes from one number, its **slot**
(`cardIndex − activeIndex`). `src/lib/deckLayout.ts` turns a slot into x, y,
scale, brightness and alpha; GSAP tweens those plain numbers and the meshes
read them each frame. No card has animation code of its own.

Cards to come wait down-right in a short stack. A card that has been passed
does not join a stack behind — it **leaves**, one per scroll, sliding up the
diagonal and off the frame. Position and opacity are tweened separately so a
departing card stays solid for most of its travel and only goes as it clears
the edge; sharing one ease dissolves it in mid-air, which reads as a glitch
rather than an exit.

Two motion libraries, with a line between them. **GSAP** drives the deck,
because it tweens the plain numbers the WebGL layer reads every frame.
**Framer Motion** drives the HTML: word-by-word text, the question tiles, the
scale. Nothing uses both.

### The diagonal, measured off the reference

`Screen Recording 2026-09-25 173452.mp4` was tracked frame by frame (optical
flow for direction, multi-scale template matching to follow individual cards
across cuts). What it actually does:

| | |
|---|---|
| Direction | The deck travels **up and to the left**, at −127° |
| Upcoming | Wait **down-right** of centre, slightly smaller, and move up-left into the middle |
| Passed | Carry on up-left and leave through the **top-left corner** |
| Card | 243 × 304 px — 4:5 exactly — at 62% of viewport height |
| Slot offset | 21 px in x, 24 px in y: **≈8% of the card's own width and height**, so the stack runs along the card's own diagonal |
| Scale per slot | Small — the gaps between card edges are near-uniform (20, 21, 22 px), so no more than a few percent |
| Drift | A constant ambient drift of ≈(−30, −40) px/s, about 12% of card size per second, along that same diagonal |

**The plan has this backwards.** Section 1 says "cards behind it step up and to
the left; cards already passed step down and to the right", and the build
followed it. Tracking the card that is *about to* become active shows it
sitting at (+61, +20) and 30% smaller before it arrives — down-right, not
up-left. `slotProps` now matches the clip.

Two things in the reference were deliberately **not** copied. It is an
auto-playing montage: cuts land every 0.43 s on average and are hard cuts, not
eased transitions — there are no in-between frames. And its constant drift
would mean rendering every frame forever, which contradicts both
`frameloop="demand"` and a deck that should be still until you move it. The
deck here is scroll-driven and still between steps; the diagonal shows up in
the stack and in the exit, which now carries the cards right off the frame
rather than parking them just outside the visible band.

```
src/
  lib/     content · deckLayout · reducer · schema · audio · useStepInput · analytics
  gl/      Stage · Deck · CardPlane · cardMaterial · Backdrop
  ui/      CoverText · GlassForm · CardLabels · NowPlaying · Questions · Thanks · FallbackDeck
api/       waitlist · answers          (Vercel functions; mounted on the dev server too)
```

## The four things that could have sunk it

1. **A scroll does not unlock audio.** Browsers need a click, key press or
   touch end. `audio.unlock()` is called synchronously inside the Submit
   handler and inside the panel's Play button — *before any `await`*, because
   after an `await fetch()` Safari has already expired the activation. There
   are two unlock paths, so nobody has to hand over an email to hear the page.

2. **One card per scroll is hard on trackpads.** One MacBook swipe sends 30–100
   wheel events and keeps sending them for about a second.
   `src/lib/useStepInput.ts` has three layers: the animation lock, a 350 ms
   cooldown, and an inertia filter that accepts a step only after 180 ms of
   quiet or a sharp rise in `|deltaY|`. The filter records **every** wheel
   event, including the ones the other two layers refuse — measuring the gap
   between accepted steps instead of between events is exactly how one swipe
   ends up moving two cards.

3. **The gate is the point of the page.** Gate rules live in the reducer
   (`canAdvance`), never in the UI, so a swipe, a key press and the panel's
   Next button are all bound by them. A blocked step nudges the card and raises
   the hint rather than doing nothing.

4. **Consent is a data question.** The box is never pre-ticked, the exact
   wording is versioned (`CONSENT_VERSION`) and stored with every lead, and
   `public/privacy.html` documents the delete-on-request process.

## Storage

`/api/waitlist` and `/api/answers` are Vercel functions. Vite has no server, so
`scripts/dev-api.ts` mounts the same handlers on the dev server — one adapter,
one set of handlers.

Copy `.env.example` to `.env.local` and run `supabase/schema.sql`. **Without
Supabase credentials the API keeps sign-ups in memory and says so on boot** —
fine for local work, useless in production. See
[Connecting Supabase](#connecting-supabase).

Supabase is reached over its REST API (PostgREST) with `fetch`, not through
`@supabase/supabase-js`. The SDK builds auth, storage and realtime clients this
code never touches, and its realtime client needs a native WebSocket — on
Node 20 `createClient` throws before a single row is written. Four queries
against two tables do not need 200 KB of SDK.

Every secret is read from a plain environment variable. Nothing may ever be
renamed to `VITE_*`: Vite inlines those into the public bundle. Vite does not
populate `process.env` either, so the dev-API plugin loads `.env.local` itself
(`scripts/dev-api.ts`).

## Connecting Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, run it.
   It creates `leads` and `answers`, the `citext` extension for
   case-insensitive unique emails, and turns on row level security with no
   policies — so the anon key can read nothing and only the service-role key
   gets through.
3. **Project Settings → API**. Copy the **Project URL** and the
   **`service_role`** key. Not the `anon` key: `anon` is blocked by the RLS
   you just enabled, and every write would fail.
4. `cp .env.example .env.local`, fill in `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`, then restart `npm run dev` — env is read at
   boot.
5. Check it: sign up through the form, then **Table Editor → leads**. Sign up
   twice with the same address and you should still see one row, with
   `consent_at` and `consent_version` filled in.

For production, set the same two variables in **Vercel → Settings →
Environment Variables** (all environments) and redeploy. `.env.local` is
gitignored and never reaches Vercel.

Export the list:

```sql
select l.created_at, l.name, l.email, l.consent_at, l.consent_version,
       a.persona, a.persona_other, a.recovery
from leads l left join answers a on a.lead_id = l.id
order by l.created_at desc;
```

Delete on request (DPDP): `delete from leads where email = '…';` — the answers
row goes with it, via `on delete cascade`.

## Verified

Driven end to end in a DOM (the HTML fallback path, so the WebGL look is not
covered):

| | |
|---|---|
| A1 | One hard trackpad swipe moves exactly 1 card |
| A2 | Two swipes 0.5 s apart move exactly 2 cards |
| A3 | One mouse-wheel notch moves exactly 1 card |
| A4 | Forward scroll on the glass card is blocked; the hint appears |
| A8 | A bad email shows an inline error and sends no request |
| A9 | A repeat sign-up returns `already: true`, one row, and opens the deck |
| — | Rate limit returns 429 on the 6th request in a minute |
| — | The honeypot answers like a success and writes nothing |
| — | The questions gate blocks with nothing answered and with only Q1 |
| — | Q1 refuses a third pick; `Send` appears only when both are answered |
| — | Reduced motion: 300 ms crossfades, no slide; all text motion falls back to a plain fade |
| — | Passed cards leave the frame one per scroll; upcoming ones stack down-right |
| — | Glass card: 11:1 body text and 5:1 small text in the worst case (a dark photo behind the frost) |
| — | The no-JavaScript form posts and gets an HTML confirmation back |

## Still to do

Things the code is ready for but that need assets, accounts or a real device:

- **Audio optimisation.** All supplied recordings are wired to the cards.
  Most are around 2.5–2.9 MB; shorter loops and optional WebM/Opus alternatives
  would reduce transfer size. The beach recording also supplies the intro.
- **Cut-outs.** `ImageCard.thumb` expects a transparent PNG per card in
  `public/images/cutouts/`. Until they exist the Now Playing panel falls back
  to a framed crop of the card image. Each card can receive its own cut-out.
- **The handwritten mark.** `src/ui/Signature.tsx` is a drawn path standing in
  for the real one. Replace the path; nothing else changes.
- **Device testing.** Desktop emulation does not reproduce blur cost or the
  audio unlock rules. A real iPhone (including the ring/silent switch — see the
  `html5` note in `src/lib/audio.ts`) and a mid-range Android are needed before
  launch, along with Lighthouse on mobile.
- **The thanks-step link** points at `public/collection.html`. Set
  `COMMERCE_LINK` in `src/lib/content.ts` when there is a real destination.
- **Analytics.** `src/lib/analytics.ts` fires the funnel events and is a no-op
  until Plausible or PostHog is on the page. Watch `glass_view` against
  `waitlist_submit` from week one.

## Deviations from the plan

- **The animation lock lives in `App.tsx`, not in the GSAP timeline.** It has to
  hold on the HTML fallback path too, and two sources of truth for one lock is
  how they drift apart.
- **`frameloop="demand"` stays on**, with GSAP asking for a render per tick
  during a step, instead of switching to `"always"` and back. Same result,
  no mode flag to get out of sync.
- **The stack direction is flipped relative to the plan**, to match the
  reference clip — see [the diagonal](#the-diagonal-measured-off-the-reference).
  The deck exit follows it, so the cards leave through the top-left.
- **There is no grain.** The plan's 4% multiply layer was invisible (under 1%
  luminance swing); a corrected two-pass version was visible and then removed
  on request. The page-wide layers, the tile and the in-shader paper grain are
  all gone — the surfaces are clean.
- **Typography is Cormorant Garamond + Jost**, not the plan's Instrument Serif
  / Inter Tight / IBM Plex Mono. Two families instead of three, and the
  utility labels are letterspaced Jost rather than a monospace: mono reads
  technical, and the brief for this page is calm.
- **The primary action is a filled, centred button**, not a text link. On the
  one screen everybody sees, a text link was too easy to miss.
- **The glass card carries its legibility in the fill, not the blur.** Over a
  near-white page a mostly-transparent white card disappears; and secondary
  text on it uses `--stone-on-glass`, because `--stone` is tuned for the page
  and falls to 3.4:1 when a dark photograph shows through the frost.
- **The questions are not a list of rows.** Q1 is a plate of tiles that fill
  from the bottom as you pick them, Q2 a single line you place yourself on
  that says your answer back to you, with a progress rail across the top.
- **`@supabase/supabase-js` was removed** in favour of direct PostgREST calls,
  for the reason above. Still Supabase Postgres, still the service-role key,
  just without the SDK's Node 22 floor.
- **`@react-three/drei` was removed.** Nothing used it, and force-bundling
  ~100 KB against a 250 KB first-load budget is not a trade worth making.
  Textures load through `TextureLoader` in `src/gl/useCardTextures.ts`, which
  also lets them arrive progressively rather than suspending the whole deck.
- **`slotProps` returns only the tweenable numbers.** `zIndex`/`autoAlpha` are
  DOM concepts; draw order comes from `slotOrder(slot)` and works for both
  paths.
- **The WebGL glass pass (phase 5) is not built.** The glass card uses CSS
  `backdrop-filter`, which the plan lists as phase 1 and which is what ships
  here; the GL plane behind it is held at low alpha so there is something real
  to blur.
