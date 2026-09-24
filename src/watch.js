// npm run watch
// Reads the document every few minutes in this visible process. Stops by
// itself after the idle limit, on a spoken
// "turn off the watcher", or with Ctrl+C.

import { loadConfig } from "./config.js";
import { trimStatus } from "./cleanup.js";
import { postStatus } from "./docs.js";
import { log } from "./log.js";
import { acquireLock, loadState, refreshLock, releaseLock, saveState } from "./state.js";
import { reportFailure, runOnce } from "./watcher.js";

const STOP_MESSAGES = {
  idle: (c) => `Vigia desligado depois de ${c.idleOffMinutes} minutos sem pedido.`,
  off: () => "Vigia desligado por pedido de voz.",
  interrupted: () => "Vigia desligado no PC.",
};

const config = loadConfig();
if (!acquireLock()) {
  console.error("Another watcher is already running.");
  process.exit(1);
}

const state = loadState();
state.lastActivityAt = new Date().toISOString();
saveState(state);

let stopping = false;
async function stop(reason) {
  if (stopping) return;
  stopping = true;
  log(`watcher stopped: ${reason}`);
  saveState(state);
  releaseLock();
  await postStatus(config, STOP_MESSAGES[reason](config)).catch(() => {});
  await trimStatus(config).catch((err) => log(`status cleanup failed: ${err.message}`));
  process.exit(0);
}
// Ctrl+C, closing the window, or a stop from the Claude Code session running it.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop("interrupted"));

log(`watcher started, every ${config.intervalMinutes} min`);
await postStatus(config, `Vigia ligado. Lendo o documento a cada ${config.intervalMinutes} minutos.`).catch(() => {});
await trimStatus(config).catch((err) => log(`status cleanup failed: ${err.message}`));

while (!stopping) {
  refreshLock();
  let reason = null;
  try {
    reason = await runOnce(config, state);
    state.lastError = null;
  } catch (err) {
    await reportFailure(config, state, err);
  }
  saveState(state);
  if (reason) await stop(reason);
  await new Promise((r) => setTimeout(r, config.intervalMinutes * 60_000));
}
