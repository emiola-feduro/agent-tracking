import { describe, expect, test } from "bun:test";
import { adapterFor, agentForClient, agentLabel, AGENTS } from "./index";

/** Payload shapes as documented by each agent (field names from their hook references). */
const CODEX = {
  prompt: { session_id: "c1", transcript_path: "/x.jsonl", cwd: "/repo", hook_event_name: "UserPromptSubmit", model: "gpt", turn_id: "t1", prompt: "Agrega el filtro" },
  tool: { session_id: "c1", cwd: "/repo", hook_event_name: "PreToolUse", turn_id: "t1", tool_name: "shell", tool_use_id: "u1", tool_input: { command: ["bash", "-lc", "bun test"] } },
  patch: { session_id: "c1", cwd: "/repo", hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { input: "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-a\n+b\n*** Add File: src/b.ts\n+x\n*** End Patch" } },
  stop: { session_id: "c1", cwd: "/repo", hook_event_name: "Stop", turn_id: "t1", stop_hook_active: false, last_assistant_message: "Listo: agregué el filtro." },
};
const GEMINI = {
  prompt: { session_id: "g1", transcript_path: "/t.json", cwd: "/repo", hook_event_name: "BeforeAgent", timestamp: "2026-11-25T10:00:00Z", prompt: "Hazlo" },
  tool: { session_id: "g1", cwd: "/repo", hook_event_name: "BeforeTool", tool_name: "replace", tool_input: { file_path: "/repo/src/a.ts", old_string: "a", new_string: "secreto" } },
  shell: { session_id: "g1", cwd: "/repo", hook_event_name: "BeforeTool", tool_name: "run_shell_command", tool_input: { command: "npm test", description: "Corre los tests" } },
  stop: { session_id: "g1", cwd: "/repo", hook_event_name: "AfterAgent", prompt: "Hazlo", prompt_response: "Hecho.", stop_hook_active: false },
  model: { session_id: "g1", cwd: "/repo", hook_event_name: "BeforeModel", llm_request: {} },
};

describe("adapters", () => {
  test("Codex hooks keep their names; the last answer comes with Stop", () => {
    const codex = adapterFor("codex")!;
    expect(codex.normalize(CODEX.prompt)).toMatchObject({ agent: "codex", hook_event_name: "UserPromptSubmit", session_id: "c1", prompt: "Agrega el filtro" });
    expect(codex.normalize(CODEX.stop)).toMatchObject({ hook_event_name: "Stop", last_assistant_message: "Listo: agregué el filtro." });
    expect(codex.describeTool("shell", CODEX.tool.tool_input)).toEqual({ label: "Ejecuta", target: "bun test" });
    expect(codex.describeTool("apply_patch", CODEX.patch.tool_input)).toEqual({ label: "Edita", target: "src/a.ts, src/b.ts" });
    expect(codex.describeTool("mcp__agent-tracking__submit_report", {})).toEqual({ label: "Agent Tracking", target: "submit report" });
  });

  test("Gemini events are translated; contents are never kept", () => {
    const gemini = adapterFor("gemini-cli")!;
    expect(gemini.normalize(GEMINI.prompt)).toMatchObject({ agent: "gemini-cli", hook_event_name: "UserPromptSubmit", prompt: "Hazlo" });
    expect(gemini.normalize(GEMINI.tool)).toMatchObject({ hook_event_name: "PreToolUse", tool_name: "replace" });
    expect(gemini.normalize(GEMINI.stop)).toMatchObject({ hook_event_name: "Stop", last_assistant_message: "Hecho." });
    expect(gemini.normalize(GEMINI.model)).toBeNull();
    const step = gemini.describeTool("replace", GEMINI.tool.tool_input);
    expect(step).toEqual({ label: "Edita", target: "/repo/src/a.ts" });
    expect(JSON.stringify(step)).not.toContain("secreto");
    expect(gemini.describeTool("run_shell_command", GEMINI.shell.tool_input)).toEqual({ label: "Ejecuta", target: "Corre los tests" });
    expect(gemini.describeTool("mcp_agent-tracking_submit_report", {})).toMatchObject({ label: "Agent Tracking" });
  });

  test("Claude Code stays the default and unknown agents are refused", () => {
    expect(adapterFor(undefined)!.kind).toBe("claude-code");
    expect(adapterFor("otro")).toBeNull();
    expect(AGENTS["claude-code"].normalize({ cwd: "/r", hook_event_name: "PostToolUse" })).toBeNull();
  });

  test("MCP client names and labels", () => {
    expect(agentForClient("codex-mcp-client")).toBe("codex");
    expect(agentForClient("gemini-cli-mcp-client")).toBe("gemini-cli");
    expect(agentForClient("claude-code")).toBe("claude-code");
    expect(agentForClient("cursor")).toBeNull();
    expect(agentLabel("codex")).toBe("Codex CLI");
    expect(agentLabel("cursor")).toBe("cursor");
  });
});
