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
    padding: 18px 22px 12px; border-bottom: 1px solid var(--border); gap: 12px;
  }
  .section-header h2 { margin: 0; font-size: 18px; }
  .section-header p { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
  .header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .section-body { flex: 1; overflow-y: auto; padding: 18px 22px; }
  @media (max-width: 720px) {
    .section-header { padding: 12px 14px 10px; flex-wrap: wrap; }
    .section-body { padding: 12px 14px; }
  }
  .error {
    margin: 12px 22px 0; background: rgba(179, 54, 74, 0.15); border: 1px solid var(--danger);
    border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--danger-text);
  }
  .ghost {
    background: var(--bg-active); color: var(--text4); border: 1px solid var(--border-input);
    border-radius: 8px; padding: 8px 12px; font-size: 12px; cursor: pointer;
  }
  .ghost:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  .ghost:disabled { opacity: 0.4; cursor: default; }
</style>
