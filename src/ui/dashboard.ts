import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { refreshDeckStatuses, renameSession } from "../deck-operations.js";
import { loadDeck, saveDeck } from "../store.js";
import { attachSession } from "../tmux.js";
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
  private cachedWidth: number | undefined;
  private cachedLines: string[] | undefined;

  constructor(
    private deck: DeckState,
    private readonly theme: Theme,
    private readonly done: () => void,
    private readonly onRename: (session: DeckSession) => Promise<void>,
    private readonly onAttach: (session: DeckSession) => Promise<void>,
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
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "q") {
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
      return;
    }
    if (matchesKey(data, Key.enter) || data === "\r" || data === "\n") {
      const selected = this.rows[this.selected];
      if (selected?.type === "session" && selected.session) void this.onAttach(selected.session);
      return;
    }
    if (data === "r") {
      const selected = this.rows[this.selected];
      if (selected?.type === "session" && selected.session) void this.onRename(selected.session);
    }
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
    out.push(this.row(pad(` ${th.fg("accent", "Actions")}  ${th.fg("dim", "Enter attach • n new • i import • s send")}`, innerW)));
    out.push(this.row(pad(` ${th.fg("dim", "r rename • x stop • d delete • ↑/↓ or j/k move • q/Esc close")}`, innerW)));
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
  let deck = await refreshDeckStatuses(await loadDeck(storePath));
  await saveDeck(storePath, deck);

  const termCols = process.stdout.columns ?? 120;
  const termRows = process.stdout.rows ?? 40;
  const overlayWidth = Math.max(72, Math.min(termCols - 8, Math.round(termCols * 0.82)));
  const overlayHeight = Math.max(14, Math.min(termRows - 6, Math.round(termRows * 0.82)));

  await ctx.ui.custom<void>((tui, theme, _kb, done) => {
    const component = new DashboardComponent(deck, theme, done, async (session) => {
      const nextName = await ctx.ui.input("Rename session", session.name);
      if (!nextName?.trim()) return;
      const latest = renameSession(await loadDeck(storePath), session.id, nextName);
      await saveDeck(storePath, latest);
      deck = latest;
      component.updateDeck(latest);
      tui.requestRender();
    }, async (session) => {
      if (!session.tmux?.sessionName) {
        ctx.ui.notify(`${session.name} does not have a tmux session`, "error");
        return;
      }
      await attachSession(session.tmux.sessionName);
      done();
    });
    let disposed = false;

    const refresh = async () => {
      if (disposed) return;
      try {
        const latest = await refreshDeckStatuses(await loadDeck(storePath));
        await saveDeck(storePath, latest);
        deck = latest;
        component.updateDeck(latest);
        tui.requestRender();
      } catch (error) {
        // Keep the dashboard open with the last good state. Command-level logging
        // records failures around /deck; render must stay safe and responsive.
      }
    };

    const interval = setInterval(() => {
      void refresh();
    }, 1000);

    return Object.assign(component, {
      dispose() {
        disposed = true;
        clearInterval(interval);
      },
    });
  }, {
    overlay: true,
    overlayOptions: { anchor: "center", width: overlayWidth, maxHeight: overlayHeight },
  });
}

function flattenDeck(deck: DeckState): Row[] {
  const rows: Row[] = [];
  const groupsById = new Map(deck.groups.map((group) => [group.id, group]));
  const sessionsById = new Map(deck.sessions.map((session) => [session.id, session]));
  const visitedGroups = new Set<string>();

  const visitGroup = (group: DeckGroup, depth: number): void => {
    if (visitedGroups.has(group.id)) return;
    visitedGroups.add(group.id);
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
