import { useEffect, useState } from "react";
import Segmented from "@/components/ui/segmented/segmented";
import TextField from "@/components/ui/text-field/text-field";
import { FONT_CATEGORIES, FONTS, loadFontPreviews } from "@/lib/appearance/fonts";
import useAppearanceStore from "@/stores/use-appearance-store";

type Target = "ui" | "code";

const SAMPLE: Record<Target, string> = { ui: "Registrar gastos, 3 de 5 criterios", code: "createApp(db) => app.post(\"/expenses\")" };

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const AppearanceFontList = () => {
  const uiFontId = useAppearanceStore((s) => s.uiFontId);
  const codeFontId = useAppearanceStore((s) => s.codeFontId);
  const setUiFont = useAppearanceStore((s) => s.setUiFont);
  const setCodeFont = useAppearanceStore((s) => s.setCodeFont);
  const [target, setTarget] = useState<Target>("ui");
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const visible = FONTS.filter((f) => !q || normalize(`${f.name} ${f.category}`).includes(q));
  const current = target === "ui" ? uiFontId : codeFontId;
  const choose = target === "ui" ? setUiFont : setCodeFont;

  // One request previews the whole list; fonts load from Google Fonts, the default ones ship with the app.
  useEffect(() => loadFontPreviews(FONTS), []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Aplicar a</span>
          <Segmented
            label="Aplicar la fuente a"
            value={target}
            onChange={setTarget}
            items={[
              { value: "ui", label: "Interfaz" },
              { value: "code", label: "Código y rutas" },
            ]}
          />
        </div>
        <TextField label="Buscar fuente" type="search" value={query} onChange={setQuery} placeholder="Inter, serif, mono..." className="sm:w-64" />
      </div>
      {visible.length === 0 && <p className="text-muted">Ninguna fuente coincide con “{query.trim()}”.</p>}
      {FONT_CATEGORIES.filter((category) => visible.some((f) => f.category === category)).map((category) => (
        <section key={category} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">{category}</h3>
          <div role="radiogroup" aria-label={category} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visible
              .filter((f) => f.category === category)
              .map((font) => (
                <button
                  key={font.id}
                  type="button"
                  role="radio"
                  aria-checked={font.id === current}
                  onClick={() => choose(font.id)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors duration-150 ${font.id === current ? "border-brand bg-brand-soft" : "border-line hover:bg-subtle"}`}
                >
                  <span className="block text-xs text-muted">{font.name}</span>
                  <span className="block truncate text-base text-ink" style={{ fontFamily: font.stack }}>
                    {SAMPLE[target]}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default AppearanceFontList;
