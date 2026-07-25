<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  type Skill = { name?: string; slug?: string; description?: string; version?: string; [k: string]: unknown };

  let loading = $state(false);
  let error = $state("");
  let skills = $state<Skill[]>([]);
  let rawFallback = $state<unknown>(null);

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("skills.status", {});
    if (!res.ok) error = res.error;
    else {
      const d = res.data as Record<string, unknown>;
      const rows = Array.isArray(d) ? d : ((d?.skills ?? d?.items ?? d?.installed ?? null) as unknown[] | null);
      if (Array.isArray(rows)) {
        skills = rows as Skill[];
        rawFallback = null;
      } else {
        skills = [];
        rawFallback = res.data;
      }
    }
    loading = false;
  }

  $effect(() => {
    void load();
  });
</script>

<Section title="Skills" subtitle="installed agent skills" {loading} {error} onrefresh={load}>
  {#if skills.length}
    <div class="grid">
      {#each skills as s (s.slug ?? s.name)}
        <div class="card">
          <div class="name">{s.name ?? s.slug}</div>
          {#if s.description}<div class="desc">{s.description}</div>{/if}
          {#if s.version}<div class="ver">v{s.version}</div>{/if}
        </div>
      {/each}
    </div>
  {:else if rawFallback}
    <JsonView data={rawFallback} />
  {:else if !loading}
    <div class="empty">No skills returned.</div>
  {/if}
</Section>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .card { background: var(--bg-card); border: 1px solid var(--border2); border-radius: 10px; padding: 14px; }
  .name { font-weight: 600; font-size: 14px; color: var(--accent); }
  .desc { font-size: 12px; color: var(--text3); margin-top: 6px; line-height: 1.45; }
  .ver { font-size: 10px; color: var(--muted); margin-top: 8px; }
  .empty { color: var(--muted); padding: 20px; }
</style>
