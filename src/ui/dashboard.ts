import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { randomUUID } from "node:crypto";
import { DEFAULT_STORE_PATH } from "../constants.js";
import { createGroup, createSession, deleteGroup, deleteSession, moveChild, renameSession } from "../deck-operations.js";
import { loadDeck, saveDeck } from "../store.js";
import { attachSession, buildManagedSessionName, getFirstPaneId, killSession, launchPiSession, listTmuxSessions, tmuxExists } from "../tmux.js";
import type { DeckGroup, DeckSession, DeckState } from "../types.js";
import { askName, chooseGroup } from "./selectors.js";

interface Row {
  id: string;
  type: "group" | "session";
  depth: number;
  label: string;
  parentId: string | null;
  session?: DeckSession;
  group?: DeckGroup;
}

interface SelectedRow {
  type: "group" | "session";
  id: string;
  parentId: string | null;
}

type DashboardAction =
  | { type: "close" }
  | { type: "new" }
  | { type: "new-group"; parentId: string }
  | { type: "attach"; sessionId: string }
  | { type: "rename"; sessionId: string }
  | { type: "delete"; rowType: "group" | "session"; id: string }
  | { type: "move"; parentId: string; child: { type: "group" | "session"; id: string }; direction: -1 | 1 };

export function dashboardActionForKey(data: string, selected: SelectedRow | string | undefined): DashboardAction | undefined {
  const selectedRow = typeof selected === "string" ? { type: "session" as const, id: selected, parentId: null } : selected;
  if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "q") return { type: "close" };
  if (data === "n") return { type: "new" };
  if (data === "g") return { type: "new-group", parentId: selectedRow?.type === "group" ? selectedRow.id : selectedRow?.parentId ?? "root" };
  if ((data === "J" || matchesKey(data, Key.shift(Key.down))) && selectedRow?.parentId) return { type: "move", parentId: selectedRow.parentId, child: { type: selectedRow.type, id: selectedRow.id }, direction: 1 };
  if ((data === "K" || matchesKey(data, Key.shift(Key.up))) && selectedRow?.parentId) return { type: "move", parentId: selectedRow.parentId, child: { type: selectedRow.type, id: selectedRow.id }, direction: -1 };
  if (matchesKey(data, Key.enter) || matchesKey(data, Key.return) || data === "\r" || data === "\n") {
    return selectedRow?.type === "session" ? { type: "attach", sessionId: selectedRow.id } : undefined;
  }
  if (data === "r") return selectedRow?.type === "session" ? { type: "rename", sessionId: selectedRow.id } : undefined;
  if (data === "d") return selectedRow ? { type: "delete", rowType: selectedRow.type, id: selectedRow.id } : undefined;
  return undefined;
}

class DashboardComponent {
  private selected = 0;
  private rows: Row[];
  private cachedWidth: number | undefined;
  private cachedLines: string[] | undefined;

  constructor(
    private deck: DeckState,
    private readonly theme: Theme,
    private readonly done: (action: DashboardAction) => void,
  ) {
    this.rows = flattenDeck(deck);
  }

  updateDeck(deck: DeckState): void {
    this.deck = deck;
    this.rows = flattenDeck(deck);
    this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
    this.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.down) || data === "j") {
      this.selected = Math.min(this.selected + 1, Math.max(0, this.rows.length - 1));
      this.invalidate();
      return;
    }
    if (matchesKey(data, Key.up) || data === "k") {
      this.selected = Math.max(0, this.selected - 1);
      this.invalidate();
      return;
    }

    const selected = this.rows[this.selected];
    const action = dashboardActionForKey(data, selected ? { type: selected.type, id: selected.id, parentId: selected.parentId } : undefined);
    if (action) this.done(action);
  }

  render(width: number): string[] {
    try {
      return this.renderUnsafe(width);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [truncateToWidth(this.theme.fg("error", `Pi Deck render failed: ${message}`), width)];
    }
  }

  private renderUnsafe(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const termCols = process.stdout.columns ?? width;
    const termRows = process.stdout.rows ?? 40;
    const w = Math.max(72, Math.min(termCols - 4, Math.round(termCols * 0.9)));
    const bodyHeight = Math.max(8, Math.min(termRows - 8, 18));
    const innerW = w - 2;
    const th = this.theme;
    const out: string[] = [];

    out.push(th.fg("border", `╭${"─".repeat(innerW)}╮`));
    out.push(this.row(padBetween(` ${th.fg("accent", "🥧 Pi Deck")}`, th.fg("dim", `${this.deck.sessions.length} session${this.deck.sessions.length === 1 ? "" : "s"} `), innerW)));
    out.push(this.row(pad(` ${th.fg("dim", "Manage Pi/tmux sessions from inside Pi")}`, innerW)));

    const rows = this.rows.length ? this.rows : [{ id: "empty", type: "group" as const, depth: 0, label: "No groups or sessions yet" }];
    const start = Math.max(0, Math.min(this.selected - Math.floor(bodyHeight / 2), Math.max(0, rows.length - bodyHeight)));
    const visibleRows = rows.slice(start, start + bodyHeight);
    for (const [offset, row] of visibleRows.entries()) {
      const index = start + offset;
      const selected = index === this.selected && this.rows.length > 0;
      const cursor = selected ? th.fg("accent", "› ") : "  ";
      const indent = "  ".repeat(row.depth);
      const text = row.type === "group" ? renderGroup(row.label, th) : renderSession(row.session, th);
      out.push(this.row(pad(cursor + indent + text, innerW)));
    }
    for (let i = visibleRows.length; i < bodyHeight; i++) out.push(this.row(pad("", innerW)));

    out.push(this.row(pad("", innerW)));
    out.push(this.row(pad(` ${th.fg("accent", "Actions")}  ${th.fg("dim", "Enter attach • n new • g group • r rename • d delete")}`, innerW)));
    out.push(this.row(pad(` ${th.fg("dim", "↑/↓ or j/k select • J/K or Shift+↑/↓ reorder • q/Esc close")}`, innerW)));
    out.push(th.fg("border", `╰${"─".repeat(innerW)}╯`));

    this.cachedWidth = width;
    this.cachedLines = out;
    return out;
  }

  private row(content: string): string {
    return this.theme.fg("border", "│") + content + this.theme.fg("border", "│");
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export async function showDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  while (true) {
    let deck = await loadDeck(storePath);

    const termCols = process.stdout.columns ?? 120;
    const termRows = process.stdout.rows ?? 40;
    const overlayWidth = Math.max(72, Math.min(termCols - 8, Math.round(termCols * 0.82)));
    const overlayHeight = Math.max(14, Math.min(termRows - 6, Math.round(termRows * 0.82)));

    const action = await ctx.ui.custom<DashboardAction>((_tui, theme, _kb, done) => {
      return new DashboardComponent(deck, theme, done);
    }, {
      overlay: true,
      overlayOptions: { anchor: "center", width: overlayWidth, maxHeight: overlayHeight },
    });

    if (action.type === "close") return;
    if (action.type === "new") {
      await createNewSessionFromDashboard(ctx, storePath);
      continue;
    }

    if (action.type === "new-group") {
      await createGroupFromDashboard(ctx, storePath, action.parentId);
      continue;
    }

    if (action.type === "move") {
      try {
        const current = await loadDeck(storePath);
        const next = moveChild(current, action.parentId, action.child, action.direction);
        if (next !== current) await saveDeck(storePath, next);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
      continue;
    }

    if (action.type === "attach") {
      const latest = await loadDeck(storePath);
      const session = latest.sessions.find((candidate) => candidate.id === action.sessionId);
      if (!session) {
        ctx.ui.notify("Selected session no longer exists", "error");
        continue;
      }
      if (!session.tmux?.sessionName) {
        ctx.ui.notify(`${session.name} does not have a tmux session`, "error");
        continue;
      }
      await attachSession(session.tmux.sessionName);
      return;
    }

    if (action.type === "rename") {
      const latest = await loadDeck(storePath);
      const session = latest.sessions.find((candidate) => candidate.id === action.sessionId);
      if (!session) {
        ctx.ui.notify("Selected session no longer exists", "error");
        continue;
      }
      const nextName = await ctx.ui.input("Rename session", session.name);
      if (!nextName?.trim()) continue;
      const renamed = renameSession(await loadDeck(storePath), session.id, nextName);
      await saveDeck(storePath, renamed);
      continue;
    }

    if (action.type === "delete") {
      const latest = await loadDeck(storePath);
      const label = action.rowType === "session" ? latest.sessions.find((candidate) => candidate.id === action.id)?.name : latest.groups.find((candidate) => candidate.id === action.id)?.name;
      if (!label) {
        ctx.ui.notify("Selected item no longer exists", "error");
        continue;
      }
      const confirmed = await ctx.ui.confirm("Delete from deck?", action.rowType === "session" ? `Delete ${label}? This will kill its tmux session if it is still running.` : `Remove empty group ${label} from Pi Deck?`);
      if (!confirmed) continue;
      try {
        if (action.rowType === "session") {
          const target = latest.sessions.find((candidate) => candidate.id === action.id);
          if (target?.tmux?.sessionName) await killSession(target.tmux.sessionName);
        }
        const next = action.rowType === "session" ? deleteSession(latest, action.id) : deleteGroup(latest, action.id);
        await saveDeck(storePath, next);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    }
  }
}

async function createGroupFromDashboard(ctx: ExtensionCommandContext, storePath: string, parentId: string): Promise<void> {
  const name = await askName(ctx, "Group name", "New Group");
  if (!name) return;
  const next = createGroup(await loadDeck(storePath), {
    id: `grp_${randomUUID().slice(0, 8)}`,
    name,
    parentId,
    now: new Date().toISOString(),
  });
  await saveDeck(storePath, next);
}

async function createNewSessionFromDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  if (!(await tmuxExists())) {
    ctx.ui.notify("tmux is not installed or not available in PATH", "error");
    return;
  }

  const deck = await loadDeck(storePath || DEFAULT_STORE_PATH);
  const name = await askName(ctx, "Session name", "api-fix");
  if (!name) return;
  const projectPath = await askName(ctx, "Project path", ctx.cwd);
  if (!projectPath) return;
  const group = await chooseGroup(ctx, deck.groups);
  if (!group) return;

  const tmuxSessionName = buildManagedSessionName(name, randomUUID().slice(0, 6));
  if (deck.sessions.some((session) => session.tmux?.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`Deck already has a session named ${tmuxSessionName}`, "error");
    return;
  }
  const tmuxSessions = await listTmuxSessions();
  if (tmuxSessions.some((session) => session.sessionName === tmuxSessionName)) {
    ctx.ui.notify(`tmux already has a session named ${tmuxSessionName}`, "error");
    return;
  }

  await launchPiSession({ sessionName: tmuxSessionName, projectPath });
  const paneId = await getFirstPaneId(tmuxSessionName);
  if (!paneId) {
    ctx.ui.notify(`Created tmux session ${tmuxSessionName}, but could not find its pane`, "error");
    return;
  }

  const next = createSession(deck, {
    id: `ses_${randomUUID().slice(0, 8)}`,
    name,
    groupId: group.id,
    projectPath,
    kind: "managed-tmux",
    now: new Date().toISOString(),
    tmux: { sessionName: tmuxSessionName, paneId },
  });
  await saveDeck(storePath, next);
  ctx.ui.notify(`Created ${name}`, "info");
}

function flattenDeck(deck: DeckState): Row[] {
  const rows: Row[] = [];
  const groupsById = new Map(deck.groups.map((group) => [group.id, group]));
  const sessionsById = new Map(deck.sessions.map((session) => [session.id, session]));
  const visitedGroups = new Set<string>();

  const visitGroup = (group: DeckGroup, depth: number): void => {
    if (visitedGroups.has(group.id)) return;
    visitedGroups.add(group.id);
    rows.push({ id: group.id, type: "group", depth, label: group.name, parentId: group.parentId, group });

    for (const child of group.children) {
      if (child.type === "group") {
        const childGroup = groupsById.get(child.id);
        if (childGroup) visitGroup(childGroup, depth + 1);
      } else {
        const session = sessionsById.get(child.id);
        if (session) rows.push({ id: session.id, type: "session", depth: depth + 1, label: session.name, parentId: group.id, session });
      }
    }
  };

  const roots = deck.groups.filter((group) => group.parentId === null);
  for (const root of roots) visitGroup(root, 0);
  return rows;
}

function renderGroup(label: string, theme: Theme): string {
  return theme.fg("accent", `▾ ${label}`);
}

function renderSession(session: DeckSession | undefined, theme: Theme): string {
  if (!session) return "";
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


function pad(s: string, len: number): string {
  const vis = visibleWidth(s);
  if (vis >= len) return truncateToWidth(s, len);
  return s + " ".repeat(len - vis);
}

function padBetween(left: string, right: string, len: number): string {
  const lv = visibleWidth(left);
  const rv = visibleWidth(right);
  const gap = Math.max(1, len - lv - rv);
  return left + " ".repeat(gap) + right;
}
