// Keeps the document small: only the most recent request threads and status
// replies stay. Each thread is copied to logs/archive.jsonl before deletion.

import fs from "node:fs";
import path from "node:path";
import { runClaude } from "./claude.js";
import { LOG_DIR } from "./config.js";
import { deleteComment, listThread } from "./docs.js";
import { log } from "./log.js";

const ARCHIVE_PATH = path.join(LOG_DIR, "archive.jsonl");
const WORKING = new Set(["working", "blocked", "busy"]);

async function busySessionIds(config) {
  const out = await runClaude(config.claudePath, ["agents", "--json", "--all"], { timeoutMs: 60_000 });
  return new Set(
    JSON.parse(out.stdout)
      .filter((a) => WORKING.has(a.state) || WORKING.has(a.status))
      .map((a) => a.sessionId),
  );
}

/** Delete the oldest request threads beyond `keepThreads`, skipping any whose session is still working. */
export async function pruneThreads(config, state) {
  const roots = Object.keys(state.threads).sort((a, b) =>
    (state.threads[a].createdAt || "").localeCompare(state.threads[b].createdAt || ""),
  );
  let excess = roots.length - config.keepThreads;
  if (excess <= 0) return;

  const busy = await busySessionIds(config);
  for (const rootId of roots) {
    if (excess <= 0) break;
    const thread = state.threads[rootId];
    if (busy.has(thread.sessionId)) continue;

    const rows = await listThread(config, rootId);
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(
      ARCHIVE_PATH,
      JSON.stringify({
        rootId,
        session: thread.name,
        archivedAt: new Date().toISOString(),
        comments: rows.filter((r) => r.verb === "create").map((r) => ({ at: r.at, body: r.payload?.value?.body })),
      }) + "\n",
    );
    await deleteComment(config, rootId);
    delete state.threads[rootId];
    excess -= 1;
    log(`thread ${rootId}: archived and deleted`);
  }
}

/** Delete status replies beyond `keepStatusReplies`, oldest first. */
export async function trimStatus(config) {
  if (!config.statusThreadId) return;
  const replies = (await listThread(config, config.statusThreadId)).filter(
    (r) => r.verb === "create" && r.payload?.value?.parent?.object === "utterance" && r.payload.value.body,
  );
  for (const r of replies.slice(0, Math.max(0, replies.length - config.keepStatusReplies))) {
    await deleteComment(config, r.id);
  }
}
