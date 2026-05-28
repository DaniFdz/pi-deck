import { describe, expect, it } from "vitest";
import { buildAttachCommand, buildLaunchCommand, buildManagedSessionName, detectPaneStatus, isPiCommandText, paneTextLooksLikePi, parsePaneIds, parseTmuxSessions } from "./tmux.js";

describe("tmux adapter helpers", () => {
  it("builds a launch command for a managed Pi session", () => {
    expect(buildLaunchCommand({ sessionName: "pi-deck-api", projectPath: "/tmp/project" })).toEqual({
      command: "tmux",
      args: ["new-session", "-d", "-s", "pi-deck-api", "-c", "/tmp/project", "pi"],
    });
  });

  it("builds a launch command that resumes an existing Pi session file", () => {
    expect(buildLaunchCommand({ sessionName: "pi-deck-api", projectPath: "/tmp/project", sessionFile: "/tmp/session.jsonl" })).toEqual({
      command: "tmux",
      args: ["new-session", "-d", "-s", "pi-deck-api", "-c", "/tmp/project", "pi", "--session", "/tmp/session.jsonl"],
    });
  });

  it("builds unique managed session names", () => {
    expect(buildManagedSessionName("api fix", "abc123")).toBe("pi-deck-api-fix-abc123");
  });

  it("builds a tmux switch command when attaching from inside tmux", () => {
    expect(buildAttachCommand("pi-deck-api", { insideTmux: true })).toEqual({
      command: "tmux",
      args: ["switch-client", "-t", "pi-deck-api"],
    });
  });

  it("builds a tmux attach command when attaching from outside tmux", () => {
    expect(buildAttachCommand("pi-deck-api", { insideTmux: false })).toEqual({
      command: "tmux",
      args: ["attach-session", "-t", "pi-deck-api"],
    });
  });

  it("parses tmux sessions", () => {
    const parsed = parseTmuxSessions("one\t%1\tpi\t123\ntwo\t%2\tzsh\t456\n");
    expect(parsed).toEqual([
      { sessionName: "one", paneId: "%1", command: "pi", panePid: 123 },
      { sessionName: "two", paneId: "%2", command: "zsh", panePid: 456 },
    ]);
  });

  it("parses session names containing colon-space when tab-delimited", () => {
    const parsed = parseTmuxSessions("project: api\t%1\tpi\t123\n");
    expect(parsed).toEqual([{ sessionName: "project: api", paneId: "%1", command: "pi", panePid: 123 }]);
  });

  it("throws for malformed tmux session lines without exactly three fields", () => {
    expect(() => parseTmuxSessions("one\t%1\tpi\n")).toThrow("Invalid tmux session line");
    expect(() => parseTmuxSessions("one\t%1\tpi\t123\textra\n")).toThrow("Invalid tmux session line");
  });

  it("detects pi commands in wrappers and aliases", () => {
    expect(isPiCommandText("pi")).toBe(true);
    expect(isPiCommandText("ENV=1 pi")).toBe(true);
    expect(isPiCommandText("volta-shim pi")).toBe(true);
    expect(isPiCommandText("/Users/me/bin/pi")).toBe(true);
    expect(isPiCommandText("claude")).toBe(false);
  });

  it("detects pi-looking pane text", () => {
    expect(paneTextLooksLikePi("Pi Deck\n/deck\nAvailable tools")).toBe(true);
    expect(paneTextLooksLikePi("plain shell prompt")).toBe(false);
  });

  it("parses pane ids", () => {
    expect(parsePaneIds("%1\n%2\n")).toEqual(["%1", "%2"]);
  });

  it("ignores blank pane id lines", () => {
    expect(parsePaneIds("\n%1\n\n")).toEqual(["%1"]);
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

  it("includes last seen time and pane hash in detected status", () => {
    const status = detectPaneStatus({
      paneText: "current output",
      now: "2026-05-28T00:00:00.000Z",
    });

    expect(status.lastSeenAt).toBe("2026-05-28T00:00:00.000Z");
    expect(status.lastPaneHash).toMatch(/^[a-f0-9]{64}$/);
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
