# UI Layer

This folder is for dashboard rendering, keyboard mapping, and small interactive selectors.

Rules:
- The dashboard custom overlay must return an action first; nested prompts and tmux/git work run after the overlay closes.
- Do not call tmux, git, filesystem, or process APIs directly from UI components. Delegate to workflows.
- Keep key mapping pure and tested.
- Keep render helpers pure and tested where practical.
- Do not trap input. `q`, `Esc`, and `Ctrl-C` behavior must remain safe.
