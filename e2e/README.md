# Browser test gate

Runs the real app in a real browser against a copy of production data. **Run it before every PR and release.**

```bash
./e2e/run.sh              # full run (about 3 minutes)
./e2e/run.sh -g shortcuts # only matching tests
KEEP_UP=1 ./e2e/run.sh    # just bring the stack up (to poke at it by hand), Ctrl-C to stop
```

What it does:
1. Restores the newest `backups/full/*/retailos.dump` into a throwaway local database (`retailos_e2e`, port 5433). Never production.
2. Starts the backend on it (applying every migration, as a deploy would) and fails if the newest migration didn't run.
3. Copies Sipra Lifeline's data into the **Test Shop** tenant (login `testshop` / `test123`), so tests see real volume.
4. Starts the frontend (pointed at the local backend) and runs the Playwright suite.

Screenshots of key screens are saved to `e2e/screenshots/`: open them, the assertions cannot see everything.

Before a release that has a migration, take a fresh backup first (`backups/full/<timestamp>_pre-<release>/retailos.dump`) so the gate tests the migration on current data.

Notes:
- Do not add a `package-lock.json` here: Next picks its project root from lockfiles and breaks.
- The login endpoint is rate-limited, so tests log in once (`global-setup.ts`, API token cached in `helpers.ts`).
- Add a test for every bug you fix.
