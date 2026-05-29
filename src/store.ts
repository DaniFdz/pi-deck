import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createEmptyDeck } from "./deck-operations.js";
import type { DeckChild, DeckGroup, DeckSession, DeckSessionStatus, DeckState } from "./types.js";

export async function loadDeck(path: string, now = new Date().toISOString()): Promise<DeckState> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return createEmptyDeck(now);
    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateDeck(parsed);
  } catch {
    const backupPath = `${path}.bak.${Date.now()}`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(backupPath, raw, "utf8");
    const fresh = createEmptyDeck(now);
    await saveDeck(path, fresh);
    return fresh;
  }
}

export async function saveDeck(path: string, deck: DeckState): Promise<void> {
  validateDeck(deck);
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

function validateDeck(value: unknown): DeckState {
  if (!isRecord(value)) throw new Error("Deck file must contain an object");
  if (value.version !== 1) throw new Error("Unsupported deck version");
  if (typeof value.updatedAt !== "string") throw new Error("Deck updatedAt must be a string");
  if (!Array.isArray(value.groups)) throw new Error("Deck groups must be an array");
  if (!Array.isArray(value.sessions)) throw new Error("Deck sessions must be an array");

  const groups = value.groups.map(validateGroup);
  const sessions = value.sessions.map(validateSession);
  return {
    version: 1,
    updatedAt: value.updatedAt,
    groups,
    sessions,
  };
}

function validateGroup(value: unknown): DeckGroup {
  if (!isRecord(value)) throw new Error("Deck group must be an object");
  if (typeof value.id !== "string") throw new Error("Deck group id must be a string");
  if (typeof value.name !== "string") throw new Error("Deck group name must be a string");
  if (value.parentId !== null && typeof value.parentId !== "string") throw new Error("Deck group parentId must be a string or null");
  if (!Array.isArray(value.children)) throw new Error("Deck group children must be an array");
  if (typeof value.createdAt !== "string") throw new Error("Deck group createdAt must be a string");
  if (typeof value.updatedAt !== "string") throw new Error("Deck group updatedAt must be a string");

  return {
    id: value.id,
    name: value.name,
    parentId: value.parentId,
    children: value.children.map(validateChild),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function validateChild(value: unknown): DeckChild {
  if (!isRecord(value)) throw new Error("Deck child must be an object");
  if (value.type !== "group" && value.type !== "session") throw new Error("Deck child type is invalid");
  if (typeof value.id !== "string") throw new Error("Deck child id must be a string");
  return { type: value.type, id: value.id };
}

function validateSession(value: unknown): DeckSession {
  if (!isRecord(value)) throw new Error("Deck session must be an object");
  if (typeof value.id !== "string") throw new Error("Deck session id must be a string");
  if (typeof value.name !== "string") throw new Error("Deck session name must be a string");
  if (typeof value.groupId !== "string") throw new Error("Deck session groupId must be a string");
  if (typeof value.projectPath !== "string") throw new Error("Deck session projectPath must be a string");
  if (!isSessionKind(value.kind)) throw new Error("Deck session kind is invalid");
  if (!isRecord(value.status)) throw new Error("Deck session status must be an object");
  if (typeof value.createdAt !== "string") throw new Error("Deck session createdAt must be a string");
  if (typeof value.updatedAt !== "string") throw new Error("Deck session updatedAt must be a string");

  const session: DeckSession = {
    id: value.id,
    name: value.name,
    groupId: value.groupId,
    projectPath: value.projectPath,
    kind: value.kind,
    status: validateStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (value.tmux !== undefined) {
    if (!isRecord(value.tmux)) throw new Error("Deck session tmux must be an object");
    if (typeof value.tmux.sessionName !== "string") throw new Error("Deck session tmux sessionName must be a string");
    session.tmux = { sessionName: value.tmux.sessionName };
    if (typeof value.tmux.windowName === "string") session.tmux.windowName = value.tmux.windowName;
    if (typeof value.tmux.paneId === "string") session.tmux.paneId = value.tmux.paneId;
  }

  if (value.pi !== undefined) {
    if (!isRecord(value.pi)) throw new Error("Deck session pi must be an object");
    session.pi = {};
    if (typeof value.pi.sessionFile === "string") session.pi.sessionFile = value.pi.sessionFile;
    if (typeof value.pi.sessionId === "string") session.pi.sessionId = value.pi.sessionId;
  }

  if (value.worktree !== undefined) {
    if (!isRecord(value.worktree)) throw new Error("Deck session worktree must be an object");
    if (typeof value.worktree.repoRoot !== "string") throw new Error("Deck session worktree repoRoot must be a string");
    if (typeof value.worktree.path !== "string") throw new Error("Deck session worktree path must be a string");
    if (typeof value.worktree.branch !== "string") throw new Error("Deck session worktree branch must be a string");
    session.worktree = { repoRoot: value.worktree.repoRoot, path: value.worktree.path, branch: value.worktree.branch };
  }

  return session;
}

function validateStatus(value: Record<string, unknown>): DeckSessionStatus {
  if (!isSessionState(value.state)) throw new Error("Deck session status state is invalid");
  if (value.confidence !== "heuristic" && value.confidence !== "known") throw new Error("Deck session status confidence is invalid");

  const status: DeckSessionStatus = {
    state: value.state,
    confidence: value.confidence,
  };
  if (typeof value.lastSeenAt === "string") status.lastSeenAt = value.lastSeenAt;
  if (typeof value.lastPaneHash === "string") status.lastPaneHash = value.lastPaneHash;
  if (typeof value.acknowledgedAt === "string") status.acknowledgedAt = value.acknowledgedAt;
  return status;
}

function isSessionKind(value: unknown): value is DeckSession["kind"] {
  return value === "managed-tmux" || value === "imported-tmux" || value === "current-unmanaged" || value === "missing";
}

function isSessionState(value: unknown): value is DeckSessionStatus["state"] {
  return value === "running" || value === "waiting" || value === "idle" || value === "missing" || value === "starting" || value === "unmanaged";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
