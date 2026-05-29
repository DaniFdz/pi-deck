import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { TMUX_SESSION_PREFIX } from "../domain/constants.js";
import type { DeckSessionStatus } from "../domain/types.js";

const execFileAsync = promisify(execFile);
export interface CommandSpec {
  command: string;
  args: string[];
}

export interface TmuxSessionSummary {
  sessionName: string;
  paneId: string;
  command: string;
  panePid?: number;
}

export interface LaunchInput {
  sessionName: string;
  projectPath: string;
  sessionFile?: string;
}

export function buildLaunchCommand(input: LaunchInput): CommandSpec {
  return {
    command: "tmux",
    args: ["new-session", "-d", "-s", input.sessionName, "-c", input.projectPath, "pi", ...(input.sessionFile ? ["--session", input.sessionFile] : [])],
  };
}

export function buildManagedSessionName(name: string, suffix: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "session";
  return `${TMUX_SESSION_PREFIX}${sanitized}-${suffix}`;
}

export function buildSendKeysCommand(paneId: string, message: string): CommandSpec {
  return {
    command: "tmux",
    args: ["send-keys", "-t", paneId, message, "Enter"],
  };
}

export function buildAttachCommand(sessionName: string, options = { insideTmux: Boolean(process.env.TMUX) }): CommandSpec {
  return {
    command: "tmux",
    args: options.insideTmux ? ["switch-client", "-t", sessionName] : ["attach-session", "-t", sessionName],
  };
}

export function buildKillSessionCommand(sessionName: string): CommandSpec {
  return {
    command: "tmux",
    args: ["kill-session", "-t", sessionName],
  };
}

// tmux exits non-zero when the target session (or the whole server) is already
// gone. Deleting a session that was already killed is not an error from the
// deck's perspective, so we treat these messages as "already gone".
export function isMissingSessionError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message}` : String(error ?? "");
  return /can't find session|no server running|no such session|session not found/i.test(text);
}

export function parseTmuxSessions(output: string): TmuxSessionSummary[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split("\t");
      if (fields.length !== 4) throw new Error(`Invalid tmux session line: ${line}`);
      const [sessionName, paneId, command, panePidText] = fields;
      if (!sessionName || !paneId || !command) throw new Error(`Invalid tmux session line: ${line}`);
      const panePid = panePidText ? Number(panePidText) : undefined;
      if (panePidText && !Number.isFinite(panePid)) throw new Error(`Invalid tmux session line: ${line}`);
      return panePid === undefined ? { sessionName, paneId, command } : { sessionName, paneId, command, panePid };
    });
}

export function parsePaneIds(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isLikelyPiSession(summary: TmuxSessionSummary): boolean {
  return isPiCommandText(summary.command) || summary.sessionName.startsWith("pi-deck-");
}

export function isPiCommandText(text: string): boolean {
  return /(^|[\s/])pi($|[\s-])/.test(text) || /(^|[\s/])pi-coding-agent($|[\s-])/.test(text);
}

export async function isPaneLikelyPi(summary: TmuxSessionSummary): Promise<boolean> {
  if (isLikelyPiSession(summary)) return true;
  if (summary.panePid && (await processTreeContainsPi(summary.panePid))) return true;

  try {
    const paneText = await capturePane(summary.paneId);
    return paneTextLooksLikePi(paneText);
  } catch {
    return false;
  }
}

export function paneTextLooksLikePi(text: string): boolean {
  return (
    text.includes("/deck") ||
    text.includes("Available tools") ||
    text.includes("Current working directory:") ||
    text.includes("Use `todo`") ||
    text.includes("pi-coding-agent")
  );
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
  const output = await runTmux(["list-panes", "-a", "-F", "#{session_name}	#{pane_id}	#{pane_current_command}	#{pane_pid}"]);
  return parseTmuxSessions(output);
}

export async function getFirstPaneId(sessionName: string): Promise<string | undefined> {
  const output = await runTmux(["list-panes", "-t", sessionName, "-F", "#{pane_id}"]);
  return parsePaneIds(output)[0];
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

export async function attachSession(sessionName: string): Promise<void> {
  const spec = buildAttachCommand(sessionName);
  await execFileAsync(spec.command, spec.args);
}

export async function killSession(sessionName: string): Promise<void> {
  const spec = buildKillSessionCommand(sessionName);
  try {
    await execFileAsync(spec.command, spec.args);
  } catch (error) {
    // The session is already gone, which is the desired end state.
    if (isMissingSessionError(error)) return;
    throw error;
  }
}

async function processTreeContainsPi(rootPid: number): Promise<boolean> {
  try {
    const output = await execFileAsync("pgrep", ["-P", String(rootPid), "-a"]);
    const lines = output.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (isPiCommandText(line)) return true;
      const childPid = Number(line.split(/\s+/, 1)[0]);
      if (Number.isFinite(childPid) && (await processTreeContainsPi(childPid))) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function hashPane(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
