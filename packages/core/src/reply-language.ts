/**
 * The language agents use with the person: answers, end-of-task summaries and the `summary` of
 * submit_report. Each project picks one (Spanish by default) or none; it goes into CONTEXT.md, the
 * block in each agent's instruction file and, for agents with hooks, every new request. Code and
 * comments follow the project's conventions, not this setting.
 */
export const REPLY_LANGUAGES = ["es", "en", "pt", "fr", "de", "it"] as const;
export type ReplyLanguage = (typeof REPLY_LANGUAGES)[number];

export const DEFAULT_REPLY_LANGUAGE: ReplyLanguage = "es";

export const REPLY_LANGUAGE_INFO: Record<ReplyLanguage, { label: string; native: string }> = {
  es: { label: "Español", native: "Español" },
  en: { label: "Inglés", native: "English" },
  pt: { label: "Portugués", native: "Português" },
  fr: { label: "Francés", native: "Français" },
  de: { label: "Alemán", native: "Deutsch" },
  it: { label: "Italiano", native: "Italiano" },
};

/** "español", "inglés (English)": how the rule names the language. */
const named = (lang: ReplyLanguage) => {
  const { label, native } = REPLY_LANGUAGE_INFO[lang];
  return label === native ? label.toLowerCase() : `${label.toLowerCase()} (${native})`;
};

/** The instruction agents receive, or null when the project sets no language. */
export function replyLanguageRule(lang: ReplyLanguage | null | undefined): string | null {
  if (!lang) return null;
  return `Háblale al usuario en ${named(lang)}: tus respuestas, el resumen al terminar cada tarea y el \`summary\` de \`submit_report\`. El código y sus comentarios siguen las convenciones del proyecto.`;
}
