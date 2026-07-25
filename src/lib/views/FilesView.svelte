<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  type Entry = { name: string; path: string; kind: string; size?: number };

  let loading = $state(false);
  let error = $state("");
  let agentId = $state("main");
  let path = $state("");
  let entries = $state<Entry[]>([]);
  let parentPath = $state<string | null>(null);
  let fileContent = $state<string | null>(null);
  let filePath = $state("");

  async function load() {
    loading = true;
    error = "";
    fileContent = null;
    const res = await app.rpc("agents.workspace.list", { agentId, path: path || undefined, limit: 500 });
    if (!res.ok) {
      error = res.error;
      entries = [];
    } else {
      const d = res.data as Record<string, unknown>;
      parentPath = (d?.parentPath ?? null) as string | null;
      const rows = (d?.entries ?? d?.files ?? d?.items ?? []) as unknown[];
      entries = (Array.isArray(rows) ? rows : []).map((r) => {
        const o = r as Record<string, unknown>;
        return {
          name: String(o.name ?? o.path ?? "?"),
          path: String(o.path ?? o.name ?? "?"),
          kind: String(o.kind ?? o.type ?? (o.dir ? "dir" : "file")),
          size: (o.size ?? o.sizeBytes) as number | undefined,
        };
      });
    }
    loading = false;
  }

  async function open(e: Entry) {
    if (e.kind === "dir" || e.kind === "directory") {
      path = e.path;
      await load();
      return;
    }
    error = "";
    const res = await app.rpc("agents.workspace.get", { agentId, path: e.path });
    if (!res.ok) {
      error = res.error;
    } else {
      const d = res.data as Record<string, unknown>;
      filePath = e.path;
      fileContent = typeof d?.content === "string" ? d.content : typeof d?.text === "string" ? d.text : JSON.stringify(d, null, 2);
    }
  }

  async function up() {
    path = parentPath ?? "";
    await load();
  }

  $effect(() => {
    void agentId;
    path = "";
    void load();
  });
</script>

<Section title="Files" subtitle="agent workspace browser (read-only, gateway-confined)" {loading} {error} onrefresh={load}>
  {#snippet actions()}
    <select bind:value={agentId}>
      {#each app.agents as a (a.agentId)}
        <option value={a.agentId}>{a.agentId}</option>
      {:else}
        <option value="main">main</option>
      {/each}
    </select>
  {/snippet}

  <div class="crumbs">
    <button class="ghost" onclick={up} disabled={!parentPath && !path}>↑ up</button>
    <code>/​{path}</code>
  </div>

  {#if fileContent !== null}
    <div class="file-head">
      <button class="ghost" onclick={() => (fileContent = null)}>← back</button>
      <code>{filePath}</code>
    </div>
    <JsonView data={fileContent} raw />
  {:else}
    <div class="list">
      {#each entries as e (e.path)}
        <button class="row" onclick={() => open(e)}>
          <span class="icon">{e.kind === "dir" || e.kind === "directory" ? "📁" : "📄"}</span>
          <span class="name">{e.name}</span>
          {#if e.size !== undefined}<span class="size">{(e.size / 1024).toFixed(1)}k</span>{/if}
        </button>
      {:else}
        {#if !loading}<div class="empty">Empty directory.</div>{/if}
      {/each}
    </div>
  {/if}
</Section>

<style>
  select { background: #0b0e14; border: 1px solid #2a3350; border-radius: 8px; color: #e6ebf5; padding: 8px 10px; font-size: 13px; outline: none; }
  .crumbs, .file-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .crumbs code, .file-head code { color: #8fa0c8; font-size: 12px; }
  .list { display: flex; flex-direction: column; gap: 2px; }
  .row {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px;
    background: transparent; border: none; border-radius: 8px; color: #b8c0d4;
    font-size: 13px; cursor: pointer; text-align: left;
  }
  .row:hover { background: #161b28; }
  .name { flex: 1; font-family: "JetBrains Mono", monospace; }
  .size { color: #5b6478; font-size: 11px; }
  .empty { color: #5b6478; padding: 20px; }
  .ghost { background: #1c2337; color: #8fa0c8; border: 1px solid #2a3350; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
  .ghost:hover:not(:disabled) { color: #ff3fa4; border-color: #ff3fa4; }
  .ghost:disabled { opacity: 0.4; }
</style>
