import { capturePane, detectPaneStatus, listTmuxSessions } from "../tmux.js";
import type { DeckSession, DeckState } from "../domain/types.js";

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
