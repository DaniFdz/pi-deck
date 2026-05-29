import { beforeEach, describe, expect, it, vi } from "vitest";
import { createManagedSession } from "./create-session.js";
import { buildDefaultBranchName, createOrReuseWorktree, isGitRepo, validateBranchName } from "../services/git.js";
import { launchPiSession } from "../services/tmux.js";
import { askPath } from "../ui/path-input.js";
import { askName, chooseGroup } from "../ui/selectors.js";

const calls: string[] = [];

vi.mock("../services/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/config.js")>();
  return {
    ...actual,
    loadConfig: vi.fn(async () => ({ sessionCreation: { branchPrefix: "dani.fernandez/", worktreeBasePath: "~/.worktrees" } })),
  };
});

vi.mock("../services/git.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/git.js")>();
  return {
    ...actual,
    ensureDirectory: vi.fn(async () => undefined),
    isGitRepo: vi.fn(async () => true),
    normalizePath: vi.fn((path: string) => path),
    validateBranchName: vi.fn(async () => undefined),
    createOrReuseWorktree: vi.fn(async (_path: string, branch: string) => ({ repoRoot: "/repo", path: `/worktree/${branch}`, branch })),
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

vi.mock("../ui/path-input.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/path-input.js")>();
  return {
    ...actual,
    askPath: vi.fn(async () => {
      calls.push("folder");
      return "/tmp/plain-folder";
    }),
  };
});

vi.mock("../ui/selectors.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/selectors.js")>();
  return {
    ...actual,
    askName: vi.fn(async (_ctx, title: string, placeholder: string) => {
      calls.push(title);
      if (title === "Session name") return "Fix API bug";
      if (title === "Branch name") return placeholder;
      return undefined;
    }),
    chooseGroup: vi.fn(async (_ctx, groups) => {
      calls.push("group");
      return groups[0];
    }),
  };
});

function fakeCtx(createInWorktree: boolean) {
  return {
    cwd: "/tmp",
    ui: {
      confirm: vi.fn(async () => {
        calls.push("worktree");
        return createInWorktree;
      }),
      notify: vi.fn(),
    },
  } as any;
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("createManagedSession workflow", () => {
  it("asks group, session name, worktree choice, then folder for plain sessions", async () => {
    await createManagedSession(fakeCtx(false), "/tmp/deck.json");

    expect(calls).toEqual(["group", "Session name", "worktree", "folder"]);
    expect(isGitRepo).not.toHaveBeenCalled();
    expect(launchPiSession).toHaveBeenCalledWith(expect.objectContaining({ projectPath: "/tmp/plain-folder" }));
  });

  it("asks for branch before folder for worktree sessions", async () => {
    await createManagedSession(fakeCtx(true), "/tmp/deck.json");

    expect(calls).toEqual(["group", "Session name", "worktree", "Branch name", "folder"]);
  });

  it("uses configured branch prefix for the default branch name", async () => {
    await createManagedSession(fakeCtx(true), "/tmp/deck.json");

    expect(askName).toHaveBeenCalledWith(expect.anything(), "Branch name", "dani.fernandez/fix-api-bug");
    expect(validateBranchName).toHaveBeenCalledWith("dani.fernandez/fix-api-bug");
  });

  it("passes configured worktree base path when creating worktrees", async () => {
    await createManagedSession(fakeCtx(true), "/tmp/deck.json");

    expect(createOrReuseWorktree).toHaveBeenCalledWith("/tmp/plain-folder", "dani.fernandez/fix-api-bug", "~/.worktrees");
  });
});
