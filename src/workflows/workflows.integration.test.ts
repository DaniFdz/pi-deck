import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDeck, createGroup, createSession } from "../domain/deck.js";
import type { DeckGroup, DeckSession, DeckState } from "../domain/types.js";
import { saveDeck } from "../services/store.js";
import { killSession, launchPiSession, sendKeys, attachSession, capturePane, listTmuxSessions } from "../services/tmux.js";
import { createGroupWorkflow } from "./create-group.js";
import { deleteDashboardItem } from "./delete-item.js";
import { importCurrentSession } from "./import-session.js";
import { moveItemToChosenGroup, reorderItem } from "./move-item.js";
import { sendPromptToSession } from "./send-prompt.js";
import { showStatusSummary } from "./refresh-status.js";

const tempDirs: string[] = [];
let selectedGroupId = "root";
let selectedSessionId = "ses_target";
let nameAnswer = "Imported Session";
let selectAnswer: string | undefined;
let editorAnswer = "hello target";
let confirmAnswer = true;

vi.mock("../services/tmux.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/tmux.js")>();
  return {
    ...actual,
    tmuxExists: vi.fn(async () => true),
    listTmuxSessions: vi.fn(async () => []),
    launchPiSession: vi.fn(async () => undefined),
    getFirstPaneId: vi.fn(async () => "%9"),
    attachSession: vi.fn(async () => undefined),
    killSession: vi.fn(async () => undefined),
    sendKeys: vi.fn(async () => undefined),
    capturePane: vi.fn(async () => "stable pane"),
  };
});

vi.mock("../ui/selectors.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ui/selectors.js")>();
  return {
    ...actual,
    askName: vi.fn(async () => nameAnswer),
    chooseGroup: vi.fn(async (_ctx, groups: DeckGroup[]) => groups.find((group) => group.id === selectedGroupId) ?? groups[0]),
    chooseSession: vi.fn(async (_ctx, sessions: DeckSession[]) => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0]),
  };
});

async function tempStore(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pi-deck-workflows-"));
  tempDirs.push(dir);
  return join(dir, "deck.json");
}

async function readDeck(path: string): Promise<DeckState> {
  return JSON.parse(await readFile(path, "utf8")) as DeckState;
}

function fakeCtx(overrides: Partial<any> = {}) {
  return {
    cwd: "/repo/project",
    ui: {
      select: vi.fn(async (_title: string, choices: string[]) => selectAnswer ?? choices[0]),
      editor: vi.fn(async () => editorAnswer),
      confirm: vi.fn(async () => confirmAnswer),
      notify: vi.fn(),
    },
    sessionManager: {
      getSessionFile: vi.fn(() => "/tmp/current-session.json"),
      getSessionName: vi.fn(() => "Current Session"),
      getSessionId: vi.fn(() => "pi_current"),
    },
    ...overrides,
  } as any;
}

function deckWithSessions(): DeckState {
  let deck = createEmptyDeck("2026-05-30T00:00:00.000Z");
  deck = createGroup(deck, { id: "grp_work", name: "Work", parentId: "root", now: "2026-05-30T00:01:00.000Z" });
  deck = createSession(deck, {
    id: "ses_target",
    name: "Target",
    groupId: "root",
    projectPath: "/repo/target",
    kind: "managed-tmux",
    now: "2026-05-30T00:02:00.000Z",
    tmux: { sessionName: "pi-deck-target", paneId: "%1" },
  });
  deck = createSession(deck, {
    id: "ses_other",
    name: "Other",
    groupId: "root",
    projectPath: "/repo/other",
    kind: "managed-tmux",
    now: "2026-05-30T00:03:00.000Z",
    tmux: { sessionName: "pi-deck-other", paneId: "%2" },
  });
  return deck;
}

beforeEach(() => {
  selectedGroupId = "root";
  selectedSessionId = "ses_target";
  nameAnswer = "Imported Session";
  selectAnswer = undefined;
  editorAnswer = "hello target";
  confirmAnswer = true;
  vi.clearAllMocks();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("workflow integration", () => {
  it("imports the current session into a managed tmux session and attaches", async () => {
    const storePath = await tempStore();
    await importCurrentSession(fakeCtx(), storePath);

    const deck = await readDeck(storePath);
    expect(deck.sessions).toHaveLength(1);
    expect(deck.sessions[0]).toMatchObject({
      name: "Imported Session",
      projectPath: "/repo/project",
      kind: "managed-tmux",
      pi: { sessionFile: "/tmp/current-session.json", sessionId: "pi_current" },
    });
    expect(launchPiSession).toHaveBeenCalledWith(expect.objectContaining({ projectPath: "/repo/project", sessionFile: "/tmp/current-session.json" }));
    expect(attachSession).toHaveBeenCalledWith(expect.stringMatching(/^pi-deck-Imported-Session-/));
  });

  it("creates a group under the selected parent", async () => {
    const storePath = await tempStore();
    await saveDeck(storePath, deckWithSessions());
    nameAnswer = "Backend";
    selectAnswer = "Work (grp_work)";

    await createGroupWorkflow(fakeCtx(), storePath);

    const deck = await readDeck(storePath);
    const created = deck.groups.find((group) => group.name === "Backend");
    expect(created).toMatchObject({ parentId: "grp_work", children: [] });
    expect(deck.groups.find((group) => group.id === "grp_work")?.children).toContainEqual({ type: "group", id: created?.id });
  });

  it("sends a prompt to the selected tmux pane after confirmation", async () => {
    const storePath = await tempStore();
    await saveDeck(storePath, deckWithSessions());
    editorAnswer = "  run tests  ";

    await sendPromptToSession(fakeCtx(), storePath);

    expect(sendKeys).toHaveBeenCalledWith("%1", "run tests");
  });

  it("deletes a session from the deck and kills its tmux session", async () => {
    const storePath = await tempStore();
    await saveDeck(storePath, deckWithSessions());

    await deleteDashboardItem(fakeCtx(), storePath, { rowType: "session", id: "ses_target" });

    const deck = await readDeck(storePath);
    expect(deck.sessions.some((session) => session.id === "ses_target")).toBe(false);
    expect(deck.groups.find((group) => group.id === "root")?.children).not.toContainEqual({ type: "session", id: "ses_target" });
    expect(killSession).toHaveBeenCalledWith("pi-deck-target");
  });

  it("moves a session to the chosen group", async () => {
    const storePath = await tempStore();
    await saveDeck(storePath, deckWithSessions());
    selectedGroupId = "grp_work";

    await moveItemToChosenGroup(fakeCtx(), storePath, { type: "session", id: "ses_target" });

    const deck = await readDeck(storePath);
    expect(deck.sessions.find((session) => session.id === "ses_target")?.groupId).toBe("grp_work");
    expect(deck.groups.find((group) => group.id === "grp_work")?.children).toContainEqual({ type: "session", id: "ses_target" });
  });

  it("reorders a child inside its parent group", async () => {
    const storePath = await tempStore();
    await saveDeck(storePath, deckWithSessions());

    const moved = await reorderItem(storePath, "root", { type: "session", id: "ses_other" }, -1);

    const deck = await readDeck(storePath);
    expect(moved).toBe(true);
    expect(deck.groups.find((group) => group.id === "root")?.children.map((child) => child.id)).toEqual(["grp_work", "ses_other", "ses_target"]);
  });

  it("refreshes statuses and reports a summary", async () => {
    const storePath = await tempStore();
    await saveDeck(storePath, deckWithSessions());
    vi.mocked(listTmuxSessions).mockResolvedValue([
      { sessionName: "pi-deck-target", paneId: "%1", attached: false, windows: [] },
      { sessionName: "pi-deck-other", paneId: "%2", attached: false, windows: [] },
    ] as any);
    const ctx = fakeCtx();

    await showStatusSummary(ctx, storePath);

    const deck = await readDeck(storePath);
    expect(capturePane).toHaveBeenCalledWith("%1");
    expect(deck.sessions.map((session) => session.status.state)).toEqual(["running", "running"]);
    expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("running"), "info");
  });
});
