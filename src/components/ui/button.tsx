"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 min-h-11 px-5",
  {
    variants: {
      variant: {
        gold: "bg-gold text-navy hover:bg-gold-2 hover:text-cream",
        navy: "bg-navy text-cream hover:bg-navy-2",
        ghost: "bg-transparent text-navy border border-line hover:bg-cream",
        ghostDark:
          "bg-transparent text-cream border border-navy-2 hover:bg-navy-2",
        danger: "bg-danger-soft text-danger hover:bg-danger hover:text-cream",
      },
      size: {
        default: "min-h-11 px-5",
        sm: "min-h-10 px-4 text-xs",
        block: "min-h-12 w-full px-5",
      },
    },
    defaultVariants: { variant: "gold", size: "default" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: Props) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
