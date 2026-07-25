<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";

  type Job = {
    id?: string; jobId?: string; name?: string; enabled?: boolean;
    schedule?: { kind?: string; expr?: string; everyMs?: number; at?: string };
    [k: string]: unknown;
  };

  let loading = $state(false);
  let error = $state("");
  let notice = $state("");
  let jobs = $state<Job[]>([]);
  let showAdd = $state(false);

  // new job form
  let newName = $state("");
  let newCron = $state("");
  let newMessage = $state("");

  function jobId(j: Job): string {
    return String(j.id ?? j.jobId ?? "");
  }

  function scheduleLabel(j: Job): string {
    const s = j.schedule ?? {};
    if (s.kind === "cron") return `cron: ${s.expr ?? "?"}`;
    if (s.kind === "every") return `every ${Math.round((s.everyMs ?? 0) / 60000)}m`;
    if (s.kind === "at") return `at ${s.at ?? "?"}`;
    return s.kind ?? "?";
  }

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("cron.list", { includeDisabled: true, limit: 200 });
    if (!res.ok) error = res.error;
    else {
      const d = res.data as Record<string, unknown>;
      const rows = Array.isArray(d) ? d : ((d?.jobs ?? d?.items ?? []) as unknown[]);
      jobs = (Array.isArray(rows) ? rows : []) as Job[];
    }
    loading = false;
  }

  async function toggle(j: Job) {
    const res = await app.rpc("cron.update", { jobId: jobId(j), patch: { enabled: !j.enabled } });
    if (!res.ok) error = res.error;
    await load();
  }

  async function remove(j: Job) {
    const res = await app.rpc("cron.remove", { jobId: jobId(j) });
    if (!res.ok) error = res.error;
    await load();
  }

  async function runNow(j: Job) {
    const res = await app.rpc("cron.run", { jobId: jobId(j), runMode: "force" });
    notice = res.ok ? `Run enqueued for “${j.name ?? jobId(j)}”.` : "";
    if (!res.ok) error = res.error;
  }

  async function add() {
    if (!newName.trim() || !newCron.trim() || !newMessage.trim()) {
      error = "Name, cron expression, and message are all required.";
      return;
    }
    error = "";
    const res = await app.rpc("cron.add", {
      name: newName.trim(),
      schedule: { kind: "cron", expr: newCron.trim() },
      payload: { kind: "agentTurn", message: newMessage.trim() },
      sessionTarget: "isolated",
      enabled: true,
    });
    if (!res.ok) error = res.error;
    else {
      notice = `Job “${newName.trim()}” created.`;
      showAdd = false;
      newName = newCron = newMessage = "";
      await load();
    }
  }

  $effect(() => {
    void load();
  });
</script>

<Section title="Cron" subtitle="scheduled gateway jobs" {loading} {error} onrefresh={load}>
  {#snippet actions()}
    <button class="primary" onclick={() => (showAdd = !showAdd)}>{showAdd ? "Cancel" : "+ New job"}</button>
  {/snippet}

  {#if notice}<div class="notice">{notice}</div>{/if}

  {#if showAdd}
    <div class="add-form">
      <input bind:value={newName} placeholder="job name" />
      <input bind:value={newCron} placeholder="cron expr, e.g. 0 9 * * * (gateway-local)" class="mono" />
      <textarea bind:value={newMessage} placeholder="agent turn message…" rows="2"></textarea>
      <button class="primary" onclick={add}>Create job</button>
    </div>
  {/if}

  <table>
    <thead><tr><th>Name</th><th>Schedule</th><th>Enabled</th><th></th></tr></thead>
    <tbody>
      {#each jobs as j (jobId(j))}
        <tr>
          <td>{j.name ?? jobId(j)}</td>
          <td class="mono">{scheduleLabel(j)}</td>
          <td>
            <button class="pill" class:on={j.enabled} onclick={() => toggle(j)}>
              {j.enabled ? "on" : "off"}
            </button>
          </td>
          <td class="ops">
            <button class="ghost" onclick={() => runNow(j)}>▶ run</button>
            <button class="ghost danger" onclick={() => remove(j)}>✕</button>
          </td>
        </tr>
      {:else}
        {#if !loading}<tr><td colspan="4" class="empty">No cron jobs.</td></tr>{/if}
      {/each}
    </tbody>
  </table>
</Section>

<style>
  .notice { background: rgba(63, 221, 140, 0.1); border: 1px solid var(--success-border); color: var(--success-text); border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
  .add-form { display: flex; flex-direction: column; gap: 8px; background: var(--bg-card); border: 1px solid var(--border2); border-radius: 10px; padding: 14px; margin-bottom: 14px; }
  .add-form input, .add-form textarea {
    background: var(--bg); border: 1px solid var(--border-input); border-radius: 8px; color: var(--text);
    padding: 9px 12px; font-size: 13px; outline: none; font-family: inherit;
  }
  .add-form input:focus, .add-form textarea:focus { border-color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
  td { padding: 8px 10px; border-bottom: 1px solid var(--bg-msg); }
  .mono { font-family: "JetBrains Mono", monospace; color: var(--text4); font-size: 12px; }
  .pill { border: 1px solid var(--border-input); background: var(--bg-active); color: var(--text5); border-radius: 20px; padding: 3px 12px; font-size: 11px; cursor: pointer; }
  .pill.on { border-color: var(--success-border); color: var(--success-text); background: rgba(63, 221, 140, 0.08); }
  .ops { text-align: right; white-space: nowrap; }
  .ghost { background: transparent; color: var(--text4); border: 1px solid var(--border-input); border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; margin-left: 6px; }
  .ghost:hover { color: var(--accent); border-color: var(--accent); }
  .ghost.danger:hover { color: var(--danger-text); border-color: var(--danger); }
  .primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .empty { color: var(--muted); padding: 20px; text-align: center; }
</style>
