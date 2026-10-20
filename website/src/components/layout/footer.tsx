import Image from "next/image";
import { placeholders } from "@/content/placeholders";

export function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Image src="/brand/lotus-logo-reverse.png" alt="Lotus" width={500} height={146} className="h-9 w-auto" />
          <p className="mt-5 max-w-sm text-sm text-paper/60">{placeholders.footer.note}</p>
        </div>
        <p className="text-sm text-paper/60">© 2026 Lotus. {placeholders.site.tagline}</p>
      </div>
    </footer>
  );
}
