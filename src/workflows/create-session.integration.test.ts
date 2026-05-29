import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckState } from "../domain/types.js";
import { createManagedSession } from "./create-session.js";
import { launchPiSession } from "../services/tmux.js";
import { askPath } from "../ui/path-input.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];
let sessionName = "Plain Folder";
let branchName: string | undefined;
let selectedPath = "";
let createInWorktree = false;
let branchPromptPlaceholder: string | undefined;
let configHome = "";

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function initGitRepo(path: string): Promise<void> {
  await execFileAsync("git", ["init", "-b", "main"], { cwd: path });
  await execFileAsync("git", ["config", "user.email", "pi-deck@example.test"], { cwd: path });
  await execFileAsync("git", ["config", "user.name", "Pi Deck Test"], { cwd: path });
  await writeFile(join(path, "README.md"), "# test\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: path });
  await execFileAsync("git", ["commit", "-m", "initial"], { cwd: path });
}

async function readDeck(path: string): Promise<DeckState> {
  return JSON.parse(await readFile(path, "utf8")) as DeckState;
}

vi.mock("../services/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/config.js")>();
  return {
    ...actual,
    loadConfig: (options = {}) => actual.loadConfig({ ...(options as object), home: configHome }),
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

vi.mock("../ui/loading.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/loading.js")>();
  return {
    ...actual,
    withLoading: async (_ctx: unknown, _message: string, task: () => Promise<unknown>) => task(),
  };
});

vi.mock("../ui/path-input.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/path-input.js")>();
  return {
    ...actual,
    askPath: vi.fn(async (_ctx, options: Parameters<typeof actual.askPath>[1]) => {
      const result = await options.validate(selectedPath);
      return result.ok ? selectedPath : undefined;
    }),
  };
});

vi.mock("../ui/text-input.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/text-input.js")>();
  return {
    ...actual,
    askRequiredText: vi.fn(async (_ctx, options: { title: string; initialValue: string; validate?: (value: string) => Promise<string | undefined> }) => {
      if (options.title === "Session name") return sessionName.trim() || undefined;
      if (options.title === "Branch name") {
        branchPromptPlaceholder = options.initialValue;
        const value = branchName ?? options.initialValue;
        const error = await options.validate?.(value);
        return error ? undefined : value;
      }
      return undefined;
    }),
  };
});

vi.mock("../ui/selectors.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/selectors.js")>();
  return {
    ...actual,
    chooseGroup: vi.fn(async (_ctx, groups) => groups[0]),
  };
});

function fakeCtx(cwd: string) {
  return {
    cwd,
    ui: {
      confirm: vi.fn(async () => createInWorktree),
      notify: vi.fn(),
    },
  } as any;
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionName = "Plain Folder";
  branchName = undefined;
  branchPromptPlaceholder = undefined;
  selectedPath = "";
  createInWorktree = false;
  configHome = await tempDir("pi-deck-config-home-");
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createManagedSession integration", () => {
  it("creates a plain session in a non-git folder", async () => {
    const project = await tempDir("pi-deck-plain-project-");
    const storePath = join(await tempDir("pi-deck-store-"), "deck.json");
    sessionName = "Plain Folder";
    selectedPath = project;
    createInWorktree = false;

    await createManagedSession(fakeCtx(project), storePath);

    const deck = await readDeck(storePath);
    expect(deck.sessions).toHaveLength(1);
    expect(deck.sessions[0]).toMatchObject({ name: "Plain Folder", projectPath: project, kind: "managed-tmux" });
    expect(deck.sessions[0]?.worktree).toBeUndefined();
    expect(launchPiSession).toHaveBeenCalledWith(expect.objectContaining({ projectPath: project }));
  });

  it("rejects empty session names before launching tmux", async () => {
    const project = await tempDir("pi-deck-empty-name-project-");
    const storePath = join(await tempDir("pi-deck-store-"), "deck.json");
    sessionName = "";
    selectedPath = project;
    createInWorktree = false;

    await createManagedSession(fakeCtx(project), storePath);

    await expect(stat(storePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(launchPiSession).not.toHaveBeenCalled();
  });

  it("rejects worktree creation from a non-git folder before launching tmux", async () => {
    const project = await tempDir("pi-deck-non-git-project-");
    const storePath = join(await tempDir("pi-deck-store-"), "deck.json");
    sessionName = "Needs Worktree";
    selectedPath = project;
    createInWorktree = true;

    await createManagedSession(fakeCtx(project), storePath);

    await expect(stat(storePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(launchPiSession).not.toHaveBeenCalled();
    expect(askPath).toHaveBeenCalled();
  });

  it("creates a real repo-local worktree when no worktree base path is configured", async () => {
    const repo = await tempDir("pi-deck-repo-");
    await initGitRepo(repo);
    const storePath = join(await tempDir("pi-deck-store-"), "deck.json");
    sessionName = "Fix API Bug";
    selectedPath = repo;
    createInWorktree = true;

    await createManagedSession(fakeCtx(repo), storePath);

    const realRepo = await realpath(repo);
    const expectedWorktree = join(realRepo, ".worktree", "fix-api-bug");
    await expect(stat(expectedWorktree)).resolves.toMatchObject({});
    const deck = await readDeck(storePath);
    expect(branchPromptPlaceholder).toBe("fix-api-bug");
    expect(deck.sessions[0]).toMatchObject({ projectPath: expectedWorktree, worktree: { repoRoot: realRepo, path: expectedWorktree, branch: "fix-api-bug" } });
    expect(launchPiSession).toHaveBeenCalledWith(expect.objectContaining({ projectPath: expectedWorktree }));
  });

  it("uses configured branch prefix and configured global worktree base path", async () => {
    const repo = await tempDir("pi-deck-config-repo-");
    await initGitRepo(repo);
    const home = configHome;
    const configDir = join(home, ".pi", "agent", "pi-deck");
    const globalWorktrees = join(home, ".worktrees");
    await writeFile(join(configDir, "config.toml"), '[session_creation]\nbranch_prefix = "dani.fernandez/"\nworktree_base_path = "~/.worktrees"\n').catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      await execFileAsync("mkdir", ["-p", configDir]);
      await writeFile(join(configDir, "config.toml"), '[session_creation]\nbranch_prefix = "dani.fernandez/"\nworktree_base_path = "~/.worktrees"\n');
    });
    const storePath = join(await tempDir("pi-deck-store-"), "deck.json");
    sessionName = "Fix API Bug";
    selectedPath = repo;
    createInWorktree = true;

    await createManagedSession(fakeCtx(repo), storePath);

    const expectedWorktree = join(globalWorktrees, "dani.fernandez-fix-api-bug");
    await expect(stat(expectedWorktree)).resolves.toMatchObject({});
    const deck = await readDeck(storePath);
    expect(branchPromptPlaceholder).toBe("dani.fernandez/fix-api-bug");
    expect(deck.sessions[0]).toMatchObject({
      projectPath: expectedWorktree,
      worktree: { repoRoot: await realpath(repo), path: expectedWorktree, branch: "dani.fernandez/fix-api-bug" },
    });
  });
});
