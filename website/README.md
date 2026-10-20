# Lotus website

The marketing site for Lotus (thelotusdigital.com). Next.js 16 static export, Tailwind v4, GSAP + Lenis for motion,
three.js (React Three Fiber) for the home hero, deployed to Cloudflare Workers static assets with Wrangler.

Status: scaffold, brand tokens, smooth scroll and the home hero ("The Rise") with placeholder copy.
The plan this follows is `/website/website-plan.md` in the project files; the brand book v2 governs visuals.

## Run

```bash
cd website
npm install
npm run dev          # http://localhost:3000
npm run build        # static export to out/
npm run start        # serve out/ locally
npm run lint && npm run typecheck
```

## Deploy (Cloudflare)

```bash
npm run deploy:preview   # builds, then deploys the Worker "lotus-website-preview" (a *.workers.dev URL)
npm run deploy           # builds, then deploys the Worker "lotus-website" (not yet on the domain)
```

Both need a Cloudflare login (`npx wrangler login`) or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
The live coming-soon page is a different Worker (`lotus-coming-soon`); nothing here touches it.
Best long-term setup: connect this repo to Cloudflare Workers Builds so every push deploys and every branch gets a preview URL.

## The hero: "The Rise"

`src/components/hero/`. Points of light rise out of dark water and gather into the Lotus mark. The section pins for
1.4 screens of scroll: the points stream down into a counting number, hold, then split into three petals that hand
off to the three section cards. Headline and buttons are real HTML on top; the canvas is decorative (`aria-hidden`).

| File | Role |
|---|---|
| `rise-hero.tsx` | Section, HTML copy layer, GSAP scroll timeline (ScrollTrigger pin + scrub), labels under the number and petals |
| `rise-scene.tsx` | R3F canvas, layout, entrance tween, drop glow, drip, pointer ripples; renders only while on screen |
| `rise-points.tsx` | The point cloud: per-frame choreography between target sets (CPU, 7k points) and the two-pass glow material |
| `water.tsx`, `shaders.ts` | Sky gradient (the brand's 160° Rise gradient), procedural water with ripple ring buffer, point sprites |
| `sampling.ts`, `targets.ts` | Rasterize the mark / a petal / the number to points; lay them out in world units per viewport |
| `hero-mode.ts` | Picks `full`, `lite` or `still` per device (see below) |
| `rise-fallback.tsx` | The still hero (`public/hero/rise-still*.webp`) for reduced motion, no WebGL, data saver, weak devices |
| `mark-paths.ts` | Generated: the logo's `<path>` data (never redrawn), see "Swapping the logo" |

Choreography timing lives in `hero-state.ts` (`PHASES`, fractions of the pinned scroll) and is shared by the GSAP
timeline (HTML layer) and the three.js loop, so both read the same clock.

### Modes and overrides

| Mode | When | What |
|---|---|---|
| `full` | desktop with a fine pointer, > 4 cores, > 4 GB | 7,000 points, two-pass glow, pixel ratio capped at 1.75 |
| `lite` | coarse pointer, width < 820 px, ≤ 4 cores or ≤ 4 GB | 3,000 points, one pass, pixel ratio capped at 1.5, no pointer ripples |
| `still` | `prefers-reduced-motion`, no WebGL, data saver, ≤ 2 cores or ≤ 2 GB | pre-rendered still, no pin, no scroll choreography |

Force one with `?hero=full`, `?hero=lite` or `?hero=still`. `?nodrip` keeps the water quiet (used by the still renderer).

### Budget (measured on the static export, gzip)

| Payload | Size |
|---|---|
| Initial JS (React, Next runtime, GSAP + ScrollTrigger, Lenis, app) | 256 KB |
| Hero chunk (three.js + React Three Fiber + scene), lazy, after first paint | 254 KB |
| CSS | 7 KB |
| HTML (home) | 5 KB |
| Stills (WebP) | 39 KB landscape, 41 KB portrait |
| Fonts preloaded (latin, 4 files) | 131 KB |

The hero chunk sits right on the ~250 KB target from the plan; three.js core is the bulk and there is no drei or
postprocessing (the glow is a second point pass, the water is one quad with a procedural normal). Frame cost is
dominated by the CPU update of 7k points (one loop, typed arrays, no allocations) and the full-screen water shader.
Frame rate on real GPUs still needs a check on a mid laptop (target 60) and a mid phone (target 30+): headless
Chromium here renders in software, so it cannot measure that.

### Re-rendering the stills

```bash
npm run build && npm run hero:still && npm run build
```

`scripts/render-hero-still.mjs` serves `out/`, opens the hero in headless Chromium (Google Chrome, or
`PW_CHROMIUM=/path/to/chromium`), waits for the entrance to settle and screenshots the scene at 1920×1080 and
1080×1920, then encodes WebP with `sharp`, `cwebp` or Python Pillow, whichever is installed.

### Swapping the logo

The hero samples its points from the supplied logo geometry; it never redraws it. The current source is the
`favicon.svg` from the logo pack (`public/brand/lotus-mark.svg`). When the SVG logo set lands:

```bash
node scripts/extract-mark-paths.mjs path/to/lotus-master-icon-colour.svg   # regenerates src/components/hero/mark-paths.ts
```

Parts are matched by fill (brand book p.10). Replace `public/brand/lotus-logo-reverse.png` and
`lotus-logo-colour.png` with the SVG logos for the header and footer at the same time.

## Tokens, type, copy

- `src/app/globals.css` ports `lotus-v2-tokens.css` (shared neutrals, one theme per section via `data-section`)
  and maps them into Tailwind v4 `@theme` tokens (`bg-ink`, `text-rose`, `font-display`, `rounded-pill`, ...).
- Type is self-hosted by `next/font`: Manrope (display), Inter (body), Fraunces and JetBrains Mono (section accents).
- All words come from `src/content/placeholders.ts` and are marked as placeholders; the copy thread replaces them.
  Flip `COPY_IS_PLACEHOLDER` to `false` to drop the "Placeholder copy" chip. Never put founder names on the site.

## Still missing

SVG logo set, photos, the design artifacts (`/website/design/`), final copy (`/website/copy/`), the booking link
(`/book` is a dead link for now), legal pages, real proof for the one number.
