import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { placeholders } from "@/content/placeholders";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink text-paper">
      <Header />
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="numeral text-[clamp(6rem,20vw,14rem)] text-paper/15">404</p>
        <h1 className="mt-4 max-w-xl text-3xl sm:text-4xl">{placeholders.notFound.heading}</h1>
        <Button asChild variant="paper" className="mt-8">
          <Link href="/">{placeholders.notFound.link}</Link>
        </Button>
      </main>
    </div>
  );
}
