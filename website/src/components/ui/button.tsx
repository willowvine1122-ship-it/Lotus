import { Slot } from "./slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/* shadcn-style button, restyled to the Lotus tokens: pill shape, display font, "calm rise" hover. */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill",
    "font-display font-bold tracking-tight select-none",
    "transition-[transform,background-color,color,box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)",
    "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-action text-on-action shadow-[0_10px_30px_-14px_var(--action)] hover:shadow-[0_16px_34px_-14px_var(--action)]",
        outline: "border border-current/25 bg-transparent text-current hover:border-current/50 hover:bg-white/5",
        ghost: "bg-transparent text-current underline-offset-[6px] hover:underline",
        paper: "bg-paper text-ink hover:bg-white",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-6 text-base",
        lg: "h-14 px-8 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
