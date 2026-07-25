<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    subtitle = "",
    loading = false,
    error = "",
    onrefresh,
    children,
    actions,
  }: {
    title: string;
    subtitle?: string;
    loading?: boolean;
    error?: string;
    onrefresh?: () => void;
    children: Snippet;
    actions?: Snippet;
  } = $props();
</script>

<div class="section">
  <header class="section-header">
    <div>
      <h2>{title}</h2>
      {#if subtitle}<p>{subtitle}</p>{/if}
    </div>
    <div class="header-actions">
      {@render actions?.()}
      {#if onrefresh}
        <button class="ghost" onclick={onrefresh} disabled={loading}>
          {loading ? "…" : "↻ Refresh"}
        </button>
      {/if}
    </div>
  </header>
  {#if error}
    <div class="error">{error}</div>
  {/if}
  <div class="section-body">
    {@render children()}
  </div>
</div>

<style>
  .section { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .section-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 18px 22px 12px; border-bottom: 1px solid #1d2333; gap: 12px;
  }
  .section-header h2 { margin: 0; font-size: 18px; }
  .section-header p { margin: 4px 0 0; font-size: 12px; color: #5b6478; }
  .header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .section-body { flex: 1; overflow-y: auto; padding: 18px 22px; }
  .error {
    margin: 12px 22px 0; background: rgba(179, 54, 74, 0.15); border: 1px solid #b3364a;
    border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #ff9aa8;
  }
  .ghost {
    background: #1c2337; color: #8fa0c8; border: 1px solid #2a3350;
    border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer;
  }
  .ghost:hover:not(:disabled) { color: #ff3fa4; border-color: #ff3fa4; }
  .ghost:disabled { opacity: 0.4; cursor: default; }
</style>
