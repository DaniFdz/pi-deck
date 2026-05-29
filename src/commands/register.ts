import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { DEFAULT_STORE_PATH } from "../domain/constants.js";
import { createSession, validateSend } from "../domain/deck.js";
import { refreshDeckStatuses } from "../services/deck-status.js";
import { loadDeck, saveDeck } from "../store.js";
import { attachSession, buildManagedSessionName, getFirstPaneId, launchPiSession, listTmuxSessions, sendKeys, tmuxExists } from "../tmux.js";
import { showDashboard } from "../ui/dashboard.js";
import { askName, chooseGroup, chooseSession } from "../ui/selectors.js";
import { createManagedSession } from "../workflows/create-session.js";
import { writeDebugLog } from "../services/logger.js";

export function registerCommands(pi: ExtensionAPI): void {
  writeDebugLog("Pi Deck extension loaded").catch(() => undefined);

  pi.registerCommand("deck", {
    description: "Open Pi Deck dashboard",
    handler: async (_args, ctx) => runCommand(ctx, "deck", () => showDashboard(ctx, DEFAULT_STORE_PATH)),
  });


  pi.registerCommand("deck-new", {
    description: "Create a managed Pi/tmux session",
    handler: async (_args, ctx) => runCommand(ctx, "deck-new", () => deckNew(ctx)),
  });

  pi.registerCommand("deck-import", {
    description: "Import Pi-looking tmux sessions",
    handler: async (_args, ctx) => runCommand(ctx, "deck-import", () => deckImport(ctx)),
  });

  pi.registerCommand("deck-send", {
    description: "Send a prompt to another managed Pi session",
    handler: async (_args, ctx) => runCommand(ctx, "deck-send", () => deckSend(ctx)),
  });

  pi.registerCommand("deck-status", {
    description: "Show Pi Deck session summary",
    handler: async (_args, ctx) => runCommand(ctx, "deck-status", () => deckStatus(ctx)),
  });

}

import { runCommand } from "./run-command.js";

async function deckNew(ctx: ExtensionCommandContext): Promise<void> {
  await createManagedSession(ctx, DEFAULT_STORE_PATH);
}

async function deckImport(ctx: ExtensionCommandContext): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) {
    ctx.ui.notify("Current Pi session is not saved, so it cannot be imported", "error");
    return;
  }

  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const name = await askName(ctx, "Managed session name", ctx.sessionManager.getSessionName() ?? "pi-session");
  if (!name) return;
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const id = `ses_${randomUUID().slice(0, 8)}`;
  const tmuxSessionName = buildManagedSessionName(name, randomUUID().slice(0, 6));
  const tmuxSessions = await listTmuxSessions();
  if (tmuxSessions.some((session) => session.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`tmux already has a session named ${tmuxSessionName}`, "error");
    return;
  }

  await launchPiSession({ sessionName: tmuxSessionName, projectPath: ctx.cwd, sessionFile });
  const paneId = await getFirstPaneId(tmuxSessionName);
  if (!paneId) {
    ctx.ui.notify(`Created tmux session ${tmuxSessionName}, but could not find its pane`, "error");
    return;
  }

  const next = createSession(deck, {
    id,
    name,
    groupId: group.id,
    projectPath: ctx.cwd,
    kind: "managed-tmux",
    now: new Date().toISOString(),
    tmux: { sessionName: tmuxSessionName, paneId },
    pi: { sessionFile, sessionId: ctx.sessionManager.getSessionId() },
  });
  await saveDeck(DEFAULT_STORE_PATH, next);
  await attachSession(tmuxSessionName);
}

async function deckSend(ctx: ExtensionCommandContext): Promise<void> {
  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const target = await chooseSession(ctx, deck.sessions.filter((session) => Boolean(session.tmux?.paneId)));
  if (!target) return;
  const message = await ctx.ui.editor("Prompt to send", "");
  if (!message) return;

  const validation = validateSend(deck, { fromSessionId: "current", toSessionId: target.id, message });
  if (!validation.ok) {
    ctx.ui.notify(validation.reason, "error");
    return;
  }

  const confirmationText = validation.warning ? `Send to ${target.name}?\n\nWarning: ${validation.warning}` : `Send to ${target.name}?`;
  const confirmed = await ctx.ui.confirm("Send prompt?", confirmationText);
  if (!confirmed) return;
  await sendKeys(validation.targetPaneId, message.trim());
  ctx.ui.notify(`Sent prompt to ${target.name}`, "info");
}

async function deckStatus(ctx: ExtensionCommandContext): Promise<void> {
  const deck = await refreshDeckStatuses(await loadDeck(DEFAULT_STORE_PATH));
  await saveDeck(DEFAULT_STORE_PATH, deck);
  const lines = deck.sessions.map((session) => `${session.status.state.padEnd(10)} ${session.name}`).join("\n");
  ctx.ui.notify(lines || "No deck sessions", "info");
}

