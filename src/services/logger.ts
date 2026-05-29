import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEBUG_LOG_PATH = join(homedir(), ".pi", "agent", "pi-deck-debug.log");

export async function writeDebugLog(message: string): Promise<void> {
  await mkdir(dirname(DEBUG_LOG_PATH), { recursive: true });
  await appendFile(DEBUG_LOG_PATH, `[${new Date().toISOString()}] ${message}\n`, "utf8");
}
