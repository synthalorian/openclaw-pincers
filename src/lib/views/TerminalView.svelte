<script lang="ts">
  import { app } from "$lib/state/app.svelte";
  import Section from "$lib/components/Section.svelte";
  import { Terminal } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { onMount, onDestroy } from "svelte";
  import "@xterm/xterm/css/xterm.css";

  let host = $state<HTMLElement | null>(null);
  let term: Terminal | null = null;
  let fit: FitAddon | null = null;
  let sessionId = $state("");
  let meta = $state<{ agentId?: string; shell?: string; cwd?: string }>({});
  let termState = $state<"idle" | "opening" | "live" | "ended">("idle");
  let error = $state("");
  let unsub: (() => void) | null = null;
  let ro: ResizeObserver | null = null;

  async function openTerm() {
    if (!host || termState === "opening" || termState === "live") return;
    error = "";
    termState = "opening";

    term?.dispose();
    term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
      theme: { background: "#00000000" }, // inherit app theme bg
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    const res = await app.rpc("terminal.open", { cols: term.cols, rows: term.rows });
    if (!res.ok) {
      error = res.error;
      termState = "idle";
      return;
    }
    const d = res.data as Record<string, unknown>;
    sessionId = String(d.sessionId ?? "");
    meta = { agentId: String(d.agentId ?? ""), shell: String(d.shell ?? ""), cwd: String(d.cwd ?? "") };
    termState = "live";

    term.onData((data) => {
      if (sessionId) void app.rpc("terminal.input", { sessionId, data });
    });

    unsub = app.client.onEvent((event, payload) => {
      const p = payload as Record<string, unknown>;
      if (p?.sessionId !== sessionId) return;
      if (event === "terminal.data") term?.write(String(p.data ?? ""));
      if (event === "terminal.exit") {
        termState = "ended";
        term?.write(`\r\n\x1b[2m[session ended: ${String(p.reason ?? "exit")}]\x1b[0m\r\n`);
      }
    });

    ro = new ResizeObserver(() => {
      if (!fit || !term || !sessionId) return;
      fit.fit();
      void app.rpc("terminal.resize", { sessionId, cols: term.cols, rows: term.rows });
    });
    ro.observe(host);
  }

  async function closeTerm() {
    if (sessionId) await app.rpc("terminal.close", { sessionId });
    cleanup();
    termState = "idle";
    sessionId = "";
  }

  function cleanup() {
    unsub?.();
    unsub = null;
    ro?.disconnect();
    ro = null;
  }

  onDestroy(() => {
    if (sessionId) void app.rpc("terminal.close", { sessionId });
    cleanup();
    term?.dispose();
  });
</script>

<Section title="Terminal" subtitle="host PTY over the gateway (terminal.*)" error={error}>
  {#snippet actions()}
    {#if termState === "live"}
      <button class="ghost" onclick={closeTerm}>✕ Close</button>
    {:else}
      <button class="primary" onclick={openTerm} disabled={termState === "opening"}>
        {termState === "opening" ? "Opening…" : termState === "ended" ? "↻ Reopen" : "▶ Open terminal"}
      </button>
    {/if}
  {/snippet}

  {#if meta.cwd && termState !== "idle"}
    <div class="meta mono">{meta.agentId} · {meta.shell} · {meta.cwd}</div>
  {/if}

  <div class="term-wrap" class:hidden={termState === "idle"}>
    <div class="term-host" bind:this={host}></div>
  </div>

  {#if termState === "idle"}
    <div class="empty">⌨️ Open a terminal to run commands on the gateway host.</div>
  {/if}
</Section>

<style>
  .meta { color: var(--text5); font-size: 11.5px; margin-bottom: 8px; word-break: break-all; }
  .term-wrap { background: var(--bg); border: 1px solid var(--border2); border-radius: 12px; padding: 8px; height: 60vh; min-height: 320px; }
  .term-wrap.hidden { display: none; }
  .term-host { width: 100%; height: 100%; }
  .term-host :global(.xterm) { height: 100%; padding: 4px; }
  .empty { color: var(--text5); font-size: 13px; padding: 32px 0; text-align: center; }
  button { border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.4; }
  .primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; }
  .ghost { background: transparent; color: var(--text4); border: 1px solid var(--border-input); }
  .ghost:hover { color: var(--accent); border-color: var(--accent); }
</style>
