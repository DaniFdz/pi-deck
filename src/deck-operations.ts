import { DECK_VERSION, ROOT_GROUP_ID } from "./constants.js";
import { capturePane, detectPaneStatus, listTmuxSessions } from "./tmux.js";
import type { CreateGroupInput, CreateSessionInput, DeckChild, DeckGroup, DeckSession, DeckState } from "./types.js";

export function createEmptyDeck(now = new Date().toISOString()): DeckState {
  return {
    version: DECK_VERSION,
    updatedAt: now,
    groups: [
      {
        id: ROOT_GROUP_ID,
        name: "Deck",
        parentId: null,
        children: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    sessions: [],
  };
}

export function createGroup(deck: DeckState, input: CreateGroupInput): DeckState {
  const parent = deck.groups.find((group) => group.id === input.parentId);
  if (!parent) throw new Error(`Parent group not found: ${input.parentId}`);
  if (deck.groups.some((group) => group.id === input.id)) throw new Error(`Group already exists: ${input.id}`);

  const group: DeckGroup = {
    id: input.id,
    name: input.name,
    parentId: input.parentId,
    children: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
  const child: DeckChild = { type: "group", id: group.id };

  return {
    ...deck,
    updatedAt: input.now,
    groups: deck.groups.map((existing) =>
      existing.id === parent.id
        ? {
            ...existing,
            updatedAt: input.now,
            children: [...existing.children, child],
          }
        : existing,
    ).concat(group),
  };
}

export function createSession(deck: DeckState, input: CreateSessionInput): DeckState {
  const group = deck.groups.find((candidate) => candidate.id === input.groupId);
  if (!group) throw new Error(`Group not found: ${input.groupId}`);
  if (deck.sessions.some((session) => session.id === input.id)) throw new Error(`Session already exists: ${input.id}`);

  const session: DeckSession = {
    id: input.id,
    name: input.name,
    groupId: input.groupId,
    projectPath: input.projectPath,
    kind: input.kind,
    ...(input.tmux ? { tmux: { ...input.tmux } } : {}),
    ...(input.pi ? { pi: { ...input.pi } } : {}),
    status: {
      state: input.kind === "current-unmanaged" ? "unmanaged" : "starting",
      confidence: "known",
    },
    createdAt: input.now,
    updatedAt: input.now,
  };
  const child: DeckChild = { type: "session", id: session.id };

  return {
    ...deck,
    updatedAt: input.now,
    sessions: [...deck.sessions, session],
    groups: deck.groups.map((existing) =>
      existing.id === group.id
        ? {
            ...existing,
            updatedAt: input.now,
            children: [...existing.children, child],
          }
        : existing,
    ),
  };
}

export function renameSession(deck: DeckState, sessionId: string, name: string, now = new Date().toISOString()): DeckState {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Session name cannot be empty");
  let found = false;
  const sessions = deck.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    found = true;
    return { ...session, name: trimmed, updatedAt: now };
  });
  if (!found) throw new Error(`Session not found: ${sessionId}`);
  return { ...deck, sessions, updatedAt: now };
}

export interface ValidateSendInput {
  fromSessionId: string;
  toSessionId: string;
  message: string;
}

export type ValidateSendResult =
  | { ok: true; targetPaneId: string; warning?: string | undefined }
  | { ok: false; reason: string };

export function validateSend(deck: DeckState, input: ValidateSendInput): ValidateSendResult {
  const message = input.message.trim();
  if (!message) return { ok: false, reason: "Message is empty" };
  if (input.fromSessionId === input.toSessionId) return { ok: false, reason: "Cannot send to the current session" };

  const target = deck.sessions.find((session) => session.id === input.toSessionId);
  if (!target) return { ok: false, reason: `Target session not found: ${input.toSessionId}` };
  if (target.kind === "missing" || target.status.state === "missing") return { ok: false, reason: "Target session is missing" };
  if (!target.tmux?.paneId) return { ok: false, reason: "Target session does not have a tmux pane" };

  return target.status.state === "running"
    ? { ok: true, targetPaneId: target.tmux.paneId, warning: "Target session appears busy" }
    : { ok: true, targetPaneId: target.tmux.paneId, warning: undefined };
}

export async function refreshDeckStatuses(deck: DeckState, now = new Date().toISOString()): Promise<DeckState> {
  let livePaneIds: Set<string> | undefined;
  try {
    livePaneIds = new Set((await listTmuxSessions()).map((session) => session.paneId));
  } catch {
    livePaneIds = undefined;
  }

  let changed = false;
  const sessions: DeckSession[] = [];

  for (const session of deck.sessions) {
    const paneId = session.tmux?.paneId;
    if (!paneId) {
      sessions.push(session);
      continue;
    }

    if (livePaneIds && !livePaneIds.has(paneId)) {
      sessions.push(markMissing(session, now));
      changed = true;
      continue;
    }

    try {
      const paneText = await capturePane(paneId);
      const status = detectPaneStatus({ paneText, previousHash: session.status.lastPaneHash, now });
      sessions.push({ ...session, status, updatedAt: now });
      changed = true;
    } catch {
      sessions.push(markMissing(session, now));
      changed = true;
    }
  }

  return changed ? { ...deck, sessions, updatedAt: now } : deck;
}

function markMissing(session: DeckSession, now: string): DeckSession {
  return {
    ...session,
    status: { state: "missing", confidence: "known", lastSeenAt: now },
    updatedAt: now,
  };
}
