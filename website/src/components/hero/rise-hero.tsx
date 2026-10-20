"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { placeholders } from "@/content/placeholders";
import { useHeroMode } from "./hero-mode";
import { heroState, PHASES } from "./hero-state";
import { RiseFallback } from "./rise-fallback";
import type { HeroAnchors } from "./rise-scene";

/* The WebGL scene is a separate chunk, loaded after the HTML has painted. Never rendered on the server. */
const RiseScene = dynamic(() => import("./rise-scene").then((m) => m.RiseScene), { ssr: false });

const copy = placeholders.hero;

/**
 * "The Rise": the home hero. Points of light rise from dark water into the Lotus mark; on scroll
 * (pinned for 1.4 screens) they stream into a counting number, then split into three petals that
 * hand off to the three section cards below. Headline and buttons are real HTML above the canvas.
 */
export function RiseHero() {
  const mode = useHeroMode();
  const section = useRef<HTMLElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [anchors, setAnchors] = useState<HeroAnchors | null>(null);
  const animated = mode === "full" || mode === "lite";
  const onReady = useCallback(() => setSceneReady(true), []);

  useGSAP(
    () => {
      if (!animated) return;

      // The copy rises into place once, on load. Long soft ease-out, nothing bounces.
      gsap.from("[data-hero-copy] > *", { autoAlpha: 0, y: 28, duration: 1.1, stagger: 0.09, ease: "power3.out", delay: 0.35 });

      // Scroll choreography. The timeline spans 0..1, matching ScrollTrigger progress, so the
      // HTML layer and the three.js choreography (PHASES) read the same clock.
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=140%",
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            heroState.scroll = self.progress;
          },
        },
      });
      tl.to("[data-hero-copy]", { autoAlpha: 0, y: -70, duration: PHASES.toNumber * 0.75 }, 0)
        .fromTo("[data-hero-number]", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.08 }, PHASES.toNumber + 0.18)
        .to("[data-hero-number]", { autoAlpha: 0, y: -14, duration: 0.07 }, PHASES.hold + 0.01)
        .fromTo("[data-hero-petal]", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.08, stagger: 0.03 }, PHASES.toPetals - 0.16)
        .to({}, { duration: 0.001 }, 1); // pads the timeline to exactly 1
    },
    { scope: section, dependencies: [animated], revertOnUpdate: true },
  );

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <section
      ref={section}
      className="relative flex h-[100svh] min-h-[640px] flex-col overflow-hidden bg-ink text-paper"
      style={{ backgroundImage: "var(--gradient-hero)" }}
      data-hero-mode={mode}
    >
      <Header />

      {mode === "still" ? <RiseFallback /> : null}
      {animated ? (
        <div
          aria-hidden
          className="absolute inset-0 z-0 transition-opacity duration-1000 ease-out"
          style={{ opacity: sceneReady ? 1 : 0 }}
        >
          <RiseScene mode={mode} container={section} finalNumber={copy.number.value} onReady={onReady} onAnchors={setAnchors} />
        </div>
      ) : null}

      {/* Copy layer: real HTML, readable before any 3D loads. Left column on wide screens, top on phones. */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start px-5 pt-24 sm:px-8 md:grid-cols-12 md:items-center md:pt-0">
        <div data-hero-copy className="md:col-span-6 lg:col-span-5">
          <p className="placeholder-chip text-paper/60">{copy.eyebrow}</p>
          <h1 className="mt-5 text-[clamp(2.6rem,6.2vw,5.4rem)]">{copy.headline}</h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-paper/75 sm:text-lg">{copy.sub}</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <a href="/book">{copy.primaryCta}</a>
            </Button>
            <Button asChild variant="ghost" size="lg" className="px-2 text-paper">
              <a href="#three-ways">{copy.secondaryCta}</a>
            </Button>
          </div>
        </div>
      </div>

      {animated ? (
        <>
          {/* Caption under the counting number (decorative; the number itself is drawn by the points). */}
          <p
            data-hero-number
            aria-hidden
            className="placeholder-chip pointer-events-none absolute z-10 -translate-x-1/2 text-center text-paper/70 opacity-0"
            style={anchors ? { left: pct(anchors.number.x), top: `calc(${pct(anchors.number.y)} + 2.75rem)` } : { left: "50%", top: "84%" }}
          >
            {copy.number.label}
          </p>
          {/* Labels under the three petals, where the three cards arrive. */}
          {copy.petals.map((name, i) => (
            <p
              key={name}
              data-hero-petal
              aria-hidden
              className="pointer-events-none absolute z-10 -translate-x-1/2 text-center font-display text-sm font-bold tracking-tight text-paper/85 opacity-0 sm:text-base"
              style={
                anchors
                  ? { left: pct(anchors.petals[i].x), top: `calc(${pct(anchors.petals[i].y)} + 2.5rem)` }
                  : { left: `${20 + i * 30}%`, top: "84%" }
              }
            >
              {name}
            </p>
          ))}
        </>
      ) : null}
    </section>
  );
}
