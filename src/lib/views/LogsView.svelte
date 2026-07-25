<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  let loading = $state(false);
  let error = $state("");
  let lines = $state<string[]>([]);
  let cursor = $state<number | undefined>(undefined);
  let follow = $state(true);
  let rawFallback = $state<unknown>(null);
  let scrollBox = $state<HTMLElement | null>(null);

  async function load(append = false) {
    loading = true;
    const res = await app.rpc("logs.tail", { cursor: append ? cursor : undefined, limit: 400 });
    if (!res.ok) {
      error = res.error;
    } else {
      error = "";
      const d = res.data as Record<string, unknown>;
      if (Array.isArray(d?.lines)) {
        lines = append ? [...lines, ...(d.lines as string[])] : (d.lines as string[]);
        if (lines.length > 2000) lines = lines.slice(-2000);
        cursor = d.cursor as number | undefined;
        rawFallback = null;
      } else {
        rawFallback = res.data;
      }
    }
    loading = false;
  }

  $effect(() => {
    void load();
    const t = setInterval(() => follow && load(true), 3000);
    return () => clearInterval(t);
  });

  $effect(() => {
    void lines.length;
    if (follow) scrollBox?.scrollTo({ top: scrollBox.scrollHeight });
  });
</script>

<Section title="Logs" subtitle="gateway file log tail" {loading} {error} onrefresh={() => load()}>
  {#snippet actions()}
    <label class="follow">
      <input type="checkbox" bind:checked={follow} /> follow
    </label>
  {/snippet}

  {#if rawFallback}
    <JsonView data={rawFallback} />
  {:else}
    <div class="log" bind:this={scrollBox}>
      {#each lines as line, i (i)}
        <div class="line">{line}</div>
      {:else}
        <div class="empty">No log lines.</div>
      {/each}
    </div>
  {/if}
</Section>

<style>
  .follow { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text4); }
  .log {
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
    padding: 12px; height: 65vh; overflow-y: auto;
    font-family: "JetBrains Mono", monospace; font-size: 11.5px; line-height: 1.5;
  }
  .line { color: var(--text3); white-space: pre-wrap; word-break: break-all; }
  .line:hover { background: var(--bg-card); }
  .empty { color: var(--muted); padding: 20px; }
</style>
