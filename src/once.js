// npm run watch-once
// A single pass, for testing or for reading the document by hand.

import { loadConfig } from "./config.js";
import { log } from "./log.js";
import { acquireLock, loadState, releaseLock, saveState } from "./state.js";
import { reportFailure, runOnce } from "./watcher.js";

const config = loadConfig();
if (!acquireLock()) {
  console.error("A watcher is already running.");
  process.exit(1);
}
const state = loadState();
state.lastActivityAt = new Date().toISOString();
try {
  const reason = await runOnce(config, state);
  if (reason) log(`pass returned: ${reason}`);
  state.lastError = null;
} catch (err) {
  await reportFailure(config, state, err);
  process.exitCode = 1;
} finally {
  saveState(state);
  releaseLock();
}
