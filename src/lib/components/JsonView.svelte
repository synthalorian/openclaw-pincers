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
    background: #1c2337; color: #8fa0c8; border: 1px solid #2a3350;
    border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer;
  }
  .copy:hover { color: #ff3fa4; border-color: #ff3fa4; }
  pre {
    margin: 0; padding: 14px; background: #0b0e14; border: 1px solid #1d2333;
    border-radius: 10px; overflow: auto; max-height: 60vh;
    font-size: 12px; line-height: 1.5; color: #a8e6c8;
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }
</style>
