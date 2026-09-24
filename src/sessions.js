import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const SESSIONS_DIR = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "sessions");

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM";
  }
}

/** Claude Code sessions running on this machine, from their registry files. */
export function liveSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((s) => s && s.pid && s.messagingSocketPath && isAlive(s.pid));
}

/** The peer token a session accepts on its inbox pipe. Never logged. */
function peerToken(pid) {
  const file = fs.readdirSync(SESSIONS_DIR).find((f) => f.startsWith(`${pid}.`) && f.endsWith(".key"));
  if (!file) throw new Error(`no key file for session pid ${pid}`);
  const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), "utf8").trim();
  try {
    const found = Object.entries(JSON.parse(raw)).find(
      ([k, v]) => /token/i.test(k) && typeof v === "string" && /^[0-9a-f]{32}$/i.test(v),
    );
    if (found) return found[1];
  } catch {
    // not JSON; fall through to a plain match
  }
  const match = raw.match(/[0-9a-f]{32}/i);
  if (!match) throw new Error(`unrecognized key file for session pid ${pid}`);
  return match[0];
}

/** Deliver a message to a running session through its inbox named pipe. */
export function sendToSession(session, text) {
  const token = peerToken(session.pid);
  return new Promise((resolve, reject) => {
    const socket = net.connect(session.messagingSocketPath, () => {
      socket.write(JSON.stringify({ type: "auth", token }) + "\n");
      socket.write(
        JSON.stringify({ type: "user", message: { role: "user", content: text }, priority: "next" }) + "\n",
      );
      setTimeout(() => socket.end(), 1500);
    });
    socket.on("error", reject);
    socket.on("close", (hadError) => (hadError ? reject(new Error("pipe closed with error")) : resolve()));
  });
}
