/**
 * `bun run dev`: the API (with --watch) and, once it answers, the web UI (Vite, with its proxy to
 * the API). Output of both goes to this terminal with a prefix; Ctrl+C stops both. When an API is
 * already running on the port, it is reused and only the UI starts.
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const port = Number(process.env.PORT ?? 4317);
const api = `http://127.0.0.1:${port}`;
const children: Bun.Subprocess[] = [];

const healthy = () =>
  fetch(`${api}/api/health`, { signal: AbortSignal.timeout(1000) })
    .then((r) => r.ok)
    .catch(() => false);

/** Copies a stream to stdout line by line, each line with a coloured prefix. */
async function pipe(stream: ReadableStream<Uint8Array>, prefix: string) {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of stream) {
    const lines = (rest + decoder.decode(chunk, { stream: true })).split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) process.stdout.write(`${prefix} ${line}\n`);
  }
  if (rest) process.stdout.write(`${prefix} ${rest}\n`);
}

function start(name: string, color: number, cmd: string[], cwd: string) {
  // The UI proxies to this same API, whatever its port.
  const child = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe", env: { AGENT_TRACKING_API: api, ...process.env, FORCE_COLOR: "1" } });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m`;
  void pipe(child.stdout, prefix);
  void pipe(child.stderr, prefix);
  children.push(child);
  void child.exited.then((code) => {
    if (!stopping) {
      console.log(`${prefix} terminó (código ${code}); se detiene todo`);
      stop(code ?? 1);
    }
  });
  return child;
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

if (await healthy()) {
  console.log(`API ya corriendo en ${api}: solo se levanta la web.`);
} else {
  start("api", 36, [process.execPath, "--watch", "packages/server/src/index.ts"], root);
  const deadline = Date.now() + 30_000;
  while (!(await healthy())) {
    if (Date.now() > deadline) {
      console.error(`La API no respondió en ${api} después de 30 s.`);
      stop(1);
    }
    await Bun.sleep(300);
  }
  console.log(`API lista en ${api}.`);
}
start("web", 35, [process.execPath, "run", "dev"], join(root, "apps", "web"));
