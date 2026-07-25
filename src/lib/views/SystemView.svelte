<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  let loading = $state(false);
  let error = $state("");
  let channels = $state<unknown>(null);
  let nodes = $state<unknown>(null);
  let updateStatus = $state<unknown>(null);
  let updating = $state(false);
  let updateNote = $state("");

  async function load() {
    loading = true;
    error = "";
    const [c, n, u] = await Promise.all([
      app.rpc("channels.status", {}),
      app.rpc("node.list", {}),
      app.rpc("update.status", {}),
    ]);
    channels = c.ok ? c.data : { error: c.error };
    nodes = n.ok ? n.data : { error: n.error };
    updateStatus = u.ok ? u.data : { error: u.error };
    loading = false;
  }

  async function runUpdate() {
    updating = true;
    updateNote = "";
    const res = await app.rpc("update.run", { note: "update triggered from OpenClaw Pincers" });
    updateNote = res.ok
      ? "Update flow started — the gateway may restart. Reconnect if the connection drops."
      : `Update failed: ${res.error}`;
    updating = false;
    await load();
  }

  $effect(() => {
    void load();
  });
</script>

<Section title="System" subtitle="channels, nodes, and gateway updates" {loading} {error} onrefresh={load}>
  <div class="cards">
    <div class="card">
      <div class="card-title">Channels</div>
      {#if channels}<JsonView data={channels} />{:else}<div class="sub">loading…</div>{/if}
    </div>
    <div class="card">
      <div class="card-title">Nodes</div>
      {#if nodes}<JsonView data={nodes} />{:else}<div class="sub">loading…</div>{/if}
    </div>
    <div class="card wide">
      <div class="card-title">Gateway Update</div>
      <button class="primary" onclick={runUpdate} disabled={updating}>
        {updating ? "Running update…" : "⬆ Run gateway update"}
      </button>
      {#if updateNote}<div class="note">{updateNote}</div>{/if}
      {#if updateStatus}<div style="margin-top:12px"><JsonView data={updateStatus} /></div>{/if}
    </div>
  </div>
</Section>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; }
  .card { background: #11141d; border: 1px solid #232a3d; border-radius: 12px; padding: 16px; }
  .card.wide { grid-column: 1 / -1; }
  .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5b6478; margin-bottom: 10px; }
  .sub { font-size: 12px; color: #7c86a0; }
  .note { margin-top: 10px; font-size: 13px; color: #ffcf6e; }
  .primary { background: linear-gradient(135deg, #ff3fa4, #7b5bff); color: white; border: none; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .primary:disabled { opacity: 0.4; cursor: default; }
</style>
