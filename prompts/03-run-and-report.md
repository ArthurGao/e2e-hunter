# Prompt 3 — Run Tests & Generate Bug Report

Use this prompt after test files have been generated.

---

```
Run the tests in two phases and produce a structured bug report.

PHASE 1 — Headless batch run (find all failures fast):

Execute:
  npx playwright test --browser=chromium 2>&1 | tee test-output.log

After the run, read:
  - test-output.log
  - test-results/ folder (screenshots, traces, videos)
  - playwright-report/ if it exists

Output an initial Failure Table:
| # | Test File | Test Name | Failure Type | Error Message (first line) | Suspected Location |

Failure types to use:
- UI_BUG      = element not found, wrong text, layout broken
- API_BUG     = wrong status code, missing field, schema mismatch
- AUTH_BUG    = wrong redirect, token not sent, session issue
- SYNC_BUG    = cross-app data did not propagate within timeout
- TIMEOUT     = page/request took too long
- TEST_BUG    = the test itself is wrong (stale selector, wrong expectation)

PHASE 2 — Headed re-run per real bug (NOT for TEST_BUG or TIMEOUT):

For each failure classified as UI_BUG / API_BUG / AUTH_BUG / SYNC_BUG:

  Run:
    npx playwright test "<test name>" --headed --slowmo=500 --browser=chromium

  While running, capture via page.on() handlers:
    - page.on('console')  — collect console errors
    - page.on('response') — collect any 4xx / 5xx network responses
    - page.on('pageerror') — collect unhandled JS errors

  After each re-run, record:
    - Exact DOM state at point of failure
    - All console messages
    - All failed network requests (URL + status + response body preview)

PHASE 3 — Final Bug Report:

Output this exact format:

## Bug Report

### Summary
- Total tests: X
- Passed: X
- Failed: X
- Test bugs (false positives): X
- Real bugs found: X

### Real Bugs

#### Bug #1
- **Test**: <file>:<test name>
- **Type**: UI_BUG / API_BUG / AUTH_BUG / SYNC_BUG
- **What the test did**: <step-by-step description>
- **What actually happened**: <actual behavior, including screenshot reference>
- **Console errors**: <any JS errors, or "none">
- **Failed network calls**: <endpoint + status code, or "none">
- **Suspected cause layer**: frontend-component / api-endpoint / auth-middleware / cross-app-sync / database
- **Suspected file + line**: <best guess based on stack trace and code scan>
- **Suggested fix**: <specific actionable recommendation>

#### Bug #2
...

### Test Bugs (need test-code fix, not app-code fix)
List each with reason (e.g. "selector outdated", "assertion expected wrong value").

### Skipped / Blocked
List tests that could not run, with reasons (e.g. "env var missing", "backend down").

### Cross-App Findings (if applicable)
- Sync latency observed: <avg ms>
- Flows that failed cross-app: <list>
- Apps that did not degrade gracefully when peer was down: <list>

STOP here. Ask the user whether to proceed with the fix-and-retest loop.
```
