<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import { THEMES } from "$lib/themes";

  let { open = $bindable(false) }: { open: boolean } = $props();
</script>

{#if open}
  <button class="scrim" aria-label="close theme picker" onclick={() => (open = false)}></button>
  <div class="picker">
    <div class="picker-title">🎨 Themes</div>
    <div class="picker-grid">
      {#each THEMES as t (t.id)}
        <button
          class="theme-card"
          class:active={app.themeId === t.id}
          onclick={() => { app.setTheme(t.id); open = false; }}
        >
          <span class="swatches">
            <span class="sw" style="background:{t.vars['--bg'] ?? '#0b0e14'}"></span>
            <span class="sw" style="background:{t.vars['--bg-card'] ?? '#11141d'}"></span>
            <span class="sw" style="background:{t.vars['--accent'] ?? '#ff3fa4'}"></span>
            <span class="sw" style="background:{t.vars['--accent2'] ?? '#7b5bff'}"></span>
          </span>
          <span class="tname">{t.name}</span>
          <span class="tblurb">{t.blurb}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 40; background: rgba(0, 0, 0, 0.5); border: none; cursor: default; }
  .picker {
    position: fixed; left: 96px; bottom: 16px; z-index: 41; width: 420px;
    background: var(--bg-panel); border: 1px solid var(--border2); border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6); padding: 16px;
  }
  @media (max-width: 720px) {
    .picker {
      left: 0; right: 0; bottom: 0; width: auto;
      border-radius: 16px 16px 0 0; border-left: none; border-right: none; border-bottom: none;
      padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    .picker-grid { grid-template-columns: 1fr; max-height: 60vh; }
  }
  .picker-title { font-weight: 700; font-size: 14px; margin-bottom: 12px; }
  .picker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-height: 55vh; overflow-y: auto; }
  .theme-card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
    background: var(--bg-card); border: 1px solid var(--border2); border-radius: 10px;
    padding: 10px; cursor: pointer; text-align: left; color: var(--text);
  }
  .theme-card:hover { border-color: var(--accent); }
  .theme-card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .swatches { display: flex; gap: 4px; }
  .sw { width: 18px; height: 18px; border-radius: 5px; border: 1px solid rgba(128, 128, 128, 0.4); }
  .tname { font-size: 13px; font-weight: 600; }
  .tblurb { font-size: 10.5px; color: var(--text5); line-height: 1.35; }
</style>
