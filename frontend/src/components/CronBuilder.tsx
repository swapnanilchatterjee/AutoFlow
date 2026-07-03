import { useState, useEffect, useRef } from "react";
import Cron from "croner";
import { cn, Input } from "./ui";
import { AlertCircle, CalendarDays } from "lucide-react";

interface CronBuilderProps {
  value: string;
  onChange: (cron: string) => void;
  className?: string;
}

const PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 9am", value: "0 9 * * *" },
  { label: "Weekdays at 9am", value: "0 9 * * 1-5" },
  { label: "Weekly (Sunday midnight)", value: "0 0 * * 0" },
  { label: "Monthly (1st at midnight)", value: "0 0 1 * *" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(d: Date): string {
  const day = DAYS[d.getDay()];
  const month = MONTHS[d.getMonth()];
  const date = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day}, ${month} ${date} at ${hours}:${mins}`;
}

export default function CronBuilder({ value, onChange, className }: CronBuilderProps) {
  const [input, setInput] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [nextRuns, setNextRuns] = useState<Date[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    if (!input?.trim()) {
      setError(null);
      setNextRuns([]);
      return;
    }
    try {
      const cronInstance = new Cron(input.trim());
      const runs = cronInstance.next(3);
      setNextRuns(Array.isArray(runs) ? runs : runs ? [runs] : []);
      setError(null);
    } catch {
      setError("Invalid cron expression. Use standard 5-field format.");
      setNextRuns([]);
    }
  }, [input]);

  function handlePresetClick(preset: string) {
    setInput(preset);
    onChange(preset);
  }

  function handleInputChange(val: string) {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(val);
    }, 600);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 text-left",
              value === preset.value
                ? "border-brand-200 bg-brand-50/80 text-brand-600 shadow-sm shadow-brand/5"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Input
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="Custom cron expression (e.g. 0 9 * * 1-5)"
        className="font-mono text-[13px]"
      />

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {nextRuns.length > 0 && !error && (
        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5 dark:text-slate-400">
            <CalendarDays className="h-3 w-3" /> Next 3 runs
          </p>
          <div className="space-y-1">
            {nextRuns.map((run, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                <span className="w-4 text-slate-300 dark:text-slate-500 font-bold">{idx + 1}.</span>
                <span>{formatDate(run)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
