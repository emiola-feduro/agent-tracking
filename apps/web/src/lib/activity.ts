import type { AgentEvent } from "./api";
import { TEST_RESULT_LABEL } from "./labels";

/** How a timeline entry reads: a verb phrase, an optional subject (code-like when `code`), and a detail line. */
export type ActivityText = { action: string; subject?: string; code?: boolean; detail?: string };

const str = (value: unknown) => (typeof value === "string" ? value : "");

const SYMBOL_ARTICLE: Record<string, string> = {
  function: "la función",
  class: "la clase",
  variable: "la variable",
  type: "el tipo",
  constant: "la constante",
};

const DOD_STATUS: Record<string, string> = { done: "cumplido", failed: "fallido", pending: "pendiente" };

export const describeEvent = ({ type, payload }: AgentEvent): ActivityText => {
  switch (type) {
    case "get_project_context":
      return { action: "Leyó el contexto del proyecto" };
    case "get_project_skills":
      return { action: "Consultó las skills" };
    case "list_requirements":
      return { action: "Consultó los requerimientos" };
    case "get_requirement":
      return { action: "Consultó el requerimiento", subject: str(payload.title) };
    case "start_feature":
      return { action: payload.created ? "Empezó el feature" : "Retomó el feature", subject: str(payload.name) };
    case "complete_feature":
      return {
        action: payload.status === "needs_review" ? "Pidió revisión del feature" : "Terminó el feature",
        subject: str(payload.name),
        detail: str(payload.summary) || undefined,
      };
    case "report_file":
      return { action: "Reportó el archivo", subject: str(payload.path), code: true };
    case "report_symbol":
      return {
        action: `Reportó ${SYMBOL_ARTICLE[str(payload.kind)] ?? "el símbolo"}`,
        subject: str(payload.name),
        code: true,
        detail: str(payload.path) || undefined,
      };
    case "report_test":
      return {
        action: "Reportó el test",
        subject: str(payload.name),
        detail: [str(payload.path), TEST_RESULT_LABEL[str(payload.result)]].filter(Boolean).join(", ") || undefined,
      };
    case "mark_dod_item":
      return {
        action: `Marcó como ${DOD_STATUS[str(payload.status)] ?? str(payload.status)} el criterio`,
        subject: str(payload.criterion),
      };
    case "suggest_test_idea":
      return { action: "Sugirió una idea de test", detail: str(payload.text) || undefined };
    default:
      return { action: type };
  }
};

const timeFormat = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

export const formatEventTime = (iso: string) => {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return today ? timeFormat.format(date) : `${dateFormat.format(date)}, ${timeFormat.format(date)}`;
};
