import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { renameSession, toggleGroupExpanded } from "../domain/deck.js";
import { loadDeck, saveDeck } from "../services/store.js";
import { attachSession } from "../services/tmux.js";
import type { DeckGroup, DeckSession, DeckState } from "../domain/types.js";

import { createManagedSession } from "../workflows/create-session.js";
import { createGroupWorkflow } from "../workflows/create-group.js";
import { deleteDashboardItem } from "../workflows/delete-item.js";
import { moveItemToChosenGroup, reorderItem } from "../workflows/move-item.js";

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
  | { type: "toggle-group"; groupId: string }
  | { type: "attach"; sessionId: string }
  | { type: "rename"; sessionId: string }
  | { type: "delete"; rowType: "group" | "session"; id: string }
  | { type: "choose-move-destination"; rowType: "group" | "session"; id: string }
  | { type: "move"; parentId: string; child: { type: "group" | "session"; id: string }; direction: -1 | 1 };

function rowKey(row: { type: "group" | "session"; id: string }): string {
  return `${row.type}:${row.id}`;
}

export function formatGroupChoice(group: DeckGroup): string {
  return group.parentId === null ? "My Deck (root)" : `${group.name} (${group.id})`;
}

export function nextSelectedRowId(previous: string | undefined, rowIds: string[]): string | undefined {
  if (previous && rowIds.includes(previous)) return previous;
  return rowIds[0];
}

export function dashboardOverlayOptions(): { anchor: "center"; width: "80%"; maxHeight: "80%" } {
  return { anchor: "center", width: "80%", maxHeight: "80%" };
}

export function dashboardBodyHeight(termRows = process.stdout.rows ?? 40): number {
  const targetTotalHeight = Math.floor(termRows * 0.8);
  const fixedLines = 7;
  return Math.max(8, targetTotalHeight - fixedLines);
}

export function dashboardActionForKey(data: string, selected: SelectedRow | string | undefined): DashboardAction | undefined {
  const selectedRow = typeof selected === "string" ? { type: "session" as const, id: selected, parentId: null } : selected;
  if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "q") return { type: "close" };
  if (data === "n") return { type: "new" };
  if (data === "g") return { type: "new-group", parentId: selectedRow?.type === "group" ? selectedRow.id : selectedRow?.parentId ?? "root" };
  if ((data === "J" || matchesKey(data, Key.shift(Key.down))) && selectedRow?.parentId) return { type: "move", parentId: selectedRow.parentId, child: { type: selectedRow.type, id: selectedRow.id }, direction: 1 };
  if ((data === "K" || matchesKey(data, Key.shift(Key.up))) && selectedRow?.parentId) return { type: "move", parentId: selectedRow.parentId, child: { type: selectedRow.type, id: selectedRow.id }, direction: -1 };
  if (matchesKey(data, Key.enter) || matchesKey(data, Key.return) || data === " " || data === "\r" || data === "\n") {
    if (selectedRow?.type === "group") return { type: "toggle-group", groupId: selectedRow.id };
    return selectedRow?.type === "session" ? { type: "attach", sessionId: selectedRow.id } : undefined;
  }
  if (data === "r") return selectedRow?.type === "session" ? { type: "rename", sessionId: selectedRow.id } : undefined;
  if (data === "d") return selectedRow ? { type: "delete", rowType: selectedRow.type, id: selectedRow.id } : undefined;
  if (data === "m") return selectedRow ? { type: "choose-move-destination", rowType: selectedRow.type, id: selectedRow.id } : undefined;
  return undefined;
}

class DashboardComponent {
  private selected = 0;
  private rows: Row[];
  private cachedWidth: number | undefined;
  private cachedRows: number | undefined;
  private cachedLines: string[] | undefined;

  constructor(
    private deck: DeckState,
    private readonly theme: Theme,
    private readonly done: (action: DashboardAction) => void,
    selectedRowId?: string,
  ) {
    this.rows = flattenDeck(deck);
    this.selectRowId(selectedRowId);
  }

  updateDeck(deck: DeckState): void {
    const selectedRowId = this.rows[this.selected] ? rowKey(this.rows[this.selected]!) : undefined;
    this.deck = deck;
    this.rows = flattenDeck(deck);
    this.selectRowId(nextSelectedRowId(selectedRowId, this.rows.map(rowKey)));
    this.invalidate();
  }

  private selectRowId(selectedRowId: string | undefined): void {
    const index = selectedRowId ? this.rows.findIndex((row) => rowKey(row) === selectedRowId) : -1;
    this.selected = index >= 0 ? index : Math.min(this.selected, Math.max(0, this.rows.length - 1));
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
    const termRows = process.stdout.rows ?? 40;
    if (this.cachedLines && this.cachedWidth === width && this.cachedRows === termRows) return this.cachedLines;

    const w = Math.max(40, width);
    const bodyHeight = dashboardBodyHeight(termRows);
    const innerW = w - 2;
    const th = this.theme;
    const out: string[] = [];

    out.push(th.fg("border", `╭${"─".repeat(innerW)}╮`));
    out.push(this.row(padBetween(` ${th.fg("accent", "🥧 Pi Deck")}`, th.fg("dim", `${this.deck.sessions.length} session${this.deck.sessions.length === 1 ? "" : "s"} `), innerW)));
    out.push(this.row(pad(` ${th.fg("dim", "Manage Pi/tmux sessions from inside Pi")}`, innerW)));

    const rows: Row[] = this.rows.length ? this.rows : [{ id: "empty", type: "group" as const, depth: 0, label: "No groups or sessions yet", parentId: null, group: { id: "empty", name: "No groups or sessions yet", parentId: null, children: [], expanded: true, createdAt: "", updatedAt: "" } }];
    const start = Math.max(0, Math.min(this.selected - Math.floor(bodyHeight / 2), Math.max(0, rows.length - bodyHeight)));
    const visibleRows = rows.slice(start, start + bodyHeight);
    for (const [offset, row] of visibleRows.entries()) {
      const index = start + offset;
      const selected = index === this.selected && this.rows.length > 0;
      const cursor = selected ? th.fg("accent", "› ") : "  ";
      const indent = "  ".repeat(row.depth);
      const text = row.type === "group" ? renderGroup(row.group!, th) : renderSession(row.session, th);
      out.push(this.row(pad(cursor + indent + text, innerW)));
    }
    for (let i = visibleRows.length; i < bodyHeight; i++) out.push(this.row(pad("", innerW)));

    out.push(this.row(pad("", innerW)));
    out.push(this.row(pad(` ${th.fg("accent", "Actions")}  ${th.fg("dim", "Enter attach/toggle • n new • g group • m move • r rename • d delete")}`, innerW)));
    out.push(this.row(pad(` ${th.fg("dim", "↑/↓ or j/k select • J/K or Shift+↑/↓ reorder • q/Esc close")}`, innerW)));
    out.push(th.fg("border", `╰${"─".repeat(innerW)}╯`));

    this.cachedWidth = width;
    this.cachedRows = termRows;
    this.cachedLines = out;
    return out;
  }

  private row(content: string): string {
    return this.theme.fg("border", "│") + content + this.theme.fg("border", "│");
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedRows = undefined;
    this.cachedLines = undefined;
  }
}

export async function showDashboard(ctx: ExtensionCommandContext, storePath: string): Promise<void> {
  let selectedRowId: string | undefined;
  while (true) {
    let deck = await loadDeck(storePath);

    const action = await ctx.ui.custom<DashboardAction>((_tui, theme, _kb, done) => {
      return new DashboardComponent(deck, theme, done, selectedRowId);
    }, {
      overlay: true,
      overlayOptions: dashboardOverlayOptions(),
    });

    if (action.type === "close") return;
    if (action.type === "new") {
      await createManagedSession(ctx, storePath);
      continue;
    }

    if (action.type === "new-group") {
      await createGroupWorkflow(ctx, storePath);
      continue;
    }

    if (action.type === "toggle-group") {
      const next = toggleGroupExpanded(await loadDeck(storePath), action.groupId);
      await saveDeck(storePath, next);
      selectedRowId = rowKey({ type: "group", id: action.groupId });
      continue;
    }

    if (action.type === "move") {
      try {
        await reorderItem(storePath, action.parentId, action.child, action.direction);
        selectedRowId = rowKey(action.child);
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
      continue;
    }

    if (action.type === "choose-move-destination") {
      await moveItemToChosenGroup(ctx, storePath, { type: action.rowType, id: action.id });
      selectedRowId = rowKey({ type: action.rowType, id: action.id });
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
      await deleteDashboardItem(ctx, storePath, { rowType: action.rowType, id: action.id });
    }
  }
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

    if (!group.expanded) return;
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

export function flattenDeckForDashboard(deck: DeckState): Row[] {
  return flattenDeck(deck);
}

function renderGroup(group: DeckGroup, theme: Theme): string {
  return theme.fg("accent", `${group.expanded ? "▾" : "▸"} ${group.name}`);
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
