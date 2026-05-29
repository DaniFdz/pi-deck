export type DeckChild =
  | { type: "group"; id: string }
  | { type: "session"; id: string };

export interface DeckGroup {
  id: string;
  name: string;
  parentId: string | null;
  children: DeckChild[];
  expanded: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DeckSessionKind = "managed-tmux" | "imported-tmux" | "current-unmanaged" | "missing";

export type DeckSessionState = "running" | "waiting" | "idle" | "missing" | "starting" | "unmanaged";

export type DeckStatusConfidence = "heuristic" | "known";

export interface DeckSessionStatus {
  state: DeckSessionState;
  confidence: DeckStatusConfidence;
  lastSeenAt?: string;
  lastPaneHash?: string;
  acknowledgedAt?: string;
}

export interface DeckTmuxRef {
  sessionName: string;
  windowName?: string;
  paneId?: string;
}

export interface DeckPiRef {
  sessionFile?: string;
  sessionId?: string;
}

export interface DeckWorktreeRef {
  repoRoot: string;
  path: string;
  branch: string;
}

export interface DeckSession {
  id: string;
  name: string;
  groupId: string;
  projectPath: string;
  kind: DeckSessionKind;
  tmux?: DeckTmuxRef;
  pi?: DeckPiRef;
  worktree?: DeckWorktreeRef;
  status: DeckSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeckState {
  version: 1;
  updatedAt: string;
  groups: DeckGroup[];
  sessions: DeckSession[];
}

export interface CreateGroupInput {
  id: string;
  name: string;
  parentId: string;
  now: string;
}

export interface CreateSessionInput {
  id: string;
  name: string;
  groupId: string;
  projectPath: string;
  kind: DeckSessionKind;
  now: string;
  tmux?: DeckTmuxRef;
  pi?: DeckPiRef;
  worktree?: DeckWorktreeRef;
}
