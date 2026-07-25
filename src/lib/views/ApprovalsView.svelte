<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  type Approval = { id?: string; command?: string; [k: string]: unknown };

  let loading = $state(false);
  let error = $state("");
  let notice = $state("");
  let approvals = $state<Approval[]>([]);
  let rawFallback = $state<unknown>(null);

  function approvalId(a: Approval): string {
    return String(a.id ?? a.approvalId ?? a.requestId ?? "");
  }

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("exec.approval.list", {});
    if (!res.ok) error = res.error;
    else {
      const d = res.data as Record<string, unknown>;
      const rows = Array.isArray(d) ? d : ((d?.approvals ?? d?.pending ?? d?.items ?? null) as unknown[] | null);
      if (Array.isArray(rows)) {
        approvals = rows as Approval[];
        rawFallback = null;
      } else {
        approvals = [];
        rawFallback = res.data;
      }
    }
    loading = false;
  }

  async function resolve(a: Approval, decision: "allow" | "deny") {
    const res = await app.rpc("exec.approval.resolve", { id: approvalId(a), decision });
    if (!res.ok) error = res.error;
    else notice = `${decision === "allow" ? "Approved" : "Denied"}: ${String(a.command ?? approvalId(a)).slice(0, 80)}`;
    await load();
  }

  $effect(() => {
    void load();
    const t = setInterval(load, 5000); // pending approvals are time-sensitive
    return () => clearInterval(t);
  });
</script>

<Section title="Approvals" subtitle="pending exec approval requests (auto-refresh 5s)" {loading} {error} onrefresh={load}>
  {#if notice}<div class="notice">{notice}</div>{/if}

  {#if approvals.length}
    <div class="list">
      {#each approvals as a (approvalId(a))}
        <div class="card">
          <div class="cmd mono">{String(a.command ?? a.cmd ?? a.title ?? approvalId(a))}</div>
          {#if Object.keys(a).length > 2}
            <details><summary>details</summary><JsonView data={a} /></details>
          {/if}
          <div class="ops">
            <button class="allow" onclick={() => resolve(a, "allow")}>✓ Allow</button>
            <button class="deny" onclick={() => resolve(a, "deny")}>✕ Deny</button>
          </div>
        </div>
      {/each}
    </div>
  {:else if rawFallback}
    <JsonView data={rawFallback} />
  {:else if !loading}
    <div class="empty">🦞 No pending approvals. The grid is calm.</div>
  {/if}
</Section>

<style>
  .notice { background: rgba(63, 221, 140, 0.1); border: 1px solid #2a7a52; color: #7fe6b0; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
  .list { display: flex; flex-direction: column; gap: 12px; }
  .card { background: #11141d; border: 1px solid #6e5b1f; border-radius: 12px; padding: 16px; }
  .cmd { font-size: 13px; color: #ffcf6e; word-break: break-all; }
  .mono { font-family: "JetBrains Mono", monospace; }
  details { margin-top: 10px; font-size: 12px; color: #5b6478; }
  summary { cursor: pointer; }
  .ops { display: flex; gap: 10px; margin-top: 14px; }
  .allow { background: rgba(63, 221, 140, 0.12); border: 1px solid #2a7a52; color: #7fe6b0; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .deny { background: rgba(179, 54, 74, 0.12); border: 1px solid #b3364a; color: #ff9aa8; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .empty { color: #5b6478; padding: 40px; text-align: center; font-size: 14px; }
</style>
