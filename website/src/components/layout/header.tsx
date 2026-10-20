import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { placeholders } from "@/content/placeholders";

/**
 * Site header. Transparent over the dark home hero, so it uses the reverse logo.
 * Logo file is the supplied PNG brand mark; swap for the SVG set at public/brand/ when it lands.
 */
export function Header({ tone = "reverse" }: { tone?: "reverse" | "colour" }) {
  const onDark = tone === "reverse";
  return (
    <header className={`absolute inset-x-0 top-0 z-30 ${onDark ? "text-paper" : "text-ink"}`}>
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center" aria-label="Lotus, home">
          <Image
            src={onDark ? "/brand/lotus-logo-reverse.png" : "/brand/lotus-logo-colour.png"}
            alt="Lotus"
            width={500}
            height={146}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {placeholders.nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="font-display text-[15px] font-bold tracking-tight opacity-85 transition-opacity duration-(--dur-fast) hover:opacity-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Button asChild size="sm" variant={onDark ? "paper" : "primary"}>
          <a href="/book">{placeholders.header.cta}</a>
        </Button>
      </div>
    </header>
  );
}
