# Workflows Layer

This folder contains user-facing use cases shared by slash commands and dashboard actions.

Rules:
- Workflows may import `domain/` and `services/`, and may use Pi command context/UI prompts.
- Keep slash commands and dashboard handlers thin by delegating business logic here.
- Preserve caller-specific UX. For example, `/deck-new` and dashboard `n` create and notify without attaching; `/deck-import` creates and attaches.
- If a workflow changes deck state, load and save through `services/store.ts` and keep behavior covered by tests or existing end-to-end smoke checks.
