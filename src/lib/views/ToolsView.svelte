<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  type Tool = { name?: string; id?: string; description?: string; source?: string; [k: string]: unknown };

  let loading = $state(false);
  let error = $state("");
  let tools = $state<Tool[]>([]);
  let rawFallback = $state<unknown>(null);
  let filter = $state("");

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("tools.catalog", { includePlugins: true });
    if (!res.ok) error = res.error;
    else {
      const d = res.data as Record<string, unknown>;
      const rows = Array.isArray(d) ? d : ((d?.tools ?? d?.items ?? d?.catalog ?? null) as unknown[] | null);
      if (Array.isArray(rows)) {
        tools = rows as Tool[];
        rawFallback = null;
      } else {
        tools = [];
        rawFallback = res.data;
      }
    }
    loading = false;
  }

  const filtered = $derived(
    tools.filter((t) => {
      const n = String(t.name ?? t.id ?? "").toLowerCase();
      return !filter || n.includes(filter.toLowerCase());
    }),
  );

  $effect(() => {
    void load();
  });
</script>

<Section title="Tools" subtitle="gateway tool catalog (core + plugins)" {loading} {error} onrefresh={load}>
  {#snippet actions()}
    <input class="filter" bind:value={filter} placeholder="filter…" />
  {/snippet}

  {#if tools.length}
    <table>
      <thead><tr><th>Tool</th><th>Source</th><th>Description</th></tr></thead>
      <tbody>
        {#each filtered as t (t.id ?? t.name)}
          <tr>
            <td class="mono">{t.name ?? t.id}</td>
            <td class="dim">{t.source ?? "core"}</td>
            <td class="desc">{t.description ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="count">{filtered.length} / {tools.length} tools</div>
  {:else if rawFallback}
    <JsonView data={rawFallback} />
  {:else if !loading}
    <div class="empty">No tools returned.</div>
  {/if}
</Section>

<style>
  .filter { background: var(--bg); border: 1px solid var(--border-input); border-radius: 8px; color: var(--text); padding: 8px 10px; font-size: 13px; outline: none; }
  .filter:focus { border-color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
  td { padding: 8px 10px; border-bottom: 1px solid var(--bg-msg); vertical-align: top; }
  tr:hover td { background: var(--bg-card); }
  .mono { font-family: "JetBrains Mono", monospace; color: var(--mono); }
  .dim { color: var(--muted); font-size: 11px; }
  .desc { color: var(--text3); font-size: 12px; }
  .count { margin-top: 10px; font-size: 11px; color: var(--muted); }
  .empty { color: var(--muted); padding: 20px; }
</style>
