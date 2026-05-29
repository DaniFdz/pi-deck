import { describe, expect, it } from "vitest";
import { buildCreateWorktreeCommand, buildWorktreePath, parseWorktreeForBranch, sanitizeBranchPathComponent } from "./git.js";

describe("git helpers", () => {
  it("sanitizes branch names for filesystem paths", () => {
    expect(sanitizeBranchPathComponent("dani.fernandez/feature thing")).toBe("dani.fernandez-feature-thing");
  });

  it("builds default worktree path under repo .worktrees", () => {
    expect(buildWorktreePath("/repo/project", "feature/test")).toBe("/repo/project/.worktrees/feature-test");
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
