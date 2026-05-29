# Domain Layer

This folder is for pure, deterministic logic over Pi Deck data structures.

Rules:
- Do not import `services/`, `workflows/`, `commands/`, or `ui/`.
- Do not call tmux, git, filesystem, network, or Pi UI APIs here.
- Keep reducers immutable: return new deck/session/group objects instead of mutating inputs.
- Runtime shape changes must update `types.ts`, store validation, and tests together.
- Keep exhaustive switches without `default` when TypeScript can catch missing cases.
