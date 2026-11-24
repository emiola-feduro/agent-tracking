/**
 * Appearance themes. The palettes come from ER Studio, so both apps share the same set; the first two
 * are the original Agent Tracking colors. Each theme sets the CSS variables read by index.css.
 */
export type ThemeColors = {
  bg: string;
  surface: string;
  surface2: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentFg: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
};

export type Theme = {
  id: string;
  name: string;
  dark: boolean;
  radius: string;
  borderWidth: string;
  shadow: string;
  colors: ThemeColors;
  /** Extra CSS for themes with a strong personality (applied while the theme is active). */
  extraCss?: string;
};

const soft = "0 1px 2px rgb(0 0 0 / 0.06), 0 2px 8px rgb(0 0 0 / 0.06)";
const deep = "0 1px 2px rgb(0 0 0 / 0.4), 0 4px 12px rgb(0 0 0 / 0.3)";

export const THEMES: Theme[] = [
  { id: "indigo", name: "Agent Tracking", dark: false, radius: "8px", borderWidth: "1px", shadow: "none",
    colors: { bg: "#f6f6f9", surface: "#ffffff", surface2: "#eff0f5", fg: "#191a23", muted: "#6b6d7e", border: "#dfe0e8", accent: "#3f3cbb", accentFg: "#ffffff", accentSoft: "#ecebfa", danger: "#b42318", dangerSoft: "#fdecea", warning: "#8a5a00", warningSoft: "#fdf1d8", success: "#0f7a54" } },
  { id: "indigo-dark", name: "Agent Tracking oscuro", dark: true, radius: "8px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#14151c", surface: "#1c1d27", surface2: "#252734", fg: "#e7e7f0", muted: "#a0a2b8", border: "#333545", accent: "#a5a3f5", accentFg: "#14151c", accentSoft: "#2d2b55", danger: "#f4978e", dangerSoft: "#3d2226", warning: "#e9c46a", warningSoft: "#3a3020", success: "#6fd3a5" } },
  { id: "light", name: "Claro", dark: false, radius: "8px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#f6f7f9", surface: "#ffffff", surface2: "#eef0f4", fg: "#1c2230", muted: "#5b6475", border: "#d9dde5", accent: "#3a5bd9", accentFg: "#ffffff", accentSoft: "#e6ebfb", danger: "#c0362c", dangerSoft: "#fbe9e7", warning: "#8a5a00", warningSoft: "#fdf3dc", success: "#23784a" } },
  { id: "dark", name: "Oscuro", dark: true, radius: "8px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#16181d", surface: "#1d2026", surface2: "#262a32", fg: "#e3e6ec", muted: "#9aa2b1", border: "#333844", accent: "#8aa4f0", accentFg: "#10131a", accentSoft: "#262f4a", danger: "#f08a80", dangerSoft: "#3b2222", warning: "#e7c06d", warningSoft: "#3a3020", success: "#7cc79a" } },
  { id: "high-contrast", name: "Alto contraste", dark: false, radius: "2px", borderWidth: "2px", shadow: "none",
    colors: { bg: "#ffffff", surface: "#ffffff", surface2: "#ececec", fg: "#000000", muted: "#1a1a1a", border: "#000000", accent: "#0000c8", accentFg: "#ffffff", accentSoft: "#dfe3ff", danger: "#a30000", dangerSoft: "#ffe0e0", warning: "#5c3b00", warningSoft: "#fff0c2", success: "#005a1e" } },
  { id: "high-contrast-dark", name: "Alto contraste oscuro", dark: true, radius: "2px", borderWidth: "2px", shadow: "none",
    colors: { bg: "#000000", surface: "#000000", surface2: "#1a1a1a", fg: "#ffffff", muted: "#f0f0f0", border: "#ffffff", accent: "#ffff00", accentFg: "#000000", accentSoft: "#333300", danger: "#ff6b6b", dangerSoft: "#330000", warning: "#ffff00", warningSoft: "#333300", success: "#00ff7f" } },
  { id: "sepia", name: "Sepia", dark: false, radius: "6px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#f4ecd8", surface: "#fbf5e6", surface2: "#ede2c8", fg: "#3b2f1e", muted: "#6e5c43", border: "#d8c8a4", accent: "#8b4a1c", accentFg: "#fff8ec", accentSoft: "#f0dcc4", danger: "#9e2b1e", dangerSoft: "#f5d9d0", warning: "#7a5200", warningSoft: "#f3e3b8", success: "#3f6b2a" } },
  { id: "brutalist", name: "Brutalista", dark: false, radius: "0px", borderWidth: "2px", shadow: "4px 4px 0 #000000", extraCss: "button, input, select, textarea { font-weight: 600; }",
    colors: { bg: "#ffffff", surface: "#ffffff", surface2: "#f2f2f2", fg: "#000000", muted: "#2b2b2b", border: "#000000", accent: "#ff4f00", accentFg: "#000000", accentSoft: "#ffe14d", danger: "#d40000", dangerSoft: "#ffd6d6", warning: "#6b4b00", warningSoft: "#fff2b3", success: "#006b2d" } },
  { id: "brutalist-dark", name: "Brutalista oscuro", dark: true, radius: "0px", borderWidth: "2px", shadow: "4px 4px 0 #f2f2ea", extraCss: "button, input, select, textarea { font-weight: 600; }",
    colors: { bg: "#111111", surface: "#161616", surface2: "#242424", fg: "#f2f2ea", muted: "#cfcfc6", border: "#f2f2ea", accent: "#ff5c1a", accentFg: "#000000", accentSoft: "#4a3d00", danger: "#ff6b6b", dangerSoft: "#3a1010", warning: "#ffe14d", warningSoft: "#3a3300", success: "#4ade80" } },
  { id: "brutalist-sepia", name: "Brutalista sepia", dark: false, radius: "0px", borderWidth: "2px", shadow: "4px 4px 0 #1f160b", extraCss: "button, input, select, textarea { font-weight: 600; }",
    colors: { bg: "#efe4c8", surface: "#f7efdc", surface2: "#e6d7b4", fg: "#1f160b", muted: "#4a3a24", border: "#1f160b", accent: "#b5400f", accentFg: "#ffffff", accentSoft: "#f2c14e", danger: "#a3200f", dangerSoft: "#f5d0c0", warning: "#6b4800", warningSoft: "#f2deb0", success: "#2f5d20" } },
  { id: "brutalist-high-contrast", name: "Brutalista alto contraste", dark: false, radius: "0px", borderWidth: "3px", shadow: "5px 5px 0 #000000", extraCss: "button, input, select, textarea { font-weight: 700; }",
    colors: { bg: "#ffffff", surface: "#ffffff", surface2: "#ececec", fg: "#000000", muted: "#000000", border: "#000000", accent: "#0000d6", accentFg: "#ffffff", accentSoft: "#ffff00", danger: "#b00000", dangerSoft: "#ffd9d9", warning: "#5a3b00", warningSoft: "#ffff99", success: "#005a1e" } },
  { id: "mono", name: "Tinta", dark: false, radius: "4px", borderWidth: "1px", shadow: "none",
    colors: { bg: "#fafafa", surface: "#ffffff", surface2: "#f0f0f0", fg: "#161616", muted: "#555555", border: "#d4d4d4", accent: "#161616", accentFg: "#ffffff", accentSoft: "#e8e8e8", danger: "#b00020", dangerSoft: "#fde7ea", warning: "#6b4f00", warningSoft: "#f7efd9", success: "#1f6b3a" } },
  { id: "solarized", name: "Solarizado", dark: false, radius: "6px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#fdf6e3", surface: "#fffbef", surface2: "#eee8d5", fg: "#073642", muted: "#586e75", border: "#e0d8bf", accent: "#1f6fa8", accentFg: "#ffffff", accentSoft: "#dcebf5", danger: "#c0302e", dangerSoft: "#f7dedb", warning: "#8a6100", warningSoft: "#f6e9c2", success: "#5e7a00" } },
  { id: "graph-paper", name: "Papel cuadriculado", dark: false, radius: "4px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#fbfbf7", surface: "#ffffff", surface2: "#f1f2ec", fg: "#22313f", muted: "#55636f", border: "#cfd8dc", accent: "#b8322a", accentFg: "#ffffff", accentSoft: "#f8e3e0", danger: "#b8322a", dangerSoft: "#f8e3e0", warning: "#7a5200", warningSoft: "#f6ecd2", success: "#2f6f3e" } },
  { id: "forest", name: "Bosque", dark: false, radius: "8px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#eef3ec", surface: "#f8fbf6", surface2: "#e1eadd", fg: "#1e2d22", muted: "#4c5f50", border: "#c7d6c2", accent: "#2f6b3a", accentFg: "#ffffff", accentSoft: "#d8e8d6", danger: "#a83a2a", dangerSoft: "#f4dcd6", warning: "#7a5600", warningSoft: "#f0e4c0", success: "#2f6b3a" } },
  { id: "sunset", name: "Atardecer", dark: false, radius: "10px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#fff3ea", surface: "#fffaf6", surface2: "#fbe4d6", fg: "#3a1f1a", muted: "#75514a", border: "#f0cbb8", accent: "#c2410c", accentFg: "#ffffff", accentSoft: "#fde0cf", danger: "#b42318", dangerSoft: "#fde2dd", warning: "#8a5300", warningSoft: "#fdebc8", success: "#2f7a4a" } },
  { id: "candy", name: "Caramelo", dark: false, radius: "14px", borderWidth: "1px", shadow: soft,
    colors: { bg: "#fef6fb", surface: "#ffffff", surface2: "#f9e8f3", fg: "#3d2340", muted: "#6f5371", border: "#f1d3e6", accent: "#c2307f", accentFg: "#ffffff", accentSoft: "#fbe1ef", danger: "#b4232f", dangerSoft: "#fde0e4", warning: "#8a5a00", warningSoft: "#fff0c7", success: "#2e7d5b" } },
  { id: "vaporwave", name: "Vaporwave", dark: false, radius: "6px", borderWidth: "1px", shadow: "3px 3px 0 #e3a6d3",
    colors: { bg: "#fdf0f8", surface: "#fff7fc", surface2: "#f6e3f1", fg: "#2d1b3d", muted: "#6a4f7d", border: "#eac7e2", accent: "#7b3fe4", accentFg: "#ffffff", accentSoft: "#ece0fb", danger: "#c2185b", dangerSoft: "#fde0ec", warning: "#8a5a00", warningSoft: "#fff1cc", success: "#1b7f6b" } },
  { id: "comic", name: "Cómic", dark: false, radius: "6px", borderWidth: "2px", shadow: "3px 3px 0 #111111",
    colors: { bg: "#fffbea", surface: "#ffffff", surface2: "#fff3c4", fg: "#111111", muted: "#3b3b3b", border: "#111111", accent: "#e2231a", accentFg: "#ffffff", accentSoft: "#ffe1de", danger: "#c4160f", dangerSoft: "#ffe1de", warning: "#7a4f00", warningSoft: "#fff0b3", success: "#157a3a" } },
  { id: "gameboy", name: "Consola de bolsillo", dark: false, radius: "0px", borderWidth: "2px", shadow: "none",
    colors: { bg: "#8bac0f", surface: "#9bbc0f", surface2: "#8bac0f", fg: "#0f380f", muted: "#1f4a1f", border: "#306230", accent: "#0f380f", accentFg: "#9bbc0f", accentSoft: "#8bac0f", danger: "#0f380f", dangerSoft: "#cfe86b", warning: "#0f380f", warningSoft: "#cfe86b", success: "#0f380f" } },
  { id: "nord", name: "Nórdico", dark: true, radius: "8px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#2e3440", surface: "#3b4252", surface2: "#434c5e", fg: "#eceff4", muted: "#c0c7d4", border: "#4c566a", accent: "#88c0d0", accentFg: "#2e3440", accentSoft: "#3e5563", danger: "#e0959c", dangerSoft: "#4a3a42", warning: "#ebcb8b", warningSoft: "#4a4436", success: "#a3be8c" } },
  { id: "dracula", name: "Vampiro", dark: true, radius: "8px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#21222c", surface: "#282a36", surface2: "#343746", fg: "#f8f8f2", muted: "#bfc3dc", border: "#44475a", accent: "#bd93f9", accentFg: "#1e1f29", accentSoft: "#3b3552", danger: "#ff6e6e", dangerSoft: "#4a2a32", warning: "#ffb86c", warningSoft: "#4a3a2a", success: "#50fa7b" } },
  { id: "ocean", name: "Océano", dark: true, radius: "10px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#0f1e2b", surface: "#142736", surface2: "#1b3245", fg: "#e2eef6", muted: "#a6bccb", border: "#284459", accent: "#5cc8d6", accentFg: "#0b1a24", accentSoft: "#1d3f4d", danger: "#ff8a80", dangerSoft: "#3d2229", warning: "#f2c66d", warningSoft: "#3b3626", success: "#7fd6a6" } },
  { id: "coffee", name: "Café", dark: true, radius: "8px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#2a201b", surface: "#33271f", surface2: "#3e3027", fg: "#f1e6da", muted: "#cbb8a5", border: "#54443a", accent: "#d9a066", accentFg: "#2a201b", accentSoft: "#4a3727", danger: "#f08a7a", dangerSoft: "#4a2a24", warning: "#e8c37a", warningSoft: "#4a3d26", success: "#9fc6a0" } },
  { id: "midnight-gold", name: "Medianoche dorada", dark: true, radius: "6px", borderWidth: "1px", shadow: deep,
    colors: { bg: "#0e1220", surface: "#151a2c", surface2: "#1d2338", fg: "#ece6d6", muted: "#bdb59f", border: "#2c3350", accent: "#d4af37", accentFg: "#0e1220", accentSoft: "#3a3220", danger: "#f08a80", dangerSoft: "#3b2226", warning: "#f0d27a", warningSoft: "#3a3220", success: "#8fd1a8" } },
  { id: "blueprint", name: "Plano técnico", dark: true, radius: "2px", borderWidth: "1px", shadow: "none",
    colors: { bg: "#163d6b", surface: "#1b4677", surface2: "#22528a", fg: "#f0f6ff", muted: "#c4d8f2", border: "#3c6aa3", accent: "#ffffff", accentFg: "#163d6b", accentSoft: "#2a5d99", danger: "#ffadad", dangerSoft: "#4a2f4a", warning: "#ffd166", warningSoft: "#3b4a5a", success: "#a7f3c0" } },
  { id: "terminal", name: "Terminal fósforo", dark: true, radius: "0px", borderWidth: "1px", shadow: "none",
    colors: { bg: "#050b05", surface: "#081208", surface2: "#0e1c0e", fg: "#33ff66", muted: "#2bd957", border: "#1a4d1a", accent: "#33ff66", accentFg: "#021002", accentSoft: "#0f2e12", danger: "#ff5c5c", dangerSoft: "#2a0d0d", warning: "#e6ff4d", warningSoft: "#262a08", success: "#33ff66" } },
  { id: "synthwave", name: "Synthwave", dark: true, radius: "6px", borderWidth: "1px", shadow: "0 0 0 1px #ff4fd855",
    colors: { bg: "#1a1033", surface: "#241446", surface2: "#2f1b5a", fg: "#f5e9ff", muted: "#cdb9ea", border: "#4a2d7a", accent: "#ff4fd8", accentFg: "#1a1033", accentSoft: "#4a1f5e", danger: "#ff6b8b", dangerSoft: "#4a1a35", warning: "#fede5d", warningSoft: "#3d3020", success: "#72f1b8" } },
  { id: "cyberpunk", name: "Ciberpunk", dark: true, radius: "0px", borderWidth: "1px", shadow: "0 0 0 1px #00f0ff44",
    colors: { bg: "#0b0c10", surface: "#12141a", surface2: "#1b1e27", fg: "#e8f1f2", muted: "#adbac0", border: "#2a2f3a", accent: "#fcee0a", accentFg: "#0b0c10", accentSoft: "#3a3712", danger: "#ff2a6d", dangerSoft: "#3a1020", warning: "#fcee0a", warningSoft: "#3a3712", success: "#05ffa1" } },
];

export const DEFAULT_THEME_ID = "indigo";

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]!;

const toKebab = (key: string) => key.replace(/[A-Z0-9]/g, (m) => `-${m.toLowerCase()}`);

/** CSS custom properties of a theme, applied on the document root. */
export const themeVariables = (theme: Theme): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.colors)) vars[`--t-${toKebab(key)}`] = value;
  vars["--t-radius"] = theme.radius;
  vars["--t-bw"] = theme.borderWidth;
  vars["--t-shadow"] = theme.shadow;
  return vars;
};
