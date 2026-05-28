import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { DEFAULT_STORE_PATH, TMUX_SESSION_PREFIX } from "../constants.js";
import { createSession, deleteSession, refreshDeckStatuses, renameSession } from "../deck-operations.js";
import { loadDeck, saveDeck } from "../store.js";
import { attachSession, getFirstPaneId, launchPiSession, listTmuxSessions, tmuxExists } from "../tmux.js";
import type { DeckSession } from "../types.js";
import { askName, chooseGroup, chooseSession } from "./selectors.js";

type DashboardAction =
  | { type: "close" }
  | { type: "new" }
  | { type: "attach"; sessionId: string }
  | { type: "rename"; sessionId: string }
  | { type: "delete"; sessionId: string };

export function dashboardActionForKey(data: string, selectedSessionId: string | undefined): DashboardAction | undefined {
  if (data === "q" || data === "\u001b" || data === "\u0003") return { type: "close" };
  if (data === "n") return { type: "new" };
  if (data === "\r" || data === "\n") return selectedSessionId ? { type: "attach", sessionId: selectedSessionId } : undefined;
  if (data === "r") return selectedSessionId ? { type: "rename", sessionId: selectedSessionId } : undefined;
  if (data === "d") return selectedSessionId ? { type: "delete", sessionId: selectedSessionId } : undefined;
  return undefined;
}

export async function showDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  while (true) {
    const deck = await loadDeck(storePath);
    const actionChoices = ["Attach session", "New session", "Rename session", "Delete session", "Refresh statuses", "Close"];
    const selected = await ctx.ui.select("Pi Deck", actionChoices);
    if (!selected || selected === "Close") return;

    if (selected === "New session") {
      await createNewSessionFromDashboard(ctx, storePath);
      continue;
    }

    if (selected === "Refresh statuses") {
      await refreshAndSaveDeck(ctx, storePath);
      continue;
    }

    const session = await chooseSession(ctx, deck.sessions);
    if (!session) continue;

    if (selected === "Attach session") {
      await attachSelectedSession(ctx, session);
      return;
    }

    if (selected === "Rename session") {
      const nextName = await ctx.ui.input("Rename session", session.name);
      if (!nextName?.trim()) continue;
      const renamed = renameSession(await loadDeck(storePath), session.id, nextName);
      await saveDeck(storePath, renamed);
      continue;
    }

    if (selected === "Delete session") {
      const confirmed = await ctx.ui.confirm("Delete from deck?", `Remove ${session.name} from Pi Deck? This does not kill the tmux session.`);
      if (!confirmed) continue;
      const next = deleteSession(await loadDeck(storePath), session.id);
      await saveDeck(storePath, next);
    }
  }
}

async function attachSelectedSession(ctx: ExtensionCommandContext, session: DeckSession): Promise<void> {
  if (!session.tmux?.sessionName) {
    ctx.ui.notify(`${session.name} does not have a tmux session`, "error");
    return;
  }
  await attachSession(session.tmux.sessionName);
}

async function refreshAndSaveDeck(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await refreshDeckStatuses(await loadDeck(storePath));
  await saveDeck(storePath, deck);
  ctx.ui.notify("Pi Deck statuses refreshed", "info");
}

async function createNewSessionFromDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(storePath || DEFAULT_STORE_PATH);
  const name = await askName(ctx, "Session name", "api-fix");
  if (!name) return;
  const projectPath = await askName(ctx, "Project path", ctx.cwd);
  if (!projectPath) return;
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

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
    id: `ses_${randomUUID().slice(0, 8)}`,
    name,
    groupId: group.id,
    projectPath,
    kind: "managed-tmux",
    now: new Date().toISOString(),
    tmux: { sessionName: tmuxSessionName, paneId },
  });
  await saveDeck(storePath, next);
  ctx.ui.notify(`Created ${name}`, "info");
}
