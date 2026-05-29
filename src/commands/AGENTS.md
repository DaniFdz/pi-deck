# Commands Layer

This folder wires Pi slash commands to workflows.

Rules:
- Register commands here, but do not implement business logic here.
- Wrap handlers with `runCommand` so failures are logged and surfaced consistently.
- Keep command descriptions aligned with README and root `AGENTS.md`.
- If a command needs new behavior, add or update a workflow instead of expanding the command handler.
