"use client";

import { useAppStore } from "@/store/useAppStore";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const COLOR_MAP = {
  success: "border-success/30 bg-success/10 text-success",
  error: "border-error/30 bg-error/10 text-error",
  info: "border-accent/30 bg-accent/10 text-accent-light",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-xl backdrop-blur-xl ${COLOR_MAP[toast.type]}`}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded p-0.5 hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
