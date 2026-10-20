"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { placeholders } from "@/content/placeholders";

/**
 * "Three ways to grow": the hero's three petals land on these three cards. Each card is a room in
 * its own section colors (data-section switches the tokens), while type and spacing stay the same.
 */
export function ThreeWays() {
  const root = useRef<HTMLElement>(null);
  const { heading, cards } = placeholders.threeWays;

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-card]", {
          autoAlpha: 0,
          y: 48,
          duration: 1,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 78%", toggleActions: "play none none none" },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="three-ways" className="relative bg-paper py-24 text-ink sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <h2 className="max-w-2xl text-[clamp(2rem,4.4vw,3.6rem)]">{heading}</h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.id}
              id={card.id}
              data-card
              data-section={card.section}
              className="flex min-h-80 flex-col justify-between rounded-card bg-tint-mist p-8"
            >
              <div>
                <span className="block h-1.5 w-12 rounded-pill bg-primary" aria-hidden />
                <h3 className="mt-6 font-accent text-2xl font-bold tracking-tight text-primary">{card.name}</h3>
                <p className="mt-4 text-base leading-relaxed text-ink/75">{card.line}</p>
              </div>
              <Button asChild className="mt-8 self-start">
                <a href={`/${card.section}`}>Placeholder button</a>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
