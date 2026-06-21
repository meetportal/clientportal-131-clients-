import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const toastConfig: Record<
  ToastType,
  {
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    titleColor: string;
    accent: string;
  }
> = {
  success: {
    icon: <CheckCircle2 size={16} strokeWidth={2.5} />,
    iconBg: "#dcfce7",
    iconColor: "#16a34a",
    titleColor: "#15803d",
    accent: "#16a34a",
  },
  error: {
    icon: <XCircle size={16} strokeWidth={2.5} />,
    iconBg: "#fee2e2",
    iconColor: "#dc2626",
    titleColor: "#b91c1c",
    accent: "#dc2626",
  },
  info: {
    icon: <Info size={16} strokeWidth={2.5} />,
    iconBg: "#eef2ff",
    iconColor: "#4355e8",
    titleColor: "#3730a3",
    accent: "#4355e8",
  },
  warning: {
    icon: <AlertTriangle size={16} strokeWidth={2.5} />,
    iconBg: "#fef3c7",
    iconColor: "#d97706",
    titleColor: "#b45309",
    accent: "#d97706",
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const cfg = toastConfig[toast.type];

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 10);
    const exitTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 320);
    }, 4200);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`toast ${visible ? "toast--enter" : "toast--exit"}`}
      style={{
        borderLeft: `3.5px solid ${cfg.accent}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.96)",
      }}
    >
      <div
        className="toast-icon-wrap"
        style={{ background: cfg.iconBg, color: cfg.iconColor }}
      >
        {cfg.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13.5px", fontWeight: 700, color: cfg.titleColor, lineHeight: 1.3 }}>
          {toast.title}
        </p>
        {toast.description && (
          <p style={{ fontSize: "12px", color: "#78716c", marginTop: "3px", lineHeight: 1.45 }}>
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 320);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#a8a29e",
          display: "flex",
          alignItems: "center",
          padding: "2px",
          borderRadius: "4px",
          flexShrink: 0,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#57534e")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#a8a29e")}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = (type: ToastType, title: string, description?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, dismiss, toast };
}
