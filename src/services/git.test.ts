import { describe, expect, it } from "vitest";
import { buildCreateWorktreeCommand, buildDefaultBranchName, buildWorktreePath, normalizePath, parseWorktreeForBranch, sanitizeBranchPathComponent } from "./git.js";

describe("git helpers", () => {
  it("expands tilde paths", () => {
    expect(normalizePath("~/repo", "/Users/example", "/tmp")).toBe("/Users/example/repo");
  });

  it("resolves relative paths from cwd", () => {
    expect(normalizePath("repo", "/Users/example", "/tmp/work")).toBe("/tmp/work/repo");
  });

  it("sanitizes branch names for filesystem paths", () => {
    expect(sanitizeBranchPathComponent("dani.fernandez/feature thing")).toBe("dani.fernandez-feature-thing");
  });

  it("builds a default branch name from a session name", () => {
    expect(buildDefaultBranchName("Fix API bug", "")).toBe("fix-api-bug");
  });

  it("prefixes default branch names", () => {
    expect(buildDefaultBranchName("Fix API bug", "dani.fernandez/")).toBe("dani.fernandez/fix-api-bug");
  });

  it("builds default worktree path under repo .worktree", () => {
    expect(buildWorktreePath("/repo/project", "feature/test")).toBe("/repo/project/.worktree/feature-test");
  });

  it("builds configured worktree path under expanded base path", () => {
    expect(buildWorktreePath("/repo/project", "feature/test", "~/.worktrees", "/Users/example")).toBe("/Users/example/.worktrees/feature-test");
  });

  it("builds git worktree add command for new branch", () => {
    expect(buildCreateWorktreeCommand("/repo/project", "/repo/project/.worktrees/feature", "feature", false)).toEqual({
      command: "git",
      args: ["-C", "/repo/project", "worktree", "add", "-b", "feature", "/repo/project/.worktrees/feature"],
    });
  });

  it("builds git worktree add command for existing branch", () => {
    expect(buildCreateWorktreeCommand("/repo/project", "/repo/project/.worktrees/feature", "feature", true)).toEqual({
      command: "git",
      args: ["-C", "/repo/project", "worktree", "add", "/repo/project/.worktrees/feature", "feature"],
    });
  });

  it("parses worktree path for a branch", () => {
    const output = "worktree /repo/project\nbranch refs/heads/main\n\nworktree /repo/project/.worktrees/feature\nbranch refs/heads/feature\n";
    expect(parseWorktreeForBranch(output, "feature")).toBe("/repo/project/.worktrees/feature");
  });
});
