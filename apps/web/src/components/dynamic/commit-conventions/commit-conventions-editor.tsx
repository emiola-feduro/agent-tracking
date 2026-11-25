import { COMMIT_TYPES, DEFAULT_COMMIT_CONVENTIONS, type CommitConventions } from "@agent-tracking/core";
import CheckOption from "@/components/ui/check-option/check-option";
import Segmented from "@/components/ui/segmented/segmented";
import TextAreaField from "@/components/ui/text-area-field/text-area-field";

type Props = {
  /** null: the defaults (Conventional Commits). */
  value: CommitConventions | null;
  onChange: (value: CommitConventions | null) => void;
};

const example = (c: CommitConventions) => {
  const type = c.types.includes("feat") ? "feat" : (c.types[0] ?? "feat");
  const text = c.language === "es" ? "agrega el filtro por fecha" : "add the date filter";
  return c.scope === "none" ? `${type}: ${text}` : `${type}(gastos): ${text}`;
};

/**
 * How the project's commits and branches are written: the categories (commit types) that apply,
 * scope, language and the team's own rules. Leaving the defaults on means Conventional Commits.
 */
const CommitConventionsEditor = ({ value, onChange }: Props) => {
  const custom = value !== null;
  const c = value ?? DEFAULT_COMMIT_CONVENTIONS;
  const set = (patch: Partial<CommitConventions>) => onChange({ ...c, ...patch });
  const toggleType = (type: string) => set({ types: c.types.includes(type) ? c.types.filter((t) => t !== type) : [...c.types, type] });

  return (
    <div className="flex flex-col gap-4">
      <CheckOption
        checked={!custom}
        onChange={() => onChange(custom ? null : { ...DEFAULT_COMMIT_CONVENTIONS })}
        label="Usar las convenciones por defecto"
        description="Conventional Commits: tipo(alcance): descripción, con feat, fix, docs y el resto de los tipos, y ramas tipo/tema."
      />
      {custom && (
        <div className="flex animate-enter flex-col gap-4">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-ink">Categorías de commit</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {COMMIT_TYPES.map((t) => (
                <CheckOption
                  key={t.type}
                  checked={c.types.includes(t.type)}
                  onChange={() => toggleType(t.type)}
                  label={<code className="font-mono text-[0.8125rem]">{t.type}</code>}
                  meta={<span className="text-xs font-normal text-muted">rama {t.branch}...</span>}
                  description={t.description}
                />
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Alcance entre paréntesis</span>
              <Segmented<CommitConventions["scope"]>
                label="Alcance del commit"
                value={c.scope}
                onChange={(scope) => set({ scope })}
                items={[
                  { value: "optional", label: "Opcional" },
                  { value: "required", label: "Obligatorio" },
                  { value: "none", label: "Sin alcance" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Idioma de los mensajes</span>
              <Segmented<CommitConventions["language"]>
                label="Idioma de los mensajes"
                value={c.language}
                onChange={(language) => set({ language })}
                items={[
                  { value: "es", label: "Español" },
                  { value: "en", label: "Inglés" },
                ]}
              />
            </div>
          </div>
          <TextAreaField
            label="Reglas propias (una por línea)"
            value={c.custom}
            onChange={(v) => set({ custom: v })}
            rows={3}
            placeholder={"Referencia el ticket al final: (JIRA-123)\nUn commit por cambio lógico\nNada de commits en main"}
          />
          <p className="text-sm text-ink-soft">
            Ejemplo: <code className="rounded-sm bg-subtle px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">{example(c)}</code>
          </p>
        </div>
      )}
      <p className="text-xs text-muted">Los agentes las reciben en CONTEXT.md y las usan para sus commits y ramas.</p>
    </div>
  );
};

export default CommitConventionsEditor;
