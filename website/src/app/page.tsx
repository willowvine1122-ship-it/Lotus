import { Footer } from "@/components/layout/footer";
import { RiseHero } from "@/components/hero/rise-hero";
import { ThreeWays } from "@/components/sections/three-ways";

export default function Home() {
  return (
    <>
      <main id="main" className="flex-1">
        <RiseHero />
        <ThreeWays />
      </main>
      <Footer />
    </>
  );
}
