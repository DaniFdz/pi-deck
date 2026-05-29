import { describe, expect, it } from "vitest";
import { createEmptyDeck, createGroup, createSession, toggleGroupExpanded } from "../domain/deck.js";
import { flattenDeckForDashboard } from "./dashboard.js";

const now = "2026-05-29T00:00:00.000Z";

describe("dashboard flattening", () => {
  it("hides children of collapsed groups", () => {
    const deck = toggleGroupExpanded(createSession(createGroup(createEmptyDeck(now), {
      id: "grp_work",
      name: "work",
      parentId: "root",
      now,
    }), {
      id: "ses_api",
      name: "api",
      groupId: "grp_work",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
    }), "grp_work", now);

    expect(flattenDeckForDashboard(deck).map((row) => `${row.type}:${row.id}`)).toEqual(["group:root", "group:grp_work"]);
  });
});
