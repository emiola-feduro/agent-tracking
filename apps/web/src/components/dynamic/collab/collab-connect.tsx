import { useState, type FormEvent } from "react";
import Alert from "@/components/ui/alert/alert";
import Button from "@/components/ui/button/button";
import Segmented from "@/components/ui/segmented/segmented";
import TextField from "@/components/ui/text-field/text-field";
import { useCollabConnect } from "@/hooks/data/use-collab";

type Mode = "login" | "register";

/** Signs in to a shared server (or creates the account there). The token stays on the local server. */
const CollabConnect = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const connect = useCollabConnect();
  const ready = url.trim() && email.trim() && password.length >= 8 && (mode === "login" || name.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    connect.mutate({ url: url.trim(), email: email.trim(), password, ...(mode === "register" ? { name: name.trim() } : {}) });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink">Conectar con un servidor compartido</h2>
        <p className="text-sm text-muted">
          Varias personas sincronizan el mismo proyecto a través del servidor de su equipo. Cada una tiene un rol: responsable, edición o lectura.
        </p>
      </div>
      <Segmented
        label="Cuenta"
        items={[
          { value: "login", label: "Ya tengo cuenta" },
          { value: "register", label: "Crear cuenta" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <TextField label="Dirección del servidor" value={url} onChange={setUrl} placeholder="https://equipo.ejemplo.com" type="url" required />
      {mode === "register" && <TextField label="Tu nombre" value={name} onChange={setName} autoComplete="name" required />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Correo" value={email} onChange={setEmail} type="email" autoComplete="email" required />
        <TextField
          label="Contraseña"
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          hint="Al menos 8 caracteres"
          required
        />
      </div>
      {connect.isError && <Alert>{connect.error.message}</Alert>}
      <Button type="submit" variant="primary" className="self-start" isLoading={connect.isPending} disabled={!ready}>
        {mode === "login" ? "Conectar" : "Crear cuenta y conectar"}
      </Button>
    </form>
  );
};

export default CollabConnect;
