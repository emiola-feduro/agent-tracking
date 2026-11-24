import { useState } from "react";
import useTestGroups, { type TestGrouping } from "@/hooks/ui/use-test-groups";
import type { ProjectView } from "@/lib/api";
import ProjectDetailTestGroup from "./project-detail-test-group";
import ProjectDetailTestIdeas from "./project-detail-test-ideas";

const GROUPINGS: { value: TestGrouping; label: string }[] = [
  { value: "type", label: "Por tipo" },
  { value: "feature", label: "Por feature" },
  { value: "requirement", label: "Por requerimiento" },
];

const ProjectDetailTests = ({ view }: { view: ProjectView }) => {
  const [grouping, setGrouping] = useState<TestGrouping>("type");
  const groups = useTestGroups(view, grouping);
  const { tests } = view;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Tests ({tests.length})</h2>
          <div role="radiogroup" aria-label="Agrupar tests" className="flex flex-wrap gap-1.5">
            {GROUPINGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={grouping === value}
                onClick={() => setGrouping(value)}
                className={`min-h-8 rounded-full border px-3 text-sm transition-colors duration-150 ${grouping === value ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-ink-soft hover:bg-subtle"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {tests.length === 0 && <p className="text-muted">Aparecerán aquí cuando un agente los reporte con report_test.</p>}
        <div key={grouping} className="flex animate-enter flex-col gap-5">
          {groups.map((group) => (
            <ProjectDetailTestGroup key={group.key || "none"} label={group.label} tests={group.tests} />
          ))}
        </div>
      </section>
      <ProjectDetailTestIdeas view={view} />
    </div>
  );
};

export default ProjectDetailTests;
