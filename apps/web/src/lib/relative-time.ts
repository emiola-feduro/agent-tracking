const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "hace 3 horas", "ayer". */
export const relativeTime = (iso: string | null | undefined, now = Date.now()) => {
  if (!iso) return "";
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "hace un momento";
};

/** "2 min 05 s" between two timestamps. */
export const duration = (start: string | null, end: string | null) => {
  if (!start || !end) return "";
  const total = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes} min ${String(seconds).padStart(2, "0")} s` : `${seconds} s`;
};

export const absoluteTime = (iso: string) =>
  new Date(iso).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" });
