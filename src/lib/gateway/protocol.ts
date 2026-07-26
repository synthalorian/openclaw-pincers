/**
 * OpenClaw Gateway protocol types (protocol v4).
 * Source of truth: docs/gateway/protocol.md + packages/gateway-protocol schemas.
 */

// ---------- Frames ----------

export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

export interface EventFrame {
  type: "event";
  event: string;
  payload: unknown;
  seq?: number;
  stateVersion?: unknown;
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryAfterMs?: number;
}

// ---------- Handshake ----------

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
  };
  role: "operator" | "node";
  scopes: string[];
  caps: string[];
  commands: string[];
  permissions: Record<string, unknown>;
  auth?: { token?: string };
  locale?: string;
  userAgent?: string;
}

export interface HelloOk {
  type: "hello-ok";
  protocol: number;
  server: { version: string; connId: string };
  features: { methods: string[]; events: string[] };
  snapshot: unknown;
  auth: { role: string; scopes: string[] };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

export interface ConnectChallenge {
  nonce: string;
  ts: number;
}

// ---------- Chat ----------

export interface ChatAttachment {
  type?: string;
  fileName: string;
  mimeType: string;
  content: string; // base64 (data-URL prefix optional — gateway strips it)
}

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  idempotencyKey: string;
  agentId?: string;
  sessionId?: string;
  deliver?: boolean;
  timeoutMs?: number;
  attachments?: ChatAttachment[];
}

export type ChatSendAck =
  | { runId: string; status: "started" }
  | { runId?: string; status: "in_flight" | "ok" };

export interface ChatEventBase {
  runId: string;
  sessionKey: string;
  agentId?: string;
  seq: number;
  message?: unknown;
  usage?: unknown;
}

export type ChatEvent =
  | (ChatEventBase & { state: "delta"; deltaText: string; replace?: boolean })
  | (ChatEventBase & { state: "final"; stopReason?: string })
  | (ChatEventBase & { state: "aborted"; errorMessage?: string; stopReason?: string })
  | (ChatEventBase & {
      state: "error";
      errorMessage?: string;
      errorKind?: "refusal" | "timeout" | "rate_limit" | "context_length" | "unknown";
      stopReason?: string;
    });

export interface ChatHistoryParams {
  sessionKey: string;
  agentId?: string;
  limit?: number;
  offset?: number;
  maxChars?: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  messageId?: string;
  timestamp?: number;
  aborted?: boolean;
  /** Local-only echo of attached images (data URLs), not from history. */
  images?: string[];
}

// ---------- Sessions ----------

export interface SessionRow {
  key: string;
  agentId?: string;
  label?: string;
  displayName?: string;
  kind?: string;
  updatedAt?: number;
  model?: string;
  [k: string]: unknown;
}

export interface SessionCreateParams {
  agentId?: string;
  label?: string;
  currentSessionKey?: string;
  parentSessionKey?: string;
  fork?: boolean;
}

// ---------- Agents ----------

export interface AgentRow {
  agentId: string;
  name?: string;
  identity?: string;
  model?: string;
  workspace?: string;
  agentDir?: string;
  isDefault?: boolean;
  [k: string]: unknown;
}

// ---------- Health / status ----------

export interface HealthSnapshot {
  ok?: boolean;
  [k: string]: unknown;
}
