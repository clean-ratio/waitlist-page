# Clean Ratio

A nature-led recovery and wellness waitlist. The page runs top to bottom:

1. **Hero** — one glacier photograph with a slow camera drift, mist and light
   (CSS only), the mark, and a name + email waitlist form. Set `HERO.video` in
   `src/lib/content.ts` to play a looping clip instead, with the still as poster.
2. **Lifestyle & Recovery Profile** — four optional questions (lifestyle,
   how you recover, what you want help with, rest). Edit them in
   `PROFILE_QUESTIONS` in `src/lib/schema.ts`.
3. **Diagonal deck** — the Three.js card stack, arriving from down-right.
4. **Closing** — thank you, or a prompt to join / finish the profile.

Nothing is gated: every section is reachable by scrolling.

```sh
npm install
npm run dev
npm run build
npm run images
```

## Waitlist storage (Supabase)

Sign-ups and profiles are saved to Supabase through two database functions,
`join_waitlist` and `save_profile`, called from `src/lib/submitWaitlistEntry.ts`.

1. Run `supabase/schema.sql` once in the Supabase SQL editor (safe to re-run).
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
   for local dev and in Vercel's environment variables for deploys (see
   `.env.example`), then redeploy.

The publishable key is public by design. It can only call the two functions:
row level security is on with no policies, so it cannot read any row back.
Never use the secret / service_role key here. Each function validates its
input again and rate-limits per IP (10 sign-ups / 20 profile saves per 10
minutes). A repeat sign-up with the same email updates the existing entry.

See everyone in the Supabase Table Editor (`leads`, `profiles`) or run
`select * from waitlist_export;` and download the CSV. To delete someone:
`delete from leads where email = '…';` (their profile goes with it).

If the profile options in `src/lib/schema.ts` change, update the allow-lists
in `save_profile` to match.

## Images and type

The three deck cards use optimized WebP images from the Cooling, Muscle
Recovery, and Skin Recovery lines. `/collection.html` browses all 179 supplied
images with lazy loading and category filters. The original files are archived
under `artifacts/source-images/new_images/` and excluded from Git and Vite's
published `public` tree. `npm run images` regenerates the WebP collection,
manifest, and Open Graph image with Sharp.

Ranade Light and Thin provide the body and display cuts; Fragment Mono accents
labels and controls. Font licenses are in `public/fonts/`.

## Motion and accessibility

React Three Fiber and Three.js render the diagonal deck. GSAP animates the
shared card positions; the canvas uses demand rendering, caps DPR at 1.75, and
pauses when hidden or off-screen. A static HTML deck remains available without
WebGL. Reduced motion is honored. Wheel, touch, and keyboard input advance one
card at a time.

The supplied audio files in `public/sounds/` are unchanged.