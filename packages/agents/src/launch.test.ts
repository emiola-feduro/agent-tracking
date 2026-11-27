import { describe, expect, test } from "bun:test";
import { launchCommand, launchLabel, launchPrompt, type LaunchItem } from "./launch";

const pagos: LaunchItem = {
  requirement: { code: "RF3", title: "Pagos", description: "Con tarjeta" },
  criteria: [{ id: "d1", criterion: "Cobra con Visa" }],
  onlyCriteria: false,
};
const login: LaunchItem = { requirement: { code: "RF5", title: "Login" }, criteria: [{ id: "d7", criterion: "Bloquea tras 5 intentos" }, { id: "d8", criterion: "Recupera la clave" }], onlyCriteria: true };

describe("launching agents", () => {
  test("one requirement: named by code, with its criteria, context, branch, tests and report", () => {
    const prompt = launchPrompt({ project: "Tienda", items: [pagos], instructions: "Usa Stripe" });
    expect(prompt).toContain("El requerimiento RF3 «Pagos» completo.");
    expect(prompt).toContain("Cobra con Visa (id d1)");
    expect(prompt).toContain('get_requirement con "RF3"');
    expect(prompt).toContain("rama feat/ o fix/");
    expect(prompt).toContain("submit_report");
    expect(prompt).toContain("Con tarjeta");
    expect(prompt).toContain("Usa Stripe");
    expect(prompt).not.toContain("1. El requerimiento");
  });

  test("several tasks go in order, and criteria alone say so", () => {
    const prompt = launchPrompt({ project: "Tienda", items: [pagos, login] });
    expect(prompt).toContain("implementa estas tareas en orden");
    expect(prompt.indexOf("1. El requerimiento RF3")).toBeLessThan(prompt.indexOf("2. Del requerimiento RF5 «Login», solo estos criterios"));
    expect(prompt).toContain("Recupera la clave (id d8)");
    expect(prompt).toContain('"RF3", "RF5"');
    expect(launchLabel([pagos, login])).toBe("RF3 y 2 criterios de RF5");
    expect(launchLabel([{ ...login, criteria: [login.criteria[0]!] }])).toBe("1 criterio de RF5");
  });

  test("each agent gets its non-interactive mode, permission level and model", () => {
    expect(launchCommand("claude-code", "x", "safe")).toEqual(["claude", "-p", "--permission-mode", "auto", "x"]);
    expect(launchCommand("claude-code", "x", "full", "claude-haiku-5-5")).toEqual(["claude", "-p", "--permission-mode", "bypassPermissions", "--model", "claude-haiku-5-5", "x"]);
    expect(launchCommand("codex", "x", "safe")).toEqual(["codex", "exec", "--full-auto", "x"]);
    expect(launchCommand("codex", "x", "full", "gpt-6.2-sol")).toEqual(["codex", "exec", "--dangerously-bypass-approvals-and-sandbox", "-m", "gpt-6.2-sol", "x"]);
    expect(launchCommand("gemini-cli", "x", "safe")).toEqual(["gemini", "--approval-mode", "auto_edit", "-p", "x"]);
    expect(launchCommand("gemini-cli", "x", "full")).toEqual(["gemini", "--approval-mode", "yolo", "-p", "x"]);
  });
});
