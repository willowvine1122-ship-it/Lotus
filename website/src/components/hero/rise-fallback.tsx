/**
 * The still hero: a pre-rendered frame of the scene (npm run hero:still) over the Rise gradient.
 * Used for reduced motion, no WebGL, data saver and very low-power devices. The copy stays HTML on top.
 * Two crops: landscape for wide screens, portrait for phones (the mark sits lower, under the copy).
 */
export function RiseFallback() {
  return (
    <div aria-hidden className="absolute inset-0 z-0">
      <picture>
        <source media="(orientation: portrait)" srcSet="/hero/rise-still-portrait.webp" />
        {/* Plain <img>: next/image has no <picture> sources, and images are unoptimized in this static export anyway. */}
        <img
          src="/hero/rise-still.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[50%_55%] portrait:object-[50%_50%]"
        />
      </picture>
    </div>
  );
}
