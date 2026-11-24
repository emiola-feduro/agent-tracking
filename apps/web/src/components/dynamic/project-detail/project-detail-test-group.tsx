import StatusPill from "@/components/ui/status-pill/status-pill";
import type { TestCase } from "@/lib/api";
import { TEST_RESULT_LABEL, TEST_RESULT_TONE, TEST_TYPE_LABEL } from "@/lib/labels";

type ProjectDetailTestGroupProps = {
  label: string;
  tests: TestCase[];
};

const ProjectDetailTestGroup = ({ label, tests }: ProjectDetailTestGroupProps) => {
  const passing = tests.filter((t) => t.lastResult === "passing").length;

  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        {label}
        <span className="font-normal tabular-nums text-muted">
          {passing} de {tests.length} pasan
        </span>
      </h3>
      <ul className="flex flex-col divide-y divide-line">
        {tests.map(({ id, name, path, type, lastResult }) => (
          <li key={id} className="flex animate-enter items-start justify-between gap-3 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-ink">{name}</span>
              <span className="flex flex-wrap gap-x-2 text-sm text-muted">
                <code className="font-mono text-xs break-all">{path}</code>
                <span>{TEST_TYPE_LABEL[type]}</span>
              </span>
            </span>
            <StatusPill tone={TEST_RESULT_TONE[lastResult]}>{TEST_RESULT_LABEL[lastResult]}</StatusPill>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ProjectDetailTestGroup;
