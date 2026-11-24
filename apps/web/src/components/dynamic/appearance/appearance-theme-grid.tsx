import { THEMES } from "@/lib/appearance/themes";
import useAppearanceStore from "@/stores/use-appearance-store";
import AppearanceThemeCard from "./appearance-theme-card";

const GROUPS = [
  { label: "Claros", dark: false },
  { label: "Oscuros", dark: true },
];

const AppearanceThemeGrid = () => {
  const themeId = useAppearanceStore((s) => s.themeId);
  const setTheme = useAppearanceStore((s) => s.setTheme);

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map(({ label, dark }) => (
        <section key={label} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">{label}</h3>
          <div role="radiogroup" aria-label={`Temas ${label.toLowerCase()}`} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {THEMES.filter((t) => t.dark === dark).map((theme) => (
              <AppearanceThemeCard key={theme.id} theme={theme} active={theme.id === themeId} onSelect={() => setTheme(theme.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default AppearanceThemeGrid;
