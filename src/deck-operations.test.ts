import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyDeck, createGroup, createSession, deleteGroup, deleteSession, moveChild, moveItemToGroup, refreshDeckStatuses, renameSession, toggleGroupExpanded, validateSend } from "./deck-operations.js";
import { capturePane, listTmuxSessions } from "./tmux.js";

vi.mock("./tmux.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tmux.js")>();
  return {
    ...actual,
    capturePane: vi.fn(),
    listTmuxSessions: vi.fn(),
  };
});

const mockedCapturePane = vi.mocked(capturePane);
const mockedListTmuxSessions = vi.mocked(listTmuxSessions);

const now = "2026-05-28T00:00:00.000Z";
const later = "2026-05-28T01:00:00.000Z";

describe("deck operations", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("creates an empty deck with a root group", () => {
    const deck = createEmptyDeck(now);

    expect(deck.version).toBe(1);
    expect(deck.groups).toHaveLength(1);
    expect(deck.groups[0]).toMatchObject({
      id: "root",
      name: "Deck",
      parentId: null,
      children: [],
      expanded: true,
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
      expanded: true,
    });
    expect(result.groups.find((group) => group.id === "root")?.children).toEqual([
      { type: "group", id: "grp_work" },
    ]);
  });

  it("creates a managed session", () => {
    const deck = createEmptyDeck(now);
    const result = createSession(deck, {
      id: "sess_api",
      name: "api",
      groupId: "root",
      projectPath: "/work/api",
      kind: "managed-tmux",
      now: later,
      tmux: { sessionName: "api", windowName: "server", paneId: "%1" },
      pi: { sessionFile: "/tmp/api.json", sessionId: "pi_api" },
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toEqual({
      id: "sess_api",
      name: "api",
      groupId: "root",
      projectPath: "/work/api",
      kind: "managed-tmux",
      tmux: { sessionName: "api", windowName: "server", paneId: "%1" },
      pi: { sessionFile: "/tmp/api.json", sessionId: "pi_api" },
      status: { state: "starting", confidence: "known" },
      createdAt: later,
      updatedAt: later,
    });
    expect(result.updatedAt).toBe(later);
  });

  it("appends a session child to its group", () => {
    const deck = createEmptyDeck(now);
    const result = createSession(deck, {
      id: "sess_api",
      name: "api",
      groupId: "root",
      projectPath: "/work/api",
      kind: "managed-tmux",
      now: later,
    });

    expect(result.groups.find((group) => group.id === "root")?.children).toEqual([
      { type: "session", id: "sess_api" },
    ]);
    expect(result.groups.find((group) => group.id === "root")?.updatedAt).toBe(later);
  });

  it("sets current-unmanaged sessions to unmanaged status", () => {
    const deck = createEmptyDeck(now);
    const result = createSession(deck, {
      id: "sess_current",
      name: "current",
      groupId: "root",
      projectPath: "/work/current",
      kind: "current-unmanaged",
      now: later,
    });

    expect(result.sessions[0]?.status).toEqual({ state: "unmanaged", confidence: "known" });
  });

  it("sets managed and imported sessions to starting status", () => {
    const deck = createEmptyDeck(now);
    const withManaged = createSession(deck, {
      id: "sess_managed",
      name: "managed",
      groupId: "root",
      projectPath: "/work/managed",
      kind: "managed-tmux",
      now: later,
    });
    const withImported = createSession(withManaged, {
      id: "sess_imported",
      name: "imported",
      groupId: "root",
      projectPath: "/work/imported",
      kind: "imported-tmux",
      now: later,
    });

    expect(withManaged.sessions[0]?.status).toEqual({ state: "starting", confidence: "known" });
    expect(withImported.sessions[1]?.status).toEqual({ state: "starting", confidence: "known" });
  });

  it("rejects duplicate session IDs", () => {
    const deck = createSession(createEmptyDeck(now), {
      id: "sess_api",
      name: "api",
      groupId: "root",
      projectPath: "/work/api",
      kind: "managed-tmux",
      now: later,
    });

    expect(() =>
      createSession(deck, {
        id: "sess_api",
        name: "api again",
        groupId: "root",
        projectPath: "/work/api-again",
        kind: "managed-tmux",
        now: later,
      }),
    ).toThrow("Session already exists: sess_api");
  });

  it("rejects sessions for missing groups", () => {
    const deck = createEmptyDeck(now);

    expect(() =>
      createSession(deck, {
        id: "sess_api",
        name: "api",
        groupId: "grp_missing",
        projectPath: "/work/api",
        kind: "managed-tmux",
        now: later,
      }),
    ).toThrow("Group not found: grp_missing");
  });

  it("does not reuse mutable tmux or pi input references", () => {
    const tmux = { sessionName: "api", windowName: "server", paneId: "%1" };
    const pi = { sessionFile: "/tmp/api.json", sessionId: "pi_api" };
    const result = createSession(createEmptyDeck(now), {
      id: "sess_api",
      name: "api",
      groupId: "root",
      projectPath: "/work/api",
      kind: "managed-tmux",
      now: later,
      tmux,
      pi,
    });

    expect(result.sessions[0]?.tmux).toEqual(tmux);
    expect(result.sessions[0]?.pi).toEqual(pi);
    expect(result.sessions[0]?.tmux).not.toBe(tmux);
    expect(result.sessions[0]?.pi).not.toBe(pi);

    tmux.sessionName = "changed";
    pi.sessionId = "changed";

    expect(result.sessions[0]?.tmux).toEqual({ sessionName: "api", windowName: "server", paneId: "%1" });
    expect(result.sessions[0]?.pi).toEqual({ sessionFile: "/tmp/api.json", sessionId: "pi_api" });
  });

  it("creates a session and appends it to the group children", () => {
    const deck = createEmptyDeck(now);
    const result = createSession(deck, {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
      tmux: { sessionName: "pi-deck-api", paneId: "%1" },
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      id: "ses_api",
      name: "api",
      groupId: "root",
      kind: "managed-tmux",
    });
    expect(result.groups[0]?.children).toContainEqual({ type: "session", id: "ses_api" });
  });

  it("deletes a session and removes it from group children", () => {
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
      tmux: { sessionName: "pi-deck-api", paneId: "%1" },
    });

    const result = deleteSession(deck, "ses_api", "2026-05-28T00:01:00.000Z");

    expect(result.sessions).toEqual([]);
    expect(result.groups[0]?.children).not.toContainEqual({ type: "session", id: "ses_api" });
    expect(result.updatedAt).toBe("2026-05-28T00:01:00.000Z");
  });

  it("toggles group expanded state", () => {
    const deck = createGroup(createEmptyDeck(now), {
      id: "grp_work",
      name: "work",
      parentId: "root",
      now,
    });

    const collapsed = toggleGroupExpanded(deck, "grp_work", later);
    const expanded = toggleGroupExpanded(collapsed, "grp_work", later);

    expect(collapsed.groups.find((group) => group.id === "grp_work")?.expanded).toBe(false);
    expect(expanded.groups.find((group) => group.id === "grp_work")?.expanded).toBe(true);
  });

  it("deletes an empty non-root group", () => {
    const deck = createGroup(createEmptyDeck(now), {
      id: "grp_work",
      name: "work",
      parentId: "root",
      now,
    });

    const result = deleteGroup(deck, "grp_work", later);

    expect(result.groups.map((group) => group.id)).toEqual(["root"]);
    expect(result.groups[0]?.children).toEqual([]);
    expect(result.updatedAt).toBe(later);
  });

  it("rejects deleting the root group", () => {
    expect(() => deleteGroup(createEmptyDeck(now), "root", later)).toThrow("Cannot delete root group");
  });

  it("rejects deleting a non-empty group", () => {
    const deck = createSession(createGroup(createEmptyDeck(now), {
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
    });

    expect(() => deleteGroup(deck, "grp_work", later)).toThrow("Group is not empty: grp_work");
  });

  it("moves child items within a parent group", () => {
    const deck = createSession(createSession(createEmptyDeck(now), {
      id: "ses_one",
      name: "one",
      groupId: "root",
      projectPath: "/tmp/one",
      kind: "managed-tmux",
      now,
    }), {
      id: "ses_two",
      name: "two",
      groupId: "root",
      projectPath: "/tmp/two",
      kind: "managed-tmux",
      now,
    });

    const result = moveChild(deck, "root", { type: "session", id: "ses_two" }, -1, later);

    expect(result.groups[0]?.children).toEqual([
      { type: "session", id: "ses_two" },
      { type: "session", id: "ses_one" },
    ]);
    expect(result.updatedAt).toBe(later);
  });

  it("keeps child order unchanged when moving past bounds", () => {
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_one",
      name: "one",
      groupId: "root",
      projectPath: "/tmp/one",
      kind: "managed-tmux",
      now,
    });

    const result = moveChild(deck, "root", { type: "session", id: "ses_one" }, -1, later);

    expect(result.groups[0]?.children).toEqual([{ type: "session", id: "ses_one" }]);
    expect(result).toBe(deck);
  });

  it("moves a session into another group", () => {
    const deck = createSession(createGroup(createEmptyDeck(now), {
      id: "grp_work",
      name: "work",
      parentId: "root",
      now,
    }), {
      id: "ses_one",
      name: "one",
      groupId: "root",
      projectPath: "/tmp/one",
      kind: "managed-tmux",
      now,
    });

    const result = moveItemToGroup(deck, { type: "session", id: "ses_one" }, "grp_work", later);

    expect(result.sessions[0]?.groupId).toBe("grp_work");
    expect(result.groups.find((group) => group.id === "root")?.children).toEqual([{ type: "group", id: "grp_work" }]);
    expect(result.groups.find((group) => group.id === "grp_work")?.children).toEqual([{ type: "session", id: "ses_one" }]);
  });

  it("moves a group into another group", () => {
    const deck = createGroup(createGroup(createEmptyDeck(now), {
      id: "grp_work",
      name: "work",
      parentId: "root",
      now,
    }), {
      id: "grp_api",
      name: "api",
      parentId: "root",
      now,
    });

    const result = moveItemToGroup(deck, { type: "group", id: "grp_api" }, "grp_work", later);

    expect(result.groups.find((group) => group.id === "grp_api")?.parentId).toBe("grp_work");
    expect(result.groups.find((group) => group.id === "root")?.children).toEqual([{ type: "group", id: "grp_work" }]);
    expect(result.groups.find((group) => group.id === "grp_work")?.children).toEqual([{ type: "group", id: "grp_api" }]);
  });

  it("rejects moving a group into itself or a descendant", () => {
    const deck = createGroup(createGroup(createEmptyDeck(now), {
      id: "grp_parent",
      name: "parent",
      parentId: "root",
      now,
    }), {
      id: "grp_child",
      name: "child",
      parentId: "grp_parent",
      now,
    });

    expect(() => moveItemToGroup(deck, { type: "group", id: "grp_parent" }, "grp_parent", later)).toThrow("Cannot move a group into itself");
    expect(() => moveItemToGroup(deck, { type: "group", id: "grp_parent" }, "grp_child", later)).toThrow("Cannot move a group into its descendant");
  });

  it("renames a session without changing its tmux metadata", () => {
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "imported-tmux",
      now,
      tmux: { sessionName: "agentdeck_api", paneId: "%1" },
    });

    const result = renameSession(deck, "ses_api", " Friendly API ", later);

    expect(result.sessions[0]?.name).toBe("Friendly API");
    expect(result.sessions[0]?.tmux?.sessionName).toBe("agentdeck_api");
    expect(result.updatedAt).toBe(later);
  });

  it("validates deck send targets", () => {
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
      tmux: { sessionName: "pi-deck-api", paneId: "%1" },
    });

    expect(validateSend(deck, { fromSessionId: "manager", toSessionId: "ses_api", message: "hello" })).toEqual({
      ok: true,
      targetPaneId: "%1",
      warning: undefined,
    });
    expect(validateSend(deck, { fromSessionId: "ses_api", toSessionId: "ses_api", message: "hello" }).ok).toBe(false);
    expect(validateSend(deck, { fromSessionId: "manager", toSessionId: "missing", message: "hello" }).ok).toBe(false);
    expect(validateSend(deck, { fromSessionId: "manager", toSessionId: "ses_api", message: "   " }).ok).toBe(false);
  });

  it("warns when validating a send to a running target", () => {
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
      tmux: { sessionName: "pi-deck-api", paneId: "%1" },
    });
    const runningDeck = {
      ...deck,
      sessions: deck.sessions.map((session) => ({
        ...session,
        status: { ...session.status, state: "running" as const },
      })),
    };

    expect(validateSend(runningDeck, { fromSessionId: "manager", toSessionId: "ses_api", message: "  hello  " })).toEqual({
      ok: true,
      targetPaneId: "%1",
      warning: "Target session appears busy",
    });
  });

  it("refreshes tmux-backed session status from pane text", async () => {
    mockedListTmuxSessions.mockResolvedValue([{ sessionName: "pi-deck-api", paneId: "%1", command: "pi", panePid: 123 }]);
    mockedCapturePane.mockResolvedValue("ready");
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
      tmux: { sessionName: "pi-deck-api", paneId: "%1" },
    });

    const result = await refreshDeckStatuses(deck, later);

    expect(result.sessions[0]?.status).toMatchObject({
      state: "running",
      confidence: "heuristic",
      lastSeenAt: later,
    });
    expect(result.sessions[0]?.status.lastPaneHash).toEqual(expect.any(String));
    expect(result.sessions[0]?.updatedAt).toBe(later);
  });

  it("marks tmux-backed sessions missing when their pane is gone", async () => {
    mockedListTmuxSessions.mockResolvedValue([]);
    const deck = createSession(createEmptyDeck(now), {
      id: "ses_api",
      name: "api",
      groupId: "root",
      projectPath: "/tmp/api",
      kind: "managed-tmux",
      now,
      tmux: { sessionName: "pi-deck-api", paneId: "%1" },
    });

    const result = await refreshDeckStatuses(deck, later);

    expect(result.sessions[0]?.status).toEqual({
      state: "missing",
      confidence: "known",
      lastSeenAt: later,
    });
    expect(mockedCapturePane).not.toHaveBeenCalled();
  });
});
