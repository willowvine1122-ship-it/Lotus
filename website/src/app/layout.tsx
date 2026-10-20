import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { PlaceholderChip } from "@/components/ui/placeholder-chip";
import { placeholders } from "@/content/placeholders";

/* Brand type: Manrope (headings), Inter (body); section accents Fraunces (Fundraising) and JetBrains Mono (Builds). Self-hosted by next/font. */
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-manrope", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces", display: "swap", preload: false });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://thelotusdigital.com"),
  title: { default: `${placeholders.site.name}: ${placeholders.site.tagline}`, template: `%s · ${placeholders.site.name}` },
  description: placeholders.site.description,
  openGraph: { siteName: placeholders.site.name, type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0f2a2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${fraunces.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-pill focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <SmoothScroll>{children}</SmoothScroll>
        <PlaceholderChip />
      </body>
    </html>
  );
}
