<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import { tick } from "svelte";
  import type { ChatAttachment } from "$lib/gateway/protocol";

  const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // gateway MAX_IMAGE_BYTES

  interface PendingImage {
    name: string;
    mime: string;
    dataUrl: string;
    size: number;
  }

  let composer = $state("");
  let scrollBox = $state<HTMLElement | null>(null);
  let pending = $state<PendingImage[]>([]);
  let attachError = $state("");
  let dragOver = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);
  let lightbox = $state<string | null>(null);

  const busy = $derived(app.activeRunId !== null || app.draft.length > 0);

  $effect(() => {
    void app.messages.length;
    void app.draft;
    void tick().then(() => {
      scrollBox?.scrollTo({ top: scrollBox.scrollHeight, behavior: "smooth" });
    });
  });

  function addFiles(files: Iterable<File>) {
    attachError = "";
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        attachError = `Only image/* files for now (“${file.name}” is ${file.type || "unknown"}).`;
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        attachError = `“${file.name}” is ${(file.size / 1048576).toFixed(1)}MB — gateway image limit is 6MB.`;
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        pending.push({ name: file.name, mime: file.type, dataUrl: String(reader.result), size: file.size });
      };
      reader.readAsDataURL(file);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const files = e.dataTransfer?.files;
    if (files?.length) addFiles(files);
  }

  function removePending(idx: number) {
    pending.splice(idx, 1);
  }

  async function handleSend() {
    const text = composer;
    const imgs = pending;
    composer = "";
    pending = [];
    attachError = "";
    const attachments: ChatAttachment[] | undefined = imgs.length
      ? imgs.map((i) => ({
          type: "image",
          fileName: i.name,
          mimeType: i.mime,
          content: i.dataUrl, // gateway strips the data: prefix
        }))
      : undefined;
    await app.send(text, attachments, imgs.map((i) => i.dataUrl));
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

  <section
    class="chat"
    class:drag-over={dragOver}
    role="region"
    aria-label="Chat with image drop zone"
    ondragover={(e) => { e.preventDefault(); dragOver = true; }}
    ondragleave={() => (dragOver = false)}
    ondrop={handleDrop}
  >
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
          {#if m.images?.length}
            <div class="msg-images">
              {#each m.images as src (src.slice(0, 64))}
                <button class="thumb-btn" onclick={() => (lightbox = src)}>
                  <img class="thumb" {src} alt="attachment" />
                </button>
              {/each}
            </div>
          {/if}
          {#if m.text}<div class="msg-text">{m.text}</div>{/if}
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
    {#if attachError}
      <div class="error inline">{attachError}</div>
    {/if}

    {#if pending.length}
      <div class="pending-strip">
        {#each pending as p, idx (p.dataUrl.slice(0, 64))}
          <div class="pending-chip">
            <img src={p.dataUrl} alt={p.name} />
            <span class="pending-name">{p.name}</span>
            <button class="pending-x" onclick={() => removePending(idx)} title="remove">✕</button>
          </div>
        {/each}
      </div>
    {/if}

    <footer class="composer">
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        multiple
        class="hidden-input"
        onchange={(e) => { addFiles(e.currentTarget.files ?? []); e.currentTarget.value = ""; }}
      />
      <button class="attach" title="Attach images" onclick={() => fileInput?.click()}>📎</button>
      <textarea
        bind:value={composer}
        onkeydown={handleKeydown}
        onpaste={handlePaste}
        placeholder="Message the agent… (Enter to send, paste or drop images)"
        rows="2"
      ></textarea>
      {#if busy}
        <button class="danger" onclick={() => app.abort()}>Abort</button>
      {:else}
        <button class="primary" onclick={handleSend} disabled={!composer.trim() && !pending.length}>Send</button>
      {/if}
    </footer>
  </section>

  {#if lightbox}
    <button class="lightbox" onclick={() => (lightbox = null)}>
      <img src={lightbox} alt="attachment preview" />
    </button>
  {/if}
</div>

<style>
  .chat-layout { display: flex; flex: 1; min-height: 0; }
  .session-pane {
    width: 230px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--bg-panel);
  }
  .pane-title { padding: 12px 14px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); }
  .session-list { overflow-y: auto; flex: 1; padding: 0 8px 12px; }
  .session-row {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    width: 100%; text-align: left; background: transparent; color: var(--text2);
    padding: 9px 10px; border-radius: 8px; font-weight: 500; border: none; cursor: pointer;
  }
  .session-row:hover { background: var(--bg-hover); }
  .session-row.active { background: var(--bg-active); color: #fff; box-shadow: inset 2px 0 0 var(--accent); }
  .session-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .session-model { font-size: 10px; color: var(--muted); }
  .empty { color: var(--muted); font-size: 13px; padding: 12px; }

  .chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .chat-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: baseline; gap: 12px; }
  .chat-header h2 { margin: 0; font-size: 16px; }
  .chat-header code { color: var(--muted); font-size: 11px; }

  .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
  .msg { max-width: 78%; }
  .msg.user { align-self: flex-end; }
  .msg.assistant { align-self: flex-start; }
  .msg-role { font-size: 11px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .msg-text { padding: 12px 14px; border-radius: 12px; white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.55; }
  .msg.user .msg-text { background: var(--bubble-user); border-bottom-right-radius: 4px; }
  .msg.assistant .msg-text { background: var(--bg-msg); border: 1px solid var(--border2); border-bottom-left-radius: 4px; }
  .msg.streaming .msg-text { border-color: var(--accent); }
  .cursor { animation: blink 1s steps(2) infinite; color: var(--accent); }
  @keyframes blink { 50% { opacity: 0; } }
  .thinking { color: var(--text5); font-style: italic; }

  .error.inline {
    margin: 0 16px 8px; background: rgba(179, 54, 74, 0.15); border: 1px solid var(--danger);
    border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--danger-text);
  }
  .composer { display: flex; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--border); align-items: flex-end; }
  .composer textarea {
    flex: 1; resize: none; font-family: inherit; background: var(--bg); border: 1px solid var(--border-input);
    border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 14px; outline: none;
  }
  .composer textarea:focus { border-color: var(--accent); }
  .hidden-input { display: none; }
  .attach {
    background: var(--bg-active); border: 1px solid var(--border-input); border-radius: 8px;
    padding: 10px 12px; font-size: 16px; cursor: pointer; color: var(--text3);
  }
  .attach:hover { color: var(--accent); border-color: var(--accent); }

  .chat.drag-over { outline: 2px dashed var(--accent); outline-offset: -4px; }

  .pending-strip {
    display: flex; gap: 10px; padding: 8px 16px; overflow-x: auto;
    border-top: 1px solid var(--border);
  }
  .pending-chip {
    position: relative; display: flex; align-items: center; gap: 8px;
    background: var(--bg-card); border: 1px solid var(--border2); border-radius: 8px; padding: 6px 8px;
  }
  .pending-chip img { width: 40px; height: 40px; object-fit: cover; border-radius: 5px; }
  .pending-name { font-size: 11px; color: var(--text4); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pending-x {
    background: transparent; border: none; color: var(--muted); cursor: pointer;
    font-size: 12px; padding: 2px 4px;
  }
  .pending-x:hover { color: var(--danger-text); }

  .msg-images { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .thumb-btn { background: none; border: none; padding: 0; cursor: zoom-in; }
  .thumb { max-width: 220px; max-height: 160px; border-radius: 8px; border: 1px solid var(--border2); }

  .lightbox {
    position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.85);
    border: none; cursor: zoom-out; display: grid; place-items: center;
  }
  .lightbox img { max-width: 92vw; max-height: 92vh; border-radius: 10px; box-shadow: 0 20px 80px rgba(0,0,0,0.8); }
  button { border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; }
  .danger { background: var(--danger); color: white; }
</style>
