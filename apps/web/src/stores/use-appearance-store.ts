import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { DEFAULT_THEME_ID } from "@/lib/appearance/themes";

export type TextSize = "sm" | "md" | "lg";

type AppearanceState = {
  themeId: string;
  uiFontId: string;
  codeFontId: string;
  textSize: TextSize;
  setTheme: (id: string) => void;
  setUiFont: (id: string) => void;
  setCodeFont: (id: string) => void;
  setTextSize: (size: TextSize) => void;
  reset: () => void;
};

export const APPEARANCE_DEFAULTS = { themeId: DEFAULT_THEME_ID, uiFontId: "arima", codeFontId: "jetbrains-mono", textSize: "md" as TextSize };

/** localStorage can throw in private windows; the appearance then just does not persist. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* not persisted */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* nothing to remove */
    }
  },
};

/** Theme, fonts and text size: a per-device preference, so it lives in the browser, not the server. */
const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...APPEARANCE_DEFAULTS,
      setTheme: (themeId) => set({ themeId }),
      setUiFont: (uiFontId) => set({ uiFontId }),
      setCodeFont: (codeFontId) => set({ codeFontId }),
      setTextSize: (textSize) => set({ textSize }),
      reset: () => set(APPEARANCE_DEFAULTS),
    }),
    { name: "agent-tracking:appearance", storage: createJSONStorage(() => safeStorage) },
  ),
);

export default useAppearanceStore;
