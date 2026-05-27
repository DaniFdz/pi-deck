import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { DEFAULT_STORE_PATH, TMUX_SESSION_PREFIX } from "./constants.js";
import { createSession, refreshDeckStatuses, validateSend } from "./deck-operations.js";
import { loadDeck, saveDeck } from "./store.js";
import { getFirstPaneId, isLikelyPiSession, launchPiSession, listTmuxSessions, sendKeys, tmuxExists } from "./tmux.js";
import type { DeckState } from "./types.js";
import { showDashboard } from "./ui/dashboard.js";
import { askName, chooseGroup, chooseSession } from "./ui/selectors.js";

export function registerCommands(pi: ExtensionAPI): void {
  pi.registerCommand("deck", {
    description: "Open Pi Deck dashboard",
    handler: async (_args, ctx) => showDashboard(ctx, DEFAULT_STORE_PATH),
  });

  pi.registerCommand("deck-new", {
    description: "Create a managed Pi/tmux session",
    handler: async (_args, ctx) => deckNew(ctx),
  });

  pi.registerCommand("deck-import", {
    description: "Import Pi-looking tmux sessions",
    handler: async (_args, ctx) => deckImport(ctx),
  });

  pi.registerCommand("deck-send", {
    description: "Send a prompt to another managed Pi session",
    handler: async (_args, ctx) => deckSend(ctx),
  });

  pi.registerCommand("deck-status", {
    description: "Show Pi Deck session summary",
    handler: async (_args, ctx) => deckStatus(ctx),
  });
}

async function deckNew(ctx: ExtensionCommandContext): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const name = await askName(ctx, "Session name", "api-fix");
  if (!name) return;
  const projectPath = await askName(ctx, "Project path", ctx.cwd);
  if (!projectPath) return;
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const id = `ses_${randomUUID().slice(0, 8)}`;
  const tmuxSessionName = `${TMUX_SESSION_PREFIX}${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  if (deck.sessions.some((session) => session.tmux?.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`Deck already has a session named ${tmuxSessionName}`, "error");
    return;
  }
  const tmuxSessions = await listTmuxSessions();
  if (tmuxSessions.some((session) => session.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`tmux already has a session named ${tmuxSessionName}`, "error");
    return;
  }

  await launchPiSession({ sessionName: tmuxSessionName, projectPath });
  const paneId = await getFirstPaneId(tmuxSessionName);
  if (!paneId) {
    ctx.ui.notify(`Created tmux session ${tmuxSessionName}, but could not find its pane`, "error");
    return;
  }

  const next = createSession(deck, {
    id,
    name,
    groupId: group.id,
    projectPath,
    kind: "managed-tmux",
    now: new Date().toISOString(),
    tmux: { sessionName: tmuxSessionName, paneId },
  });
  await saveDeck(DEFAULT_STORE_PATH, next);
  ctx.ui.notify(`Created ${name}`, "info");
}

async function deckImport(ctx: ExtensionCommandContext): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const summaries = (await listTmuxSessions()).filter(isLikelyPiSession);
  let next: DeckState = deck;
  const now = new Date().toISOString();
  let imported = 0;

  for (const summary of summaries) {
    if (next.sessions.some((session) => session.tmux?.sessionName === summary.sessionName)) continue;
    next = createSession(next, {
      id: `ses_${randomUUID().slice(0, 8)}`,
      name: summary.sessionName,
      groupId: group.id,
      projectPath: ctx.cwd,
      kind: "imported-tmux",
      now,
      tmux: { sessionName: summary.sessionName, paneId: summary.paneId },
    });
    imported += 1;
  }

  await saveDeck(DEFAULT_STORE_PATH, next);
  ctx.ui.notify(`Imported ${imported} Pi tmux session(s)`, "info");
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
