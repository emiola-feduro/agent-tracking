import { claudeCode } from "./claude-code";
import { codex } from "./codex";
import { geminiCli } from "./gemini-cli";
import { AGENT_KINDS, type AgentAdapter, type AgentKind } from "./types";

export * from "./types";
export { claudeLastMessage } from "./claude-code";

export const AGENTS: Record<AgentKind, AgentAdapter> = { "claude-code": claudeCode, codex, "gemini-cli": geminiCli };

export const isAgentKind = (v: unknown): v is AgentKind => AGENT_KINDS.includes(v as AgentKind);

/** The adapter for a hook endpoint's `?agent=`; Claude Code when missing, as before. */
export const adapterFor = (kind: string | undefined | null): AgentAdapter | null => (!kind ? claudeCode : isAgentKind(kind) ? AGENTS[kind] : null);

/** The agent behind an MCP client name, or null when unknown. */
export const agentForClient = (clientName: string | undefined | null): AgentKind | null => {
  const name = (clientName ?? "").toLowerCase();
  return (Object.values(AGENTS).find((a) => a.clientNames.some((c) => name === c || name.startsWith(`${c}-`)))?.kind ?? null) as AgentKind | null;
};

/** Spanish-friendly name of an agent kind, or the raw name for agents Agent Tracking does not know. */
export const agentLabel = (agent: string | null | undefined) => (agent && isAgentKind(agent) ? AGENTS[agent].label : agent || "Agente");
