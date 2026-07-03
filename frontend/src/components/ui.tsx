import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import type {
  ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode,
  SelectHTMLAttributes, TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle, Check, ChevronDown, Info, Loader2, X, Moon, Sun,
} from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-600 active:bg-brand-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 " +
    "dark:bg-brand-500 dark:hover:bg-brand-400 dark:active:bg-brand-600 dark:text-white",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 " +
    "dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white dark:active:bg-slate-600",
  outline:
    "border-2 border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/30 active:bg-brand-50/50 " +
    "dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-300 dark:hover:bg-brand-500/5 dark:active:bg-brand-500/10",
  ghost:
    "text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 " +
    "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-700",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 " +
    "dark:bg-red-500 dark:hover:bg-red-400 dark:active:bg-red-600",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] font-semibold rounded-lg",
  md: "h-10 gap-2 px-4 text-sm font-semibold rounded-xl",
  lg: "h-12 gap-2.5 px-5 text-sm font-semibold rounded-xl",
};

export function Button({
  variant = "primary", size = "md", className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
        "disabled:pointer-events-none disabled:opacity-50 disabled:transform-none",
        SIZES[size], VARIANTS[variant], className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors",
        "hover:bg-slate-100 hover:text-slate-700",
        "dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        "disabled:pointer-events-none disabled:opacity-50", className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Theme Toggle                                                               */
/* -------------------------------------------------------------------------- */

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
        "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
        "dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        className,
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition-all duration-150 " +
  "placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none " +
  "disabled:bg-slate-50 disabled:text-slate-400 " +
  "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 " +
  "dark:focus:border-brand-400 dark:focus:ring-brand/20 dark:disabled:bg-slate-900 dark:disabled:text-slate-600";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          FIELD, "h-10 appearance-none pr-10 cursor-pointer",
          "dark:bg-slate-800",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
    </div>
  );
}

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300", className)}>
      {children}
    </label>
  );
}

export function Help({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">{children}</p>;
}

export function Field({
  label, htmlFor, help, error, children, labelClassName,
}: { label?: string; htmlFor?: string; help?: ReactNode; error?: ReactNode; children: ReactNode; labelClassName?: string }) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor} className={labelClassName}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      ) : (
        <Help>{help}</Help>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({ className, children, ...props }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white shadow-premium transition-all duration-200",
        "hover:shadow-premium-hover",
        "dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title, description, action, className,
}: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b px-6 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title, description, actions, className,
}: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges + status                                                            */
/* -------------------------------------------------------------------------- */

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
};

export function Badge({
  children, tone = "neutral", className,
}: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold tracking-wide",
      TONES[tone], className,
    )}>
      {children}
    </span>
  );
}

const STATUS_MAP: Record<string, { tone: Tone; dot: string; pulse?: boolean }> = {
  success: { tone: "ok", dot: "bg-emerald-500" },
  delivered: { tone: "ok", dot: "bg-emerald-500" },
  failed: { tone: "danger", dot: "bg-red-500" },
  running: { tone: "info", dot: "bg-blue-500", pulse: true },
  executing: { tone: "info", dot: "bg-blue-500", pulse: true },
  queued: { tone: "warn", dot: "bg-amber-500" },
  pending: { tone: "neutral", dot: "bg-slate-400 dark:bg-slate-500" },
  cancelled: { tone: "neutral", dot: "bg-slate-400 dark:bg-slate-500" },
  skipped: { tone: "neutral", dot: "bg-slate-400 dark:bg-slate-500" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
      TONES[s.tone], className,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot, s.pulse && "animate-rail-pulse")} />
      {status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat card                                                                  */
/* -------------------------------------------------------------------------- */

export function StatCard({
  label, value, icon, hint, className,
}: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "group rounded-2xl border bg-white p-5 shadow-premium transition-all duration-200 hover:shadow-premium-hover hover:-translate-y-0.5",
      "dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700",
      className,
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        {icon && <span className="text-slate-400 dark:text-slate-500 group-hover:scale-110 transition-transform duration-200">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white tnum">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 shadow-premium", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b bg-slate-50/80 dark:bg-slate-800/30 dark:border-slate-800">{children}</thead>;
}
export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800">{children}</tbody>;
}
export function TR({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        onClick && "cursor-pointer transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/30",
        className,
      )}
    >
      {children}
    </tr>
  );
}
export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500", className)}>
      {children}
    </th>
  );
}
export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3.5 text-slate-700 dark:text-slate-300", className)}>{children}</td>;
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export interface TabItem { key: string; label: string; icon?: ReactNode; badge?: ReactNode }

export function Tabs({
  tabs, active, onChange, className,
}: { tabs: TabItem[]; active: string; onChange: (key: string) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 border-b bg-white px-1 dark:bg-slate-900 dark:border-slate-800 rounded-t-2xl", className)}>
      {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 relative",
                on
                  ? "text-brand dark:text-brand-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              {t.icon}
              {t.label}
              {t.badge}
              {on && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full dark:bg-brand-400" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

/* -------------------------------------------------------------------------- */
/* Dropdown menu                                                              */
/* -------------------------------------------------------------------------- */

export function Menu({
  trigger, children, align = "right", width = "w-48",
}: { trigger: ReactNode; children: ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute z-40 mt-1.5 rounded-2xl border bg-white p-1.5 shadow-pop animate-pop-in",
            "dark:bg-slate-900 dark:border-slate-800 dark:shadow-dark-pop",
            width, align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children, onClick, icon, danger,
}: { children: ReactNode; onClick?: () => void; icon?: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors",
        danger ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      )}
    >
      {icon && <span className={danger ? "text-red-500" : "text-slate-400 dark:text-slate-500"}>{icon}</span>}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">{children}</div>;
}
export function MenuSeparator() {
  return <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />;
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open, onClose, title, description, children, footer, size = "md",
}: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  const w = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-md p-2 sm:p-4 pt-[5vh] sm:pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-2xl border bg-white shadow-pop-lg animate-pop-in overflow-hidden",
          "dark:bg-slate-900 dark:border-slate-800 dark:shadow-dark-pop",
          "sm:" + w,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(
          "flex items-start justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5",
          "border-b",
        )}>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <IconButton onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-slate-600 dark:text-slate-300 max-h-[85vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t bg-slate-50/80 px-4 sm:px-6 py-3 sm:py-4 dark:bg-slate-800/30 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback: spinner, skeleton, empty, error, avatar                          */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-brand", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800",
        className,
      )}
    />
  );
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-shimmer",
        "dark:from-slate-800 dark:via-slate-700 dark:to-slate-800",
        className,
      )}
    />
  );
}

export function EmptyState({
  icon, title, description, action, className,
}: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200",
      "border-slate-200 bg-slate-50/50 hover:border-slate-300",
      "dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700",
      className,
    )}>
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand dark:bg-brand-500/10 dark:text-brand-300 shadow-sm">
          {icon}
        </div>
      )}
      <p className="text-base font-bold text-slate-900 dark:text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
      <AlertCircle className="h-4 w-4 shrink-0" /> {children}
    </p>
  );
}

const AVATAR_HUES = [
  "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
];
export function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const hue = AVATAR_HUES[(name.charCodeAt(0) || 0) % AVATAR_HUES.length];
  return (
    <span className={cn(
      "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", hue, className,
    )}>
      {letter}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */

type ToastTone = "success" | "error" | "info";
interface Toast { id: number; tone: ToastTone; message: string }

const ToastCtx = createContext<{
  success: (m: string) => void; error: (m: string) => void; info: (m: string) => void;
}>({ success: () => {}, error: () => {}, info: () => {} });

const TOAST_ICON: Record<ToastTone, ReactNode> = {
  success: <Check className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const value = {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
  };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-pop animate-toast-in",
              "bg-white dark:bg-slate-900 dark:border-slate-800 dark:shadow-dark-pop",
            )}
          >
            <span className="mt-0.5">{TOAST_ICON[t.tone]}</span>
            <p className="flex-1 text-sm text-slate-800 dark:text-slate-200">{t.message}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* -------------------------------------------------------------------------- */
/* Formatters                                                                  */
/* -------------------------------------------------------------------------- */

export function fmtDate(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function fmtRelative(iso: string | null) {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="/logo.png" alt="Report Scheduler" className={cn("object-contain", className)} />;
}
