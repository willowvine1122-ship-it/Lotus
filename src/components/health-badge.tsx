import { cn } from "@/lib/utils";
import type { Health } from "@/lib/types";

const styles: Record<Health, string> = {
  green: "bg-green-soft text-green",
  amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red",
};

const labels: Record<Health, string> = {
  green: "Healthy",
  amber: "Watch",
  red: "Needs action",
};

export function HealthBadge({ health }: { health: Health }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[health],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {labels[health]}
    </span>
  );
}
