import { Mail, MessageSquare } from "lucide-react";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Channel identity is a monochrome glyph in the surrounding text colour,
 * never a brand colour: WhatsApp green and Facebook blue would read as
 * signals on paper. The two brand glyphs are drawn to Lucide's grid and
 * stroke so they sit beside the Lucide icons without a seam.
 */

export const channelLabel: Record<Channel, string> = { sms: "SMS", email: "Email", whatsapp: "WhatsApp", facebook: "Facebook" };
export const channels: Channel[] = ["sms", "email", "whatsapp", "facebook"];

type GlyphProps = { className?: string; strokeWidth?: number };

function WhatsAppGlyph({ className, strokeWidth = 1.75 }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.6z" />
      <path d="M9 8.6c.2-.5.6-.6 1-.6l.6 1.5-.7.9a5.6 5.6 0 0 0 2.8 2.8l.9-.7 1.5.6c0 .4-.1.8-.6 1-1.9.9-6.3-3.3-5.5-5.5z" />
    </svg>
  );
}

function FacebookGlyph({ className, strokeWidth = 1.75 }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M15.5 8H14a2 2 0 0 0-2 2v11" />
      <path d="M9.5 13h5.5" />
    </svg>
  );
}

export function ChannelIcon({ channel, className, strokeWidth = 1.75 }: { channel: Channel; className?: string; strokeWidth?: number }) {
  const cls = cn("size-3.5 shrink-0", className);
  if (channel === "email") return <Mail className={cls} strokeWidth={strokeWidth} aria-hidden />;
  if (channel === "whatsapp") return <WhatsAppGlyph className={cls} strokeWidth={strokeWidth} />;
  if (channel === "facebook") return <FacebookGlyph className={cls} strokeWidth={strokeWidth} />;
  return <MessageSquare className={cls} strokeWidth={strokeWidth} aria-hidden />;
}
