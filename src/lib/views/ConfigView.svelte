<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  let loading = $state(false);
  let error = $state("");
  let notice = $state("");
  let raw = $state("");
  let baseHash = $state("");
  let dirty = $state(false);
  let saving = $state(false);

  // schema lookup drill-down
  let lookupPath = $state("");
  let lookupResult = $state<unknown>(null);

  async function load() {
    loading = true;
    error = "";
    notice = "";
    const res = await app.rpc("config.get");
    if (!res.ok) {
      error = res.error;
    } else {
      const d = res.data as Record<string, unknown>;
      baseHash = String(d?.hash ?? d?.baseHash ?? "");
      const cfg = d?.config ?? d?.raw ?? d;
      raw = typeof cfg === "string" ? cfg : JSON.stringify(cfg, null, 2);
      dirty = false;
    }
    loading = false;
  }

  async function save() {
    saving = true;
    error = "";
    notice = "";
    try {
      JSON.parse(raw); // validate before sending
    } catch (e) {
      error = `Invalid JSON: ${e instanceof Error ? e.message : e}`;
      saving = false;
      return;
    }
    const res = await app.rpc("config.set", { raw, baseHash: baseHash || undefined });
    if (!res.ok) error = res.error;
    else {
      notice = "Config written. Some fields may require a gateway restart (see System).";
      dirty = false;
      await load();
    }
    saving = false;
  }

  async function lookup() {
    if (!lookupPath.trim()) return;
    const res = await app.rpc("config.schema.lookup", { path: lookupPath.trim() });
    lookupResult = res.ok ? res.data : { error: res.error };
  }

  $effect(() => {
    void load();
  });
</script>

<Section title="Config" subtitle="live gateway configuration — validated write via config.set" {loading} {error} onrefresh={load}>
  {#snippet actions()}
    {#if dirty}<span class="dirty">unsaved changes</span>{/if}
    <button class="primary" onclick={save} disabled={!dirty || saving}>
      {saving ? "Saving…" : "Save config"}
    </button>
  {/snippet}

  {#if notice}<div class="notice">{notice}</div>{/if}

  <div class="lookup-bar">
    <input bind:value={lookupPath} placeholder="schema lookup path, e.g. gateway.auth or agents.defaults" onkeydown={(e) => e.key === "Enter" && lookup()} />
    <button class="ghost" onclick={lookup}>Lookup schema</button>
  </div>
  {#if lookupResult}
    <div class="lookup-result"><JsonView data={lookupResult} /></div>
  {/if}

  {#if baseHash}<div class="hash">base hash: <code>{baseHash}</code></div>{/if}
  <textarea
    class="editor"
    bind:value={raw}
    oninput={() => (dirty = true)}
    spellcheck="false"
  ></textarea>
</Section>

<style>
  .notice {
    background: rgba(63, 221, 140, 0.1); border: 1px solid #2a7a52; color: #7fe6b0;
    border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px;
  }
  .lookup-bar { display: flex; gap: 8px; margin-bottom: 12px; }
  .lookup-bar input {
    flex: 1; background: #0b0e14; border: 1px solid #2a3350; border-radius: 8px;
    color: #e6ebf5; padding: 9px 12px; font-size: 13px; outline: none;
    font-family: "JetBrains Mono", monospace;
  }
  .lookup-bar input:focus { border-color: #ff3fa4; }
  .lookup-result { margin-bottom: 12px; }
  .hash { font-size: 11px; color: #5b6478; margin-bottom: 8px; }
  .hash code { color: #8fa0c8; }
  .editor {
    width: 100%; min-height: 55vh; resize: vertical;
    background: #0b0e14; border: 1px solid #2a3350; border-radius: 10px;
    color: #a8e6c8; padding: 14px; font-size: 12.5px; line-height: 1.55; outline: none;
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }
  .editor:focus { border-color: #ff3fa4; }
  .dirty { font-size: 11px; color: #ffcf6e; }
  .primary { background: linear-gradient(135deg, #ff3fa4, #7b5bff); color: white; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .primary:disabled { opacity: 0.4; cursor: default; }
  .ghost { background: #1c2337; color: #8fa0c8; border: 1px solid #2a3350; border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer; }
  .ghost:hover { color: #ff3fa4; border-color: #ff3fa4; }
</style>
