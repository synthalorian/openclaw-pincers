<script lang="ts">
  let { data, raw = false }: { data: unknown; raw?: boolean } = $props();

  const text = $derived(
    typeof data === "string" && raw ? data : JSON.stringify(data, null, 2) ?? String(data),
  );
  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      // clipboard unavailable
    }
  }
</script>

<div class="json-wrap">
  <button class="copy" onclick={copy}>{copied ? "copied ✓" : "copy"}</button>
  <pre>{text}</pre>
</div>

<style>
  .json-wrap { position: relative; }
  .copy {
    position: absolute; top: 8px; right: 8px; z-index: 1;
    background: var(--bg-active); color: var(--text4); border: 1px solid var(--border-input);
    border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer;
  }
  .copy:hover { color: var(--accent); border-color: var(--accent); }
  pre {
    margin: 0; padding: 14px; background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; overflow: auto; max-height: 60vh;
    font-size: 12px; line-height: 1.5; color: var(--mono);
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }
</style>
