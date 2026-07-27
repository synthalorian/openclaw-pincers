/**
 * Slash command registry + parser for the chat composer.
 *
 * Mirrors the OpenClaw Control UI command catalog. Three execution paths:
 *  - local:   handled client-side (session lifecycle that must not desync the UI)
 *  - gateway: sent through chat.send; the gateway executes and replies in-stream
 *
 * Verified against gateway 2026.7.1-2: slash commands sent via chat.send from a
 * gateway-client (mode ui) ARE executed server-side and the result arrives as a
 * normal chat final event (message.content[].text, provider "openclaw").
 */

export type SlashCategory = "session" | "options" | "status" | "management" | "tools" | "media";

export interface SlashCommand {
  key: string;
  description: string;
  /** Usage hint shown in the menu, e.g. "<level|default>". Absent = no args. */
  args?: string;
  category: SlashCategory;
  /** Client-side handling. Everything else passes through to the gateway. */
  local?: "new" | "stop" | "clear";
  /** After the gateway ack, drop stale sessionId + reload transcript. */
  resetsTranscript?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // --- Session lifecycle ---
  { key: "new", description: "Start a fresh session (creates and switches to it)", args: "[model]", category: "session", local: "new" },
  { key: "reset", description: "Reset the current session in place", args: "[soft [message]]", category: "session", resetsTranscript: true },
  { key: "stop", description: "Abort the current run", category: "session", local: "stop" },
  { key: "clear", description: "Clear the chat view locally (does not touch the gateway)", category: "session", local: "clear" },
  { key: "name", description: "Name or rename the current session", args: "<title>", category: "session" },
  { key: "compact", description: "Compact the session context", args: "[instructions]", category: "session" },
  { key: "session", description: "Thread-binding idle/max-age expiry", args: "<idle|max-age> <duration|off>", category: "session" },
  { key: "export-session", description: "Export the current session to HTML", args: "[path]", category: "session" },
  { key: "export-trajectory", description: "Export a JSONL trajectory bundle", args: "[path]", category: "session" },

  // --- Model & run controls ---
  { key: "model", description: "Show or set the model ('default' clears the pin)", args: "[name|#|status]", category: "options" },
  { key: "models", description: "List configured providers/models", args: "[provider]", category: "options" },
  { key: "think", description: "Set thinking level", args: "<level|default>", category: "options" },
  { key: "fast", description: "Show/set fast mode", args: "[status|auto|on|off|default]", category: "options" },
  { key: "verbose", description: "Toggle verbose output", args: "<on|off|full>", category: "options" },
  { key: "reasoning", description: "Toggle reasoning visibility", args: "[on|off|stream]", category: "options" },
  { key: "trace", description: "Toggle plugin trace lines", args: "<on|off>", category: "options" },
  { key: "elevated", description: "Toggle elevated mode", args: "[on|off|ask|full]", category: "options" },
  { key: "exec", description: "Show or set exec defaults", args: "host=<…> security=<…> ask=<…>", category: "options" },
  { key: "queue", description: "Active-run queue behavior", args: "<steer|followup|collect|interrupt>", category: "options" },
  { key: "usage", description: "Usage footer or cost summary", args: "<off|tokens|full|reset|cost>", category: "options" },

  // --- Discovery & status ---
  { key: "help", description: "Short help summary", category: "status" },
  { key: "commands", description: "Full command catalog", category: "status" },
  { key: "status", description: "Runtime status + provider usage", args: "[plugins]", category: "status" },
  { key: "tools", description: "What the agent can use right now", args: "[compact|verbose]", category: "status" },
  { key: "whoami", description: "Show your sender id", category: "status" },
  { key: "tasks", description: "Active/recent background tasks", category: "status" },
  { key: "context", description: "Explain how context is assembled", args: "[list|detail|map|json]", category: "status" },
  { key: "goal", description: "Manage the session goal", args: "[status|start|pause|resume|complete|…]", category: "status" },

  // --- Management ---
  { key: "approve", description: "Resolve an exec/plugin approval", args: "<id> <decision>", category: "management" },
  { key: "steer", description: "Inject guidance into the active run", args: "<message>", category: "management" },
  { key: "btw", description: "Side question without changing session context", args: "<question>", category: "management" },
  { key: "subagents", description: "Inspect sub-agent runs", args: "<list|log|info>", category: "management" },
  { key: "agents", description: "List thread-bound agents", category: "management" },
  { key: "config", description: "Read/write openclaw.json (owner)", args: "<show|get|set|unset> …", category: "management" },
  { key: "mcp", description: "Read/write MCP server config (owner)", args: "<show|get|set|unset> …", category: "management" },
  { key: "plugins", description: "Plugin discovery + enable/disable (owner)", args: "[list|show|enable|disable] …", category: "management" },
  { key: "debug", description: "Runtime-only config overrides (owner)", args: "<show|set|unset|reset> …", category: "management" },
  { key: "restart", description: "Restart OpenClaw", category: "management" },
  { key: "send", description: "Set send policy", args: "<on|off|inherit>", category: "management" },
  { key: "activation", description: "Group activation mode", args: "<mention|always>", category: "management" },
  { key: "allowlist", description: "Manage allowlist entries", args: "[list|add|remove] …", category: "management" },

  // --- Tools & media ---
  { key: "skill", description: "Run a skill by name", args: "<name> [input]", category: "tools" },
  { key: "learn", description: "Draft a reusable skill from recent work", args: "[request]", category: "tools" },
  { key: "tts", description: "Control text-to-speech", args: "<on|off|status|…>", category: "media" },
];

const BY_KEY = new Map(SLASH_COMMANDS.map((c) => [c.key, c]));

export function getCommand(key: string): SlashCommand | undefined {
  return BY_KEY.get(key.toLowerCase());
}

/** Parse "/key args" or "/key: args". Returns null when not a command-shaped message. */
export function parseSlashCommand(text: string): { key: string; args: string } | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const m = t.match(/^\/([a-zA-Z0-9_-]+)(?:\s*:\s*|\s+|$)([\s\S]*)$/);
  if (!m) return null;
  return { key: m[1].toLowerCase(), args: m[2].trim() };
}

/** Prefix filter for the autocomplete menu. Empty query returns the full catalog. */
export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  if (!q) return SLASH_COMMANDS;
  const prefix = SLASH_COMMANDS.filter((c) => c.key.startsWith(q));
  const fuzzy = SLASH_COMMANDS.filter(
    (c) => !c.key.startsWith(q) && (c.key.includes(q) || c.description.toLowerCase().includes(q)),
  );
  return [...prefix, ...fuzzy];
}
