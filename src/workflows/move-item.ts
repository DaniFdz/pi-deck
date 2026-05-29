import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { moveChild, moveItemToGroup } from "../domain/deck.js";
import { loadDeck, saveDeck } from "../services/store.js";
import type { DeckChild, DeckState } from "../domain/types.js";
import { chooseGroup } from "../ui/selectors.js";

export async function reorderItem(storePath: string, parentId: string, child: DeckChild, direction: -1 | 1): Promise<boolean> {
  const current = await loadDeck(storePath);
  const next = moveChild(current, parentId, child, direction);
  if (next === current) return false;
  await saveDeck(storePath, next);
  return true;
}

export async function moveItemToChosenGroup(ctx: ExtensionCommandContext, storePath: string, child: DeckChild): Promise<void> {
  const deck = await loadDeck(storePath);
  const destinationGroups = deck.groups.filter((group) => child.type === "session" || (group.id !== child.id && !isGroupDescendant(deck, group.id, child.id)));
  const group = await chooseGroup(ctx, destinationGroups);
  if (!group) return;
  try {
    const next = moveItemToGroup(deck, child, group.id);
    if (next !== deck) await saveDeck(storePath, next);
  } catch (error) {
    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
  }
}

function isGroupDescendant(deck: DeckState, candidateGroupId: string, ancestorGroupId: string): boolean {
  let group = deck.groups.find((candidate) => candidate.id === candidateGroupId);
  while (group?.parentId) {
    if (group.parentId === ancestorGroupId) return true;
    group = deck.groups.find((candidate) => candidate.id === group?.parentId);
  }
  return false;
}
