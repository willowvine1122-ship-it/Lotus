import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Lotus", template: "%s · Lotus" },
  description:
    "Agency operating system: CRM, funnels, automations and a daily diagnostic for every client.",
  // In metadata rather than app/favicon.ico so a client site's own favicon replaces it.
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Restore the folded rail before first paint so it never jumps. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("lotus-nav")==="collapsed")document.documentElement.dataset.nav="collapsed"}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
