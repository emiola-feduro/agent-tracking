// Browser check: an MCP call makes the feature, the file and its symbols show up without a reload.
// Needs a running server on a spare port and playwright plus the MCP SDK in a folder outside the repo:
//
//   PORT=4401 AGENT_TRACKING_DB=/tmp/at-e2e.db bun packages/server/src/index.ts   (after bun run build:web)
//   mkdir /tmp/at-tools && cd /tmp/at-tools && bun add playwright@1 @modelcontextprotocol/sdk
//   cp scripts/e2e-mcp-live.ts /tmp/at-tools/ && bun /tmp/at-tools/e2e-mcp-live.ts
//
// Env: AT_BASE (default http://127.0.0.1:4401), AT_REPO_ROOT (this checkout), CHROMIUM (executable path).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium } from "playwright";

const BASE = process.env.AT_BASE ?? "http://127.0.0.1:4401";
const REPO = `/tmp/at-e2e-repo-${Date.now()}`;
await Bun.spawn(["git", "init", "-q", "-b", "main", REPO]).exited;
const OUT = process.env.AT_OUT ?? "/tmp";
const ROOT = process.env.AT_REPO_ROOT ?? `${process.env.HOME}/agent-tracking`;

const res = await fetch(`${BASE}/api/projects`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Tienda demo",
    platforms: ["web"],
    repoPath: REPO,
    requirements: [{ title: "Checkout", dod: [{ criterion: "Paga con tarjeta" }] }],
  }),
});
const view = await res.json();
const projectId = view.project.id;
const reqId = view.requirements[0].id;
const dodId = view.dod[0].id;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let loads = 0;
page.on("load", () => loads++);
await page.goto(`${BASE}/projects/${projectId}?tab=traceability`);
await page.getByText("Ningún agente ha empezado un feature aquí.").waitFor();
await page.screenshot({ path: `${OUT}/1-before.png`, fullPage: true });
const loadsBefore = loads;

// A real agent path: the stdio entrypoint, proxied to the running server's /mcp.
const client = new Client({ name: "claude-code", version: "1" });
await client.connect(
  new StdioClientTransport({
    command: "bun",
    args: [`${ROOT}/packages/mcp/src/stdio.ts`, "--project", REPO, "--url", BASE],
    cwd: REPO,
  }),
);
const call = async (name: string, args: Record<string, unknown>) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  if (r.isError) throw new Error(`${name}: ${r.content[0]!.text}`);
  try { return JSON.parse(r.content[0]!.text); } catch { return r.content[0]!.text; }
};
await call("get_project_context", {});
const { featureId } = await call("start_feature", { requirementId: reqId, name: "Pago con tarjeta", description: "Cobro con Stripe" });
await call("report_file", { path: "src/checkout/pay.ts", purpose: "Cobra el pedido con la pasarela", featureIds: [featureId] });
await call("report_symbol", { path: "src/checkout/pay.ts", name: "chargeOrder", kind: "function", lineStart: 12, lineEnd: 48, purpose: "Crea el cargo y guarda el recibo" });
await call("report_symbol", { path: "src/checkout/pay.ts", name: "PaymentResult", kind: "type", lineStart: 3 });

await page.getByText("Pago con tarjeta").waitFor({ timeout: 5000 });
await page.getByText("src/checkout/pay.ts").waitFor({ timeout: 5000 });
await page.getByText("chargeOrder").waitFor({ timeout: 5000 });
await page.getByText("PaymentResult").waitFor({ timeout: 5000 });
if (loads !== loadsBefore) throw new Error("La página se recargó");
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/2-traceability.png`, fullPage: true });
console.log("OK traceability updated live, page loads:", loads);

await page.getByRole("tab", { name: "Actividad" }).click();
await page.getByText("reportó el tipo").waitFor({ timeout: 5000 });
await call("report_test", { path: "src/checkout/pay.test.ts", name: "cobra un pedido válido", featureId, type: "unit", result: "passing" });
await call("mark_dod_item", { dodId, evidence: "src/checkout/pay.test.ts" });
await call("suggest_test_idea", { text: "Tarjeta rechazada por fondos insuficientes", featureId });
await call("complete_feature", { featureId, summary: "Cobro listo con tests" });
await page.getByText("terminó el feature").waitFor({ timeout: 5000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/3-activity.png`, fullPage: true });

await page.getByRole("tab", { name: /^Tests/ }).click();
await page.getByText("cobra un pedido válido").waitFor();
await page.getByText("Tarjeta rechazada por fondos insuficientes").waitFor();
await page.getByLabel("Nueva idea de test").fill("Pago duplicado por doble clic");
await page.getByRole("button", { name: "Agregar idea" }).click();
await page.getByText("Pago duplicado por doble clic").waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/4-tests.png`, fullPage: true });
await page.setViewportSize({ width: 380, height: 800 });
await page.getByRole("tab", { name: "Trazabilidad" }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/5-mobile.png`, fullPage: true });
if (loads !== loadsBefore) throw new Error("La página se recargó");
console.log("OK all, page loads:", loads);
await client.close();
await browser.close();
