import { Link } from "@tanstack/react-router";

const ProjectListEmpty = () => {
  return (
    <div className="flex animate-enter flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">Aún no hay proyectos</h2>
      <Link
        to="/projects/new"
        className="inline-flex min-h-10 items-center rounded-md bg-brand px-4 font-medium text-on-brand transition-colors hover:bg-brand-hover"
      >
        Crear o importar un proyecto
      </Link>
    </div>
  );
};

export default ProjectListEmpty;
