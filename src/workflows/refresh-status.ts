import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { refreshDeckStatuses } from "../services/deck-status.js";
import { loadDeck, saveDeck } from "../services/store.js";

export async function showStatusSummary(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await refreshDeckStatuses(await loadDeck(storePath));
  await saveDeck(storePath, deck);
  const lines = deck.sessions.map((session) => `${session.status.state.padEnd(10)} ${session.name}`).join("\n");
  ctx.ui.notify(lines || "No deck sessions", "info");
}
