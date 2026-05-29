import { describe, expect, it, vi } from "vitest";
import { createManagedSession } from "./create-session.js";
import { isGitRepo } from "../services/git.js";
import { launchPiSession } from "../services/tmux.js";

vi.mock("../services/git.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/git.js")>();
  return {
    ...actual,
    ensureDirectory: vi.fn(async () => undefined),
    isGitRepo: vi.fn(async () => false),
    normalizePath: vi.fn((path: string) => path),
  };
});

vi.mock("../services/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/store.js")>();
  return {
    ...actual,
    loadDeck: vi.fn(async () => ({
      version: 1,
      updatedAt: "now",
      groups: [{ id: "root", name: "Deck", parentId: null, children: [], expanded: true, createdAt: "now", updatedAt: "now" }],
      sessions: [],
    })),
    saveDeck: vi.fn(async () => undefined),
  };
});

vi.mock("../services/tmux.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/tmux.js")>();
  return {
    ...actual,
    tmuxExists: vi.fn(async () => true),
    listTmuxSessions: vi.fn(async () => []),
    launchPiSession: vi.fn(async () => undefined),
    getFirstPaneId: vi.fn(async () => "%1"),
  };
});

vi.mock("../ui/selectors.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/selectors.js")>();
  return {
    ...actual,
    askName: vi.fn(async (_ctx, title: string) => title === "Session name" ? "plain" : "/tmp/plain-folder"),
    chooseGroup: vi.fn(async (ctx, groups) => groups[0]),
  };
});

function fakeCtx(createInWorktree: boolean) {
  return {
    cwd: "/tmp",
    ui: {
      confirm: vi.fn(async () => createInWorktree),
      notify: vi.fn(),
    },
  } as any;
}

describe("createManagedSession workflow", () => {
  it("allows non-git folders when worktree mode is disabled", async () => {
    await createManagedSession(fakeCtx(false), "/tmp/deck.json");

    expect(isGitRepo).not.toHaveBeenCalled();
    expect(launchPiSession).toHaveBeenCalledWith(expect.objectContaining({ projectPath: "/tmp/plain-folder" }));
  });

  it("validates git repo only when worktree mode is enabled", async () => {
    const ctx = fakeCtx(true);
    await createManagedSession(ctx, "/tmp/deck.json");

    expect(isGitRepo).toHaveBeenCalledWith("/tmp/plain-folder");
    expect(ctx.ui.notify).toHaveBeenCalledWith("Path is not a git repository", "error");
  });
});
