import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = path.join(ROOT, "config.json");
export const STATE_DIR = path.join(ROOT, "state");
export const LOG_DIR = path.join(ROOT, "logs");

export const DEFAULTS = {
  // Filled in by `npm run setup`.
  docId: null,
  tabId: null,
  claudePath: "claude",
  // MCP server names this machine's Claude Code loads. Each headless Claude
  // Docs call denies all of them except Claude Docs itself.
  mcpServers: [],

  workdir: path.resolve(ROOT, ".."),
  intervalMinutes: 3,
  dailyCap: 30,
  idleOffMinutes: 30,
  dedupeMinutes: 5,
  // The document keeps only this many request threads and status replies.
  keepThreads: 10,
  keepStatusReplies: 10,
  pollModel: "haiku",
  // null = the user's default model.
  workerModel: null,
  deniedWorkerTools: ["Bash(git push *)", "Bash(gh pr *)"],
};

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error("config.json not found. Run: npm run setup -- <document link>");
  }
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
}

export function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
