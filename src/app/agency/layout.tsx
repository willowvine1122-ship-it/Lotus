import type { Metadata } from "next";

// Lets the team add Lotus to a phone or desktop home screen as its own app.
export const metadata: Metadata = { manifest: "/manifest.webmanifest" };

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
