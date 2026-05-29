import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { validateSend } from "../domain/deck.js";
import { loadDeck } from "../services/store.js";
import { sendKeys } from "../services/tmux.js";
import { chooseSession } from "../ui/selectors.js";

export async function sendPromptToSession(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await loadDeck(storePath);
  const target = await chooseSession(ctx, deck.sessions.filter((session) => Boolean(session.tmux?.paneId)));
  if (!target) return;
  const message = await ctx.ui.editor("Prompt to send", "");
  if (!message) return;

  const validation = validateSend(deck, { fromSessionId: "current", toSessionId: target.id, message });
  if (!validation.ok) {
    ctx.ui.notify(validation.reason, "error");
    return;
  }

  const confirmationText = validation.warning ? `Send to ${target.name}?\n\nWarning: ${validation.warning}` : `Send to ${target.name}?`;
  const confirmed = await ctx.ui.confirm("Send prompt?", confirmationText);
  if (!confirmed) return;
  await sendKeys(validation.targetPaneId, message.trim());
  ctx.ui.notify(`Sent prompt to ${target.name}`, "info");
}
