# OpenClaw Pincers 🦞

**Get a grip on your gateway.** A standalone cross-platform desktop client for
[OpenClaw](https://github.com/openclaw/openclaw), built with Tauri 2 + Svelte 5 + TypeScript. Twelve sections: Chat, Dashboard, Models, Config, Files, Cron, Approvals, Skills, Tools, Logs, System, and Setup — full CLI parity over the Gateway WS protocol.

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

## Install

### Linux
- **Debian/Ubuntu:** `sudo dpkg -i "OpenClaw Pincers"_*_amd64.deb`
- **Fedora/openSUSE:** `sudo dnf install OpenClaw\ Pincers-*.x86_64.rpm`
- **Any distro:** the `.AppImage` — `chmod +x` and run
- **Arch/CachyOS/Manjaro:** `cd packaging && makepkg -si`

Requires `webkit2gtk-4.1`, `gtk3`, `libsoup3` (preinstalled on most desktops).

### macOS
Download the `.dmg` for your chip (arm64 = Apple Silicon, x64 = Intel),
drag to Applications. Unsigned build: first launch may need
`xattr -dr com.apple.quarantine "/Applications/OpenClaw Pincers.app"`.

### Windows
Download the `.msi` (or NSIS `.exe`) and install. Unsigned build:
click “More info → Run anyway” on the SmartScreen prompt.

### Build from source (any platform)
Prereqs: Rust toolchain, Node 18+, [Tauri system deps](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev      # dev build with hot reload
npm run tauri build    # release bundles (deb/rpm/AppImage/dmg/msi per host OS)
npm run check          # svelte-check types
```

Releases are built by GitHub Actions (`.github/workflows/release.yml`) —
tag `v*` and the pipeline ships Linux (deb/rpm/AppImage), macOS (arm64+x64 dmg),
and Windows (msi/nsis) artifacts.

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
