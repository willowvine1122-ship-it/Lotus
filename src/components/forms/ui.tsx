import {
  AlignLeft,
  AtSign,
  Calendar,
  CheckSquare,
  ChevronDownSquare,
  CircleDot,
  FileUp,
  Gauge,
  Hash,
  Megaphone,
  Phone,
  Star,
  ToggleLeft,
  Type,
} from "lucide-react";
import type { FormQuestionType, FormStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Small pieces shared by the forms screens. */

export const questionIcon: Record<
  FormQuestionType,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  short_text: Type,
  long_text: AlignLeft,
  email: AtSign,
  phone: Phone,
  number: Hash,
  multiple_choice: CircleDot,
  checkboxes: CheckSquare,
  dropdown: ChevronDownSquare,
  yes_no: ToggleLeft,
  rating: Star,
  opinion_scale: Gauge,
  date: Calendar,
  file_upload: FileUp,
  statement: Megaphone,
};

/** Live is the normal state: neutral with a small green dot. Draft is the dashed outline; Closed is muted. */
export function FormStatusTag({ status }: { status: FormStatus }) {
  if (status === "draft")
    return (
      <span className="inline-flex h-5 items-center rounded-[4px] border border-dashed border-line-strong px-1.5 text-2xs font-medium whitespace-nowrap text-fg-3">
        Draft
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-[4px] bg-surface-2 px-1.5 text-2xs font-medium whitespace-nowrap",
        status === "live" ? "text-fg-2" : "text-fg-3",
      )}
    >
      {status === "live" && (
        <span className="size-1.5 rounded-full bg-green" aria-hidden />
      )}
      {status === "live" ? "Live" : "Closed"}
    </span>
  );
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) return "–";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

export const smallButton =
  "inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-surface px-2.5 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50";
export const inkButton =
  "inline-flex h-7 items-center gap-1.5 rounded border border-rail bg-rail px-2.5 text-xs font-medium text-rail-fg transition-colors duration-150 hover:bg-rail-2 disabled:pointer-events-none disabled:opacity-60";
