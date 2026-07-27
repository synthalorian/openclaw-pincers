<script lang="ts">
  import { app, SECTIONS, type Section } from "$lib/state/app.svelte";
  import ChatView from "$lib/views/ChatView.svelte";
  import AgentsView from "$lib/views/AgentsView.svelte";
  import DashboardView from "$lib/views/DashboardView.svelte";
  import ModelsView from "$lib/views/ModelsView.svelte";
  import ConfigView from "$lib/views/ConfigView.svelte";
  import FilesView from "$lib/views/FilesView.svelte";
  import CronView from "$lib/views/CronView.svelte";
  import ApprovalsView from "$lib/views/ApprovalsView.svelte";
  import DevicesView from "$lib/views/DevicesView.svelte";
  import TerminalView from "$lib/views/TerminalView.svelte";
  import SkillsView from "$lib/views/SkillsView.svelte";
  import ToolsView from "$lib/views/ToolsView.svelte";
  import LogsView from "$lib/views/LogsView.svelte";
  import SystemView from "$lib/views/SystemView.svelte";
  import OnboardingView from "$lib/views/OnboardingView.svelte";
  import ThemePicker from "$lib/components/ThemePicker.svelte";

  let themePickerOpen = $state(false);
  let moreOpen = $state(false);

  const connected = $derived(app.status === "connected");

  // Bottom tab bar (mobile): primary sections + "More" sheet for the rest.
  const PRIMARY_TABS: Section[] = ["chat", "agents", "approvals", "cron", "dashboard"];
  const primaryTabs = $derived(SECTIONS.filter((s) => PRIMARY_TABS.includes(s.id)));

  function goSection(id: Section) {
    app.section = id;
    moreOpen = false;
  }

  const VIEWS: Record<Section, typeof ChatView> = {
    chat: ChatView,
    agents: AgentsView,
    dashboard: DashboardView,
    models: ModelsView,
    config: ConfigView,
    files: FilesView,
    cron: CronView,
    approvals: ApprovalsView,
    devices: DevicesView,
    terminal: TerminalView,
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
      <div class="claw-mark"><img src="/pincers-logo.png" alt="OpenClaw Pincers logo" /></div>
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

      {#if app.pairing}
        <div class="pairing">
          <div class="pairing-title">🦞 Pairing approval needed</div>
          <p>This device introduced itself to the gateway and is waiting for approval.
          Approve it from any terminal:</p>
          <code>openclaw devices approve {app.pairing.requestId || "<requestId>"}</code>
          <p class="retrying">Auto-retrying… (attempt {app.pairing.attempts})</p>
        </div>
      {/if}

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
        <img class="rail-logo" src="/pincers-logo.png" alt="Pincers" />
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
        <button class="rail-item" title="Themes" onclick={() => (themePickerOpen = !themePickerOpen)}>
          <span class="rail-icon">🎨</span>
        </button>
        <div class="conn-dot"></div>
        <div class="conn-info">
          <small>v{app.hello?.server.version ?? "?"}</small>
        </div>
        <button class="rail-item" title="Disconnect" onclick={() => app.disconnect()}>
          <span class="rail-icon">⏻</span>
        </button>
      </div>
    </nav>

    <ThemePicker bind:open={themePickerOpen} />
    <ActiveView />

    <!-- Mobile bottom tab bar -->
    <nav class="tabbar">
      {#each primaryTabs as s (s.id)}
        <button
          class="tab"
          class:active={app.section === s.id && !moreOpen}
          onclick={() => goSection(s.id)}
        >
          <span class="tab-icon">{s.icon}</span>
          <span class="tab-label">{s.label}</span>
        </button>
      {/each}
      <button class="tab" class:active={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
        <span class="tab-icon">⋯</span>
        <span class="tab-label">More</span>
      </button>
    </nav>

    <!-- Mobile "More" bottom sheet -->
    {#if moreOpen}
      <button class="sheet-scrim" aria-label="close menu" onclick={() => (moreOpen = false)}></button>
      <div class="sheet">
        <div class="sheet-grip"></div>
        <div class="sheet-title">All sections</div>
        <div class="sheet-grid">
          {#each SECTIONS as s (s.id)}
            <button
              class="sheet-item"
              class:active={app.section === s.id}
              onclick={() => goSection(s.id)}
            >
              <span class="sheet-icon">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          {/each}
        </div>
        <div class="sheet-actions">
          <button class="sheet-action" onclick={() => { moreOpen = false; themePickerOpen = true; }}>
            <span class="sheet-icon">🎨</span> Themes
          </button>
          <button class="sheet-action danger" onclick={() => app.disconnect()}>
            <span class="sheet-icon">⏻</span> Disconnect
          </button>
        </div>
        <div class="sheet-conn">
          <span class="conn-dot"></span>
          <span>gateway v{app.hello?.server.version ?? "?"}</span>
        </div>
      </div>
    {/if}
  </main>
{/if}

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    overflow: hidden;
  }

  /* ---------- Connect screen ---------- */
  .connect-screen {
    height: 100vh;
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at 30% 20%, var(--bg-card) 0%, var(--bg) 60%);
  }
  .connect-card {
    width: 400px;
    padding: 32px;
    border-radius: 14px;
    background: var(--bg-card);
    border: 1px solid var(--border2);
    box-shadow: 0 0 60px rgba(255, 63, 164, 0.08), 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .claw-mark img {
    width: 132px; height: 132px; border-radius: 28px;
    box-shadow: 0 0 44px rgba(255, 63, 164, 0.45), 0 12px 32px rgba(0, 0, 0, 0.6);
  }
  .claw-mark { text-align: center; }
  .brand { margin: 0; font-size: 26px; letter-spacing: 0.5px; text-align: center; }
  .brand span { color: var(--accent); }
  .tagline { margin: 0 0 8px; color: var(--text5); font-size: 13px; text-align: center; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text3); }
  .hint { color: var(--muted); font-size: 11px; }
  input {
    background: var(--bg);
    border: 1px solid var(--border-input);
    border-radius: 8px;
    color: var(--text);
    padding: 10px 12px;
    font-size: 14px;
    outline: none;
  }
  input:focus { border-color: var(--accent); }
  button { border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; }
  .detect { align-self: flex-start; font-size: 12px; color: var(--text4); border: 1px dashed var(--border-input); border-radius: 8px; padding: 7px 10px; background: transparent; }
  .detect:hover { color: var(--accent); border-color: var(--accent); }
  .error {
    background: rgba(179, 54, 74, 0.15);
    border: 1px solid var(--danger);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--danger-text);
  }
  .pairing {
    background: rgba(255, 207, 110, 0.08);
    border: 1px solid var(--warning-border);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 12.5px;
    color: var(--warning-text);
  }
  .pairing-title { font-weight: 700; color: var(--warning); margin-bottom: 6px; }
  .pairing p { margin: 6px 0; color: var(--text4); line-height: 1.5; }
  .pairing code {
    display: block; background: var(--bg); border: 1px solid var(--border-input); border-radius: 6px;
    padding: 8px 10px; margin: 8px 0; font-size: 11.5px; color: var(--warning); word-break: break-all;
  }
  .pairing .retrying { color: var(--text5); font-size: 11px; font-style: italic; }

  /* ---------- Shell ---------- */
  .shell { display: flex; height: 100vh; height: 100dvh; padding-top: env(safe-area-inset-top, 0px); }
  .rail {
    width: 86px;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .rail-brand {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 14px 0 10px; border-bottom: 1px solid var(--border); width: 100%;
  }
  .rail-logo {
    width: 34px; height: 34px; border-radius: 9px;
    box-shadow: 0 0 10px rgba(255, 63, 164, 0.5);
  }
  .rail-name { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: var(--accent); text-transform: uppercase; }
  .rail-items { flex: 1; overflow-y: auto; width: 100%; padding: 8px 6px; display: flex; flex-direction: column; gap: 2px; }
  .rail-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    background: transparent; color: var(--text5); padding: 8px 2px; border-radius: 10px;
    font-weight: 500; width: 100%;
  }
  .rail-item:hover { background: var(--bg-hover); color: var(--text); }
  .rail-item.active { background: var(--bg-active); color: #fff; box-shadow: inset 0 0 0 1px var(--border-input), inset 2px 0 0 var(--accent); }
  .rail-icon { font-size: 17px; }
  .rail-label { font-size: 9px; letter-spacing: 0.3px; }
  .rail-footer {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 10px 0; border-top: 1px solid var(--border); width: 100%;
  }
  .conn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); }
  .conn-info small { color: var(--muted); font-size: 9px; }

  /* ---------- Mobile tab bar + sheet (hidden on desktop) ---------- */
  .tabbar, .sheet, .sheet-scrim { display: none; }

  @media (max-width: 720px) {
    .shell { flex-direction: column; }
    .rail { display: none; }

    .tabbar {
      display: flex;
      flex-shrink: 0;
      background: var(--bg-panel);
      border-top: 1px solid var(--border);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .tab {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: transparent; border: none; color: var(--text5);
      padding: 8px 2px 6px; min-height: 52px; cursor: pointer; font-weight: 500;
    }
    .tab:active { background: var(--bg-hover); }
    .tab.active { color: var(--accent); }
    .tab-icon { font-size: 20px; }
    .tab-label { font-size: 10px; letter-spacing: 0.2px; }

    .sheet-scrim {
      display: block; position: fixed; inset: 0; z-index: 44;
      background: rgba(0, 0, 0, 0.55); border: none;
    }
    .sheet {
      display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 45;
      background: var(--bg-panel); border-top: 1px solid var(--border2);
      border-radius: 16px 16px 0 0; padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.6);
      max-height: 72vh; overflow-y: auto;
    }
    .sheet-grip { width: 36px; height: 4px; border-radius: 2px; background: var(--border-input); margin: 4px auto 10px; }
    .sheet-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 10px; }
    .sheet-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sheet-item {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      background: var(--bg-card); border: 1px solid var(--border2); border-radius: 10px;
      padding: 12px 6px; color: var(--text2); font-size: 12px; font-weight: 500; cursor: pointer;
    }
    .sheet-item.active { border-color: var(--accent); color: var(--accent); }
    .sheet-icon { font-size: 20px; }
    .sheet-actions { display: flex; gap: 8px; margin-top: 12px; }
    .sheet-action {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
      background: var(--bg-card); border: 1px solid var(--border2); border-radius: 10px;
      padding: 12px; color: var(--text2); font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .sheet-action.danger { color: var(--danger-text); border-color: var(--danger); }
    .sheet-conn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 12px; font-size: 11px; color: var(--muted);
    }
  }

  /* Connect screen small-device fit */
  @media (max-width: 480px) {
    .connect-card { width: 92vw; padding: 24px 20px; }
    .claw-mark img { width: 108px; height: 108px; border-radius: 24px; }
  }
</style>
