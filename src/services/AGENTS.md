# Services Layer

This folder wraps external side effects: tmux, git, filesystem paths, deck storage, status refresh, and logging.

Rules:
- Keep command builders/parsers pure and unit-tested.
- Keep execution wrappers thin and explicit about shell commands they run.
- Do not put Pi UI prompts here; prompts belong in workflows or UI selectors.
- Treat missing tmux sessions as success when killing a session; the desired final state is "not running".
- Managed tmux names must keep a unique suffix. Do not return to plain `pi-deck-<name>` names.
- Do not reintroduce bulk tmux pane scanning for `/deck-import`.
