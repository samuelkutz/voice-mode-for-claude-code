// One-time setup: npm run setup -- <document link>
// Reads the document once, finds its tab, records which MCP tools this
// machine loads, and writes config.json.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { CONFIG_PATH, DEFAULTS, loadConfig, saveConfig } from "./config.js";
import { callDocsTool, queryComments, startThread } from "./docs.js";
import { loadState, saveState } from "./state.js";

const link = process.argv[2];
if (!link) {
  console.error("Usage: npm run setup -- <document link>");
  process.exit(1);
}

const claudePath = execFileSync("where", ["claude"], { encoding: "utf8" }).split(/\r?\n/)[0].trim();
const config = fs.existsSync(CONFIG_PATH) ? loadConfig() : { ...DEFAULTS };
config.claudePath = claudePath;

// The first call denies no server, so its init event lists every MCP server.
config.mcpServers = [];
const { data, servers } = await callDocsTool(
  config,
  "read",
  { ref: { object: "project", id: link } },
  { withInit: true },
);
config.mcpServers = servers;
delete config.mcpTools;

const tab = data.files?.[0];
if (!tab) throw new Error(`the document has no tabs: ${JSON.stringify(data).slice(0, 300)}`);
config.tabId = tab.id;
config.docId = data.id || data.project?.id || link.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
if (!config.docId) throw new Error("could not find the document id; pass the claude.ai/code/artifact/<uuid> link");
saveConfig(config);

// A fixed thread where the watcher reports its own state, so voice mode can
// answer "what is the watcher doing?".
if (!config.statusThreadId) {
  const title = data.name || "voice-mode-for-claude-code";
  config.statusThreadId = await startThread(
    config,
    tab.content.id,
    title,
    "Status do vigia. Cada mudança de estado do vigia aparece como resposta neste tópico.",
  );
  saveConfig(config);
}

// Start from the current end of the comment history, so old comments are not replayed.
const state = loadState();
const rows = await queryComments(config, 0);
state.lastSeq = rows.reduce((max, r) => Math.max(max, r.seq), 0);
saveState(state);

console.log(`config.json written: doc ${config.docId}, tab ${config.tabId}, MCP servers: ${config.mcpServers.join(", ")}; starting after comment seq ${state.lastSeq}.`);
