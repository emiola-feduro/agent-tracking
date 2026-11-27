import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import RemoveButton from "@/components/ui/remove-button/remove-button";
import SelectField from "@/components/ui/select-field/select-field";
import TextField from "@/components/ui/text-field/text-field";
import { useCollabMemberActions, useCollabMembers } from "@/hooks/data/use-collab";
import { COLLAB_ROLES, roleLabel, type CollabRole } from "@/lib/collab-api";

type CollabMembersProps = { projectId: string; myId: string; isOwner: boolean };

/** People in the shared project with their roles; the owner adds people, changes roles and removes them. */
const CollabMembers = ({ projectId, myId, isOwner }: CollabMembersProps) => {
  const { data: members = [], status } = useCollabMembers(projectId, true);
  const { setMember, removeMember } = useCollabMemberActions(projectId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollabRole>("editor");
  const error = setMember.error ?? removeMember.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) setMember.mutate({ email: email.trim(), role }, { onSuccess: () => setEmail("") });
  };

  return (
    <section aria-labelledby="collab-members" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <h2 id="collab-members" className="text-lg font-semibold text-ink">
        Personas y roles
      </h2>
      {status === "pending" && <p className="text-muted">Cargando personas...</p>}
      <ul className="flex flex-col divide-y divide-line">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">
                {m.name}
                {m.id === myId && <span className="font-normal text-muted"> (tú)</span>}
              </p>
              <p className="truncate text-sm text-muted">{m.email}</p>
            </div>
            {isOwner ? (
              <select
                aria-label={`Rol de ${m.name}`}
                value={m.role}
                onChange={(e) => setMember.mutate({ email: m.email, role: e.target.value as CollabRole })}
                className="min-h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
              >
                {COLLAB_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-full bg-subtle px-2.5 py-0.5 text-sm text-ink-soft">{roleLabel(m.role)}</span>
            )}
            {(isOwner || m.id === myId) && (
              <RemoveButton label={m.id === myId ? "Salir del proyecto" : `Quitar a ${m.name}`} onClick={() => removeMember.mutate(m.id)} />
            )}
          </li>
        ))}
      </ul>
      {error && <Alert>{error.message}</Alert>}
      {isOwner && (
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            label="Correo de una persona con cuenta en el servidor"
            value={email}
            onChange={setEmail}
            type="email"
            className="flex-1"
          />
          <SelectField label="Rol" value={role} onChange={(v) => setRole(v as CollabRole)} options={COLLAB_ROLES.map((r) => ({ value: r.value, label: r.label }))} />
          <Button type="submit" isLoading={setMember.isPending} disabled={!email.trim()}>
            Agregar
          </Button>
        </form>
      )}
      <dl className="grid gap-1 text-sm text-muted sm:grid-cols-3">
        {COLLAB_ROLES.map((r) => (
          <div key={r.value}>
            <dt className="inline font-medium text-ink-soft">{r.label}: </dt>
            <dd className="inline">{r.hint}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default CollabMembers;
