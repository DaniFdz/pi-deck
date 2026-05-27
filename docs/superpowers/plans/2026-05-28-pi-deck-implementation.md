# Pi Deck Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-ready Pi extension package that manages Pi/tmux sessions from inside Pi through `/deck` and related commands.

**Architecture:** The extension is a TypeScript Pi package with a small command/UI layer over focused core modules. State lives in `~/.pi/agent/deck.json`; all tmux behavior is isolated in a `tmux` adapter so UI and storage code remain testable without real tmux.

**Tech Stack:** TypeScript, Vitest, Node.js `fs/promises`, Pi extension APIs from `@earendil-works/pi-coding-agent`, TUI components from `@earendil-works/pi-tui`, tmux CLI.

---

## File structure

Create this repository structure:

```text
pi-deck/
  .gitignore
  README.md
  LICENSE
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    commands.ts
    constants.ts
    types.ts
    store.ts
    store.test.ts
    tmux.ts
    tmux.test.ts
    deck-operations.ts
    deck-operations.test.ts
    ui/
      dashboard.ts
      selectors.ts
  docs/
    superpowers/
      plans/
        2026-05-28-pi-deck-implementation.md
      specs/
        2026-05-28-pi-deck-design.md  # local-only, ignored by git
```

Responsibilities:

- `src/index.ts`: Pi extension entrypoint. Registers commands.
- `src/commands.ts`: Command handlers that connect Pi contexts to operations and UI.
- `src/constants.ts`: shared constants such as default store path and tmux prefix.
- `src/types.ts`: all deck data types.
- `src/store.ts`: load/save/validate JSON store with atomic writes.
- `src/tmux.ts`: tmux command adapter and status heuristics.
- `src/deck-operations.ts`: pure-ish operations for groups/sessions and validation around sends.
- `src/ui/dashboard.ts`: `/deck` TUI component.
- `src/ui/selectors.ts`: reusable selection/input helpers.
- Tests sit beside implementation files.

Important repository rule:

- Do not commit `docs/superpowers/specs/`. The design spec may exist locally for reference, but the public repo should not include it.

---

### Task 1: Repository package skeleton

**Files:**
- Modify: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1: Replace `.gitignore` with repo-safe ignores**

Write `.gitignore` exactly as:

```gitignore
node_modules/
dist/
coverage/
*.tsbuildinfo
.DS_Store
.env
.env.*
!.env.example
docs/superpowers/specs/
```

- [ ] **Step 2: Create `package.json`**

Write `package.json` exactly as:

```json
{
  "name": "pi-deck",
  "version": "0.1.0",
  "description": "Pi extension for managing Pi tmux sessions from inside Pi.",
  "type": "module",
  "license": "MIT",
  "keywords": [
    "pi-package",
    "pi-extension",
    "tmux",
    "session-manager"
  ],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "pi": {
    "extensions": [
      "./src/index.ts"
    ]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  },
  "devDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*",
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2",
    "typebox": "*",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

Write `tsconfig.json` exactly as:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

Write `vitest.config.ts` exactly as:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create `README.md`**

Write `README.md` exactly as:

```markdown
# Pi Deck

Pi Deck is a Pi extension for managing Pi sessions that run inside tmux.

It provides a Pi-native dashboard and commands for creating, adding, importing, organizing, attaching to, sending prompts to, stopping, restarting, and deleting Pi/tmux sessions.

## Status

Early development. The first version focuses on a simple Pi-native dashboard, local JSON persistence, nested groups, and tmux-backed session control.

## Install locally

From this repository:

```bash
pi install /absolute/path/to/pi-deck
```

Or test without installing:

```bash
pi -e /absolute/path/to/pi-deck
```

## Commands

- `/deck` opens the dashboard.
- `/deck-new` creates a managed Pi/tmux session.
- `/deck-add` adds the current Pi session to the deck.
- `/deck-import` imports tmux sessions that look like Pi.
- `/deck-send` sends a prompt to another managed Pi/tmux session.
- `/deck-attach <name>` attaches to a managed session.
- `/deck-status` shows a compact summary.
- `/deck-cleanup` repairs or removes missing records.

## Data file

Pi Deck stores state in:

```text
~/.pi/agent/deck.json
```

The file stores only deck structure and session metadata. It does not store sent prompts or command history.

## License

MIT
```

- [ ] **Step 6: Create `LICENSE`**

Write `LICENSE` exactly as:

```text
MIT License

Copyright (c) 2026 Dani Fernandez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install succeeds.

- [ ] **Step 8: Verify scripts start cleanly**

Run:

```bash
npm test
npm run typecheck
```

Expected:

- `npm test` reports no test files or passes with zero tests depending on Vitest behavior.
- `npm run typecheck` passes once source files exist later. If it fails now because no source files exist, proceed; Task 2 creates source files.

- [ ] **Step 9: Commit skeleton**

Run:

```bash
git add .gitignore README.md LICENSE package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "Initialize Pi Deck package"
```

---

### Task 2: Core types and constants

**Files:**
- Create: `src/constants.ts`
- Create: `src/types.ts`
- Create: `src/deck-operations.test.ts`
- Create: `src/deck-operations.ts`

- [ ] **Step 1: Write failing tests for default deck creation and group insertion**

Create `src/deck-operations.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/deck-operations.test.ts
```

Expected: FAIL because `src/deck-operations.ts` does not exist.

- [ ] **Step 3: Create constants**

Create `src/constants.ts` with:

```ts
import { homedir } from "node:os";
import { join } from "node:path";

export const DECK_VERSION = 1;
export const ROOT_GROUP_ID = "root";
export const DEFAULT_STORE_PATH = join(homedir(), ".pi", "agent", "deck.json");
export const TMUX_SESSION_PREFIX = "pi-deck-";
```

- [ ] **Step 4: Create types**

Create `src/types.ts` with:

```ts
export type DeckChild =
  | { type: "group"; id: string }
  | { type: "session"; id: string };

export interface DeckGroup {
  id: string;
  name: string;
  parentId: string | null;
  children: DeckChild[];
  createdAt: string;
  updatedAt: string;
}

export type DeckSessionKind = "managed-tmux" | "imported-tmux" | "current-unmanaged" | "missing";

export type DeckSessionState = "running" | "waiting" | "idle" | "missing" | "starting" | "unmanaged";

export type DeckStatusConfidence = "heuristic" | "known";

export interface DeckSessionStatus {
  state: DeckSessionState;
  confidence: DeckStatusConfidence;
  lastSeenAt?: string;
  lastPaneHash?: string;
  acknowledgedAt?: string;
}

export interface DeckTmuxRef {
  sessionName: string;
  windowName?: string;
  paneId?: string;
}

export interface DeckPiRef {
  sessionFile?: string;
  sessionId?: string;
}

export interface DeckSession {
  id: string;
  name: string;
  groupId: string;
  projectPath: string;
  kind: DeckSessionKind;
  tmux?: DeckTmuxRef;
  pi?: DeckPiRef;
  status: DeckSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeckState {
  version: 1;
  updatedAt: string;
  groups: DeckGroup[];
  sessions: DeckSession[];
}

export interface CreateGroupInput {
  id: string;
  name: string;
  parentId: string;
  now: string;
}

export interface CreateSessionInput {
  id: string;
  name: string;
  groupId: string;
  projectPath: string;
  kind: DeckSessionKind;
  now: string;
  tmux?: DeckTmuxRef;
  pi?: DeckPiRef;
}
```

- [ ] **Step 5: Implement minimal deck operations**

Create `src/deck-operations.ts` with:

```ts
import { DECK_VERSION, ROOT_GROUP_ID } from "./constants.js";
import type { CreateGroupInput, CreateSessionInput, DeckGroup, DeckSession, DeckState } from "./types.js";

export function createEmptyDeck(now = new Date().toISOString()): DeckState {
  return {
    version: DECK_VERSION,
    updatedAt: now,
    groups: [
      {
        id: ROOT_GROUP_ID,
        name: "Deck",
        parentId: null,
        children: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    sessions: [],
  };
}

export function createGroup(deck: DeckState, input: CreateGroupInput): DeckState {
  const parent = deck.groups.find((group) => group.id === input.parentId);
  if (!parent) throw new Error(`Parent group not found: ${input.parentId}`);
  if (deck.groups.some((group) => group.id === input.id)) throw new Error(`Group already exists: ${input.id}`);

  const group: DeckGroup = {
    id: input.id,
    name: input.name,
    parentId: input.parentId,
    children: [],
    createdAt: input.now,
    updatedAt: input.now,
  };

  return {
    ...deck,
    updatedAt: input.now,
    groups: deck.groups.map((existing) =>
      existing.id === parent.id
        ? {
            ...existing,
            updatedAt: input.now,
            children: [...existing.children, { type: "group", id: group.id }],
          }
        : existing,
    ).concat(group),
  };
}

export function createSession(deck: DeckState, input: CreateSessionInput): DeckState {
  const group = deck.groups.find((candidate) => candidate.id === input.groupId);
  if (!group) throw new Error(`Group not found: ${input.groupId}`);
  if (deck.sessions.some((session) => session.id === input.id)) throw new Error(`Session already exists: ${input.id}`);

  const session: DeckSession = {
    id: input.id,
    name: input.name,
    groupId: input.groupId,
    projectPath: input.projectPath,
    kind: input.kind,
    tmux: input.tmux,
    pi: input.pi,
    status: {
      state: input.kind === "current-unmanaged" ? "unmanaged" : "starting",
      confidence: "known",
    },
    createdAt: input.now,
    updatedAt: input.now,
  };

  return {
    ...deck,
    updatedAt: input.now,
    sessions: [...deck.sessions, session],
    groups: deck.groups.map((existing) =>
      existing.id === group.id
        ? {
            ...existing,
            updatedAt: input.now,
            children: [...existing.children, { type: "session", id: session.id }],
          }
        : existing,
    ),
  };
}
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```bash
npm test -- src/deck-operations.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit core types**

Run:

```bash
git add src/constants.ts src/types.ts src/deck-operations.ts src/deck-operations.test.ts
git commit -m "Add deck state types and basic operations"
```

---

### Task 3: JSON store with validation and atomic writes

**Files:**
- Create: `src/store.test.ts`
- Create: `src/store.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/store.test.ts` with:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyDeck } from "./deck-operations.js";
import { loadDeck, saveDeck } from "./store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pi-deck-store-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("loads an empty deck when the file does not exist", async () => {
    const deck = await loadDeck(join(dir, "deck.json"), "2026-05-28T00:00:00.000Z");
    expect(deck.groups[0]?.id).toBe("root");
    expect(deck.sessions).toEqual([]);
  });

  it("saves and loads deck JSON", async () => {
    const path = join(dir, "deck.json");
    const deck = createEmptyDeck("2026-05-28T00:00:00.000Z");

    await saveDeck(path, deck);
    const loaded = await loadDeck(path);

    expect(loaded).toEqual(deck);
  });

  it("backs up invalid JSON and returns an empty deck", async () => {
    const path = join(dir, "deck.json");
    await writeFile(path, "{not json", "utf8");

    const loaded = await loadDeck(path, "2026-05-28T01:00:00.000Z");
    const files = await readFile(path, "utf8");

    expect(loaded.groups[0]?.id).toBe("root");
    expect(files).toContain("\"version\": 1");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/store.test.ts
```

Expected: FAIL because `src/store.ts` does not exist.

- [ ] **Step 3: Implement store**

Create `src/store.ts` with:

```ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createEmptyDeck } from "./deck-operations.js";
import type { DeckState } from "./types.js";

export async function loadDeck(path: string, now = new Date().toISOString()): Promise<DeckState> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return createEmptyDeck(now);
    throw error;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateDeck(parsed);
  } catch {
    const backupPath = `${path}.bak.${Date.now()}`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(backupPath, raw, "utf8");
    const fresh = createEmptyDeck(now);
    await saveDeck(path, fresh);
    return fresh;
  }
}

export async function saveDeck(path: string, deck: DeckState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

function validateDeck(value: unknown): DeckState {
  if (!value || typeof value !== "object") throw new Error("Deck file must contain an object");
  const deck = value as Partial<DeckState>;
  if (deck.version !== 1) throw new Error("Unsupported deck version");
  if (typeof deck.updatedAt !== "string") throw new Error("Deck updatedAt must be a string");
  if (!Array.isArray(deck.groups)) throw new Error("Deck groups must be an array");
  if (!Array.isArray(deck.sessions)) throw new Error("Deck sessions must be an array");
  return deck as DeckState;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
```

- [ ] **Step 4: Run store tests**

Run:

```bash
npm test -- src/store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit store**

Run:

```bash
git add src/store.ts src/store.test.ts
git commit -m "Add deck JSON store"
```

---

### Task 4: tmux adapter and heuristics

**Files:**
- Create: `src/tmux.test.ts`
- Create: `src/tmux.ts`

- [ ] **Step 1: Write failing tmux tests**

Create `src/tmux.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/tmux.test.ts
```

Expected: FAIL because `src/tmux.ts` does not exist.

- [ ] **Step 3: Implement tmux adapter helpers**

Create `src/tmux.ts` with:

```ts
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DeckSessionStatus } from "./types.js";

const execFileAsync = promisify(execFile);

export interface CommandSpec {
  command: string;
  args: string[];
}

export interface TmuxSessionSummary {
  sessionName: string;
  paneId: string;
  command: string;
}

export interface LaunchInput {
  sessionName: string;
  projectPath: string;
}

export function buildLaunchCommand(input: LaunchInput): CommandSpec {
  return {
    command: "tmux",
    args: ["new-session", "-d", "-s", input.sessionName, "-c", input.projectPath, "pi"],
  };
}

export function buildSendKeysCommand(paneId: string, message: string): CommandSpec {
  return {
    command: "tmux",
    args: ["send-keys", "-t", paneId, message, "Enter"],
  };
}

export function parseTmuxSessions(output: string): TmuxSessionSummary[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sessionName, paneId, command] = line.split(": ");
      if (!sessionName || !paneId || !command) throw new Error(`Invalid tmux session line: ${line}`);
      return { sessionName, paneId, command };
    });
}

export function isLikelyPiSession(summary: TmuxSessionSummary): boolean {
  return summary.command === "pi" || summary.sessionName.startsWith("pi-") || summary.sessionName.startsWith("pi-deck-");
}

export interface DetectPaneStatusInput {
  paneText: string;
  previousHash?: string;
  now: string;
}

export function detectPaneStatus(input: DetectPaneStatusInput): DeckSessionStatus {
  const hash = hashPane(input.paneText);
  return {
    state: input.previousHash && input.previousHash === hash ? "idle" : "running",
    confidence: "heuristic",
    lastSeenAt: input.now,
    lastPaneHash: hash,
  };
}

export async function tmuxExists(): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["-V"]);
    return true;
  } catch {
    return false;
  }
}

export async function runTmux(args: string[]): Promise<string> {
  const result = await execFileAsync("tmux", args);
  return result.stdout;
}

export async function listTmuxSessions(): Promise<TmuxSessionSummary[]> {
  const output = await runTmux(["list-panes", "-a", "-F", "#{session_name}: #{pane_id}: #{pane_current_command}"]);
  return parseTmuxSessions(output);
}

export async function capturePane(paneId: string): Promise<string> {
  return runTmux(["capture-pane", "-p", "-t", paneId]);
}

export async function launchPiSession(input: LaunchInput): Promise<void> {
  const spec = buildLaunchCommand(input);
  await execFileAsync(spec.command, spec.args);
}

export async function sendKeys(paneId: string, message: string): Promise<void> {
  const spec = buildSendKeysCommand(paneId, message);
  await execFileAsync(spec.command, spec.args);
}

function hashPane(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
```

- [ ] **Step 4: Run tmux tests**

Run:

```bash
npm test -- src/tmux.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit tmux adapter**

Run:

```bash
git add src/tmux.ts src/tmux.test.ts
git commit -m "Add tmux adapter helpers"
```

---

### Task 5: Session operations for create/import/send validation

**Files:**
- Modify: `src/deck-operations.test.ts`
- Modify: `src/deck-operations.ts`

- [ ] **Step 1: Add failing tests for sessions and send validation**

Append these tests inside the existing `describe("deck operations", ...)` block in `src/deck-operations.test.ts`:

```ts
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
```

Update the import at the top of `src/deck-operations.test.ts` to:

```ts
import { createEmptyDeck, createGroup, createSession, validateSend } from "./deck-operations.js";
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/deck-operations.test.ts
```

Expected: FAIL because `validateSend` is not implemented.

- [ ] **Step 3: Add send validation types and function**

Append this to `src/deck-operations.ts`:

```ts
export interface ValidateSendInput {
  fromSessionId: string;
  toSessionId: string;
  message: string;
}

export type ValidateSendResult =
  | { ok: true; targetPaneId: string; warning?: string }
  | { ok: false; reason: string };

export function validateSend(deck: DeckState, input: ValidateSendInput): ValidateSendResult {
  const message = input.message.trim();
  if (!message) return { ok: false, reason: "Message is empty" };
  if (input.fromSessionId === input.toSessionId) return { ok: false, reason: "Cannot send to the current session" };

  const target = deck.sessions.find((session) => session.id === input.toSessionId);
  if (!target) return { ok: false, reason: `Target session not found: ${input.toSessionId}` };
  if (target.kind === "missing" || target.status.state === "missing") return { ok: false, reason: "Target session is missing" };
  if (!target.tmux?.paneId) return { ok: false, reason: "Target session does not have a tmux pane" };

  return {
    ok: true,
    targetPaneId: target.tmux.paneId,
    warning: target.status.state === "running" ? "Target session appears busy" : undefined,
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/deck-operations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit operations**

Run:

```bash
git add src/deck-operations.ts src/deck-operations.test.ts
git commit -m "Add deck session operations"
```

---

### Task 6: Pi command handlers

**Files:**
- Create: `src/index.ts`
- Create: `src/commands.ts`
- Create: `src/ui/selectors.ts`

- [ ] **Step 1: Create selector helpers**

Create `src/ui/selectors.ts` with:

```ts
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { DeckGroup, DeckSession } from "../types.js";

export async function askName(ctx: ExtensionCommandContext, title: string, placeholder: string): Promise<string | undefined> {
  const value = await ctx.ui.input(title, placeholder);
  const trimmed = value?.trim();
  return trimmed || undefined;
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
```

- [ ] **Step 2: Create command handlers**

Create `src/commands.ts` with:

```ts
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { DEFAULT_STORE_PATH, TMUX_SESSION_PREFIX } from "./constants.js";
import { createSession, validateSend } from "./deck-operations.js";
import { loadDeck, saveDeck } from "./store.js";
import { launchPiSession, listTmuxSessions, sendKeys, tmuxExists, isLikelyPiSession } from "./tmux.js";
import { showDashboard } from "./ui/dashboard.js";
import { askName, chooseGroup, chooseSession } from "./ui/selectors.js";
import type { DeckState } from "./types.js";

export function registerCommands(pi: ExtensionAPI): void {
  pi.registerCommand("deck", {
    description: "Open Pi Deck dashboard",
    handler: async (_args, ctx) => showDashboard(ctx, DEFAULT_STORE_PATH),
  });

  pi.registerCommand("deck-new", {
    description: "Create a managed Pi/tmux session",
    handler: async (_args, ctx) => deckNew(ctx),
  });

  pi.registerCommand("deck-import", {
    description: "Import Pi-looking tmux sessions",
    handler: async (_args, ctx) => deckImport(ctx),
  });

  pi.registerCommand("deck-send", {
    description: "Send a prompt to another managed Pi session",
    handler: async (_args, ctx) => deckSend(ctx),
  });

  pi.registerCommand("deck-status", {
    description: "Show Pi Deck session summary",
    handler: async (_args, ctx) => deckStatus(ctx),
  });
}

async function deckNew(ctx: ExtensionCommandContext): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const name = await askName(ctx, "Session name", "api-fix");
  if (!name) return;
  const projectPath = await askName(ctx, "Project path", ctx.cwd);
  if (!projectPath) return;
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const id = `ses_${randomUUID().slice(0, 8)}`;
  const tmuxSessionName = `${TMUX_SESSION_PREFIX}${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  await launchPiSession({ sessionName: tmuxSessionName, projectPath });

  const next = createSession(deck, {
    id,
    name,
    groupId: group.id,
    projectPath,
    kind: "managed-tmux",
    now: new Date().toISOString(),
    tmux: { sessionName: tmuxSessionName },
  });
  await saveDeck(DEFAULT_STORE_PATH, next);
  ctx.ui.notify(`Created ${name}`, "info");
}

async function deckImport(ctx: ExtensionCommandContext): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const summaries = (await listTmuxSessions()).filter(isLikelyPiSession);
  let next: DeckState = deck;
  const now = new Date().toISOString();
  let imported = 0;

  for (const summary of summaries) {
    if (next.sessions.some((session) => session.tmux?.sessionName === summary.sessionName)) continue;
    next = createSession(next, {
      id: `ses_${randomUUID().slice(0, 8)}`,
      name: summary.sessionName,
      groupId: group.id,
      projectPath: ctx.cwd,
      kind: "imported-tmux",
      now,
      tmux: { sessionName: summary.sessionName, paneId: summary.paneId },
    });
    imported += 1;
  }

  await saveDeck(DEFAULT_STORE_PATH, next);
  ctx.ui.notify(`Imported ${imported} Pi tmux session(s)`, "info");
}

async function deckSend(ctx: ExtensionCommandContext): Promise<void> {
  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const target = await chooseSession(ctx, deck.sessions.filter((session) => Boolean(session.tmux?.paneId)));
  if (!target) return;
  const message = await ctx.ui.editor("Prompt to send", "");
  if (!message) return;

  const validation = validateSend(deck, { fromSessionId: "current", toSessionId: target.id, message });
  if (!validation.ok) {
    ctx.ui.notify(validation.reason, "error");
    return;
  }

  const confirmed = await ctx.ui.confirm("Send prompt?", `Send to ${target.name}?`);
  if (!confirmed) return;
  await sendKeys(validation.targetPaneId, message.trim());
  ctx.ui.notify(`Sent prompt to ${target.name}`, "info");
}

async function deckStatus(ctx: ExtensionCommandContext): Promise<void> {
  const deck = await loadDeck(DEFAULT_STORE_PATH);
  const lines = deck.sessions.map((session) => `${session.status.state.padEnd(10)} ${session.name}`).join("\n");
  ctx.ui.notify(lines || "No deck sessions", "info");
}
```

- [ ] **Step 3: Create extension entrypoint**

Create `src/index.ts` with:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./commands.js";

export default function piDeckExtension(pi: ExtensionAPI): void {
  registerCommands(pi);
}
```

- [ ] **Step 4: Create temporary dashboard stub**

Create `src/ui/dashboard.ts` with:

```ts
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { loadDeck } from "../store.js";

export async function showDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await loadDeck(storePath);
  ctx.ui.notify(`Pi Deck: ${deck.sessions.length} session(s), ${deck.groups.length} group(s)`, "info");
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit command handlers**

Run:

```bash
git add src/index.ts src/commands.ts src/ui/selectors.ts src/ui/dashboard.ts
git commit -m "Register Pi Deck commands"
```

---

### Task 7: Dashboard TUI first pass

**Files:**
- Modify: `src/ui/dashboard.ts`

- [ ] **Step 1: Replace dashboard stub with list UI**

Replace `src/ui/dashboard.ts` with:

```ts
import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { loadDeck } from "../store.js";
import type { DeckGroup, DeckSession, DeckState } from "../types.js";

interface Row {
  id: string;
  type: "group" | "session";
  depth: number;
  label: string;
  session?: DeckSession;
  group?: DeckGroup;
}

class DashboardComponent {
  private selected = 0;
  private rows: Row[];
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    private readonly deck: DeckState,
    private readonly theme: Theme,
    private readonly done: () => void,
  ) {
    this.rows = flattenDeck(deck);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.done();
      return;
    }
    if (matchesKey(data, Key.down) || data === "j") {
      this.selected = Math.min(this.selected + 1, Math.max(0, this.rows.length - 1));
      this.invalidate();
      return;
    }
    if (matchesKey(data, Key.up) || data === "k") {
      this.selected = Math.max(0, this.selected - 1);
      this.invalidate();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    const lines: string[] = [];
    const th = this.theme;
    lines.push(th.fg("accent", th.bold("Pi Deck")));
    lines.push(th.fg("borderMuted", "─".repeat(Math.max(0, width))));
    lines.push("");

    if (this.rows.length === 0) {
      lines.push(th.fg("dim", "  No groups or sessions yet."));
    } else {
      this.rows.forEach((row, index) => {
        const selected = index === this.selected;
        const prefix = selected ? th.fg("accent", "> ") : "  ";
        const indent = "  ".repeat(row.depth);
        const text = row.type === "group" ? th.fg("accent", `▾ ${row.label}`) : renderSession(row.session!, th);
        lines.push(truncateToWidth(prefix + indent + text, width));
      });
    }

    lines.push("");
    lines.push(th.fg("borderMuted", "─".repeat(Math.max(0, width))));
    lines.push(th.fg("dim", "esc close • n new • a add current • i import • s send • ? help"));

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export async function showDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  const deck = await loadDeck(storePath);
  await ctx.ui.custom<void>((_tui, theme, _kb, done) => new DashboardComponent(deck, theme, done));
}

function flattenDeck(deck: DeckState): Row[] {
  const rows: Row[] = [];
  const groupsById = new Map(deck.groups.map((group) => [group.id, group]));
  const sessionsById = new Map(deck.sessions.map((session) => [session.id, session]));

  const visitGroup = (group: DeckGroup, depth: number) => {
    rows.push({ id: group.id, type: "group", depth, label: group.name, group });
    for (const child of group.children) {
      if (child.type === "group") {
        const childGroup = groupsById.get(child.id);
        if (childGroup) visitGroup(childGroup, depth + 1);
      } else {
        const session = sessionsById.get(child.id);
        if (session) rows.push({ id: session.id, type: "session", depth: depth + 1, label: session.name, session });
      }
    }
  };

  const roots = deck.groups.filter((group) => group.parentId === null);
  for (const root of roots) visitGroup(root, 0);
  return rows;
}

function renderSession(session: DeckSession, theme: Theme): string {
  const symbol = statusSymbol(session.status.state);
  const project = theme.fg("dim", session.projectPath);
  return `${symbol} ${theme.fg("text", session.name)} ${project}`;
}

function statusSymbol(state: DeckSession["status"]["state"]): string {
  switch (state) {
    case "running":
      return "●";
    case "waiting":
      return "◐";
    case "idle":
      return "○";
    case "missing":
      return "✕";
    case "starting":
      return "⟳";
    case "unmanaged":
      return "◇";
  }
}
```

- [ ] **Step 2: Run tests and typecheck**

Run:

```bash
npm test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit dashboard**

Run:

```bash
git add src/ui/dashboard.ts
git commit -m "Add initial deck dashboard UI"
```

---

### Task 8: Public repo polish and verification

**Files:**
- Modify: `README.md`
- Ensure: `docs/superpowers/specs/` remains untracked

- [ ] **Step 1: Verify spec doc is ignored**

Run:

```bash
git status --short --ignored docs/superpowers/specs
```

Expected: spec files appear as ignored, not tracked. If any spec file is tracked, run:

```bash
git rm --cached docs/superpowers/specs/2026-05-28-pi-deck-design.md
git commit -m "Stop tracking local design spec"
```

- [ ] **Step 2: Update README with v1 limitations**

Append to `README.md`:

```markdown

## V1 limitations

- Status detection is heuristic and based on tmux pane state.
- `/deck-send` types into a target tmux pane; it is not a full orchestration protocol.
- Sessions added outside tmux may need to be relaunched inside managed tmux before attach/stop/restart actions work.
- There is no background daemon in v1; statuses refresh when commands run or the dashboard opens.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm pack --dry-run
```

Expected:

- Tests pass.
- Typecheck passes.
- Pack output includes source, README, LICENSE, package files, and does not include `docs/superpowers/specs/`.

- [ ] **Step 4: Manual smoke test locally**

Run:

```bash
pi -e /Users/dani.fernandez/projects/pi-deck
```

In Pi, manually test:

1. `/deck-status` shows no sessions on a fresh deck.
2. `/deck` opens the dashboard and closes with Escape.
3. `/deck-new` creates a tmux session when tmux is installed.
4. `/deck-import` imports Pi-looking tmux sessions.
5. `/deck-send` sends a prompt to a target with a pane id.

Expected: no crashes. Any missing v1 actions should be documented as not yet implemented before release.

- [ ] **Step 5: Commit polish**

Run:

```bash
git add README.md
git commit -m "Document Pi Deck v1 limitations"
```

---

## Self-review

Spec coverage:

- Pi-native extension package: Tasks 1 and 6.
- Public repo skeleton: Tasks 1 and 8.
- JSON persistence: Task 3.
- Nested groups and sessions: Tasks 2 and 5.
- tmux launch/import/send/status helpers: Task 4.
- Commands: Task 6.
- Dashboard first pass: Task 7.
- Verification and public packaging: Task 8.

Known v1 implementation gap accepted by this plan:

- Full dashboard actions for every key are not implemented in the first pass. The commands provide the functional entry points; dashboard key actions can be layered after the first working package.

Placeholder scan:

- No `TBD`, `TODO`, or “implement later” placeholders are required for tasks.
- The only “limitations” text is public documentation, not an implementation placeholder.

Type consistency:

- `DeckState`, `DeckGroup`, `DeckSession`, `DeckSessionStatus`, and operation function names are consistent across tasks.
- `validateSend` returns `targetPaneId`, which `deckSend` passes to `sendKeys`.
