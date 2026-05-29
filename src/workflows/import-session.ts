import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { createSession } from "../domain/deck.js";
import { loadDeck, saveDeck } from "../services/store.js";
import { attachSession, buildManagedSessionName, getFirstPaneId, launchPiSession, listTmuxSessions, tmuxExists } from "../services/tmux.js";
import { askName, chooseGroup } from "../ui/selectors.js";

export async function importCurrentSession(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const sessionFile = ctx.sessionManager.getSessionFile();
  if (!sessionFile) {
    ctx.ui.notify("Current Pi session is not saved, so it cannot be imported", "error");
    return;
  }

  const deck = await loadDeck(storePath);
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
  await saveDeck(storePath, next);
  await attachSession(tmuxSessionName);
}
