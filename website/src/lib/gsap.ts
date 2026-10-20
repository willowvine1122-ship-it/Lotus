"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

/* Register once, client-only. Import gsap from here everywhere so plugins are always registered. */
gsap.registerPlugin(ScrollTrigger, useGSAP);

/* Project defaults: "calm rise". Things rise into place; nothing bounces or pops. */
gsap.defaults({ ease: "power3.out", duration: 0.8 });

export { gsap, ScrollTrigger, useGSAP };
