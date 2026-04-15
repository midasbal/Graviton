import { Loader2 } from "lucide-react";
import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES = {
  primary:
    "bg-accent text-white hover:bg-accent-light shadow-lg shadow-accent/25 hover:shadow-accent/40",
  secondary:
    "bg-card text-foreground border border-border hover:bg-card-hover hover:border-accent/30",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-card/60 hover:border-accent/30",
  ghost:
    "bg-transparent text-muted hover:text-foreground hover:bg-card/60",
  danger:
    "bg-error/10 text-error border border-error/20 hover:bg-error/20 hover:border-error/40",
};

const SIZE_CLASSES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-2xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
