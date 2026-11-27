import type { RequirementType } from "./types";

/**
 * Short codes that name a requirement inside its project (RF1, RNF2…), so people and agents can
 * write "RF3" instead of the title or the id. New requirements get the next number for their type;
 * the code can be edited later and never repeats within the project (case aside).
 */
export const REQUIREMENT_CODE_PREFIX: Record<RequirementType, string> = { functional: "RF", non_functional: "RNF" };

/** Letters first, then letters, digits, dots, dashes or underscores; at most 20 characters. */
export const REQUIREMENT_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,19}$/;

export const normalizeRequirementCode = (code: string) => code.trim().toUpperCase();

export const sameCode = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normalizeRequirementCode(a) === normalizeRequirementCode(b);

/** Problem with a code the person typed, or null when it can be used. */
export function requirementCodeProblem(code: string, others: (string | null | undefined)[]): string | null {
  const value = normalizeRequirementCode(code);
  if (!value) return "Escribe un código";
  if (!REQUIREMENT_CODE_PATTERN.test(value)) return "Usa letras al inicio y luego letras, números, puntos o guiones (máximo 20)";
  if (others.some((o) => sameCode(o, value))) return `Ya hay un requerimiento con el código ${value}`;
  return null;
}

/** The next free code for a type: one more than the highest number used with its prefix. */
export function nextRequirementCode(type: RequirementType, existing: (string | null | undefined)[]): string {
  const prefix = REQUIREMENT_CODE_PREFIX[type];
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const taken = new Set(existing.filter(Boolean).map((c) => normalizeRequirementCode(c!)));
  let n = Math.max(0, ...[...taken].map((c) => Number(pattern.exec(c)?.[1] ?? 0))) + 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Codes for requirements in order, keeping the ones they have and numbering the rest. */
export function assignRequirementCodes<T extends { type?: RequirementType; code?: string | null }>(items: T[]): (T & { code: string })[] {
  const used: string[] = items.map((r) => r.code?.trim() || null).filter((c): c is string => !!c).map(normalizeRequirementCode);
  const seen = new Set<string>();
  return items.map((r) => {
    const own = r.code?.trim() ? normalizeRequirementCode(r.code) : null;
    if (own && !seen.has(own)) {
      seen.add(own);
      return { ...r, code: own };
    }
    const code = nextRequirementCode(r.type ?? "functional", [...used, ...seen]);
    seen.add(code);
    used.push(code);
    return { ...r, code };
  });
}

/** "RF1 Título" style label; the title alone when there is no code. */
export const requirementLabel = (r: { code?: string | null; title: string }) => (r.code ? `${r.code} ${r.title}` : r.title);
