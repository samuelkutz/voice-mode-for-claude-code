// One watcher pass: read new comments addressed to Claude and forward each one
// to a Claude Code session. `watch.js` repeats it; `once.js` runs it once.

import crypto from "node:crypto";
import { runClaude } from "./claude.js";
import { pruneThreads } from "./cleanup.js";
import { postReply, postStatus, queryComments } from "./docs.js";
import { log } from "./log.js";
import { workerPrompt } from "./prompt.js";
import { liveSessions, sendToSession } from "./sessions.js";
import { saveState } from "./state.js";

const OFF_COMMAND = /\b(desliga|desligar|turn off|stop)\b.*\b(vigia|watcher)\b/i;
const SESSION_MENTION = /\bsess(?:ão|ao|ion)\s+["“']?([^\s,.:;"”']+)/i;

const minutes = (n) => n * 60_000;
export const hhmm = (d) => d.toTimeString().slice(0, 5);
const today = (d) => d.toLocaleDateString("sv-SE");
const hash = (text) => crypto.createHash("sha1").update(text.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");

const TO_CLAUDE_TEXT = /^\s*(to|para)\s*:?\s*(o\s+)?claude\b/i;

/**
 * A request is a comment by the user's own account that either starts a new
 * thread (neither sessions nor the watcher start threads, except the status
 * thread) or is addressed to Claude. Voice mode sometimes writes "to: claude"
 * in the text instead of filling the `to` field. Replies without an address
 * are not requests: sessions post their answers through the same account.
 */
function isRequest(row, config) {
  const value = row.payload?.value;
  if (row.verb !== "create" || row.actor?.self !== true) return false;
  if (typeof value?.body !== "string" || value.body.trim() === "") return false;
  if (row.id === config.statusThreadId) return false;
  const addressed = (Array.isArray(value.to) && value.to.includes("claude")) || TO_CLAUDE_TEXT.test(value.body);
  const newThread = value.parent?.object === "node";
  return addressed || newThread;
}

/** The comment that starts the thread: the parent comment for a reply, else the row itself. */
function threadRoot(row) {
  const parent = row.payload.value.parent;
  return parent?.object === "utterance" ? parent.id : row.id;
}

function namedSession(body, sessions) {
  const text = body.toLowerCase();
  return sessions.find((s) => {
    const name = (s.name || "").toLowerCase();
    return name && ["sessão", "sessao", "session"].some((w) => text.includes(`${w} ${name}`));
  });
}

async function startSession(config, { name, prompt, resumeId }) {
  const args = ["--bg", "--name", name, "--permission-mode", "auto"];
  if (resumeId) args.push("--resume", resumeId);
  if (config.workerModel) args.push("--model", config.workerModel);
  args.push(prompt, "--disallowedTools", ...config.deniedWorkerTools);

  const out = await runClaude(config.claudePath, args, { cwd: config.workdir, timeoutMs: 120_000 });
  const shortId = out.stdout.match(/backgrounded\s+\S+\s+([0-9a-f]{8})/)?.[1];
  if (out.code !== 0 || !shortId) {
    throw new Error(`claude --bg failed (exit ${out.code}): ${(out.stderr || out.stdout).trim().slice(0, 300)}`);
  }
  const agents = await runClaude(config.claudePath, ["agents", "--json", "--all"], { timeoutMs: 60_000 });
  const agent = JSON.parse(agents.stdout).find((a) => a.id === shortId);
  return { shortId, sessionId: agent?.sessionId || null };
}

/** Forward one request. Returns a short spoken sentence saying where it went. */
async function forward(config, state, row, sessions) {
  const body = row.payload.value.body.trim();
  const rootId = threadRoot(row);
  const known = state.threads[rootId];

  // A reply in a thread goes to the session that opened the thread.
  if (known?.sessionId) {
    const prompt = workerPrompt({ docId: config.docId, rootId, body, followUp: true });
    const live = sessions.find((s) => s.sessionId === known.sessionId);
    if (live) {
      await sendToSession(live, prompt);
      log(`thread ${rootId}: sent to live session ${known.name}`);
      return `Mandei para a sessão ${known.name}.`;
    }
    try {
      const started = await startSession(config, { name: known.name, prompt, resumeId: known.sessionId });
      state.threads[rootId] = { ...known, sessionId: started.sessionId || known.sessionId };
      log(`thread ${rootId}: resumed session ${known.name} as ${started.shortId}`);
      return `Retomei a sessão ${known.name}.`;
    } catch (err) {
      log(`thread ${rootId}: resume failed, starting a new session: ${err.message}`);
    }
  }

  // A request that names a running session goes to that session.
  const target = namedSession(body, sessions);
  if (target) {
    await sendToSession(target, workerPrompt({ docId: config.docId, rootId, body }));
    state.threads[rootId] = { sessionId: target.sessionId, name: target.name, createdAt: row.at };
    log(`thread ${rootId}: sent to named session ${target.name}`);
    return `Mandei para a sessão ${target.name}.`;
  }

  const mention = body.match(SESSION_MENTION)?.[1];
  const note = mention
    ? `o pedido cita a sessão "${mention}", mas não há sessão viva com esse nome; esta é uma sessão nova. Diga isso na resposta.`
    : known
      ? "a sessão original deste tópico não pôde ser retomada; esta é uma sessão nova. Diga isso na resposta."
      : "";
  const name = `voz-${hhmm(new Date()).replace(":", "")}-${rootId.slice(0, 4)}`;
  const started = await startSession(config, { name, prompt: workerPrompt({ docId: config.docId, rootId, body, note }) });
  state.threads[rootId] = { sessionId: started.sessionId, name, createdAt: row.at };
  log(`thread ${rootId}: new session ${name} (${started.shortId})`);
  return `Abri a sessão ${name}.`;
}

/**
 * One pass. Returns why the watcher should stop ("idle", "off"),
 * or null to keep going.
 */
export async function runOnce(config, state) {
  const now = new Date();
  if (now - new Date(state.lastActivityAt || now) > minutes(config.idleOffMinutes)) return "idle";

  if (state.daily.date !== today(now)) state.daily = { date: today(now), count: 0 };
  state.recent = state.recent.filter((r) => now - new Date(r.at) < minutes(config.dedupeMinutes));

  const rows = await queryComments(config, state.lastSeq);
  for (const row of rows) state.lastSeq = Math.max(state.lastSeq, row.seq);
  // The history keeps the creation of comments that were deleted since.
  const deleted = new Set(rows.filter((r) => r.verb === "delete").map((r) => r.id));
  const requests = rows
    .filter((r) => !deleted.has(r.id) && isRequest(r, config))
    .sort((a, b) => a.seq - b.seq);
  log(`read ${rows.length} new rows, ${requests.length} requests`);

  const sessions = liveSessions();
  for (const row of requests) {
    const body = row.payload.value.body;
    const rootId = threadRoot(row);
    const h = hash(body);
    if (state.recent.some((r) => r.hash === h)) {
      log(`comment ${row.id}: duplicate, skipped`);
      continue;
    }
    state.recent.push({ hash: h, at: now.toISOString() });
    state.lastActivityAt = now.toISOString();

    if (OFF_COMMAND.test(body)) {
      saveState(state);
      log(`comment ${row.id}: off command`);
      await postReply(config, rootId, "Vigia desligado. Para ligar de novo, use o Remote Control.");
      return "off";
    }
    if (state.daily.count >= config.dailyCap) {
      log(`comment ${row.id}: daily cap reached`);
      await postReply(config, rootId, `Limite de ${config.dailyCap} pedidos por dia atingido. O pedido não foi repassado.`);
      continue;
    }
    // Acknowledge before forwarding: a quick session can answer within seconds,
    // and its answer must be the latest comment in the thread, not the receipt.
    await postReply(config, rootId, "Recebido. Repassando para o Claude Code.").catch((err) => log(`ack failed: ${err.message}`));
    try {
      const where = await forward(config, state, row, sessions);
      state.daily.count += 1;
      log(`comment ${row.id}: ${where}`);
    } catch (err) {
      log(`comment ${row.id}: failed: ${err.message}`);
      await postReply(config, rootId, "Não consegui repassar este pedido para o Claude Code. O motivo está no log do vigia, no PC.").catch(() => {});
    }
    // Save after each request, so a crash never forwards the same one twice.
    saveState(state);
  }

  try {
    await pruneThreads(config, state);
  } catch (err) {
    log(`cleanup failed: ${err.message}`);
  }
  return null;
}

/** Report a failure in the status thread once, not on every pass while it lasts. */
export async function reportFailure(config, state, err) {
  log(`pass failed: ${err.message}`);
  if (state.lastError === err.message) return;
  state.lastError = err.message;
  await postStatus(config, "O vigia falhou ao ler o documento. O motivo está no log, no PC.").catch(() => {});
}
