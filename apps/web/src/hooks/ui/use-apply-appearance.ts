import { useEffect } from "react";
import { getFont, loadFont } from "@/lib/appearance/fonts";
import { getTheme, themeVariables } from "@/lib/appearance/themes";
import useAppearanceStore from "@/stores/use-appearance-store";

export const TEXT_SCALE = { sm: "0.93", md: "1", lg: "1.12" } as const;
const EXTRA_CSS_ID = "at-theme-extra";
/** Read by the inline script in index.html, so a reload starts in the chosen theme without a flash. */
export const BOOT_KEY = "agent-tracking:boot";

/** Applies theme variables, fonts and text size to the document root. */
const useApplyAppearance = () => {
  const themeId = useAppearanceStore((s) => s.themeId);
  const uiFontId = useAppearanceStore((s) => s.uiFontId);
  const codeFontId = useAppearanceStore((s) => s.codeFontId);
  const textSize = useAppearanceStore((s) => s.textSize);

  useEffect(() => {
    const theme = getTheme(themeId);
    const ui = getFont(uiFontId, "arima");
    const code = getFont(codeFontId, "jetbrains-mono");
    loadFont(ui);
    loadFont(code);

    const vars: Record<string, string> = {
      ...themeVariables(theme),
      "--t-font-ui": ui.stack,
      "--t-font-code": code.stack,
      "--t-scale": TEXT_SCALE[textSize],
    };
    const root = document.documentElement;
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    root.dataset.theme = theme.id;
    root.style.colorScheme = theme.dark ? "dark" : "light";

    let style = document.getElementById(EXTRA_CSS_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = EXTRA_CSS_ID;
      document.head.appendChild(style);
    }
    style.textContent = theme.extraCss ?? "";

    try {
      localStorage.setItem(BOOT_KEY, JSON.stringify({ vars, dark: theme.dark, fonts: [ui, code].filter((f) => f.google).map((f) => f.google) }));
    } catch {
      /* the next load starts with the default theme */
    }
  }, [themeId, uiFontId, codeFontId, textSize]);
};

export default useApplyAppearance;
