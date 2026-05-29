import { describe, expect, it } from "vitest";
import { formatGroupChoice } from "./dashboard.js";
import type { DeckGroup } from "../types.js";

const root: DeckGroup = {
  id: "root",
  name: "Deck",
  parentId: null,
  children: [],
  createdAt: "now",
  updatedAt: "now",
};

const group: DeckGroup = {
  id: "grp_api",
  name: "API",
  parentId: "root",
  children: [],
  createdAt: "now",
  updatedAt: "now",
};

describe("group choice labels", () => {
  it("labels root as My Deck", () => {
    expect(formatGroupChoice(root)).toBe("My Deck (root)");
  });

  it("labels non-root groups with their name and id", () => {
    expect(formatGroupChoice(group)).toBe("API (grp_api)");
  });
});
