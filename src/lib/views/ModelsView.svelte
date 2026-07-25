<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  type ModelRow = { id: string; name?: string; provider?: string; [k: string]: unknown };

  let loading = $state(false);
  let error = $state("");
  let models = $state<ModelRow[]>([]);
  let rawFallback = $state<unknown>(null);
  let view = $state<"default" | "configured" | "all">("default");
  let filter = $state("");

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("models.list", { view });
    if (!res.ok) {
      error = res.error;
    } else {
      const d = res.data as Record<string, unknown>;
      const rows = Array.isArray(d) ? d : ((d?.models ?? d?.items ?? d?.entries ?? null) as unknown[] | null);
      if (Array.isArray(rows)) {
        models = rows.map((r) => {
          const o = r as Record<string, unknown>;
          return { ...o, id: String(o.id ?? o.model ?? o.key ?? "?"), provider: (o.provider ?? o.vendor) as string | undefined };
        });
        rawFallback = null;
      } else {
        models = [];
        rawFallback = res.data;
      }
    }
    loading = false;
  }

  const filtered = $derived(
    models.filter((m) => !filter || m.id.toLowerCase().includes(filter.toLowerCase())),
  );

  $effect(() => {
    void view;
    void load();
  });
</script>

<Section title="Models" subtitle="runtime-allowed model catalog" {loading} {error} onrefresh={load}>
  {#snippet actions()}
    <input class="filter" bind:value={filter} placeholder="filter…" />
    <select bind:value={view}>
      <option value="default">default</option>
      <option value="configured">configured</option>
      <option value="all">all</option>
    </select>
  {/snippet}

  {#if models.length}
    <table>
      <thead><tr><th>Model</th><th>Provider</th><th>Details</th></tr></thead>
      <tbody>
        {#each filtered as m (m.id)}
          <tr>
            <td class="mono">{m.id}</td>
            <td>{m.provider ?? "—"}</td>
            <td class="dim">{Object.keys(m).filter((k) => !["id", "provider", "name"].includes(k)).slice(0, 4).map((k) => `${k}=${JSON.stringify(m[k])}`).join(" · ")}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="count">{filtered.length} / {models.length} models</div>
  {:else if rawFallback}
    <JsonView data={rawFallback} />
  {:else if !loading}
    <div class="empty">No models returned.</div>
  {/if}
</Section>

<style>
  .filter, select {
    background: var(--bg); border: 1px solid var(--border-input); border-radius: 8px;
    color: var(--text); padding: 8px 10px; font-size: 13px; outline: none;
  }
  .filter:focus, select:focus { border-color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
  td { padding: 8px 10px; border-bottom: 1px solid var(--bg-msg); }
  tr:hover td { background: var(--bg-card); }
  .mono { font-family: "JetBrains Mono", monospace; color: var(--mono); }
  .dim { color: var(--muted); font-size: 11px; }
  .count { margin-top: 10px; font-size: 11px; color: var(--muted); }
  .empty { color: var(--muted); padding: 20px; }
</style>
