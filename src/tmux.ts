import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import type { DeckSessionStatus } from "./types.js";

const execFileAsync = promisify(execFile);

export interface CommandSpec {
  command: string;
  args: string[];
}

export interface TmuxSessionSummary {
  sessionName: string;
  paneId: string;
  command: string;
}

export interface LaunchInput {
  sessionName: string;
  projectPath: string;
}

export function buildLaunchCommand(input: LaunchInput): CommandSpec {
  return {
    command: "tmux",
    args: ["new-session", "-d", "-s", input.sessionName, "-c", input.projectPath, "pi"],
  };
}

export function buildSendKeysCommand(paneId: string, message: string): CommandSpec {
  return {
    command: "tmux",
    args: ["send-keys", "-t", paneId, message, "Enter"],
  };
}

export function parseTmuxSessions(output: string): TmuxSessionSummary[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sessionName, paneId, command] = line.split(": ");
      if (!sessionName || !paneId || !command) throw new Error(`Invalid tmux session line: ${line}`);
      return { sessionName, paneId, command };
    });
}

export function isLikelyPiSession(summary: TmuxSessionSummary): boolean {
  return summary.command === "pi" || summary.sessionName.startsWith("pi-") || summary.sessionName.startsWith("pi-deck-");
}

export interface DetectPaneStatusInput {
  paneText: string;
  previousHash?: string | undefined;
  now: string;
}

export function detectPaneStatus(input: DetectPaneStatusInput): DeckSessionStatus {
  const hash = hashPane(input.paneText);
  return {
    state: input.previousHash && input.previousHash === hash ? "idle" : "running",
    confidence: "heuristic",
    lastSeenAt: input.now,
    lastPaneHash: hash,
  };
}

export async function tmuxExists(): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["-V"]);
    return true;
  } catch {
    return false;
  }
}

export async function runTmux(args: string[]): Promise<string> {
  const result = await execFileAsync("tmux", args);
  return result.stdout;
}

export async function listTmuxSessions(): Promise<TmuxSessionSummary[]> {
  const output = await runTmux(["list-panes", "-a", "-F", "#{session_name}: #{pane_id}: #{pane_current_command}"]);
  return parseTmuxSessions(output);
}

export async function capturePane(paneId: string): Promise<string> {
  return runTmux(["capture-pane", "-p", "-t", paneId]);
}

export async function launchPiSession(input: LaunchInput): Promise<void> {
  const spec = buildLaunchCommand(input);
  await execFileAsync(spec.command, spec.args);
}

export async function sendKeys(paneId: string, message: string): Promise<void> {
  const spec = buildSendKeysCommand(paneId, message);
  await execFileAsync(spec.command, spec.args);
}

function hashPane(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
