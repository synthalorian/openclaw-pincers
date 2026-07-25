/**
 * Central app state (Svelte 5 runes).
 */

import { GatewayClient, isChatEvent, type ConnectionStatus } from "$lib/gateway/client";
import type { ChatMessage, HelloOk, SessionRow } from "$lib/gateway/protocol";

const LS_URL = "ocd.gatewayUrl";
const LS_TOKEN = "ocd.token";
const LS_SESSION = "ocd.sessionKey";

function genIdem(): string {
  return `ocd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

class AppState {
  client = new GatewayClient();

  status = $state<ConnectionStatus>("disconnected");
  hello = $state<HelloOk | null>(null);
  connectError = $state("");

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
      localStorage.setItem(LS_URL, this.gatewayUrl.trim());
      localStorage.setItem(LS_TOKEN, this.token.trim());
      await this.refreshSessions();
      await this.loadHistory();
    } catch (err) {
      this.connectError = friendlyConnectError(err);
    }
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

  async send(text: string) {
    const message = text.trim();
    if (!message || this.status !== "connected") return;
    this.chatError = "";
    this.messages.push({ role: "user", text: message, timestamp: Date.now() });
    try {
      const ack = await this.client.chatSend({
        sessionKey: this.activeKey,
        message,
        idempotencyKey: genIdem(),
        sessionId: this.sessionId,
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

export const app = new AppState();
