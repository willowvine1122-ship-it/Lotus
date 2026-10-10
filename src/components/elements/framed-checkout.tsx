"use client";

import { useRouter } from "next/navigation";
import type { ElementLive } from "./data";
import { CheckoutModal } from "./live";
import type { DonateIntent } from "./render";

/* The checkout inside the install script's full-window frame; closing it tells the host page. */
export function FramedCheckout({
  live,
  accent,
  start,
}: {
  live: ElementLive;
  accent: string;
  start: DonateIntent & { elementId?: string };
}) {
  const router = useRouter();
  const close = () => {
    if (window.parent !== window)
      window.parent.postMessage({ lotus: true, kind: "close-checkout" }, "*");
    else router.push(`/donate/${live.campaign.slug}`);
  };
  return (
    <CheckoutModal
      live={live}
      accent={accent}
      start={start}
      onClose={close}
      framed
    />
  );
}
