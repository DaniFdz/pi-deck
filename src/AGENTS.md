# Source Layout

Pi Deck code is organized by responsibility:

- `domain/`: pure state and validation logic. It must not import `services/`, `workflows/`, `commands/`, or `ui/`.
- `services/`: side-effect adapters for filesystem, git, tmux, storage, status refresh, and logging.
- `workflows/`: user-facing use cases that compose domain logic and services. Command handlers and dashboard actions should call workflows instead of duplicating business logic.
- `commands/`: Pi slash-command registration and command error handling only.
- `ui/`: rendering, key handling, and small UI selectors. UI should emit/route actions and delegate side effects to workflows.

When adding behavior, first decide whether it is pure domain logic, an external adapter, or an orchestration workflow. Avoid putting process, tmux, git, or filesystem side effects in UI components.
