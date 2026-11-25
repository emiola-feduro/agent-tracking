import { useEffect } from "react";
import Segmented from "@/components/ui/segmented/segmented";
import SelectField from "@/components/ui/select-field/select-field";
import Skeleton from "@/components/ui/skeleton/skeleton";
import TextField from "@/components/ui/text-field/text-field";
import useGithubAccount from "@/hooks/data/use-github-account";
import type { GithubPublish } from "@/lib/api";

type Props = { value: GithubPublish; onChange: (value: GithubPublish) => void };

const VALID = /^[A-Za-z0-9._-]{1,100}$/;
export const isValidRepoName = (name: string) => VALID.test(name) && !name.startsWith(".");

/** Owner, name and visibility of a new GitHub repository. Private unless chosen otherwise. */
const GithubPublishFields = ({ value, onChange }: Props) => {
  const { data, isPending } = useGithubAccount();
  const owners = data?.ok ? [data.account.login, ...data.account.orgs] : [];
  const owner = value.owner || owners[0] || "";
  // The signed-in account is the default owner.
  useEffect(() => {
    if (owner && owner !== value.owner) onChange({ ...value, owner });
  }, [owner, value, onChange]);

  if (isPending) return <Skeleton className="h-20" />;
  if (data && !data.ok) return <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">{data.reason}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <SelectField label="Cuenta" value={owner} onChange={(v) => onChange({ ...value, owner: v })} options={owners.map((o) => ({ value: o, label: o }))} />
        <TextField
          label="Nombre del repositorio"
          value={value.name}
          onChange={(v) => onChange({ ...value, name: v.replace(/\s+/g, "-") })}
          error={value.name && !isValidRepoName(value.name) ? "Solo letras, números, puntos, guiones y guiones bajos" : null}
          spellCheck={false}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">Visibilidad</span>
        <Segmented<GithubPublish["visibility"]>
          label="Visibilidad del repositorio"
          value={value.visibility}
          onChange={(v) => onChange({ ...value, visibility: v })}
          items={[
            { value: "private", label: "Privado" },
            { value: "public", label: "Público" },
          ]}
        />
        {value.visibility === "public" && <p className="text-xs text-warn">Cualquiera en internet podrá ver el código.</p>}
      </div>
      <p className="text-xs text-muted">
        Se crea en github.com/{owner || "tu-cuenta"}/{value.name || "nombre"}, se conecta como <code className="font-mono">origin</code> y se sube la rama
        actual. Si el repo no tiene commits, se hace uno primero con lo que hay.
      </p>
    </div>
  );
};

export default GithubPublishFields;
