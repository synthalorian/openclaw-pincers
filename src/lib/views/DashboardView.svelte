<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  let loading = $state(false);
  let error = $state("");
  let status = $state<unknown>(null);
  let health = $state<unknown>(null);
  let usage = $state<unknown>(null);
  let presence = $state<unknown>(null);

  async function load() {
    loading = true;
    error = "";
    const [s, h, u, p] = await Promise.all([
      app.rpc("status"),
      app.rpc("health"),
      app.rpc("usage.status"),
      app.rpc("system-presence"),
    ]);
    if (!s.ok && !h.ok) error = s.ok ? "" : s.error;
    status = s.ok ? s.data : null;
    health = h.ok ? h.data : null;
    usage = u.ok ? u.data : null;
    presence = p.ok ? p.data : null;
    loading = false;
  }

  $effect(() => {
    void load();
  });
</script>

<Section title="Dashboard" subtitle="gateway status, health, usage, presence" {loading} {error} onrefresh={load}>
  <div class="cards">
    <div class="card hero">
      <div class="card-title">Gateway</div>
      <div class="big">v{app.hello?.server.version ?? "?"}</div>
      <div class="sub">protocol {app.hello?.protocol} · conn {app.hello?.server.connId?.slice(0, 8)}…</div>
      <div class="sub">scopes: {app.hello?.auth.scopes.join(", ")}</div>
      <div class="sub">{app.hello?.features.methods.length ?? 0} methods · {app.hello?.features.events.length ?? 0} events</div>
    </div>
    <div class="card">
      <div class="card-title">Health</div>
      {#if health}<JsonView data={health} />{:else}<div class="sub">unavailable</div>{/if}
    </div>
    <div class="card">
      <div class="card-title">Usage / Quota</div>
      {#if usage}<JsonView data={usage} />{:else}<div class="sub">unavailable</div>{/if}
    </div>
    <div class="card">
      <div class="card-title">Presence</div>
      {#if presence}<JsonView data={presence} />{:else}<div class="sub">unavailable</div>{/if}
    </div>
    <div class="card wide">
      <div class="card-title">Status</div>
      {#if status}<JsonView data={status} />{:else}<div class="sub">unavailable</div>{/if}
    </div>
  </div>
</Section>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
  .card { background: var(--bg-card); border: 1px solid var(--border2); border-radius: 12px; padding: 16px; }
  .card.wide { grid-column: 1 / -1; }
  .card.hero { background: linear-gradient(135deg, var(--bg-active), var(--bg-card)); border-color: var(--accent2); }
  .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 10px; }
  .big { font-size: 28px; font-weight: 700; color: var(--accent); }
  .sub { font-size: 12px; color: var(--text5); margin-top: 4px; word-break: break-all; }
</style>
