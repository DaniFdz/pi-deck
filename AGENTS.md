# AGENTS.md

This file is a practical guide for agents and contributors working on Pi Deck.
It should answer common questions about how the extension behaves and what not to break.

## What is Pi Deck?

Pi Deck is a Pi extension for managing Pi sessions that run inside tmux.

The main UI is `/deck`. It stores local deck state in:

```text
~/.pi/agent/deck.json
```

That file stores deck structure and session metadata only. Do not store sent prompts,
command history, or full conversation content in it.

## Package and repository

- Product name: Pi Deck
- Main command: `/deck`
- npm package name: `@danifdz/pi-deck`
- GitHub repo: `DaniFdz/pi-deck`

Keep README, package metadata, and command behavior aligned.

## How does `/deck-import` work?

`/deck-import` imports the **current Pi session only**.

It does not scan all tmux sessions. It does not bulk-import every pane that looks like
Pi. This is intentional.

The flow is:

1. Read the current Pi session file with `ctx.sessionManager.getSessionFile()`.
2. Ask for a managed session name and group.
3. Create a new Pi Deck-owned tmux session with a unique name like:

   ```text
   pi-deck-<name>-<short-id>
   ```

4. Launch Pi in that tmux session with:

   ```bash
   pi --session <current-session-file>
   ```

5. Store the new session as `managed-tmux` in `deck.json`.
6. Switch to the new tmux session.

### What if I run `/deck-import` from a tmux session with 10 Pi panes?

Only the Pi process where the command is executed is imported.

Pi Deck does not inspect or import sibling panes. This avoids accidentally adding
unrelated Agent Deck sessions, old Pi Deck sessions, or other Pi-looking shells.

### Does `/deck-import` fork the conversation?

No. It opens the same Pi session file with `pi --session <current-session-file>`.

That gives the expected UX: after importing, the same conversation continues in a
new Pi Deck-managed tmux session.

Avoid using both the old Pi process and the new managed Pi process at the same
time, because they point at the same session file.

### Why not import existing tmux sessions directly?

The earlier implementation scanned tmux panes and stored whatever looked like Pi.
That caused confusing behavior:

- importing more sessions than expected
- storing stale or wrong tmux pane IDs
- making it hard to return to the actual current session

Pi Deck should prefer sessions it owns and names itself.

## What does `/deck-new` do?

`/deck-new` creates a fresh managed tmux session running `pi` in the selected
project path.

It does not resume the current conversation. Use `/deck-import` when you want the
current conversation to continue inside a Pi Deck-managed tmux session.

Managed tmux session names must include a unique suffix. Do not go back to plain
`pi-deck-<name>` names; old tmux sessions can outlive deck entries and cause name
collisions.

## What does `/deck-send` do?

`/deck-send` sends a prompt by typing into another managed session's tmux pane
with `tmux send-keys`.

It is not a structured orchestration protocol. Keep validation strict:

- reject empty messages
- reject missing targets
- reject targets without a tmux pane
- warn when the target appears busy

Do not store sent messages or send history in `deck.json`.

## What does `/deck-status` do?

`/deck-status` refreshes and displays a compact status summary.

Status is heuristic and based on tmux pane state. It is not authoritative. A
stable pane hash is treated as idle; a changed pane hash is treated as running.
If a stored pane is gone, the session can be marked missing.

## Dashboard behavior

`/deck` opens the full dashboard.

Current keys:

- `↑` / `↓` or `j` / `k` — move selection
- `Enter` — attach to the selected session
- `n` — create a new managed session
- `g` — create a group
- `r` — rename the selected session
- `d` — delete the selected item after confirmation
- `J` / `K` or `Shift+↓` / `Shift+↑` — reorder within the current parent group
- `q` / `Esc` — close the dashboard

Dashboard actions should return an action from the overlay first, then run nested
prompts or tmux operations after the overlay closes. Avoid doing nested
`ctx.ui.input`, `ctx.ui.confirm`, or tmux switching directly inside the custom
component's key handler; that previously trapped input and forced Pi restarts.

## Delete behavior

Deleting is destructive and requires confirmation.

- Deleting a session kills its recorded tmux session if it is still running, then
  removes the deck entry.
- Deleting an empty non-root group removes the group.
- Root groups cannot be deleted.
- Non-empty groups cannot be deleted yet.

If group subtree deletion is added later, it must have an explicit confirmation
that explains it will kill all child sessions.

## Reordering behavior

Reordering currently moves the selected session or group within its parent group.

It does not move items across groups. Add cross-group moves separately and with a
clear UI, because it changes hierarchy rather than just order.

## Verification before handoff

Before handing work back, run:

```bash
npm test
npm run typecheck
npm pack --dry-run
```

Check that `npm pack --dry-run` does not include internal planning/spec files.

## Packaging rules

Do not publish or package internal planning/spec files:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`

The package `files` list in `package.json` should keep the npm tarball focused on
runtime source, README, license, and config needed for installation.
