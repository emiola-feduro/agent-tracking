import type { Feature } from "@agent-tracking/core";
import StatusPill from "@/components/ui/status-pill/status-pill";
import { FEATURE_STATUS_LABEL } from "@/lib/labels";

type ProjectDetailFeaturesProps = {
  features: Feature[];
  progress: Record<string, number>;
};

const tone = { pending: "neutral", in_progress: "brand", done: "ok", needs_review: "warn", orphaned: "danger" } as const;

const ProjectDetailFeatures = ({ features, progress }: ProjectDetailFeaturesProps) => {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">Features</h3>
      {features.length === 0 && (
        <p className="text-sm text-muted">Aparecerán aquí cuando un agente reporte su trabajo.</p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {features.map(({ id, name, status }) => (
          <li key={id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              {name}
              <StatusPill tone={tone[status]}>{FEATURE_STATUS_LABEL[status]}</StatusPill>
            </span>
            <span className="tabular-nums text-muted">{progress[id] ?? 0}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ProjectDetailFeatures;
