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
    ...(input.tmux ? { tmux: input.tmux } : {}),
    ...(input.pi ? { pi: input.pi } : {}),
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
