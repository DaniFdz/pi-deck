import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { createOrReuseWorktree, ensureDirectory, isGitRepo, normalizePath } from "../git.js";
import { createSession } from "../domain/deck.js";
import { loadDeck, saveDeck } from "../store.js";
import { buildManagedSessionName, getFirstPaneId, launchPiSession, listTmuxSessions, tmuxExists } from "../tmux.js";
import type { DeckWorktreeRef } from "../domain/types.js";
import { askName, chooseGroup } from "../ui/selectors.js";

export async function createManagedSession(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(storePath);
  const name = await askName(ctx, "Session name", "api-fix");
  if (!name) return;
  const projectPathInput = await askName(ctx, "Project path", ctx.cwd);
  if (!projectPathInput) return;
  const projectPath = normalizePath(projectPathInput, process.env.HOME ?? "", ctx.cwd);
  const createInWorktree = await ctx.ui.confirm("Create in worktree?", "Create a git worktree for this session?");
  let effectiveProjectPath = projectPath;
  let worktree: DeckWorktreeRef | undefined;
  if (createInWorktree) {
    if (!(await isGitRepo(projectPath))) {
      ctx.ui.notify("Path is not a git repository", "error");
      return;
    }
    const branch = await askName(ctx, "Branch name", `dani.fernandez/${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}`);
    if (!branch) return;
    worktree = await createOrReuseWorktree(projectPath, branch);
    effectiveProjectPath = worktree.path;
  } else {
    try {
      await ensureDirectory(projectPath);
    } catch (error) {
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      return;
    }
  }
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const id = `ses_${randomUUID().slice(0, 8)}`;
  const tmuxSessionName = buildManagedSessionName(name, randomUUID().slice(0, 6));
  if (deck.sessions.some((session) => session.tmux?.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`Deck already has a session named ${tmuxSessionName}`, "error");
    return;
  }
  const tmuxSessions = await listTmuxSessions();
  if (tmuxSessions.some((session) => session.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`tmux already has a session named ${tmuxSessionName}`, "error");
    return;
  }

  await launchPiSession({ sessionName: tmuxSessionName, projectPath: effectiveProjectPath });
  const paneId = await getFirstPaneId(tmuxSessionName);
  if (!paneId) {
    ctx.ui.notify(`Created tmux session ${tmuxSessionName}, but could not find its pane`, "error");
    return;
  }

  const next = createSession(deck, {
    id,
    name,
    groupId: group.id,
    projectPath: effectiveProjectPath,
    kind: "managed-tmux",
    now: new Date().toISOString(),
    tmux: { sessionName: tmuxSessionName, paneId },
    ...(worktree ? { worktree } : {}),
  });
  await saveDeck(storePath, next);
  ctx.ui.notify(`Created ${name}`, "info");
}
