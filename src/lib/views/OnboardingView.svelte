<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import JsonView from "$lib/components/JsonView.svelte";

  let loading = $state(false);
  let error = $state("");
  let wizardStatus = $state<unknown>(null);
  let wizardSession = $state<unknown>(null);

  async function load() {
    loading = true;
    error = "";
    const res = await app.rpc("wizard.status", {});
    wizardStatus = res.ok ? res.data : { error: res.error };
    loading = false;
  }

  async function startWizard(mode: "local" | "remote") {
    loading = true;
    error = "";
    const res = await app.rpc("wizard.start", { mode });
    if (!res.ok) error = res.error;
    else wizardSession = res.data;
    loading = false;
  }

  async function cancelWizard() {
    const d = wizardSession as Record<string, unknown> | null;
    const sessionId = d?.sessionId as string | undefined;
    if (sessionId) await app.rpc("wizard.cancel", { sessionId });
    wizardSession = null;
    await load();
  }

  $effect(() => {
    void load();
  });
</script>

<Section title="Setup" subtitle="onboarding and gateway setup wizard" {loading} {error} onrefresh={load}>
  <div class="cards">
    <div class="card hero">
      <div class="lobster">🦞</div>
      <h3>Welcome to OpenClaw Pincers</h3>
      <p>
        You're connected to gateway <strong>v{app.hello?.server.version}</strong> with
        scopes <code>{app.hello?.auth.scopes.join(", ")}</code>. From here you can chat, edit config,
        manage cron, browse workspaces, approve execs, and run updates — everything the CLI does,
        with claws.
      </p>
    </div>

    <div class="card">
      <div class="card-title">Setup Wizard</div>
      {#if wizardSession}
        <p class="sub">Wizard in progress:</p>
        <JsonView data={wizardSession} />
        <button class="ghost" style="margin-top:10px" onclick={cancelWizard}>Cancel wizard</button>
      {:else}
        <p class="sub">Run the gateway onboarding wizard over RPC.</p>
        <div class="ops">
          <button class="primary" onclick={() => startWizard("local")}>Start local wizard</button>
          <button class="ghost" onclick={() => startWizard("remote")}>Start remote wizard</button>
        </div>
      {/if}
    </div>

    <div class="card wide">
      <div class="card-title">Wizard Status</div>
      {#if wizardStatus}<JsonView data={wizardStatus} />{:else}<div class="sub">loading…</div>{/if}
    </div>
  </div>
</Section>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; }
  .card { background: #11141d; border: 1px solid #232a3d; border-radius: 12px; padding: 18px; }
  .card.wide { grid-column: 1 / -1; }
  .card.hero { background: linear-gradient(135deg, #1a1030, #11141d); border-color: #7b5bff; }
  .lobster { font-size: 40px; filter: drop-shadow(0 0 14px rgba(255, 63, 164, 0.7)); }
  .card.hero h3 { margin: 8px 0; font-size: 18px; }
  .card.hero p { font-size: 13px; color: #9aa4bc; line-height: 1.6; }
  .card.hero code { color: #a8e6c8; font-size: 11px; }
  .card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5b6478; margin-bottom: 10px; }
  .sub { font-size: 12px; color: #7c86a0; }
  .ops { display: flex; gap: 10px; margin-top: 10px; }
  .primary { background: linear-gradient(135deg, #ff3fa4, #7b5bff); color: white; border: none; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .ghost { background: #1c2337; color: #8fa0c8; border: 1px solid #2a3350; border-radius: 8px; padding: 9px 14px; font-size: 12px; cursor: pointer; }
  .ghost:hover { color: #ff3fa4; border-color: #ff3fa4; }
</style>
