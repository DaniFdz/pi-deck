import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { createGroup } from "../domain/deck.js";
import { loadDeck, saveDeck } from "../services/store.js";
import { askName } from "../ui/selectors.js";
import { formatGroupChoice } from "../ui/dashboard.js";

export async function createGroupWorkflow(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await loadDeck(storePath);
  const choices = deck.groups.map(formatGroupChoice);
  const selected = await ctx.ui.select("Create group under", choices);
  if (!selected) return;
  const parent = deck.groups.find((group) => formatGroupChoice(group) === selected);
  if (!parent) return;

  const name = await askName(ctx, "Group name", "New Group");
  if (!name) return;
  const next = createGroup(deck, {
    id: `grp_${randomUUID().slice(0, 8)}`,
    name,
    parentId: parent.id,
    now: new Date().toISOString(),
  });
  await saveDeck(storePath, next);
}
