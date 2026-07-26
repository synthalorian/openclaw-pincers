/**
 * GatewayClient — thin typed client for the OpenClaw Gateway WS protocol (v4).
 *
 * Transport: WebSocket, JSON text frames.
 * First frame must be `connect` (after the gateway's `connect.challenge`).
 */

import { invoke } from "@tauri-apps/api/core";

import type {
  ChatEvent,
  ChatHistoryParams,
  ChatMessage,
  ChatSendAck,
  ChatSendParams,
  ConnectChallenge,
  ErrorShape,
  EventFrame,
  GatewayFrame,
  HelloOk,
  SessionCreateParams,
  SessionRow,
} from "./protocol";

export const PROTOCOL_VERSION = 4;

// Gateway client.id is a closed enum (see ConnectParamsSchema).
// External apps use the generic "gateway-client" id + "ui" mode.
export const CLIENT_ID = "gateway-client";
export const CLIENT_DISPLAY_NAME = "OpenClaw Desktop";
export const CLIENT_VERSION = "0.1.0";
export const CLIENT_MODE = "ui";
export const ROLE = "operator";
export const SCOPES = ["operator.read", "operator.write"];

interface DeviceIdentityInfo {
  deviceId: string;
  publicKeyB64u: string;
}

/** Device identity + v3 signature from the Rust backend (key never leaves native code). */
async function buildDeviceParams(
  nonce: string,
  token: string,
  platform: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const id = await invoke<DeviceIdentityInfo>("device_identity");
    const signedAt = Date.now();
    // buildDeviceAuthPayloadV3: v3|deviceId|clientId|clientMode|role|scopes|signedAt|token|nonce|platform|deviceFamily
    const payload = [
      "v3",
      id.deviceId,
      CLIENT_ID,
      CLIENT_MODE,
      ROLE,
      SCOPES.join(","),
      String(signedAt),
      token,
      nonce,
      platform.toLowerCase(),
      "", // deviceFamily (unused)
    ].join("|");
    const signature = await invoke<string>("sign_device_payload", { payload });
    return {
      id: id.deviceId,
      publicKey: id.publicKeyB64u,
      signature,
      signedAt,
      nonce,
    };
  } catch (err) {
    console.warn("device identity unavailable (running outside Tauri?):", err);
    return undefined;
  }
}

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

type EventHandler = (event: string, payload: unknown) => void;
type StatusHandler = (status: ConnectionStatus) => void;

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: GatewayError) => void;
  method: string;
}

export class GatewayError extends Error {
  code: string;
  details?: unknown;
  retryAfterMs?: number;

  constructor(shape: ErrorShape) {
    super(shape.message || shape.code);
    this.code = shape.code;
    this.details = shape.details;
    this.retryAfterMs = shape.retryAfterMs;
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers = new Set<EventHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private helloOk: HelloOk | null = null;
  status: ConnectionStatus = "disconnected";

  get hello(): HelloOk | null {
    return this.helloOk;
  }

  onEvent(cb: EventHandler): () => void {
    this.eventHandlers.add(cb);
    return () => this.eventHandlers.delete(cb);
  }

  onStatus(cb: StatusHandler): () => void {
    this.statusHandlers.add(cb);
    return () => this.statusHandlers.delete(cb);
  }

  private setStatus(s: ConnectionStatus) {
    this.status = s;
    for (const cb of this.statusHandlers) cb(s);
  }

  private emit(event: string, payload: unknown) {
    for (const cb of this.eventHandlers) cb(event, payload);
  }

  /** Connect, perform the handshake, and resolve with hello-ok. */
  connect(url: string, token?: string): Promise<HelloOk> {
    this.close();
    this.setStatus("connecting");

    return new Promise<HelloOk>((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        this.setStatus("disconnected");
        reject(err);
      };

      ws.onerror = () => fail(new Error(`WebSocket error connecting to ${url}`));
      ws.onclose = (ev) => {
        if (!settled) {
          fail(new Error(`Connection closed during handshake (code ${ev.code})`));
          return;
        }
        this.setStatus("disconnected");
        this.emit("connection.closed", { code: ev.code, reason: ev.reason });
      };

      ws.onmessage = (msg) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(String(msg.data));
        } catch {
          return;
        }

        // Pre-handshake: expect connect.challenge then respond to our connect req.
        if (!settled) {
          if (frame.type === "event" && frame.event === "connect.challenge") {
            const challenge = frame.payload as ConnectChallenge;
            const platform = detectPlatform();
            void (async () => {
              const device = await buildDeviceParams(challenge.nonce, token ?? "", platform);
              this.sendFrame({
                type: "req",
                id: genId("connect"),
                method: "connect",
                params: {
                  minProtocol: PROTOCOL_VERSION,
                  maxProtocol: PROTOCOL_VERSION,
                  client: {
                    id: CLIENT_ID,
                    displayName: CLIENT_DISPLAY_NAME,
                    version: CLIENT_VERSION,
                    platform,
                    mode: CLIENT_MODE,
                  },
                  role: ROLE,
                  scopes: SCOPES,
                  caps: [],
                  commands: [],
                  permissions: {},
                  auth: token ? { token } : undefined,
                  device,
                  locale: navigator.language || "en-US",
                  userAgent: `openclaw-desktop/${CLIENT_VERSION}`,
                },
              });
            })();
            return;
          }
          if (frame.type === "res") {
            settled = true;
            if (frame.ok) {
              this.helloOk = frame.payload as HelloOk;
              this.setStatus("connected");
              this.dispatch(frame);
              resolve(this.helloOk);
            } else {
              fail(new GatewayError(frame.error ?? { code: "UNKNOWN", message: "connect failed" }));
            }
            return;
          }
          return;
        }

        this.dispatch(frame);
      };
    });
  }

  private dispatch(frame: GatewayFrame) {
    if (frame.type === "res") {
      const p = this.pending.get(frame.id);
      if (p) {
        this.pending.delete(frame.id);
        if (frame.ok) p.resolve(frame.payload);
        else p.reject(new GatewayError(frame.error ?? { code: "UNKNOWN", message: "request failed" }));
      }
      return;
    }
    if (frame.type === "event") {
      this.emit(frame.event, frame.payload);
    }
  }

  private sendFrame(frame: GatewayFrame) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  /** Call a gateway RPC method. */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.status !== "connected") {
      return Promise.reject(new GatewayError({ code: "NOT_CONNECTED", message: "Not connected" }));
    }
    const id = genId("req");
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (p: unknown) => void, reject, method });
      this.sendFrame({ type: "req", id, method, params });
    });
  }

  close() {
    this.helloOk = null;
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    for (const [, p] of this.pending) {
      p.reject(new GatewayError({ code: "CLOSED", message: "Connection closed" }));
    }
    this.pending.clear();
    this.setStatus("disconnected");
  }

  // ---------- Typed helpers ----------

  health(): Promise<unknown> {
    return this.request("health");
  }

  async listSessions(): Promise<SessionRow[]> {
    const res = await this.request<unknown>("sessions.list", {});
    return extractSessions(res);
  }

  async chatHistory(params: ChatHistoryParams): Promise<{ messages: ChatMessage[]; sessionId?: string }> {
    const res = await this.request<unknown>("chat.history", params);
    return extractHistory(res);
  }

  chatSend(params: ChatSendParams): Promise<ChatSendAck> {
    return this.request<ChatSendAck>("chat.send", params);
  }

  chatAbort(sessionKey: string, runId?: string): Promise<unknown> {
    return this.request("chat.abort", { sessionKey, runId });
  }

  /** Create a new session; resolves with the canonical session key. */
  async createSession(params: SessionCreateParams): Promise<string> {
    const res = await this.request<unknown>("sessions.create", params);
    const key = (res as Record<string, unknown>)?.key;
    if (typeof key !== "string" || !key.trim()) {
      throw new GatewayError({ code: "BAD_RESPONSE", message: "sessions.create returned no key" });
    }
    return key.trim();
  }
}

function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  if (ua.includes("linux")) return "linux";
  return "unknown";
}

/** Tolerant extraction of session rows across gateway versions. */
function extractSessions(res: unknown): SessionRow[] {
  const rows = Array.isArray(res)
    ? res
    : ((res as Record<string, unknown>)?.sessions ??
      (res as Record<string, unknown>)?.items ??
      (res as Record<string, unknown>)?.rows ??
      []);
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      ...o,
      key: String(o.key ?? o.sessionKey ?? o.id ?? "unknown"),
      label: (o.label ?? o.displayName ?? o.title) as string | undefined,
      updatedAt: o.updatedAt as number | undefined,
      model: o.model as string | undefined,
    } as SessionRow;
  });
}

/** Tolerant extraction of chat history entries (display-normalized by the gateway). */
function extractHistory(res: unknown): { messages: ChatMessage[]; sessionId?: string } {
  const obj = (res ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(res)
    ? res
    : ((obj.messages ?? obj.entries ?? obj.history ?? []) as unknown[]);
  const sessionId = obj.sessionId as string | undefined;

  const messages: ChatMessage[] = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const role = String(o.role ?? o.type ?? "assistant") as ChatMessage["role"];
    if (role !== "user" && role !== "assistant") continue;
    const text = extractText(o);
    if (!text) continue;
    messages.push({
      role,
      text,
      messageId: (o.messageId ?? o.id) as string | undefined,
      timestamp: (o.timestamp ?? o.ts) as number | undefined,
      aborted: Boolean(o.aborted),
    });
  }
  return { messages, sessionId };
}

function extractText(o: Record<string, unknown>): string {
  if (typeof o.text === "string") return o.text;
  if (typeof o.content === "string") return o.content;
  if (Array.isArray(o.content)) {
    return (o.content as unknown[])
      .map((b) => {
        if (typeof b === "string") return b;
        if (b && typeof b === "object" && typeof (b as Record<string, unknown>).text === "string") {
          return (b as Record<string, string>).text;
        }
        return "";
      })
      .join("");
  }
  if (typeof o.message === "string") return o.message;
  return "";
}

export function isChatEvent(payload: unknown): payload is ChatEvent {
  return (
    !!payload &&
    typeof payload === "object" &&
    typeof (payload as ChatEvent).state === "string" &&
    typeof (payload as ChatEvent).runId === "string"
  );
}
