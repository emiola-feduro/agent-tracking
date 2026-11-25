import { openDb } from "@agent-tracking/db";
import { git } from "@agent-tracking/git";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { createLiveActivity } from "./live-activity";

const live = createLiveActivity();

let tmp: string;
let repo: string;
let claudeHome: string;
let app: ReturnType<typeof createApp>;
let projectId: string;
let reqId: string;

const call = async (method: string, path: string, json?: unknown) => {
  const res = await app.request(`/api${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : {},
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as any };
};
const run = async (args: string[], cwd = repo) => {
  const r = await git(args, cwd);
  if (!r.ok) throw new Error(r.stderr);
  return r.stdout;
};
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "at-v3-"));
  repo = join(tmp, "repo");
  claudeHome = join(tmp, "claude");
  await run(["init", "-q", "-b", "main", repo], tmp);
  await run(["config", "user.email", "t@t"]);
  await run(["config", "user.name", "t"]);
  await writeFile(join(repo, "app.ts"), "export const a = 1;\n");
  await run(["add", "."]);
  await run(["commit", "-qm", "init"]);
  app = createApp(openDb(":memory:"), { claudeHome, live });
  const created = await call("POST", "/projects", {
    name: "Gastos",
    kind: "api",
    repoPath: repo,
    requirements: [{ title: "Registrar gastos", description: "Con categoría", type: "functional", area: "backend", dod: [{ criterion: "Valida montos" }] }],
  });
  projectId = created.data.project.id;
  reqId = created.data.requirements[0].id;
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe("requirements", () => {
  test("keep type and area, and a partial edit leaves the rest alone", async () => {
    await call("PATCH", `/projects/${projectId}/requirements/${reqId}`, { title: "Registrar gastos y ver total" });
    const view = (await call("GET", `/projects/${projectId}`)).data;
    expect(view.requirements[0]).toMatchObject({ title: "Registrar gastos y ver total", description: "Con categoría", type: "functional", area: "backend" });
    await call("PATCH", `/projects/${projectId}/requirements/${reqId}`, { type: "non_functional", area: "performance" });
    expect((await call("GET", `/projects/${projectId}`)).data.requirements[0]).toMatchObject({ type: "non_functional", area: "performance" });
  });
});

describe("images", () => {
  test("a reference image is stored, served and exported for agents", async () => {
    const dodId = (await call("GET", `/projects/${projectId}`)).data.dod[0].id;
    const form = new FormData();
    form.set("file", new File([PNG], "Mockup Lista.png", { type: "image/png" }));
    form.set("dodItemId", dodId);
    form.set("title", "Así se ve la lista");
    const res = await app.request(`/api/projects/${projectId}/attachments`, { method: "POST", body: form });
    expect(res.status).toBe(201);
    const row = (await res.json()) as any;
    expect(row).toMatchObject({ kind: "reference", requirementId: reqId, dodItemId: dodId, mime: "image/png" });

    const image = await app.request(`/api/attachments/${row.id}`);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(PNG);
    expect(await Bun.file(join(repo, ".agent-tracking/attachments", `${row.id.slice(0, 8)}-mockup-lista.png`)).exists()).toBe(true);
    expect(await Bun.file(join(repo, ".agent-tracking/CONTEXT.md")).text()).toContain("Referencias visuales");

    await call("DELETE", `/projects/${projectId}/attachments/${row.id}`);
    expect(await Bun.file(join(repo, ".agent-tracking/attachments", `${row.id.slice(0, 8)}-mockup-lista.png`)).exists()).toBe(false);
  });

  test("anything that is not a raster image is refused, whatever it claims", async () => {
    const form = new FormData();
    form.set("file", new File(['<svg onload="alert(1)"/>'], "x.png", { type: "image/png" }));
    const res = await app.request(`/api/projects/${projectId}/attachments`, { method: "POST", body: form });
    expect(res.status).toBe(400);
  });
});

describe("agent turns", () => {
  test("a turn keeps the request, the final answer and only its own diff", async () => {
    await writeFile(join(repo, "app.ts"), "export const a = 2;\n"); // uncommitted before the turn
    const hook = (payload: object) => call("POST", "/agent/hook", { cwd: repo, session_id: "s1", ...payload });
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "Agrega el total mensual" });
    await hook({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(repo, "total.ts") } });
    await writeFile(join(repo, "total.ts"), "export const total = 0;\n");

    const transcript = join(claudeHome, "projects", "x", "s1.jsonl");
    await mkdir(join(claudeHome, "projects", "x"), { recursive: true });
    await writeFile(
      transcript,
      [
        JSON.stringify({ type: "user", message: { content: "hola" } }),
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Listo: agregué **total.ts**." }] } }),
      ].join("\n"),
    );
    await hook({ hook_event_name: "Stop", transcript_path: transcript });
    await Bun.sleep(300);

    const list = (await call("GET", `/projects/${projectId}/turns`)).data;
    expect(list[0]).toMatchObject({ prompt: "Agrega el total mensual", summary: "Listo: agregué **total.ts**.", branch: "main" });
    expect(list[0].files).toEqual([{ path: "total.ts", insertions: 1, deletions: 0, binary: false }]);
    expect(list[0].steps.map((x: any) => x.label)).toEqual(["Escribe"]);
    const turn = (await call("GET", `/projects/${projectId}/turns/${list[0].id}`)).data;
    expect(turn.patch).toContain("+export const total = 0;");
    expect(turn.patch).not.toContain("a = 2");
  });

  test("a turn that changed nothing (just a question) leaves no summary", async () => {
    const before = (await call("GET", `/projects/${projectId}/turns`)).data.length;
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s3", hook_event_name: "UserPromptSubmit", prompt: "¿Qué hace createApp?" });
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s3", hook_event_name: "Stop", last_assistant_message: "Crea la app." });
    await Bun.sleep(300);
    expect((await call("GET", `/projects/${projectId}/turns`)).data.length).toBe(before);
  });

  test("a message sent while the agent works joins the same turn", async () => {
    const hook = (payload: object) => call("POST", "/agent/hook", { cwd: repo, session_id: "s4", ...payload });
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "Agrega el filtro por categoría" });
    await hook({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(repo, "filtro.ts") } });
    await writeFile(join(repo, "filtro.ts"), "export const filtro = 1;\n");
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "Y que también filtre por fecha" });
    await writeFile(join(repo, "fecha.ts"), "export const fecha = 1;\n");
    await hook({ hook_event_name: "Stop", last_assistant_message: "Listo, filtros por categoría y fecha." });
    await Bun.sleep(300);
    const [turn] = (await call("GET", `/projects/${projectId}/turns`)).data;
    expect(turn.prompt).toBe("Agrega el filtro por categoría\n\nY que también filtre por fecha");
    expect(turn.files.map((f: any) => f.path).sort()).toEqual(["fecha.ts", "filtro.ts"]);
  });

  test("a turn whose Stop never came is summarized when the next request arrives", async () => {
    const hook = (payload: object) => call("POST", "/agent/hook", { cwd: repo, session_id: "s5", ...payload });
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "Primer pedido" });
    await writeFile(join(repo, "primero.ts"), "export {};\n");
    // No Stop; after a while (the live view goes idle) the next request comes in.
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s5", hook_event_name: "SessionStart" });
    live.forget(projectId);
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "Segundo pedido", last_assistant_message: "Hice el primero." });
    await Bun.sleep(300);
    const first = (await call("GET", `/projects/${projectId}/turns`)).data.find((t: any) => t.prompt === "Primer pedido");
    expect(first).toMatchObject({ files: [{ path: "primero.ts" }] });
    expect(first.endedAt).not.toBeNull();
  });

  test("a session started outside the repo is tracked from the first file it touches", async () => {
    const outside = join(tmp, "fuera");
    await mkdir(outside, { recursive: true });
    const hook = (payload: object) => call("POST", "/agent/hook", { cwd: outside, session_id: "s6", ...payload });
    await hook({ hook_event_name: "UserPromptSubmit", prompt: "Desde otra carpeta" });
    await hook({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: join(repo, "app.ts") } });
    await writeFile(join(repo, "app.ts"), "export const a = 99;\n");
    await hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `cd ${repo} && bun test` } });
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s6", hook_event_name: "Stop", last_assistant_message: "Cambié app.ts." });
    await Bun.sleep(300);
    const [turn] = (await call("GET", `/projects/${projectId}/turns`)).data;
    expect(turn).toMatchObject({ prompt: "Desde otra carpeta", summary: "Cambié app.ts.", files: [{ path: "app.ts" }] });
  });

  test("transcripts outside the Claude folder are never read", async () => {
    const outside = join(tmp, "secret.jsonl");
    await writeFile(outside, JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "secreto" }] } }));
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s2", hook_event_name: "UserPromptSubmit", prompt: "x" });
    await writeFile(join(repo, "otro.ts"), "export {};\n");
    await call("POST", "/agent/hook", { cwd: repo, session_id: "s2", hook_event_name: "Stop", transcript_path: outside });
    await Bun.sleep(300);
    expect((await call("GET", `/projects/${projectId}/turns`)).data[0].summary).toBe("");
  });
});

describe("worktrees and previews", () => {
  test("lists checkouts with progress, previews files and diffs a worktree", async () => {
    const wt = join(tmp, "wt-total");
    await run(["worktree", "add", "-q", "-b", "agente/total", wt]);
    await writeFile(join(wt, "nuevo.ts"), "export const n = 1;\n");

    const { data } = await call("GET", `/projects/${projectId}/repo/worktrees`);
    expect(data.base).toBe("main");
    const other = data.worktrees.find((w: any) => w.path === wt);
    expect(other).toMatchObject({ branch: "agente/total", main: false, progress: { ahead: 0, dirty: 1 } });

    // Hooks from inside the worktree belong to the same project.
    await call("POST", "/agent/hook", { cwd: wt, hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: join(wt, "nuevo.ts") } });
    expect((await call("GET", `/projects/${projectId}/live`)).data.status).toBe("working");

    const diff = (await call("GET", `/projects/${projectId}/repo/worktree-diff?worktree=${encodeURIComponent(wt)}`)).data;
    expect(diff.files.map((f: any) => f.path)).toEqual(["nuevo.ts"]);
    const file = (await call("GET", `/projects/${projectId}/repo/file?path=nuevo.ts&worktree=${encodeURIComponent(wt)}`)).data;
    expect(file.content).toBe("export const n = 1;\n");
    expect((await call("GET", `/projects/${projectId}/repo/file?path=x&worktree=${encodeURIComponent(tmp)}`)).status).toBe(400);
    expect((await call("GET", `/projects/${projectId}/repo/file?path=../secret.jsonl`)).status).toBe(400);
  });
});

describe("importing requirements", () => {
  test("markdown with criteria becomes requirements; missing type and area are inferred", async () => {
    const res = await call("POST", `/projects/${projectId}/requirements/import`, {
      text: "## Exportar gastos a CSV\n- [ ] Descarga un archivo\n\n## Cifrar los datos en reposo\n",
    });
    expect(res.status).toBe(201);
    expect(res.data.created).toBe(2);
    const reqs = (await call("GET", `/projects/${projectId}`)).data.requirements;
    expect(reqs.find((r: any) => r.title === "Cifrar los datos en reposo")).toMatchObject({ type: "non_functional", area: "security" });
    expect((await call("POST", `/projects/${projectId}/requirements/import`, { text: "nada" })).status).toBe(400);
  });

  test("switching type picks an area that fits", async () => {
    const r = (await call("POST", `/projects/${projectId}/requirements`, { title: "Pantalla de resumen" })).data;
    const view = async () => (await call("GET", `/projects/${projectId}`)).data.requirements.find((x: any) => x.id === r.id);
    expect(await view()).toMatchObject({ type: "functional", area: "backend" });
    await call("PATCH", `/projects/${projectId}/requirements/${r.id}`, { type: "non_functional" });
    expect((await view()).type).toBe("non_functional");
    expect(["performance", "security", "ux", "accessibility", "reliability", "scalability", "maintainability", "compatibility"]).toContain((await view()).area);
  });
});
