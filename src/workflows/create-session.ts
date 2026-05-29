import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { buildDefaultBranchName, createOrReuseWorktree, isGitRepo, normalizePath, validateBranchName } from "../services/git.js";
import { createSession } from "../domain/deck.js";
import { loadConfig } from "../services/config.js";
import { completeDirectoryPath, validateDirectoryPath } from "../services/paths.js";
import { loadDeck, saveDeck } from "../services/store.js";
import { buildManagedSessionName, getFirstPaneId, launchPiSession, listTmuxSessions, tmuxExists } from "../services/tmux.js";
import type { DeckWorktreeRef } from "../domain/types.js";
import { askPath } from "../ui/path-input.js";
import { askRequiredText } from "../ui/text-input.js";
import { chooseGroup } from "../ui/selectors.js";

export async function createManagedSession(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(storePath);
  const config = await loadConfig();
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const name = await askRequiredText(ctx, { title: "Session name", initialValue: "", errorMessage: "Session name is required" });
  if (!name) return;

  const createInWorktree = await ctx.ui.confirm("Create in git worktree?", "Choose Yes to create or reuse a Git worktree for this session. Choose No to run Pi directly in a folder.");

  let branch: string | undefined;
  if (createInWorktree) {
    branch = await askRequiredText(ctx, {
      title: "Branch name",
      initialValue: buildDefaultBranchName(name, config.sessionCreation.branchPrefix),
      errorMessage: "Branch name is required",
      validate: async (value) => {
        try {
          await validateBranchName(value);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    });
    if (!branch) return;
  }

  const projectPathInput = await askPath(ctx, {
    title: createInWorktree ? "Git repository folder" : "Project folder",
    initialValue: ctx.cwd,
    validate: async (value) => {
      const path = normalizePath(value, process.env.HOME ?? "", ctx.cwd);
      const directory = await validateDirectoryPath(path);
      if (!directory.ok) return directory;
      if (createInWorktree && !(await isGitRepo(path))) return { ok: false, error: `Path is not a git repository: ${path}` };
      return directory;
    },
    complete: (value) => completeDirectoryPath(value, { home: process.env.HOME ?? "", cwd: ctx.cwd }),
  });
  if (!projectPathInput) return;

  const projectPath = normalizePath(projectPathInput, process.env.HOME ?? "", ctx.cwd);
  let effectiveProjectPath = projectPath;
  let worktree: DeckWorktreeRef | undefined;
  if (createInWorktree) {
    worktree = await createOrReuseWorktree(projectPath, branch!, config.sessionCreation.worktreeBasePath, config.home);
    effectiveProjectPath = worktree.path;
  }

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
