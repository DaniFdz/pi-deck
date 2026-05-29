import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { deleteGroup, deleteSession } from "../domain/deck.js";
import { loadDeck, saveDeck } from "../services/store.js";
import { killSession } from "../services/tmux.js";

export async function deleteDashboardItem(ctx: ExtensionCommandContext, storePath: string, action: { rowType: "group" | "session"; id: string }): Promise<void> {
  const latest = await loadDeck(storePath);
  const label = action.rowType === "session" ? latest.sessions.find((candidate) => candidate.id === action.id)?.name : latest.groups.find((candidate) => candidate.id === action.id)?.name;
  if (!label) {
    ctx.ui.notify("Selected item no longer exists", "error");
    return;
  }
  const confirmed = await ctx.ui.confirm("Delete from deck?", action.rowType === "session" ? `Delete ${label}? This will kill its tmux session if it is still running.` : `Remove empty group ${label} from Pi Deck?`);
  if (!confirmed) return;
  try {
    const next = action.rowType === "session" ? deleteSession(latest, action.id) : deleteGroup(latest, action.id);
    await saveDeck(storePath, next);
    if (action.rowType === "session") {
      const target = latest.sessions.find((candidate) => candidate.id === action.id);
      if (target?.tmux?.sessionName) {
        try {
          await killSession(target.tmux.sessionName);
        } catch (killError) {
          ctx.ui.notify(`Removed from deck, but tmux session may still be running: ${killError instanceof Error ? killError.message : String(killError)}`, "warning");
        }
      }
    }
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
  }
}
