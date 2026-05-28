import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { refreshDeckStatuses } from "../deck-operations.js";
import { loadDeck, saveDeck } from "../store.js";
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
    try {
      return this.renderUnsafe(width);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [truncateToWidth(this.theme.fg("error", `Pi Deck render failed: ${message}`), width)];
    }
  }

  private renderUnsafe(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const lines: string[] = [];
    const th = this.theme;
    const separator = th.fg("borderMuted", "─".repeat(Math.max(0, width)));
    lines.push(truncateToWidth(th.fg("accent", th.bold("Pi Deck")), width));
    lines.push(truncateToWidth(separator, width));
    lines.push("");

    if (this.rows.length === 0) {
      lines.push(truncateToWidth(th.fg("dim", "  No groups or sessions yet."), width));
    } else {
      this.rows.forEach((row, index) => {
        const selected = index === this.selected;
        const prefix = selected ? th.fg("accent", "> ") : "  ";
        const indent = "  ".repeat(row.depth);
        const text = row.type === "group" ? renderGroup(row.label, th) : renderSession(row.session, th);
        lines.push(truncateToWidth(prefix + indent + text, width));
      });
    }

    lines.push("");
    lines.push(truncateToWidth(separator, width));
    lines.push(truncateToWidth(th.fg("dim", "esc close • ↑/↓ or j/k move"), width));

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
  let deck = await refreshDeckStatuses(await loadDeck(storePath));
  await saveDeck(storePath, deck);

  await ctx.ui.custom<void>((tui, theme, _kb, done) => {
    const component = new DashboardComponent(deck, theme, done);
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
