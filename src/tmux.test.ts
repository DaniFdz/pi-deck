import { describe, expect, it } from "vitest";
import { buildLaunchCommand, detectPaneStatus, parseTmuxSessions } from "./tmux.js";

describe("tmux adapter helpers", () => {
  it("builds a launch command for a managed Pi session", () => {
    expect(buildLaunchCommand({ sessionName: "pi-deck-api", projectPath: "/tmp/project" })).toEqual({
      command: "tmux",
      args: ["new-session", "-d", "-s", "pi-deck-api", "-c", "/tmp/project", "pi"],
    });
  });

  it("parses tmux sessions", () => {
    const parsed = parseTmuxSessions("one: %1: pi\ntwo: %2: zsh\n");
    expect(parsed).toEqual([
      { sessionName: "one", paneId: "%1", command: "pi" },
      { sessionName: "two", paneId: "%2", command: "zsh" },
    ]);
  });

  it("detects running when pane hash changes", () => {
    const status = detectPaneStatus({
      paneText: "new output",
      previousHash: "old",
      now: "2026-05-28T00:00:00.000Z",
    });

    expect(status.state).toBe("running");
    expect(status.confidence).toBe("heuristic");
  });

  it("detects idle when pane hash is stable", () => {
    const first = detectPaneStatus({ paneText: "pi prompt", now: "2026-05-28T00:00:00.000Z" });
    const second = detectPaneStatus({
      paneText: "pi prompt",
      previousHash: first.lastPaneHash,
      now: "2026-05-28T00:01:00.000Z",
    });

    expect(second.state).toBe("idle");
  });
});
