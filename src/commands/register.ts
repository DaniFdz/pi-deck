import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_STORE_PATH } from "../domain/constants.js";
import { showDashboard } from "../ui/dashboard.js";
import { createManagedSession } from "../workflows/create-session.js";
import { importCurrentSession } from "../workflows/import-session.js";
import { sendPromptToSession } from "../workflows/send-prompt.js";
import { showStatusSummary } from "../workflows/refresh-status.js";
import { writeDebugLog } from "../services/logger.js";
import { runCommand } from "./run-command.js";

export function registerCommands(pi: ExtensionAPI): void {
  writeDebugLog("Pi Deck extension loaded").catch(() => undefined);

  pi.registerCommand("deck", {
    description: "Open Pi Deck dashboard",
    handler: async (_args, ctx) => runCommand(ctx, "deck", () => showDashboard(ctx, DEFAULT_STORE_PATH)),
  });


  pi.registerCommand("deck-new", {
    description: "Create a managed Pi/tmux session",
    handler: async (_args, ctx) => runCommand(ctx, "deck-new", () => createManagedSession(ctx, DEFAULT_STORE_PATH)),
  });

  pi.registerCommand("deck-import", {
    description: "Import Pi-looking tmux sessions",
    handler: async (_args, ctx) => runCommand(ctx, "deck-import", () => importCurrentSession(ctx, DEFAULT_STORE_PATH)),
  });

  pi.registerCommand("deck-send", {
    description: "Send a prompt to another managed Pi session",
    handler: async (_args, ctx) => runCommand(ctx, "deck-send", () => sendPromptToSession(ctx, DEFAULT_STORE_PATH)),
  });

  pi.registerCommand("deck-status", {
    description: "Show Pi Deck session summary",
    handler: async (_args, ctx) => runCommand(ctx, "deck-status", () => showStatusSummary(ctx, DEFAULT_STORE_PATH)),
  });

}
