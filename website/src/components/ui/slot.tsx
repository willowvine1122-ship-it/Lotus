import * as React from "react";
import { cn } from "@/lib/utils";

/* Minimal Slot (merges props onto the single child), so Button can render as <a> without a Radix dependency. */
export function Slot({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (!React.isValidElement(children)) return null;
  const child = children as React.ReactElement<Record<string, unknown>>;
  const childClassName = child.props.className as string | undefined;
  return React.cloneElement(child, { ...props, ...child.props, className: cn(className, childClassName) });
}
