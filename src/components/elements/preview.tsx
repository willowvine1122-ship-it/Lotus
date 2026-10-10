"use client";

import { useMemo } from "react";
import { Checkout } from "@/components/donate/checkout";
import { isOverlay } from "@/lib/elements";
import type { DonationElementConfig, DonationElementType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ElementLive } from "./data";
import { OverlayPlacement } from "./live";
import { ElementView, type DonateIntent } from "./render";
import { SiteBackdrop, TextBars } from "./ui";

/*
 * An element drawn on a stand-in page, the way a visitor would meet it:
 * inline elements in the flow of some text, overlays where they float.
 * Used by the board panel (static) and the builder (interactive).
 */

export function ElementPreview({
  type,
  config,
  live,
  nowIso,
  onDonate,
  interactive = false,
  compact = false,
  phone = false,
  className,
}: {
  type: DonationElementType;
  config: DonationElementConfig;
  live: ElementLive;
  nowIso: string;
  onDonate?: (i: DonateIntent) => void;
  interactive?: boolean;
  compact?: boolean;
  phone?: boolean;
  className?: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const dark = config.theme === "dark" && type !== "message_bar";
  const view = (
    <ElementView
      type={type}
      c={config}
      live={live}
      now={now}
      onDonate={onDonate ?? (() => {})}
      onClose={
        isOverlay(type) && type !== "sticky_button" ? () => {} : undefined
      }
      form={
        type === "donation_form" ? (
          <Checkout
            key={`${config.frequency}`}
            campaign={live.campaign}
            orgName={live.orgName}
            defaultCountry={live.defaultCountry}
            start={{
              frequency:
                config.frequency === "campaign" ? undefined : config.frequency,
            }}
          />
        ) : undefined
      }
    />
  );

  const overlay = isOverlay(type);
  return (
    <SiteBackdrop
      dark={dark}
      className={cn(phone && "mx-auto w-[375px] max-w-full", className)}
    >
      <div
        inert={!interactive}
        className={cn(
          "relative",
          compact ? "min-h-[260px]" : "min-h-[420px]",
          overlay &&
            type !== "message_bar" &&
            (compact ? "min-h-[300px]" : "min-h-[520px]"),
        )}
      >
        {overlay ? (
          <>
            <div
              className={cn(
                "flex flex-col gap-6",
                compact ? "p-4" : "p-6 md:p-8",
                type === "message_bar" &&
                  config.position !== "bottom" &&
                  (compact ? "pt-16" : "pt-20"),
              )}
            >
              <TextBars dark={dark} lines={3} />
              <TextBars dark={dark} lines={4} />
              {!compact && <TextBars dark={dark} lines={2} />}
            </div>
            <OverlayPlacement type={type} position={config.position} contained>
              <div
                className={cn(
                  type === "popup" && compact && "origin-center scale-[0.72]",
                )}
              >
                {view}
              </div>
            </OverlayPlacement>
          </>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-5",
              compact ? "p-4" : "p-6 md:p-8",
            )}
          >
            <TextBars dark={dark} lines={compact ? 2 : 3} />
            <div
              className={cn(
                type === "donation_form" &&
                  compact &&
                  "relative max-h-[340px] overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-[#fbfaf8]",
                type === "donation_form" &&
                  compact &&
                  dark &&
                  "after:from-[#0f1115]",
              )}
            >
              {view}
            </div>
            {!compact && <TextBars dark={dark} lines={2} />}
          </div>
        )}
      </div>
    </SiteBackdrop>
  );
}
