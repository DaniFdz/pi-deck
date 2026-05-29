import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { writeDebugLog } from "../services/logger.js";

export async function runCommand(ctx: ExtensionCommandContext, name: string, action: () => Promise<void>): Promise<void> {
  await writeDebugLog(`${name} start`);
  try {
    await action();
    await writeDebugLog(`${name} complete`);
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await writeDebugLog(`${name} failed: ${message}`);
    ctx.ui.notify(`${name} failed. See ~/.pi/agent/pi-deck-debug.log`, "error");
  }
}