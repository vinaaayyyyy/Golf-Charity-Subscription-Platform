import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonStyles = cva(
  "inline-flex items-center justify-center rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white shadow-[0_16px_30px_rgba(235,125,79,0.28)] hover:-translate-y-0.5 hover:bg-primary-strong hover:shadow-[0_22px_44px_rgba(235,125,79,0.34)] active:translate-y-0",
        secondary:
          "border border-line-strong bg-white/80 text-foreground hover:-translate-y-0.5 hover:border-secondary hover:bg-secondary-soft/60 hover:shadow-[0_16px_28px_rgba(32,94,93,0.14)] active:translate-y-0",
        ghost: "text-foreground hover:-translate-y-0.5 hover:bg-white/70 active:translate-y-0",
        dark: "bg-foreground text-background hover:-translate-y-0.5 hover:bg-black/80 hover:shadow-[0_18px_36px_rgba(30,29,24,0.18)] active:translate-y-0",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-12 px-5 text-sm sm:text-base",
        lg: "h-14 px-6 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>;

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}
