import { runClaude } from "./claude.js";

const DOCS_SERVER = "claude_ai_Claude_Docs";
const DOCS = `mcp__${DOCS_SERVER}__`;
const DOCS_TOOLS = ["batch", "create", "delete", "export", "guide", "query", "read", "update"];

/** The MCP tool prefix Claude Code derives from a server name. */
export const serverPrefix = (name) => name.replace(/[^A-Za-z0-9_-]/g, "_");

/** The first complete JSON object in `text`; tool results can carry a note after it. */
function firstJsonObject(text) {
  const start = text.indexOf("{");
  let depth = 0;
  let inString = false;
  for (let i = start; start >= 0 && i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("no JSON object");
}

/**
 * Make exactly one Claude Docs tool call through a minimal headless Claude
 * Code run, and return the server's own response.
 *
 * The model only relays the call. The result is read from the raw tool result
 * in the event stream, never from the model's text, so a run where the model
 * skips the call fails loudly instead of reporting "nothing new".
 */
export async function callDocsTool(config, tool, args, options = {}) {
  // Haiku occasionally answers without making the call; that case is safe to retry.
  for (let attempt = 1; ; attempt++) {
    try {
      return await callDocsToolOnce(config, tool, args, options);
    } catch (err) {
      if (!(err instanceof SkippedCall) || attempt >= 3) throw err;
    }
  }
}

class SkippedCall extends Error {}

async function callDocsToolOnce(config, tool, args, { withInit = false } = {}) {
  const name = DOCS + tool;
  // Deny every other MCP server whole, and the other Claude Docs tools one by
  // one, so the run carries a single tool definition.
  const denied = [
    ...config.mcpServers.map(serverPrefix).filter((s) => s !== DOCS_SERVER).map((s) => `mcp__${s}`),
    ...DOCS_TOOLS.filter((t) => t !== tool).map((t) => DOCS + t),
  ];
  const prompt =
    `Call the tool ${name} exactly once, with exactly these arguments:\n` +
    JSON.stringify(args) +
    "\nThen reply with the single word: ok";

  const cliArgs = [
    "-p", prompt,
    "--model", config.pollModel,
    "--output-format", "stream-json", "--verbose",
    "--system-prompt", "You relay one tool call. Call the tool you are told to call, with the arguments given, then reply ok.",
    "--tools", "",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--allowedTools", name,
  ];
  if (denied.length) cliArgs.push("--disallowedTools", ...denied);

  const { code, stdout, stderr } = await runClaude(config.claudePath, cliArgs, {
    env: { ENABLE_TOOL_SEARCH: "false" },
  });

  const events = stdout
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l));

  const use = events
    .filter((e) => e.type === "assistant")
    .flatMap((e) => e.message.content)
    .find((c) => c.type === "tool_use" && c.name === name);
  if (!use) {
    throw new SkippedCall(`the model did not call ${name} (exit ${code}). ${stderr.trim().slice(0, 300)}`);
  }
  const result = events
    .filter((e) => e.type === "user")
    .flatMap((e) => e.message.content || [])
    .find((c) => c.type === "tool_result" && c.tool_use_id === use.id);
  if (!result) throw new Error(`no result for ${name}`);

  const text = Array.isArray(result.content)
    ? result.content.filter((c) => c.type === "text").map((c) => c.text).join("")
    : String(result.content);
  let data;
  try {
    data = firstJsonObject(text);
  } catch {
    throw new Error(`${name} returned non-JSON: ${text.slice(0, 300)}`);
  }
  if (result.is_error || data.verdict !== "allow") {
    throw new Error(`${name} refused: ${text.slice(0, 300)}`);
  }

  if (withInit) {
    const init = events.find((e) => e.type === "system" && e.subtype === "init");
    return { data, servers: (init?.mcp_servers || []).map((s) => s.name) };
  }
  return data;
}

/** Comment rows on the document's tab newer than `afterSeq`. */
export async function queryComments(config, afterSeq) {
  const data = await callDocsTool(config, "query", {
    object: "utterance",
    container: { kind: "project", id: config.docId },
    payload: { under: { object: "file", id: config.tabId }, afterSeq },
  });
  return data.rows || [];
}

/** The live comments of one thread, oldest first. Deleted ones are left out. */
export async function listThread(config, rootId) {
  const data = await callDocsTool(config, "query", {
    object: "utterance",
    container: { kind: "project", id: config.docId },
    payload: { under: { object: "utterance", id: rootId } },
  });
  const rows = data.rows || [];
  const deleted = new Set(rows.filter((r) => r.verb === "delete").map((r) => r.id));
  return rows.filter((r) => r.verb === "create" && !deleted.has(r.id)).sort((a, b) => a.seq - b.seq);
}

/** Delete a comment; deleting a thread's first comment removes the whole thread. */
export async function deleteComment(config, id) {
  return callDocsTool(config, "delete", {
    ref: { object: "utterance", id },
    container: { kind: "project", id: config.docId },
  });
}

/** Start a thread anchored on `anchorText` in the tab body. Returns the new comment id. */
export async function startThread(config, bodyId, anchorText, body) {
  const data = await callDocsTool(config, "create", {
    object: "utterance",
    container: { kind: "project", id: config.docId },
    payload: { value: { body, parent: { object: "node", id: bodyId, anchor: { kind: "find", text: anchorText, nth: 1 } } } },
  });
  return data.minted;
}

/** Post in the watcher's status thread, when there is one. */
export async function postStatus(config, body) {
  if (config.statusThreadId) await postReply(config, config.statusThreadId, body);
}

/** Post a reply in a thread. Replies carry no `to`, so the watcher ignores them. */
export async function postReply(config, rootId, body) {
  return callDocsTool(config, "create", {
    object: "utterance",
    container: { kind: "project", id: config.docId },
    payload: { value: { body, parent: { object: "utterance", id: rootId } } },
  });
}
