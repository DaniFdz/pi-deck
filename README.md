# Pi Deck

A keyboard-driven dashboard for Pi sessions running in tmux.

Pi Deck gives you one place to create, group, move, reorder, attach to, and send prompts to Pi sessions. It also supports worktree-backed sessions, so a new session can start in an isolated Git branch without leaving the dashboard.

```text
╭────────────────────────────────────────────────────────────╮
│ 🥧 Pi Deck                                      4 sessions │
│ Manage Pi/tmux sessions from inside Pi                    │
│                                                           │
│ › ▾ My Deck                                               │
│     ○ pi-deck                         ~/projects/pi-deck  │
│     ▾ PR work                                            │
│       ○ web-ui tests                  ~/web-ui/.worktrees/test │
│       ○ docs update                   ~/docs              │
│                                                           │
│ Actions  Enter attach/toggle • n new • g group • m move  │
│ ↑/↓ or j/k select • J/K reorder • q/Esc close            │
╰────────────────────────────────────────────────────────────╯
```

## Status

Pi Deck is early-stage software. The core dashboard, session creation, current-session import, grouping, moving, reordering, worktree-backed session creation, prompt sending, and status display are implemented. Stop/restart and worktree cleanup flows are still planned.

## Requirements

- [Pi](https://github.com/earendil-works/pi-coding-agent) installed and available as `pi`
- `tmux`
- Node.js and npm for local development
- `git` for worktree-backed sessions

## Install

From npm:

```bash
pi install npm:@danifdz/pi-deck
```

From a local checkout:

```bash
pi install /absolute/path/to/pi-deck
```

To try it without installing:

```bash
pi -e /absolute/path/to/pi-deck
```

## Quick start

1. Open Pi.
2. Run `/deck`.
3. Press `n` to create a managed Pi session.
4. Choose a group, name the session, decide whether to use a Git worktree, then pick the folder.
5. Use `Enter` to attach to a session.
6. Use `/deck-send` to send a prompt to another managed session.

If you already have a Pi session and want Pi Deck to manage it, run:

```text
/deck-import
```

That creates a new Pi Deck-owned tmux session using the current Pi session file and switches you to it.

## Commands

| Command | What it does |
| --- | --- |
| `/deck` | Opens the dashboard. |
| `/deck-new` | Creates a new managed Pi/tmux session. It can optionally create or reuse a Git worktree. |
| `/deck-import` | Imports the current Pi session into a new Pi Deck-managed tmux session and switches to it. |
| `/deck-send` | Sends a prompt to another managed Pi/tmux session by typing into its tmux pane. |
| `/deck-status` | Refreshes and displays a compact status summary. |

## Dashboard keys

| Key | Action |
| --- | --- |
| `↑` / `↓`, `j` / `k` | Move selection. |
| `Enter` | Attach to the selected session, or expand/collapse the selected group. |
| `Space` | Expand/collapse the selected group. |
| `n` | Create a new managed session, optionally in a Git worktree. |
| `g` | Create a group. Pi Deck asks which group to create it under, including `My Deck (root)`. |
| `m` | Move the selected session or group into a chosen destination group. |
| `r` | Rename the selected session. |
| `d` | Delete the selected item after confirmation. Deleting a session kills its tmux session if it is still running. |
| `J` / `K`, `Shift+↓` / `Shift+↑` | Reorder the selected item within its parent group. |
| `q` / `Esc` | Close the dashboard. |

## How import works

`/deck-import` imports only the current Pi process. It does not scan tmux and it does not bulk-import every pane that looks like Pi.

The command:

1. Reads the current Pi session file.
2. Creates a new Pi Deck-owned tmux session.
3. Launches `pi --session <current-session-file>` inside that tmux session.
4. Saves the new managed session in `deck.json`.
5. Switches to the new tmux session.

This avoids stale tmux IDs and avoids accidentally importing unrelated sessions.

## Worktree-backed sessions

When creating a session, Pi Deck can create or reuse a Git worktree first.

When you create a session, Pi Deck asks for values in this order:

1. Group
2. Session name
3. Whether to use a Git worktree
4. Branch name, only for worktree sessions
5. Folder path

The folder prompt supports Tab completion for directory names and keeps validation errors inline, so a bad path can be corrected without restarting the flow.

If worktree mode is enabled, Pi Deck:

1. Asks for the branch name before folder selection.
2. Validates that the selected folder is inside a Git repository.
3. Resolves the main repo root, even if the selected folder is already inside a worktree.
4. Reuses an existing worktree for that branch, or creates one under the configured worktree base path.
5. Starts Pi from the worktree path.

Deleting a Pi Deck session kills the tmux session and removes it from the deck. It does not remove the worktree directory or delete the branch yet.

## Configuration

Pi Deck reads optional user configuration from:

```text
~/.pi/agent/pi-deck/config.toml
```

If the file is missing, Pi Deck uses these defaults:

```toml
[session_creation]
branch_prefix = ""
worktree_base_path = ""
default_path = "~"
```

`default_path` controls the initial value in the folder prompt for new sessions. It defaults to `~` and can be set to any absolute, relative, or `~` path.

`branch_prefix` is prepended to the default branch name for worktree sessions. The branch suffix is the session name converted to lowercase kebab case by replacing non-alphanumeric runs with `-`.

For example:

```toml
[session_creation]
branch_prefix = "dani.fernandez/"
```

A session named `Fix API bug` gets this default branch:

```text
dani.fernandez/fix-api-bug
```

`worktree_base_path` controls where new worktrees are created. When it is empty, Pi Deck uses the repo-local default:

```text
<repo path>/.worktree/<safe-branch-name>
```

Set it to an absolute path or a `~` path to use a shared worktree directory instead:

```toml
[session_creation]
worktree_base_path = "~/.worktrees"
```

That creates or reuses worktrees under:

```text
~/.worktrees/<safe-branch-name>
```

## Data file

Pi Deck stores deck state here:

```text
~/.pi/agent/deck.json
```

The file stores group structure and session metadata. It does not store sent prompts, command history, or full conversation content.

## Troubleshooting

### `Path is not a git repository`

This appears when worktree mode is enabled and the selected path is not inside a Git repo. Pi Deck expands `~` and resolves relative paths from the current Pi working directory before checking Git.

### A session is marked missing

Pi Deck tracks tmux panes heuristically. If the stored pane no longer exists, the session can be marked missing. Delete the stale entry or recreate/import the session.

### `/deck-send` did nothing

`/deck-send` types into another tmux pane. The target must have a valid tmux pane and the message cannot be empty. If the target appears busy, Pi Deck warns before sending.

## Current limitations

- Status detection is heuristic and based on tmux pane state.
- `/deck-send` is tmux typing, not a structured orchestration protocol.
- Group deletion only supports empty non-root groups.
- Stop, restart, worktree finish/cleanup, and branch merge actions are not implemented yet.
- Deleting a worktree-backed session does not remove the worktree directory or branch.

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm test
npm run typecheck
npm pack --dry-run
```

The code is organized by layer:

- `src/commands/` registers Pi slash commands.
- `src/domain/` contains pure deck state logic.
- `src/services/` wraps tmux, Git, storage, status refresh, and logging.
- `src/workflows/` contains user-facing flows shared by commands and the dashboard.
- `src/ui/` contains dashboard rendering, key mapping, and selectors.

Read `AGENTS.md` and `src/AGENTS.md` before changing behavior.

## License

MIT
