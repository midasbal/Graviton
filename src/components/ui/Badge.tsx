import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "error";
  className?: string;
}

const VARIANT_MAP = {
  default: "border-border/60 bg-card/60 text-muted",
  accent: "border-accent/30 bg-accent/10 text-accent-light",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-error/30 bg-error/10 text-error",
};

export default function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${VARIANT_MAP[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
