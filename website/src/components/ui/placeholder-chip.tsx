import { COPY_IS_PLACEHOLDER } from "@/content/placeholders";

/* Shown while content/placeholders.ts is in use, so nobody mistakes scaffolding copy for final copy. */
export function PlaceholderChip() {
  if (!COPY_IS_PLACEHOLDER) return null;
  return (
    <div
      className="placeholder-chip pointer-events-none fixed bottom-4 left-4 z-50 rounded-pill border border-ink/15 bg-paper/90 px-3 py-1.5 text-ink/80 shadow-sm backdrop-blur"
      role="note"
    >
      <span className="sm:hidden">Placeholder copy</span>
      <span className="hidden sm:inline">Placeholder copy · the copy thread writes the words</span>
    </div>
  );
}
