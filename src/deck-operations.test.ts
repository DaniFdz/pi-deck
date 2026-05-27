import { describe, expect, it } from "vitest";
import { createEmptyDeck, createGroup } from "./deck-operations.js";

const now = "2026-05-28T00:00:00.000Z";

describe("deck operations", () => {
  it("creates an empty deck with a root group", () => {
    const deck = createEmptyDeck(now);

    expect(deck.version).toBe(1);
    expect(deck.groups).toHaveLength(1);
    expect(deck.groups[0]).toMatchObject({
      id: "root",
      name: "Deck",
      parentId: null,
      children: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(deck.sessions).toEqual([]);
  });

  it("creates a child group and appends it to the parent children", () => {
    const deck = createEmptyDeck(now);
    const result = createGroup(deck, {
      id: "grp_work",
      name: "work",
      parentId: "root",
      now,
    });

    expect(result.groups).toHaveLength(2);
    expect(result.groups.find((group) => group.id === "grp_work")).toMatchObject({
      id: "grp_work",
      name: "work",
      parentId: "root",
      children: [],
    });
    expect(result.groups.find((group) => group.id === "root")?.children).toEqual([
      { type: "group", id: "grp_work" },
    ]);
  });
});
