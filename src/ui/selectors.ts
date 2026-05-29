import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { DeckGroup, DeckSession } from "../domain/types.js";

export function formatGroupChoice(group: DeckGroup): string {
  return group.parentId === null ? "My Deck (root)" : `${group.name} (${group.id})`;
}

export function normalizeInputValue(value: string | undefined, fallback: string): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed || fallback.trim() || undefined;
}

export async function askName(ctx: ExtensionCommandContext, title: string, placeholder: string): Promise<string | undefined> {
  const value = await ctx.ui.input(title, placeholder);
  return normalizeInputValue(value, placeholder);
}

export async function chooseGroup(ctx: ExtensionCommandContext, groups: DeckGroup[]): Promise<DeckGroup | undefined> {
  const choices = groups.map((group) => `${group.name} (${group.id})`);
  const selected = await ctx.ui.select("Choose group", choices);
  if (!selected) return undefined;
  const id = selected.match(/\(([^)]+)\)$/)?.[1];
  return groups.find((group) => group.id === id);
}

export async function chooseSession(ctx: ExtensionCommandContext, sessions: DeckSession[]): Promise<DeckSession | undefined> {
  const choices = sessions.map((session) => `${session.name} (${session.id})`);
  const selected = await ctx.ui.select("Choose session", choices);
  if (!selected) return undefined;
  const id = selected.match(/\(([^)]+)\)$/)?.[1];
  return sessions.find((session) => session.id === id);
}
