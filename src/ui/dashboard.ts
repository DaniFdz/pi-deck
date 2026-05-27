import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { loadDeck } from "../store.js";

export async function showDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await loadDeck(storePath);
  ctx.ui.notify(`Pi Deck: ${deck.sessions.length} session(s), ${deck.groups.length} group(s)`, "info");
}
