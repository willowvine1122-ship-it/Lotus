"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/page-header";

/** Two submits for one form: send it now, or keep it as a draft. Posts `intent`. */
export function IntentButtons({ primary, secondary }: { primary: string; secondary: string }) {
  const { pending, data } = useFormStatus();
  const which = data?.get("intent");
  return (
    <>
      <Button type="submit" name="intent" value="send" disabled={pending}>
        {pending && which === "send" && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
        {primary}
      </Button>
      <Button type="submit" name="intent" value="draft" disabled={pending} className="border-line-strong bg-surface text-fg shadow-none hover:bg-surface-2" variant="secondary">
        {pending && which === "draft" && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
        {secondary}
      </Button>
    </>
  );
}
