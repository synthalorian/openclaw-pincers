/**
 * Central app state (Svelte 5 runes).
 */

import { GatewayClient, isChatEvent, type ConnectionStatus } from "$lib/gateway/client";
import type { AgentRow, ChatAttachment, ChatMessage, HelloOk, SessionRow } from "$lib/gateway/protocol";
import { THEMES, type ThemeDef } from "$lib/themes";

const LS_URL = "ocd.gatewayUrl";
const LS_TOKEN = "ocd.token";
const LS_SESSION = "ocd.sessionKey";
const LS_THEME = "ocd.theme";

export type Section =
  | "chat"
  | "agents"
  | "dashboard"
  | "models"
  | "config"
  | "files"
  | "cron"
  | "approvals"
  | "skills"
  | "tools"
  | "logs"
  | "system"
  | "onboarding";

export const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "agents", label: "Agents", icon: "🤖" },
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "models", label: "Models", icon: "🧠" },
  { id: "config", label: "Config", icon: "⚙️" },
  { id: "files", label: "Files", icon: "📁" },
  { id: "cron", label: "Cron", icon: "⏰" },
  { id: "approvals", label: "Approvals", icon: "🛡️" },
  { id: "skills", label: "Skills", icon: "✨" },
  { id: "tools", label: "Tools", icon: "🔧" },
  { id: "logs", label: "Logs", icon: "📜" },
  { id: "system", label: "System", icon: "🖥️" },
  { id: "onboarding", label: "Setup", icon: "🚀" },
];

export type RpcResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

function genIdem(): string {
  return `ocd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

class AppState {
  client = new GatewayClient();

  status = $state<ConnectionStatus>("disconnected");
  hello = $state<HelloOk | null>(null);
  connectError = $state("");
  pairing = $state<{ requestId: string; attempts: number } | null>(null);
  private pairingTimer: ReturnType<typeof setInterval> | null = null;
  section = $state<Section>("chat");
  agents = $state<AgentRow[]>([]);
  themeId = $state(localStorage.getItem(LS_THEME) ?? "grid");

  get theme(): ThemeDef {
    return THEMES.find((t) => t.id === this.themeId) ?? THEMES[0];
  }

  setTheme(id: string) {
    this.themeId = id;
    localStorage.setItem(LS_THEME, id);
    applyTheme(this.theme);
  }

  gatewayUrl = $state(localStorage.getItem(LS_URL) ?? "ws://127.0.0.1:18789");
  token = $state(localStorage.getItem(LS_TOKEN) ?? "");

  sessions = $state<SessionRow[]>([]);
  activeKey = $state(localStorage.getItem(LS_SESSION) ?? "agent:main:main");
  sessionId = $state<string | undefined>(undefined);

  messages = $state<ChatMessage[]>([]);
  draft = $state(""); // streaming assistant text
  activeRunId = $state<string | null>(null);
  loadingHistory = $state(false);
  chatError = $state("");

  constructor() {
    this.client.onStatus((s) => (this.status = s));
    this.client.onEvent((event, payload) => this.handleEvent(event, payload));
    applyTheme(this.theme);
  }

  private handleEvent(event: string, payload: unknown) {
    if (event === "chat" && isChatEvent(payload)) {
      if (payload.sessionKey !== this.activeKey) return;
      if (payload.state === "delta") {
        if (payload.replace) this.draft = payload.deltaText;
        else this.draft += payload.deltaText;
      } else if (payload.state === "final") {
        const text = this.draft || extractFinalText(payload.message);
        if (text) {
          this.messages.push({ role: "assistant", text, timestamp: Date.now() });
        }
        this.draft = "";
        this.activeRunId = null;
      } else if (payload.state === "aborted") {
        if (this.draft) {
          this.messages.push({ role: "assistant", text: this.draft, aborted: true, timestamp: Date.now() });
        }
        this.draft = "";
        this.activeRunId = null;
      } else if (payload.state === "error") {
        this.chatError = payload.errorMessage ?? `Run error (${payload.errorKind ?? "unknown"})`;
        this.draft = "";
        this.activeRunId = null;
      }
    }
    if (event === "connection.closed") {
      this.hello = null;
      this.activeRunId = null;
    }
    if (event === "sessions.changed") {
      void this.refreshSessions();
    }
  }

  async connect() {
    this.connectError = "";
    try {
      const hello = await this.client.connect(this.gatewayUrl.trim(), this.token.trim() || undefined);
      this.hello = hello;
      this.stopPairingRetry();
      localStorage.setItem(LS_URL, this.gatewayUrl.trim());
      localStorage.setItem(LS_TOKEN, this.token.trim());
      await this.refreshSessions();
      await this.refreshAgents();
      await this.loadHistory();
    } catch (err) {
      const e = err as { code?: string; message?: string; details?: unknown };
      if (e?.code === "NOT_PAIRED") {
        // Device pairing pending: surface it and auto-retry until approved.
        const requestId = extractRequestId(e) ?? this.pairing?.requestId ?? "";
        this.pairing = { requestId, attempts: (this.pairing?.attempts ?? 0) + 1 };
        this.startPairingRetry();
        return;
      }
      this.connectError = friendlyConnectError(err);
    }
  }

  private startPairingRetry() {
    if (this.pairingTimer) return;
    this.pairingTimer = setInterval(() => {
      if ((this.pairing?.attempts ?? 0) > 45) {
        // ~3 minutes of retries; give up and show a manual message.
        this.stopPairingRetry();
        this.connectError =
          "Still waiting for pairing approval. Run: openclaw devices list → openclaw devices approve <requestId>, then hit Connect.";
        this.pairing = null;
        return;
      }
      void this.connect();
    }, 4000);
  }

  stopPairingRetry() {
    if (this.pairingTimer) {
      clearInterval(this.pairingTimer);
      this.pairingTimer = null;
    }
    this.pairing = null;
  }

  /** Pull URL + token from the local OpenClaw config via the Rust backend. */
  async detectLocalGateway(): Promise<boolean> {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const found = await invoke<{ url: string; token: string } | null>("local_gateway_auth");
      if (!found) return false;
      this.gatewayUrl = found.url;
      this.token = found.token;
      return true;
    } catch {
      return false;
    }
  }

  disconnect() {
    this.client.close();
    this.hello = null;
    this.messages = [];
    this.draft = "";
    this.activeRunId = null;
  }

  async refreshSessions() {
    try {
      this.sessions = await this.client.listSessions();
    } catch {
      // sessions discovery is best-effort in v0.1
    }
  }

  async refreshAgents() {
    try {
      const res = (await this.client.request("agents.list", {})) as unknown;
      const rows = Array.isArray(res)
        ? res
        : (((res as Record<string, unknown>)?.agents ??
            (res as Record<string, unknown>)?.items ??
            []) as unknown[]);
      this.agents = (Array.isArray(rows) ? rows : []).map((r) => {
        const o = r as Record<string, unknown>;
        const identity = (o.identity ?? {}) as Record<string, unknown>;
        const model = o.model;
        return {
          ...o,
          agentId: String(o.agentId ?? o.id ?? "main"),
          name: (o.name ?? identity.name ?? o.identityName) as string | undefined,
          // model can be a string or an object like { primary: "provider/model" }
          model: (typeof model === "string"
            ? model
            : ((model as Record<string, unknown> | null)?.primary ?? o.effectiveModel)) as
            | string
            | undefined,
          workspace: o.workspace as string | undefined,
          agentDir: (o.agentDir ?? o.agentDirectory) as string | undefined,
          isDefault: Boolean(o.default ?? o.isDefault),
        } as AgentRow;
      });
    } catch {
      this.agents = [];
    }
  }

  /**
   * Create a fresh session (optionally for a specific agent + label),
   * refresh the session index, jump to it in Chat, and return its key.
   */
  async createSession(opts: { agentId?: string; label?: string }): Promise<string> {
    const params: Record<string, unknown> = {};
    if (opts.agentId?.trim()) params.agentId = opts.agentId.trim();
    if (opts.label?.trim()) params.label = opts.label.trim();
    const key = await this.client.createSession(params);
    await this.refreshSessions();
    this.section = "chat";
    await this.selectSession(key);
    return key;
  }

  /** Generic RPC passthrough for section views. Never throws. */
  async rpc(method: string, params?: unknown): Promise<RpcResult> {
    try {
      const data = await this.client.request(method, params);
      return { ok: true, data };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      return { ok: false, error: e?.code ? `${e.code}: ${e.message}` : String(e?.message ?? err) };
    }
  }

  async selectSession(key: string) {
    if (key === this.activeKey) return;
    this.activeKey = key;
    localStorage.setItem(LS_SESSION, key);
    this.messages = [];
    this.draft = "";
    this.chatError = "";
    await this.loadHistory();
  }

  async loadHistory() {
    this.loadingHistory = true;
    this.chatError = "";
    try {
      const { messages, sessionId } = await this.client.chatHistory({
        sessionKey: this.activeKey,
        limit: 200,
      });
      this.messages = messages;
      if (sessionId) this.sessionId = sessionId;
    } catch (err) {
      this.chatError = err instanceof Error ? err.message : String(err);
    } finally {
      this.loadingHistory = false;
    }
  }

  async send(text: string, attachments?: ChatAttachment[], localImages?: string[]) {
    const message = text.trim();
    if ((!message && !attachments?.length) || this.status !== "connected") return;
    this.chatError = "";
    this.messages.push({ role: "user", text: message, images: localImages, timestamp: Date.now() });
    try {
      const ack = await this.client.chatSend({
        sessionKey: this.activeKey,
        message: message || "[image]",
        idempotencyKey: genIdem(),
        sessionId: this.sessionId,
        attachments,
      });
      if (ack.runId) this.activeRunId = ack.runId;
    } catch (err) {
      this.chatError = err instanceof Error ? err.message : String(err);
      this.messages.push({ role: "assistant", text: `⚠ send failed: ${this.chatError}`, timestamp: Date.now() });
    }
  }

  async abort() {
    try {
      await this.client.chatAbort(this.activeKey, this.activeRunId ?? undefined);
    } catch (err) {
      this.chatError = err instanceof Error ? err.message : String(err);
    }
  }
}

function extractRequestId(err: { details?: unknown; message?: string }): string | null {
  const d = err.details as Record<string, unknown> | undefined;
  const fromDetails = (d?.requestId ?? d?.pairingRequestId) as string | undefined;
  if (fromDetails) return fromDetails;
  const m = err.message?.match(/requestId:\s*([0-9a-f-]+)/i);
  return m?.[1] ?? null;
}

function friendlyConnectError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const msg = e?.message ?? String(err);
  if (e?.code === "AUTH_TOKEN_MISSING" || msg.includes("token missing")) {
    return "This gateway requires an auth token. Hit “Detect local gateway” or paste the token from ~/.openclaw/openclaw.json (gateway.auth.token).";
  }
  if (e?.code === "NOT_PAIRED" || msg.includes("pairing")) {
    return "This device needs pairing approval. Approve it with: openclaw devices approve";
  }
  if (msg.includes("WebSocket error") || msg.includes("closed during handshake")) {
    return "Can't reach the gateway at that URL. Is OpenClaw running? (openclaw gateway status)";
  }
  return msg;
}

function extractFinalText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const o = message as Record<string, unknown>;
  if (typeof o.text === "string") return o.text;
  if (Array.isArray(o.content)) {
    return (o.content as unknown[])
      .map((b) =>
        b && typeof b === "object" && typeof (b as Record<string, unknown>).text === "string"
          ? (b as Record<string, string>).text
          : "",
      )
      .join("");
  }
  return "";
}

export function applyTheme(theme: ThemeDef) {
  // Reset to :root defaults, then overlay theme vars.
  const style = document.documentElement.style;
  for (const key of Object.keys(THEMES[1].vars)) style.removeProperty(key);
  for (const [k, v] of Object.entries(theme.vars)) style.setProperty(k, v);
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.style.colorScheme = theme.dark ? "dark" : "light";
}

export const app = new AppState();
