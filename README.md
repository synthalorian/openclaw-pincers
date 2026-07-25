# OpenClaw Desktop

**The gateway, on the grid.** A standalone cross-platform desktop client for
[OpenClaw](https://github.com/openclaw/openclaw), built with Tauri 2 + Svelte 5 + TypeScript.

Talks to any OpenClaw Gateway over the official WebSocket protocol (v4) —
no shim, no fork, no screen-scraping. Device-auth handshake implemented
natively in Rust (Ed25519, v3 signed payloads); the private key never
leaves the native process.

## Status — v0.1 (MVP core)

- [x] Connection manager: gateway URL + token, persisted profiles
- [x] Full protocol v4 handshake: `connect.challenge` → signed `connect` → `hello-ok`
- [x] Ed25519 device identity (Rust), base64url signatures, v3 auth payload
- [x] Sessions browser (`sessions.list`, live `sessions.changed` refresh)
- [x] Chat: `chat.history`, `chat.send` (idempotency keys), streaming `chat` deltas, `chat.abort`
- [ ] Approvals inbox (`exec.approval.*`, `plugin.approval.*`)
- [ ] Dashboard (health / usage / models)
- [ ] Schema-driven config editor (`config.schema` + `config.patch`) — the v1.1 killer feature
- [ ] Cron manager, logs tail, embedded terminal, node pairing UI

## Develop

Prereqs: Rust toolchain, Node 18+, Tauri system deps
(`webkit2gtk-4.1`, `libsoup-3.0`, `gtk+3` on Linux).

```bash
npm install
npm run tauri dev      # dev build with hot reload
npm run tauri build    # release bundles
npm run check          # svelte-check types
```

## Architecture

```
src/lib/gateway/protocol.ts   Protocol v4 types (frames, handshake, chat events)
src/lib/gateway/client.ts     GatewayClient — WS transport, req/res correlation,
                              event routing, tolerant payload extraction
src/lib/state/app.svelte.ts   Svelte 5 runes app state
src/routes/+page.svelte       UI shell (connect screen → sessions + chat)
src-tauri/src/lib.rs          Device identity (Ed25519 keygen/storage/signing)
```

### Protocol notes (learned from the source)

- `client.id` is a **closed enum** — external apps must use `gateway-client`
  with mode `ui`.
- Device auth payload v3:
  `v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily`
  (scopes normalized/sorted, platform lowercased, deviceFamily empty).
- `device.id` = sha256hex(raw Ed25519 public key); `device.publicKey` =
  base64url(raw key); signature = base64url(Ed25519 signature over payload).
- Gateways with `gateway.auth.token` require the token in both `auth.token`
  **and** the signed payload.
- `chat.send` acks with `{runId, status:"started"}`; responses stream as
  `chat` events (`delta`/`final`/`aborted`/`error`, deltas via `deltaText`,
  `replace=true` for non-prefix rewrites).

## License

MIT
