import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommandSpec {
  command: string;
  args: string[];
}

export interface WorktreeInfo {
  repoRoot: string;
  path: string;
  branch: string;
}

export function normalizePath(path: string, home = process.env.HOME ?? "", cwd = process.cwd()): string {
  const trimmed = path.trim();
  if (trimmed === "~") return home;
  if (trimmed.startsWith("~/")) return join(home, trimmed.slice(2));
  return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
}

export function sanitizeBranchPathComponent(branch: string): string {
  return branch.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "branch";
}

export function buildDefaultBranchName(sessionName: string, prefix = ""): string {
  const slug = sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "session";
  return `${prefix}${slug}`;
}

export function buildWorktreePath(repoRoot: string, branch: string, basePath = "", home = process.env.HOME ?? ""): string {
  const resolvedBasePath = basePath.trim() ? normalizePath(basePath, home, repoRoot) : join(repoRoot, ".worktree");
  return join(resolvedBasePath, sanitizeBranchPathComponent(branch));
}

export function buildCreateWorktreeCommand(repoRoot: string, worktreePath: string, branch: string, branchExists: boolean): CommandSpec {
  return branchExists
    ? { command: "git", args: ["-C", repoRoot, "worktree", "add", worktreePath, branch] }
    : { command: "git", args: ["-C", repoRoot, "worktree", "add", "-b", branch, worktreePath] };
}

export function parseWorktreeForBranch(output: string, branch: string): string | undefined {
  const entries = output.split(/\n\s*\n/);
  for (const entry of entries) {
    const lines = entry.split("\n");
    const worktree = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    const branchLine = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length);
    if (worktree && branchLine === `refs/heads/${branch}`) return worktree;
  }
  return undefined;
}

export async function ensureDirectory(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`Path is not a directory: ${path}`);
}

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["-C", path, "rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

export async function validateBranchName(branch: string): Promise<void> {
  const trimmed = branch.trim();
  if (!trimmed) throw new Error("Branch name is required");
  try {
    await execFileAsync("git", ["check-ref-format", "--branch", trimmed]);
  } catch (error) {
    throw new Error(`Invalid branch name: ${trimmed}`);
  }
}

export async function getWorktreeBaseRoot(path: string): Promise<string> {
  try {
    const common = await execFileAsync("git", ["-C", path, "rev-parse", "--path-format=absolute", "--git-common-dir"]);
    const commonDir = common.stdout.trim();
    if (commonDir.endsWith("/.git")) return dirname(commonDir);
    const top = await execFileAsync("git", ["-C", path, "rev-parse", "--show-toplevel"]);
    return top.stdout.trim();
  } catch (error) {
    throw new Error(`Path is not a git repository: ${path}`);
  }
}

async function branchExists(repoRoot: string, branch: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["-C", repoRoot, "show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

async function existingWorktreeForBranch(repoRoot: string, branch: string): Promise<string | undefined> {
  const result = await execFileAsync("git", ["-C", repoRoot, "worktree", "list", "--porcelain"]);
  return parseWorktreeForBranch(result.stdout, branch);
}

export async function createOrReuseWorktree(projectPath: string, branch: string, worktreeBasePath = ""): Promise<WorktreeInfo> {
  const normalizedProjectPath = normalizePath(projectPath);
  await ensureDirectory(normalizedProjectPath);
  await validateBranchName(branch);
  const repoRoot = await getWorktreeBaseRoot(normalizedProjectPath);
  const existing = await existingWorktreeForBranch(repoRoot, branch);
  if (existing) return { repoRoot, path: existing, branch };

  const worktreePath = buildWorktreePath(repoRoot, branch, worktreeBasePath);
  await mkdir(dirname(worktreePath), { recursive: true });
  const exists = await branchExists(repoRoot, branch);
  const spec = buildCreateWorktreeCommand(repoRoot, worktreePath, branch, exists);
  await execFileAsync(spec.command, spec.args);
  return { repoRoot, path: worktreePath, branch };
}
