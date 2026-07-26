<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import type { AgentRow } from "$lib/gateway/protocol";

  let creating = $state<string | null>(null); // agentId currently creating
  let createError = $state("");
  let loading = $state(false);

  async function load() {
    loading = true;
    await app.refreshAgents();
    loading = false;
  }

  async function newSession(agent: AgentRow) {
    createError = "";
    creating = agent.agentId;
    try {
      await app.createSession({ agentId: agent.agentId });
    } catch (err) {
      createError = err instanceof Error ? err.message : String(err);
    } finally {
      creating = null;
    }
  }

  function displayName(a: AgentRow): string {
    return a.name || a.agentId;
  }

  $effect(() => {
    void load();
  });
</script>

<Section
  title="Agents"
  subtitle="{app.agents.length} configured"
  {loading}
  error=""
  onrefresh={load}
>
  {#if createError}
    <div class="error">{createError}</div>
  {/if}

  {#if app.agents.length}
    <div class="agent-grid">
      {#each app.agents as a (a.agentId)}
        <div class="agent-card">
          <div class="agent-head">
            <span class="agent-avatar">🤖</span>
            <div class="agent-id-block">
              <div class="agent-name">
                {displayName(a)}
                {#if a.isDefault}<span class="badge">default</span>{/if}
              </div>
              <div class="agent-id mono">{a.agentId}</div>
            </div>
          </div>

          <div class="agent-meta">
            {#if a.model}
              <div class="meta-row"><span class="meta-key">model</span><span class="mono">{a.model}</span></div>
            {/if}
            {#if a.workspace}
              <div class="meta-row"><span class="meta-key">workspace</span><span class="mono dim">{a.workspace}</span></div>
            {/if}
            {#if a.agentDir}
              <div class="meta-row"><span class="meta-key">agent dir</span><span class="mono dim">{a.agentDir}</span></div>
            {/if}
          </div>

          <div class="agent-actions">
            <button
              class="primary"
              onclick={() => newSession(a)}
              disabled={creating !== null}
            >
              {creating === a.agentId ? "Creating…" : "＋ New session"}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">No agents returned by the gateway.</div>
  {/if}
</Section>

<style>
  .agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }
  .agent-card {
    background: var(--bg-card);
    border: 1px solid var(--border2);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .agent-card:hover { border-color: var(--border-input); }
  .agent-head { display: flex; align-items: center; gap: 12px; }
  .agent-avatar {
    font-size: 24px;
    width: 44px; height: 44px;
    display: grid; place-items: center;
    background: var(--bg-active);
    border: 1px solid var(--border-input);
    border-radius: 10px;
    flex-shrink: 0;
  }
  .agent-id-block { min-width: 0; }
  .agent-name { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .agent-id { font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
    background: var(--bg-active); color: var(--accent);
    border: 1px solid var(--border-input);
    padding: 2px 6px; border-radius: 999px;
  }
  .agent-meta { display: flex; flex-direction: column; gap: 5px; }
  .meta-row { display: flex; gap: 10px; font-size: 12px; align-items: baseline; min-width: 0; }
  .meta-key { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; width: 74px; flex-shrink: 0; }
  .meta-row .mono { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mono { font-family: "JetBrains Mono", monospace; color: var(--mono); }
  .dim { color: var(--text5); }
  .agent-actions { display: flex; gap: 8px; margin-top: 2px; }
  .primary {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white; border: none; border-radius: 8px;
    padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .primary:disabled { opacity: 0.4; cursor: default; }
  .error {
    background: rgba(179, 54, 74, 0.15); border: 1px solid var(--danger);
    border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--danger-text);
    margin-bottom: 12px;
  }
  .empty { color: var(--muted); padding: 20px; }
</style>
