# Pi Deck

Pi Deck is a Pi extension for managing Pi sessions that run inside tmux.

It currently provides a Pi-native dashboard and commands for creating, importing, viewing, and sending prompts to Pi/tmux sessions. The dashboard can also create and attach to sessions. Additional dashboard actions such as add, stop, restart, delete, and cleanup are v1 goals.

## Status

Early development. The current package focuses on a simple Pi-native dashboard, local JSON persistence, and basic tmux-backed session creation/import/send/status flows. The data model supports nested groups; UI/actions for creating and managing groups are planned.

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

Implemented commands:

- `/deck` opens the dashboard.
- `/my-pi` opens the same dashboard with a more personal command name.
- `/deck-new` creates a managed Pi/tmux session.
- `/deck-import` imports tmux sessions that look like Pi.
- `/deck-send` sends a prompt to another managed Pi/tmux session.
- `/deck-status` shows a compact summary.

Dashboard actions include creating a new session with `n` and attaching to the selected session with Enter. Planned future dashboard actions include adding an existing current Pi session, stopping, restarting, deleting, and cleaning up missing records.

## Data file

Pi Deck stores state in:

```text
~/.pi/agent/deck.json
```

The file stores only deck structure and session metadata. It does not store sent prompts or command history.

## V1 limitations

- Status detection is heuristic and based on tmux pane state.
- `/deck-send` types into a target tmux pane; it is not a full orchestration protocol.
- Sessions added outside tmux may need to be relaunched inside managed tmux before attach/stop/restart actions work.
- There is no background daemon in v1; statuses refresh when commands run or the dashboard opens.

## License

MIT
