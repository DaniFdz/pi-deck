# Pi Deck

Pi Deck is a Pi extension for managing Pi sessions that run inside tmux.

It provides a Pi-native dashboard for creating, importing, grouping, reordering, attaching to, deleting, and sending prompts to Pi/tmux sessions.

## Status

Early development. The current package focuses on a local JSON-backed dashboard and tmux-backed Pi session control.

## Install

From npm:

```bash
pi install npm:@danifdz/pi-deck
```

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
- `/deck-new` creates a new managed Pi/tmux session. It can optionally create/reuse a git worktree and run the session there.
- `/deck-import` imports the current Pi session into a new Pi Deck-managed tmux session and switches to it.
- `/deck-send` sends a prompt to another managed Pi/tmux session.
- `/deck-status` shows a compact summary.

## Dashboard keys

- `↑` / `↓` or `j` / `k` — move selection.
- `Enter` — attach to the selected session, or expand/collapse the selected group.
- `n` — create a new managed session, optionally in a git worktree.
- `g` — create a group. Pi Deck asks which group to create it under, including `My Deck (root)`.
- `r` — rename the selected session.
- `d` — delete the selected item after confirmation. Deleting a session kills its tmux session if it is still running. Empty non-root groups can be deleted; root and non-empty groups are protected.
- `J` / `K` or `Shift+↓` / `Shift+↑` — reorder the selected item within its parent group.
- `m` — move the selected session or group into a chosen destination group.
- `Space` — expand/collapse the selected group.
- `q` / `Esc` — close the dashboard.

## Data file

Pi Deck stores state in:

```text
~/.pi/agent/deck.json
```

The file stores deck structure and session metadata. It does not store sent prompts or command history.

## Current limitations

- Status detection is heuristic and based on tmux pane state.
- `/deck-send` types into a target tmux pane; it is not a full orchestration protocol.
- `J` / `K` reordering only moves items within their current parent group. Use `m` to move an item to another group.
- Group deletion only supports empty non-root groups.
- Stop, restart, worktree finish/cleanup, and branch merge actions are not implemented yet.

## License

MIT
