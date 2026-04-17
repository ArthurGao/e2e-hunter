# Prompt 4 — Fix-and-Retest Loop

Use this prompt after the bug report has been reviewed.

---

```
Enter a fix-and-retest loop until all real bugs are resolved.

LOOP RULES:
- Continue if any UI_BUG, API_BUG, AUTH_BUG, or SYNC_BUG remains
- Stop if only TEST_BUG or SKIPPED remain → ask for human input
- Maximum 5 iterations — if bugs persist after 5 rounds, stop and report
- Any regression introduced must be reverted immediately before continuing

EACH ITERATION:

STEP 1 — Fix
For each real bug from the previous round:
  - Locate the exact file and line causing the bug (use stack trace + code scan)
  - Apply the MINIMAL fix
  - Do NOT refactor unrelated code
  - Do NOT change test files unless the bug is classified as TEST_BUG
  - Document for each fix: file, lines changed, reason

STEP 2 — Retest
Run headless again (replace N with the current round number):
  npx playwright test --browser=chromium 2>&1 | tee test-output-round-N.log

STEP 3 — Diff
Compare this round's failures against the previous round:
  - ✅ Newly passing → "fixed"
  - 🔄 Still failing → "not fixed yet"
  - ⚠️ Newly failing → "REGRESSION"

If any REGRESSION is detected:
  - Revert the last fix immediately
  - Re-run tests
  - Continue the loop

STEP 4 — Progress Report
After each round, output:

## Round N Results

### Progress Table
| Test | Round 1 | Round 2 | ... | Round N | Status |
|------|---------|---------|-----|---------|--------|
| login happy path | ❌ | ✅ | ✅ | ✅ | Fixed |
| dashboard 401 | ❌ | ❌ | ✅ | ✅ | Fixed |
| users schema | ✅ | ✅ | ✅ | ✅ | Stable |

### This Round
- Bugs addressed: N
- Bugs fixed successfully: N
- Bugs still failing: N
- Regressions introduced (and reverted): N
- Files modified this round: <list>

Continue to next round if real bugs remain.

FINAL OUTPUT WHEN LOOP ENDS:

## All Clear Report

### Outcome
- Reason for stopping: all passing / only TEST_BUG remain / max iterations / blocked
- Total rounds used: N
- Total bugs fixed: X
- Total regressions caught and reverted: Y

### Files Modified
List every file touched, grouped by app:
- apps/backend/...
- apps/frontend/...

### Test Results Summary
- Total tests: X
- Passing: X
- Failing (TEST_BUG): X — human review needed
- Skipped: X — blockers: <list>

### Confirmation
- No regressions remain: ✅ / ⚠️
- All P0 scenarios passing: ✅ / ⚠️
- All cross-app scenarios passing (if applicable): ✅ / ⚠️

### Remaining Work (if any)
Actionable list for the user to resolve manually.
```
