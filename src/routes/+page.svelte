<script lang="ts">
  import { app, SECTIONS, type Section } from "$lib/state/app.svelte";
  import ChatView from "$lib/views/ChatView.svelte";
  import DashboardView from "$lib/views/DashboardView.svelte";
  import ModelsView from "$lib/views/ModelsView.svelte";
  import ConfigView from "$lib/views/ConfigView.svelte";
  import FilesView from "$lib/views/FilesView.svelte";
  import CronView from "$lib/views/CronView.svelte";
  import ApprovalsView from "$lib/views/ApprovalsView.svelte";
  import SkillsView from "$lib/views/SkillsView.svelte";
  import ToolsView from "$lib/views/ToolsView.svelte";
  import LogsView from "$lib/views/LogsView.svelte";
  import SystemView from "$lib/views/SystemView.svelte";
  import OnboardingView from "$lib/views/OnboardingView.svelte";

  const connected = $derived(app.status === "connected");

  const VIEWS: Record<Section, typeof ChatView> = {
    chat: ChatView,
    dashboard: DashboardView,
    models: ModelsView,
    config: ConfigView,
    files: FilesView,
    cron: CronView,
    approvals: ApprovalsView,
    skills: SkillsView,
    tools: ToolsView,
    logs: LogsView,
    system: SystemView,
    onboarding: OnboardingView,
  };

  const ActiveView = $derived(VIEWS[app.section]);
</script>

{#if !connected}
  <main class="connect-screen">
    <div class="connect-card">
      <div class="claw-mark">🦞</div>
      <h1 class="brand">OpenClaw <span>Pincers</span></h1>
      <p class="tagline">Get a grip on your gateway.</p>

      <label>
        Gateway URL
        <input bind:value={app.gatewayUrl} placeholder="ws://127.0.0.1:18789" spellcheck="false" />
      </label>
      <label>
        Token <span class="hint">(if the gateway requires auth)</span>
        <input bind:value={app.token} type="password" placeholder="gateway token" spellcheck="false" />
      </label>

      <button class="ghost detect" onclick={() => app.detectLocalGateway()}>
        ⚡ Detect local gateway (fills URL + token from ~/.openclaw)
      </button>

      {#if app.connectError}
        <div class="error">{app.connectError}</div>
      {/if}

      <button class="primary" onclick={() => app.connect()} disabled={app.status === "connecting"}>
        {app.status === "connecting" ? "Connecting…" : "Connect"}
      </button>
    </div>
  </main>
{:else}
  <main class="shell">
    <nav class="rail">
      <div class="rail-brand">
        <span class="rail-claw">🦞</span>
        <span class="rail-name">Pincers</span>
      </div>

      <div class="rail-items">
        {#each SECTIONS as s (s.id)}
          <button
            class="rail-item"
            class:active={app.section === s.id}
            onclick={() => (app.section = s.id)}
            title={s.label}
          >
            <span class="rail-icon">{s.icon}</span>
            <span class="rail-label">{s.label}</span>
          </button>
        {/each}
      </div>

      <div class="rail-footer">
        <div class="conn-dot"></div>
        <div class="conn-info">
          <small>v{app.hello?.server.version ?? "?"}</small>
        </div>
        <button class="rail-item" title="Disconnect" onclick={() => app.disconnect()}>
          <span class="rail-icon">⏻</span>
        </button>
      </div>
    </nav>

    <ActiveView />
  </main>
{/if}

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    background: #0b0e14;
    color: #d7dce6;
    height: 100vh;
    overflow: hidden;
  }

  /* ---------- Connect screen ---------- */
  .connect-screen {
    height: 100vh;
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at 30% 20%, #141b2e 0%, #0b0e14 60%);
  }
  .connect-card {
    width: 400px;
    padding: 32px;
    border-radius: 14px;
    background: #11141d;
    border: 1px solid #232a3d;
    box-shadow: 0 0 60px rgba(255, 63, 164, 0.08), 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .claw-mark { font-size: 44px; text-align: center; filter: drop-shadow(0 0 16px rgba(255, 63, 164, 0.7)); }
  .brand { margin: 0; font-size: 26px; letter-spacing: 0.5px; text-align: center; }
  .brand span { color: #ff3fa4; }
  .tagline { margin: 0 0 8px; color: #7c86a0; font-size: 13px; text-align: center; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9aa4bc; }
  .hint { color: #5b6478; font-size: 11px; }
  input {
    background: #0b0e14;
    border: 1px solid #2a3350;
    border-radius: 8px;
    color: #e6ebf5;
    padding: 10px 12px;
    font-size: 14px;
    outline: none;
  }
  input:focus { border-color: #ff3fa4; }
  button { border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: linear-gradient(135deg, #ff3fa4, #7b5bff); color: white; }
  .detect { align-self: flex-start; font-size: 12px; color: #8fa0c8; border: 1px dashed #2a3350; border-radius: 8px; padding: 7px 10px; background: transparent; }
  .detect:hover { color: #ff3fa4; border-color: #ff3fa4; }
  .error {
    background: rgba(179, 54, 74, 0.15);
    border: 1px solid #b3364a;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: #ff9aa8;
  }

  /* ---------- Shell ---------- */
  .shell { display: flex; height: 100vh; }
  .rail {
    width: 86px;
    background: #0e1119;
    border-right: 1px solid #1d2333;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .rail-brand {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 14px 0 10px; border-bottom: 1px solid #1d2333; width: 100%;
  }
  .rail-claw { font-size: 24px; filter: drop-shadow(0 0 8px rgba(255, 63, 164, 0.6)); }
  .rail-name { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #ff3fa4; text-transform: uppercase; }
  .rail-items { flex: 1; overflow-y: auto; width: 100%; padding: 8px 6px; display: flex; flex-direction: column; gap: 2px; }
  .rail-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: transparent; color: #7c86a0; padding: 8px 2px; border-radius: 10px;
    font-weight: 500; width: 100%;
  }
  .rail-item:hover { background: #161b28; color: #d7dce6; }
  .rail-item.active { background: #1c2337; color: #fff; box-shadow: inset 0 0 0 1px #2a3350, inset 2px 0 0 #ff3fa4; }
  .rail-icon { font-size: 17px; }
  .rail-label { font-size: 9px; letter-spacing: 0.3px; }
  .rail-footer {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 10px 0; border-top: 1px solid #1d2333; width: 100%;
  }
  .conn-dot { width: 8px; height: 8px; border-radius: 50%; background: #3fdd8c; box-shadow: 0 0 8px #3fdd8c; }
  .conn-info small { color: #5b6478; font-size: 9px; }
</style>
