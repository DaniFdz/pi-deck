import { DECK_VERSION, ROOT_GROUP_ID } from "./constants.js";
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
        expanded: true,
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
    expanded: true,
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
    ...(input.worktree ? { worktree: { ...input.worktree } } : {}),
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

export function deleteSession(deck: DeckState, sessionId: string, now = new Date().toISOString()): DeckState {
  if (!deck.sessions.some((session) => session.id === sessionId)) throw new Error(`Session not found: ${sessionId}`);
  return {
    ...deck,
    updatedAt: now,
    sessions: deck.sessions.filter((session) => session.id !== sessionId),
    groups: deck.groups.map((group) => ({
      ...group,
      updatedAt: group.children.some((child) => child.type === "session" && child.id === sessionId) ? now : group.updatedAt,
      children: group.children.filter((child) => !(child.type === "session" && child.id === sessionId)),
    })),
  };
}

export function toggleGroupExpanded(deck: DeckState, groupId: string, now = new Date().toISOString()): DeckState {
  if (!deck.groups.some((group) => group.id === groupId)) throw new Error(`Group not found: ${groupId}`);
  return {
    ...deck,
    updatedAt: now,
    groups: deck.groups.map((group) => group.id === groupId ? { ...group, expanded: !group.expanded, updatedAt: now } : group),
  };
}

export function deleteGroup(deck: DeckState, groupId: string, now = new Date().toISOString()): DeckState {
  if (groupId === ROOT_GROUP_ID) throw new Error("Cannot delete root group");
  const group = deck.groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`Group not found: ${groupId}`);
  if (group.children.length > 0) throw new Error(`Group is not empty: ${groupId}`);

  return {
    ...deck,
    updatedAt: now,
    groups: deck.groups
      .filter((candidate) => candidate.id !== groupId)
      .map((candidate) => ({
        ...candidate,
        updatedAt: candidate.children.some((child) => child.type === "group" && child.id === groupId) ? now : candidate.updatedAt,
        children: candidate.children.filter((child) => !(child.type === "group" && child.id === groupId)),
      })),
  };
}

export function moveChild(deck: DeckState, parentId: string, child: DeckChild, direction: -1 | 1, now = new Date().toISOString()): DeckState {
  const parent = deck.groups.find((group) => group.id === parentId);
  if (!parent) throw new Error(`Parent group not found: ${parentId}`);
  const index = parent.children.findIndex((candidate) => candidate.type === child.type && candidate.id === child.id);
  if (index < 0) throw new Error(`Child not found in parent group: ${child.type}:${child.id}`);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= parent.children.length) return deck;

  const children = [...parent.children];
  const [moved] = children.splice(index, 1);
  children.splice(nextIndex, 0, moved!);

  return {
    ...deck,
    updatedAt: now,
    groups: deck.groups.map((group) => group.id === parentId ? { ...group, children, updatedAt: now } : group),
  };
}

export function moveItemToGroup(deck: DeckState, child: DeckChild, targetGroupId: string, now = new Date().toISOString()): DeckState {
  const targetGroup = deck.groups.find((group) => group.id === targetGroupId);
  if (!targetGroup) throw new Error(`Target group not found: ${targetGroupId}`);

  if (child.type === "group") {
    if (child.id === targetGroupId) throw new Error("Cannot move a group into itself");
    if (isDescendantGroup(deck, targetGroupId, child.id)) throw new Error("Cannot move a group into its descendant");
  }

  const sourceGroup = deck.groups.find((group) => group.children.some((candidate) => candidate.type === child.type && candidate.id === child.id));
  if (!sourceGroup) throw new Error(`Child not found: ${child.type}:${child.id}`);
  if (sourceGroup.id === targetGroupId) return deck;

  const groups = deck.groups.map((group) => {
    if (group.id === sourceGroup.id) {
      return {
        ...group,
        updatedAt: now,
        children: group.children.filter((candidate) => !(candidate.type === child.type && candidate.id === child.id)),
      };
    }
    if (group.id === targetGroupId) {
      return { ...group, updatedAt: now, children: [...group.children, child] };
    }
    if (child.type === "group" && group.id === child.id) return { ...group, parentId: targetGroupId, updatedAt: now };
    return group;
  });

  const sessions = child.type === "session"
    ? deck.sessions.map((session) => session.id === child.id ? { ...session, groupId: targetGroupId, updatedAt: now } : session)
    : deck.sessions;

  return { ...deck, updatedAt: now, groups, sessions };
}

function isDescendantGroup(deck: DeckState, candidateGroupId: string, ancestorGroupId: string): boolean {
  let group = deck.groups.find((candidate) => candidate.id === candidateGroupId);
  while (group?.parentId) {
    if (group.parentId === ancestorGroupId) return true;
    group = deck.groups.find((candidate) => candidate.id === group?.parentId);
  }
  return false;
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
