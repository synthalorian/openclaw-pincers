<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";
  import { onMount } from "svelte";

  interface DeviceRow {
    deviceId?: string;
    id?: string;
    name?: string;
    displayName?: string;
    client?: string;
    roles?: string[] | string;
    scopes?: string[] | string;
    ip?: string;
    pending?: boolean;
    requestId?: string;
    [k: string]: unknown;
  }

  let devices = $state<DeviceRow[]>([]);
  let pending = $state<DeviceRow[]>([]);
  let loading = $state(false);
  let error = $state("");
  let notice = $state("");
  let rawFallback = $state<unknown>(null);

  // Setup code / QR state
  let qrBusy = $state(false);
  let setupCode = $state("");
  let qrDataUrl = $state("");
  let qrGatewayUrl = $state("");

  function deviceId(d: DeviceRow): string {
    return String(d.deviceId ?? d.id ?? d.requestId ?? "");
  }
  function deviceName(d: DeviceRow): string {
    return String(d.displayName ?? d.name ?? d.client ?? deviceId(d).slice(0, 12));
  }
  function scopeList(d: DeviceRow): string {
    const s = d.scopes ?? d.roles ?? "";
    return Array.isArray(s) ? s.join(", ") : String(s);
  }

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("device.pair.list", {});
    if (!res.ok) {
      error = res.error;
    } else {
      const d = res.data as Record<string, unknown>;
      const dev = (d?.devices ?? d?.paired ?? d?.approved ?? null) as unknown[] | null;
      const pen = (d?.pending ?? d?.requests ?? null) as unknown[] | null;
      if (Array.isArray(dev) || Array.isArray(pen)) {
        devices = (Array.isArray(dev) ? dev : []) as DeviceRow[];
        pending = (Array.isArray(pen) ? pen : []) as DeviceRow[];
        rawFallback = null;
      } else if (Array.isArray(d)) {
        // single flat list: split by pending flag
        const all = d as unknown as DeviceRow[];
        pending = all.filter((r) => r.pending);
        devices = all.filter((r) => !r.pending);
        rawFallback = null;
      } else {
        devices = [];
        pending = [];
        rawFallback = res.data;
      }
    }
    loading = false;
  }

  async function decide(d: DeviceRow, decision: "approve" | "reject") {
    error = "";
    notice = "";
    const id = String(d.requestId ?? deviceId(d));
    const res = await app.rpc(`device.pair.${decision}`, { requestId: id });
    if (!res.ok) error = res.error;
    else notice = `${decision === "approve" ? "✅ Approved" : "🚫 Rejected"}: ${deviceName(d)}`;
    await load();
  }

  async function removeDevice(d: DeviceRow) {
    error = "";
    notice = "";
    const res = await app.rpc("device.pair.remove", { deviceId: deviceId(d) });
    if (!res.ok) error = res.error;
    else notice = `🗑️ Removed: ${deviceName(d)}`;
    await load();
  }

  async function makeSetupCode() {
    qrBusy = true;
    error = "";
    setupCode = "";
    qrDataUrl = "";
    const res = await app.rpc("device.pair.setupCode", {});
    qrBusy = false;
    if (!res.ok) {
      error = res.error;
      return;
    }
    const d = res.data as Record<string, unknown>;
    setupCode = String(d?.setupCode ?? "");
    qrDataUrl = String(d?.qrDataUrl ?? "");
    qrGatewayUrl = String(d?.gatewayUrl ?? "");
  }

  onMount(() => {
    void load();
  });
</script>

<Section
  title="Devices"
  subtitle="paired devices, pending pairing requests, and mobile setup codes"
  {loading}
  {error}
  onrefresh={load}
>
  {#snippet actions()}
    <button class="ghost" onclick={makeSetupCode} disabled={qrBusy}>
      {qrBusy ? "…" : "📱 New setup code"}
    </button>
  {/snippet}

  {#if notice}<div class="notice">{notice}</div>{/if}

  {#if setupCode || qrDataUrl}
    <div class="qr-card">
      <div class="qr-title">📱 Pair a mobile device</div>
      <p class="qr-sub">Scan with the OpenClaw mobile app, or paste the setup code manually. Treat it like a password while valid.</p>
      {#if qrDataUrl}
        <img class="qr-img" src={qrDataUrl} alt="Pairing QR code" />
      {/if}
      {#if setupCode}
        <code class="setup-code mono">{setupCode}</code>
      {/if}
      {#if qrGatewayUrl}
        <div class="qr-url mono">{qrGatewayUrl}</div>
      {/if}
      <button class="ghost" onclick={() => { setupCode = ""; qrDataUrl = ""; }}>Dismiss</button>
    </div>
  {/if}

  {#if pending.length}
    <h3 class="group-title">⏳ Pending approval</h3>
    <div class="list">
      {#each pending as d (deviceId(d))}
        <div class="card pending-card">
          <div class="row">
            <div class="grow">
              <div class="name">{deviceName(d)}</div>
              <div class="meta mono">{scopeList(d)}</div>
              {#if d.ip}<div class="meta mono">{String(d.ip)}</div>{/if}
            </div>
            <div class="btns">
              <button class="allow" onclick={() => decide(d, "approve")}>Approve</button>
              <button class="deny" onclick={() => decide(d, "reject")}>Reject</button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if devices.length}
    <h3 class="group-title">🦞 Paired devices</h3>
    <div class="list">
      {#each devices as d (deviceId(d))}
        <div class="card">
          <div class="row">
            <div class="grow">
              <div class="name">{deviceName(d)}</div>
              <div class="meta mono">{scopeList(d)}</div>
              {#if d.ip}<div class="meta mono">{String(d.ip)}</div>{/if}
            </div>
            <div class="btns">
              <button class="deny" onclick={() => removeDevice(d)}>Remove</button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if !loading && !pending.length && !rawFallback}
    <div class="empty">No paired devices yet. Generate a setup code to pair one.</div>
  {/if}

  {#if rawFallback}
    <JsonView data={rawFallback} />
  {/if}
</Section>

<style>
  .list { display: flex; flex-direction: column; gap: 10px; }
  .card { background: var(--bg-card); border: 1px solid var(--border2); border-radius: 12px; padding: 14px 16px; }
  .pending-card { border-color: var(--warning-border, var(--border2)); }
  .row { display: flex; align-items: center; gap: 12px; }
  .grow { flex: 1; min-width: 0; }
  .name { font-weight: 600; font-size: 14px; }
  .meta { color: var(--text5); font-size: 11.5px; margin-top: 3px; word-break: break-all; }
  .btns { display: flex; gap: 8px; flex-shrink: 0; }
  button { border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .allow { background: var(--success, #3fb96b); color: #fff; }
  .deny { background: transparent; color: var(--danger-text, #e07080); border: 1px solid var(--danger, #b3364a); }
  .ghost { background: transparent; color: var(--text4); border: 1px solid var(--border-input); }
  .ghost:hover { color: var(--accent); border-color: var(--accent); }
  .notice { background: rgba(63, 185, 107, 0.12); border: 1px solid var(--success, #3fb96b); border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
  .group-title { font-size: 13px; color: var(--text4); margin: 18px 0 10px; }
  .empty { color: var(--text5); font-size: 13px; padding: 24px 0; text-align: center; }
  .qr-card { background: var(--bg-card); border: 1px solid var(--accent); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 14px; }
  .qr-title { font-weight: 700; font-size: 15px; }
  .qr-sub { color: var(--text5); font-size: 12px; text-align: center; margin: 0; max-width: 420px; }
  .qr-img { width: 240px; height: 240px; border-radius: 12px; background: #fff; padding: 10px; }
  .setup-code { background: var(--bg); border: 1px solid var(--border-input); border-radius: 8px; padding: 10px 14px; font-size: 13px; word-break: break-all; }
  .qr-url { color: var(--text5); font-size: 11.5px; }
</style>
