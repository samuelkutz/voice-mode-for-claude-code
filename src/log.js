import fs from "node:fs";
import path from "node:path";
import { LOG_DIR } from "./config.js";

const LOG_PATH = path.join(LOG_DIR, "watcher.log");

export function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.join(" ")}`;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, line + "\n");
  console.log(line);
}
