<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import { tick } from "svelte";

  let composer = $state("");
  let scrollBox = $state<HTMLElement | null>(null);

  const busy = $derived(app.activeRunId !== null || app.draft.length > 0);

  $effect(() => {
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

<div class="chat-layout">
  <aside class="session-pane">
    <div class="pane-title">Sessions</div>
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
        <div class="empty">No sessions discovered.</div>
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
</div>

<style>
  .chat-layout { display: flex; flex: 1; min-height: 0; }
  .session-pane {
    width: 230px;
    border-right: 1px solid #1d2333;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: #0e1119;
  }
  .pane-title { padding: 12px 14px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5b6478; }
  .session-list { overflow-y: auto; flex: 1; padding: 0 8px 12px; }
  .session-row {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    width: 100%; text-align: left; background: transparent; color: #b8c0d4;
    padding: 9px 10px; border-radius: 8px; font-weight: 500; border: none; cursor: pointer;
  }
  .session-row:hover { background: #161b28; }
  .session-row.active { background: #1c2337; color: #fff; box-shadow: inset 2px 0 0 #ff3fa4; }
  .session-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .session-model { font-size: 10px; color: #5b6478; }
  .empty { color: #5b6478; font-size: 13px; padding: 12px; }

  .chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .chat-header { padding: 14px 20px; border-bottom: 1px solid #1d2333; display: flex; align-items: baseline; gap: 12px; }
  .chat-header h2 { margin: 0; font-size: 16px; }
  .chat-header code { color: #5b6478; font-size: 11px; }

  .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .msg { max-width: 78%; }
  .msg.user { align-self: flex-end; }
  .msg.assistant { align-self: flex-start; }
  .msg-role { font-size: 11px; color: #5b6478; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .msg-text { padding: 12px 14px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.55; }
  .msg.user .msg-text { background: #2a3a6e; border-bottom-right-radius: 4px; }
  .msg.assistant .msg-text { background: #151a28; border: 1px solid #232a3d; border-bottom-left-radius: 4px; }
  .msg.streaming .msg-text { border-color: #ff3fa4; }
  .cursor { animation: blink 1s steps(2) infinite; color: #ff3fa4; }
  @keyframes blink { 50% { opacity: 0; } }
  .thinking { color: #7c86a0; font-style: italic; }

  .error.inline {
    margin: 0 16px 8px; background: rgba(179, 54, 74, 0.15); border: 1px solid #b3364a;
    border-radius: 8px; padding: 10px 12px; font-size: 13px; color: #ff9aa8;
  }
  .composer { display: flex; gap: 10px; padding: 14px 16px; border-top: 1px solid #1d2333; align-items: flex-end; }
  .composer textarea {
    flex: 1; resize: none; font-family: inherit; background: #0b0e14; border: 1px solid #2a3350;
    border-radius: 8px; color: #e6ebf5; padding: 10px 12px; font-size: 14px; outline: none;
  }
  .composer textarea:focus { border-color: #ff3fa4; }
  button { border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: linear-gradient(135deg, #ff3fa4, #7b5bff); color: white; }
  .danger { background: #b3364a; color: white; }
</style>
