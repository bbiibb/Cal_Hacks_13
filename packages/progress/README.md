# @cal-hacks/progress

SpacetimeDB module that remembers each person's viewing progress, so they can come back to where they left off.

## What it stores
One row per person and procedure in the private `step_progress` table: the procedure slug, the current step, the steps viewed, and a timestamp. It never holds names, SSNs, or chat text. The row is keyed by an anonymous SpacetimeDB identity.

## Who can read what
- `step_progress` is private. Only the module and the database owner can read it.
- Clients subscribe to the `my_progress` view, which returns only the caller's own rows.
- Writes go through the `save_progress` and `reset_progress` reducers. They use `ctx.sender`, so a client cannot write another person's row.

## Commands
Add `~/.local/bin` to your PATH after installing the CLI (https://spacetimedb.com/install), then log in once with `spacetime login`.

```bash
pnpm --filter @cal-hacks/progress typecheck
cd packages/progress && spacetime build

# Try it on a local server
spacetime start                                              # leave running
spacetime publish my-test-db --server local --module-path spacetimedb --yes
spacetime call --no-config -s local my-test-db save_progress '"tavr"' 0 5
spacetime sql  --no-config -s local my-test-db "SELECT * FROM step_progress"
```

`spacetime.local.json` holds your own database name and is gitignored. Publishing to the cloud (`--server maincloud`) creates a database under your account, so do it deliberately.

`CLAUDE.md` in this folder is SpacetimeDB's own reference for AI assistants (tables, reducers, views, client API).
