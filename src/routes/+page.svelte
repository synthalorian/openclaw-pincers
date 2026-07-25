<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import { tick } from "svelte";

  let composer = $state("");
  let scrollBox = $state<HTMLElement | null>(null);

  const connected = $derived(app.status === "connected");
  const busy = $derived(app.activeRunId !== null || app.draft.length > 0);

  $effect(() => {
    // auto-scroll on new content
    void app.messages.length;
    void app.draft;
    void tick().then(() => {
      scrollBox?.scrollTo({ top: scrollBox.scrollHeight, behavior: "smooth" });
    });
  });

  async function handleSend() {
    const text = composer;
    composer = "";
    await app.send(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function sessionLabel(key: string): string {
    const row = app.sessions.find((s) => s.key === key);
    return row?.label || key;
  }
</script>

{#if !connected}
  <main class="connect-screen">
    <div class="connect-card">
      <h1 class="brand">OpenClaw <span>Desktop</span> <em class="lobster">🦞</em></h1>
      <p class="tagline">The gateway, on the grid.</p>

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
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="conn-dot"></div>
        <div class="conn-info">
          <strong>v{app.hello?.server.version ?? "?"}</strong>
          <small>{app.hello?.auth.scopes.join(", ")}</small>
        </div>
        <button class="ghost" title="Disconnect" onclick={() => app.disconnect()}>⏻</button>
      </div>

      <div class="sidebar-title">Sessions</div>
      <div class="session-list">
        {#each app.sessions as s (s.key)}
          <button
            class="session-row"
            class:active={s.key === app.activeKey}
            onclick={() => app.selectSession(s.key)}
          >
            <span class="session-name">{sessionLabel(s.key)}</span>
            {#if s.model}<span class="session-model">{s.model}</span>{/if}
          </button>
        {:else}
          <div class="empty">No sessions discovered — chatting with the default session.</div>
        {/each}
      </div>
    </aside>

    <section class="chat">
      <header class="chat-header">
        <h2>{sessionLabel(app.activeKey)}</h2>
        <code>{app.activeKey}</code>
      </header>

      <div class="messages" bind:this={scrollBox}>
        {#if app.loadingHistory}
          <div class="empty">Loading history…</div>
        {/if}
        {#each app.messages as m, i (i)}
          <div class="msg {m.role}">
            <div class="msg-role">{m.role === "user" ? "You" : "Assistant"}{m.aborted ? " (aborted)" : ""}</div>
            <div class="msg-text">{m.text}</div>
          </div>
        {/each}
        {#if app.draft}
          <div class="msg assistant streaming">
            <div class="msg-role">Assistant</div>
            <div class="msg-text">{app.draft}<span class="cursor">▊</span></div>
          </div>
        {:else if busy}
          <div class="msg assistant"><div class="msg-role">Assistant</div><div class="msg-text thinking">thinking…</div></div>
        {/if}
      </div>

      {#if app.chatError}
        <div class="error inline">{app.chatError}</div>
      {/if}

      <footer class="composer">
        <textarea
          bind:value={composer}
          onkeydown={handleKeydown}
          placeholder="Message the agent… (Enter to send, Shift+Enter for newline)"
          rows="2"
        ></textarea>
        {#if busy}
          <button class="danger" onclick={() => app.abort()}>Abort</button>
        {:else}
          <button class="primary" onclick={handleSend} disabled={!composer.trim()}>Send</button>
        {/if}
      </footer>
    </section>
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
    width: 380px;
    padding: 32px;
    border-radius: 14px;
    background: #11141d;
    border: 1px solid #232a3d;
    box-shadow: 0 0 60px rgba(255, 63, 164, 0.08), 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .brand { margin: 0; font-size: 26px; letter-spacing: 0.5px; }
  .brand span { color: #ff3fa4; }
  .lobster { font-style: normal; filter: drop-shadow(0 0 10px rgba(255, 63, 164, 0.6)); }
  .detect { align-self: flex-start; font-size: 12px; color: #8fa0c8; border: 1px dashed #2a3350; border-radius: 8px; padding: 7px 10px; }
  .detect:hover { color: #ff3fa4; border-color: #ff3fa4; }
  .tagline { margin: 0 0 8px; color: #7c86a0; font-size: 13px; }
  label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9aa4bc; }
  .hint { color: #5b6478; font-size: 11px; }
  input, textarea {
    background: #0b0e14;
    border: 1px solid #2a3350;
    border-radius: 8px;
    color: #e6ebf5;
    padding: 10px 12px;
    font-size: 14px;
    outline: none;
  }
  input:focus, textarea:focus { border-color: #ff3fa4; }

  button {
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: linear-gradient(135deg, #ff3fa4, #7b5bff); color: white; }
  .danger { background: #b3364a; color: white; }
  .ghost { background: transparent; color: #7c86a0; padding: 6px 8px; }
  .ghost:hover { color: #ff3fa4; }

  .error {
    background: rgba(179, 54, 74, 0.15);
    border: 1px solid #b3364a;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    color: #ff9aa8;
  }
  .error.inline { margin: 0 16px 8px; }

  /* ---------- Shell ---------- */
  .shell { display: flex; height: 100vh; }
  .sidebar {
    width: 260px;
    background: #0e1119;
    border-right: 1px solid #1d2333;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-bottom: 1px solid #1d2333;
  }
  .conn-dot { width: 9px; height: 9px; border-radius: 50%; background: #3fdd8c; box-shadow: 0 0 8px #3fdd8c; }
  .conn-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .conn-info small { color: #5b6478; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sidebar-title { padding: 12px 14px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5b6478; }
  .session-list { overflow-y: auto; flex: 1; padding: 0 8px 12px; }
  .session-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    text-align: left;
    background: transparent;
    color: #b8c0d4;
    padding: 9px 10px;
    border-radius: 8px;
    font-weight: 500;
  }
  .session-row:hover { background: #161b28; }
  .session-row.active { background: #1c2337; color: #fff; box-shadow: inset 2px 0 0 #ff3fa4; }
  .session-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .session-model { font-size: 10px; color: #5b6478; }
  .empty { color: #5b6478; font-size: 13px; padding: 12px; }

  .chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .chat-header {
    padding: 14px 20px;
    border-bottom: 1px solid #1d2333;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .chat-header h2 { margin: 0; font-size: 16px; }
  .chat-header code { color: #5b6478; font-size: 11px; }

  .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .msg { max-width: 78%; }
  .msg.user { align-self: flex-end; }
  .msg.assistant { align-self: flex-start; }
  .msg-role { font-size: 11px; color: #5b6478; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .msg-text {
    padding: 12px 14px;
    border-radius: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 14px;
    line-height: 1.55;
  }
  .msg.user .msg-text { background: #2a3a6e; border-bottom-right-radius: 4px; }
  .msg.assistant .msg-text { background: #151a28; border: 1px solid #232a3d; border-bottom-left-radius: 4px; }
  .msg.streaming .msg-text { border-color: #ff3fa4; }
  .cursor { animation: blink 1s steps(2) infinite; color: #ff3fa4; }
  @keyframes blink { 50% { opacity: 0; } }
  .thinking { color: #7c86a0; font-style: italic; }

  .composer {
    display: flex;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid #1d2333;
    align-items: flex-end;
  }
  .composer textarea { flex: 1; resize: none; font-family: inherit; }
</style>
