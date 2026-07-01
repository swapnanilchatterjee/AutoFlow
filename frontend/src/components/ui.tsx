import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import type {
  ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode,
  SelectHTMLAttributes, TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle, Check, ChevronDown, Info, Loader2, X,
} from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-brand-600 to-indigo-600 text-white hover:from-brand-700 hover:to-indigo-700 shadow-sm border border-brand-700/10 active:shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-800 shadow-sm hover:border-slate-300 active:shadow-sm",
  ghost: "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800",
  danger: "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-sm active:shadow-sm",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3.5 text-[13px] rounded-lg",
  md: "h-10 gap-2 px-4.5 text-sm rounded-lg",
};

export function Button({
  variant = "primary", size = "md", className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:shadow-focus",
        "disabled:pointer-events-none disabled:opacity-50",
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
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors",
        "hover:bg-hairline hover:text-ink focus-visible:outline-none focus-visible:shadow-focus",
        "disabled:pointer-events-none disabled:opacity-50", className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

const FIELD =
  "w-full rounded-lg border border-slate-200/80 bg-white px-3.5 text-sm text-slate-800 transition-all duration-200 " +
  "placeholder:text-slate-400 focus:border-brand-500 focus:ring focus:ring-brand-500/10 focus:outline-none " +
  "disabled:bg-slate-50 disabled:text-slate-400";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(FIELD, "h-9 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink">
      {children}
    </label>
  );
}

export function Help({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs leading-relaxed text-faint">{children}</p>;
}

export function Field({
  label, htmlFor, help, error, children,
}: { label?: string; htmlFor?: string; help?: ReactNode; error?: ReactNode; children: ReactNode }) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
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
    <div className={cn("rounded-xl border border-slate-100 bg-white shadow-premium transition-all duration-200", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title, description, action, className,
}: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-hairline px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title, description, actions, className,
}: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
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
  neutral: "bg-slate-50 text-slate-600 border border-slate-200/60",
  brand: "bg-brand-50/50 text-brand-700 border border-brand-100",
  ok: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  warn: "bg-amber-50 text-amber-700 border border-amber-100",
  danger: "bg-rose-50 text-rose-700 border border-rose-100",
  info: "bg-blue-50 text-blue-700 border border-blue-100",
};

export function Badge({
  children, tone = "neutral", className,
}: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border",
      TONES[tone], className,
    )}>
      {children}
    </span>
  );
}

const STATUS_MAP: Record<string, { tone: Tone; dot: string; pulse?: boolean }> = {
  success: { tone: "ok", dot: "bg-ok" },
  delivered: { tone: "ok", dot: "bg-ok" },
  failed: { tone: "danger", dot: "bg-danger" },
  running: { tone: "info", dot: "bg-info", pulse: true },
  executing: { tone: "info", dot: "bg-info", pulse: true },
  queued: { tone: "warn", dot: "bg-warn" },
  pending: { tone: "neutral", dot: "bg-faint" },
  cancelled: { tone: "neutral", dot: "bg-faint" },
  skipped: { tone: "neutral", dot: "bg-faint" },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
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
    <div className={cn("rounded-xl border border-line bg-surface p-4 shadow-card", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-ink tnum">{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-100 bg-white shadow-premium", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-hairline bg-canvas/60">{children}</thead>;
}
export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-hairline">{children}</tbody>;
}
export function TR({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn(onClick && "cursor-pointer transition-colors hover:bg-canvas/70", className)}
    >
      {children}
    </tr>
  );
}
export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-faint", className)}>
      {children}
    </th>
  );
}
export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-ink", className)}>{children}</td>;
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export interface TabItem { key: string; label: string; icon?: ReactNode; badge?: ReactNode }

export function Tabs({
  tabs, active, onChange, className,
}: { tabs: TabItem[]; active: string; onChange: (key: string) => void; className?: string }) {
  return (
    <div className={cn("flex gap-2 border-b border-slate-100", className)}>
      {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all duration-200",
                on
                  ? "border-brand text-brand-600"
                  : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800",
              )}
            >
              {t.icon}
              {t.label}
              {t.badge}
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
            "absolute z-40 mt-1.5 rounded-xl border border-line bg-surface p-1 shadow-pop animate-pop-in",
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
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        danger ? "text-danger hover:bg-danger-50" : "text-ink hover:bg-hairline",
      )}
    >
      {icon && <span className={danger ? "text-danger" : "text-faint"}>{icon}</span>}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-faint">{children}</div>;
}
export function MenuSeparator() {
  return <div className="my-1 h-px bg-hairline" />;
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
  const w = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn("w-full rounded-2xl border border-line bg-surface shadow-pop animate-pop-in", w)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="px-5 pb-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3.5">
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
  return <div className={cn("animate-pulse rounded-md bg-hairline", className)} />;
}

export function EmptyState({
  icon, title, description, action, className,
}: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center",
      className,
    )}>
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg border border-danger-50 bg-danger-50 px-3 py-2 text-sm text-danger-600">
      <AlertCircle className="h-4 w-4 shrink-0" /> {children}
    </p>
  );
}

const AVATAR_HUES = [
  "bg-brand-100 text-brand-700", "bg-ok-50 text-ok-600",
  "bg-warn-50 text-warn-600", "bg-info-50 text-info-600", "bg-danger-50 text-danger-600",
];
export function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const hue = AVATAR_HUES[(name.charCodeAt(0) || 0) % AVATAR_HUES.length];
  return (
    <span className={cn(
      "inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold", hue, className,
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
  success: <Check className="h-4 w-4 text-ok" />,
  error: <AlertCircle className="h-4 w-4 text-danger" />,
  info: <Info className="h-4 w-4 text-info" />,
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
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-pop animate-toast-in"
          >
            <span className="mt-0.5">{TOAST_ICON[t.tone]}</span>
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-faint transition-colors hover:text-ink"
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
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function fmtRelative(iso: string | null) {
  if (!iso) return "—";
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
