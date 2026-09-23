# Obsidian mirror

After this command has written all `.paul/` files, run:

```bash
node "{{PAUL_OBSIDIAN_SYNC_SCRIPT}}" sync --project "."
```

This reads the configured vault path and mirrors PAUL project, roadmap, state, plans, and summaries into `20 Projects/PAUL` in that vault. If no vault is configured, it skips cleanly. If sync fails, report the error and leave the PAUL workflow result intact; the user can run the sync again later. Never edit mirrored notes as the source of truth.
