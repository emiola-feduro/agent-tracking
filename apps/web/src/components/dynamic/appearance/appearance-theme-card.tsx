import type { Theme } from "@/lib/appearance/themes";

type AppearanceThemeCardProps = { theme: Theme; active: boolean; onSelect: () => void };

/** A miniature of a project page drawn with the theme's own colors, whatever theme is active. */
const AppearanceThemeCard = ({ theme, active, onSelect }: AppearanceThemeCardProps) => {
  const { name, colors: c, radius, borderWidth, shadow } = theme;
  const box = { background: c.surface, border: `${borderWidth} solid ${c.border}`, borderRadius: radius, boxShadow: shadow };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`overflow-hidden rounded-md border-2 text-left transition-colors duration-150 ${active ? "border-brand" : "border-line hover:border-muted"}`}
    >
      <span aria-hidden className="flex h-24 flex-col gap-1.5 p-2.5" style={{ background: c.bg }}>
        <span className="flex flex-col gap-1.5 p-2" style={box}>
          <span className="h-1.5 w-14 rounded-full" style={{ background: c.fg, opacity: 0.8 }} />
          <span className="flex h-1.5 overflow-hidden rounded-full" style={{ background: c.surface2 }}>
            <span className="w-3/5" style={{ background: c.accent }} />
          </span>
          <span className="flex gap-1">
            <span className="h-2.5 w-7 rounded-full" style={{ background: c.accentSoft, border: `1px solid ${c.accent}` }} />
            <span className="h-2.5 w-5 rounded-full" style={{ background: c.success, opacity: 0.85 }} />
            <span className="h-2.5 w-4 rounded-full" style={{ background: c.warningSoft, border: `1px solid ${c.warning}` }} />
          </span>
        </span>
        <span className="flex gap-1.5">
          <span className="h-3 w-10" style={{ background: c.accent, borderRadius: radius }} />
          <span className="h-3 w-8" style={{ ...box, boxShadow: "none" }} />
        </span>
      </span>
      <span className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm font-medium" style={{ background: c.surface, color: c.fg }}>
        {name}
        {active && (
          <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        )}
      </span>
    </button>
  );
};

export default AppearanceThemeCard;
