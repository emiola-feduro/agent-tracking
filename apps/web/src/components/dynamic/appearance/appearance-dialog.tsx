import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/button/button";
import Segmented from "@/components/ui/segmented/segmented";
import useAppearanceStore, { type TextSize } from "@/stores/use-appearance-store";
import AppearanceFontList from "./appearance-font-list";
import AppearanceThemeGrid from "./appearance-theme-grid";

type Section = "themes" | "fonts";

type AppearanceDialogProps = { open: boolean; onClose: () => void };

/** Theme, fonts and text size, the same choices ER Studio offers. Changes apply at once. */
const AppearanceDialog = ({ open, onClose }: AppearanceDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<Section>("themes");
  const textSize = useAppearanceStore((s) => s.textSize);
  const setTextSize = useAppearanceStore((s) => s.setTextSize);
  const reset = useAppearanceStore((s) => s.reset);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="appearance-title"
      className="m-auto max-h-[min(90dvh,860px)] w-[min(calc(100vw-2rem),960px)] overflow-hidden rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex max-h-[min(90dvh,860px)] flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id="appearance-title" className="text-lg font-semibold">
            Apariencia
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </header>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-3">
          <Segmented
            label="Sección de apariencia"
            value={section}
            onChange={setSection}
            items={[
              { value: "themes", label: "Temas" },
              { value: "fonts", label: "Fuentes" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted">Tamaño del texto</span>
            <Segmented<TextSize>
              label="Tamaño del texto"
              value={textSize}
              onChange={setTextSize}
              items={[
                { value: "sm", label: "Pequeño" },
                { value: "md", label: "Normal" },
                { value: "lg", label: "Grande" },
              ]}
            />
            <Button variant="ghost" size="sm" onClick={reset}>
              Restablecer
            </Button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{section === "themes" ? <AppearanceThemeGrid /> : <AppearanceFontList />}</div>
      </div>
    </dialog>
  );
};

export default AppearanceDialog;
