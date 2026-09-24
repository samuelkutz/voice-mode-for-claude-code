import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "./config.js";

const STATE_PATH = path.join(STATE_DIR, "state.json");
const LOCK_PATH = path.join(STATE_DIR, "lock");
const LOCK_STALE_MS = 10 * 60_000;

const EMPTY = {
  lastSeq: 0,
  lastRunAt: null,
  lastActivityAt: null,
  daily: { date: null, count: 0 },
  // [{ hash, at }] of recent request texts, for de-duplication.
  recent: [],
  // thread root comment id -> { sessionId, name }
  threads: {},
};

export function loadState() {
  if (!fs.existsSync(STATE_PATH)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) };
}

export function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tmp = STATE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
  fs.renameSync(tmp, STATE_PATH);
}

/** A lock, so two watchers never read and forward the same comments. */
export function acquireLock() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try {
    fs.writeFileSync(LOCK_PATH, String(Date.now()), { flag: "wx" });
    return true;
  } catch {
    const since = Number(fs.readFileSync(LOCK_PATH, "utf8")) || 0;
    if (Date.now() - since < LOCK_STALE_MS) return false;
    fs.writeFileSync(LOCK_PATH, String(Date.now()));
    return true;
  }
}

/** A long-running watcher touches its lock every pass so it never looks stale. */
export function refreshLock() {
  fs.writeFileSync(LOCK_PATH, String(Date.now()));
}

export function releaseLock() {
  fs.rmSync(LOCK_PATH, { force: true });
}
