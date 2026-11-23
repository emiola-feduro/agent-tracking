import { useState } from "react";
import CheckOption from "@/components/ui/check-option/check-option";
import StatusPill from "@/components/ui/status-pill/status-pill";
import TextField from "@/components/ui/text-field/text-field";
import useWizardStore, { type SelectedSkill } from "@/stores/use-wizard-store";

const SOURCE_LABEL = { user: "Usuario", repo: "Repositorio", plugin: "Plugin", catalog: "Catálogo", created: "Nueva" };

const matches = (skill: SelectedSkill, query: string) =>
  !query || `${skill.name} ${skill.description} ${skill.plugin ?? ""}`.toLowerCase().includes(query.toLowerCase());

type NewProjectSkillListProps = {
  skills: SelectedSkill[];
  label?: string;
};

const NewProjectSkillList = ({ skills, label = "Skills instaladas" }: NewProjectSkillListProps) => {
  const [query, setQuery] = useState("");
  const selected = useWizardStore((s) => s.skills);
  const toggleSkill = useWizardStore((s) => s.toggleSkill);
  const reasons = useWizardStore((s) => s.skillReasons);
  const visible = skills.filter((s) => matches(s, query));
  const count = skills.filter((s) => selected[s.key]).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-ink">{label}</h3>
        <span className="text-sm tabular-nums text-muted">
          {count} de {skills.length} elegidas
        </span>
      </div>
      <TextField label={`Filtrar ${label.toLowerCase()}`} hideLabel type="search" value={query} onChange={setQuery} placeholder="Filtrar por nombre o descripción" />
      <div className="max-h-96 overflow-y-auto rounded-md border border-line p-1">
        {visible.length === 0 && <p className="p-3 text-sm text-muted">Ninguna coincide con el filtro.</p>}
        {visible.map((skill) => (
          <CheckOption
            key={skill.key}
            checked={!!selected[skill.key]}
            onChange={() => toggleSkill(skill)}
            label={skill.name}
            meta={
              <>
                <StatusPill>{skill.plugin ?? SOURCE_LABEL[skill.source]}</StatusPill>
                {reasons[skill.key] !== undefined && <StatusPill tone="brand">Sugerida por IA</StatusPill>}
              </>
            }
            description={reasons[skill.key] || skill.description}
          />
        ))}
      </div>
    </section>
  );
};

export default NewProjectSkillList;
