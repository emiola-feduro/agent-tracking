import { describe, expect, test } from "bun:test";
import { launchCommand, launchPrompt } from "./launch";

describe("launching agents", () => {
  test("the prompt names the requirement by code and asks for context, a branch, tests and the report", () => {
    const prompt = launchPrompt({ project: "Tienda", requirement: { code: "RF3", title: "Pagos", description: "Con tarjeta" }, instructions: "Usa Stripe" });
    expect(prompt).toContain("RF3 «Pagos»");
    expect(prompt).toContain('get_requirement con "RF3"');
    expect(prompt).toContain("rama feat/ o fix/");
    expect(prompt).toContain("submit_report");
    expect(prompt).toContain("Con tarjeta");
    expect(prompt).toContain("Usa Stripe");
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
