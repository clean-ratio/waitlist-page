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

## Waitlist status

Name and email are validated in the browser. `src/lib/submitWaitlistEntry.ts`
is the single adapter to replace when a database is selected
(`submitWaitlistEntry` and `submitProfile`). It currently saves nothing; submitted details and the optional survey answers remain in
React memory only. Visitors are told this in the form and privacy notice.
There are no required environment variables; `.env.example` is intentionally
empty apart from that note.

## Images and type

The three deck cards use optimized WebP images from the Cooling, Muscle
Recovery, and Skin Recovery lines. `/collection.html` browses all 179 supplied
images with lazy loading and category filters. The original files are archived
under `artifacts/source-images/new_images/` and excluded from Git and Vite's
published `public` tree. `npm run images` regenerates the WebP collection,
manifest, and Open Graph image with Sharp.

Lora is self-hosted for display type; Manrope is bundled locally for body text.
Font licenses are in `public/fonts/`.

## Motion and accessibility

React Three Fiber and Three.js render the diagonal deck. GSAP animates the
shared card positions; the canvas uses demand rendering, caps DPR at 1.75, and
pauses when hidden or off-screen. A static HTML deck remains available without
WebGL. Reduced motion is honored. Wheel, touch, and keyboard input advance one
card at a time.

The supplied audio files in `public/sounds/` are unchanged.