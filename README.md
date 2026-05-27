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
