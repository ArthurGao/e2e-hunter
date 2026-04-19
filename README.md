# e2e-hunter

A Claude Code skill that **hunts bugs** by generating and running comprehensive
E2E tests for any full-stack project using Playwright. Framework-agnostic —
works across any frontend/backend combination.

Unlike naïve test generators, e2e-hunter does two things differently:

1. **Detects before forcing.** Before writing tests, it scores each UI surface
   on test-readiness (`data-testid`, `aria-label`, `htmlFor`). Low-readiness
   components get smoke-only tests plus a concrete list of fixes to raise the
   score — never brittle tests that pass once and break on the next refactor.
2. **Respects project notes.** An optional `e2e/HUNTER_NOTES.md` lets you steer
   every phase — what to ignore, what to cover deeply, which dev-mode oddities
   to classify as `KNOWN_QUIRK` instead of bugs, and rules the fix-loop must
   respect.

---

## Trigger phrases

In Claude Code, say any of these:

- "Hunt for bugs in this project"
- "Run e2e-hunter"
- "Scan test scenarios"
- "Generate Playwright tests"
- "Find bugs automatically"
- "Set up E2E testing"

---

## Supported stacks

| Frontend | Backend |
|---|---|
| Next.js (App Router + Pages Router) | NestJS |
| React + React Router | Express / Koa / Fastify |
| Vue 3 + Vue Router | FastAPI (Python) |
| Nuxt 3 | Django / DRF (Python) |
| SvelteKit | Ruby on Rails |
| Angular | Go (Gin / Echo / Chi / Fiber) |
| Any app with an OpenAPI spec | Spring Boot (Java / Kotlin) |
| | Laravel (PHP) |

**Auth:** JWT, Session/Cookie, OAuth/SSO bypass, API Key, mock-header dev mode.

---

## What gets produced

After a successful run you'll have three artifacts in `e2e/`:

| File | What it contains |
|---|---|
| `e2e/SCENARIO_MATRIX.md` | Tech stack, app inventory, cross-app map, full scenario table with priorities, readiness scores per UI component. Persisted at end of Phase 2 — you review/approve before tests are generated. |
| `e2e/BUG_REPORT.md` | Every failure classified as `API_BUG`, `UI_BUG`, `AUTH_BUG`, `SYNC_BUG`, `TIMEOUT`, `TEST_BUG`, `TEST_HOSTILE_UI`, or `KNOWN_QUIRK`, with root cause, stack layer, and suggested fix. Updated each round. |
| `e2e/*.spec.ts` | The test files themselves — API tests, page tests, and (for multi-app) cross-app tests. |

---

## Configuring e2e-hunter in a project

The skill is **project-agnostic**. All project-specific configuration lives in
two files — the skill folder itself is never edited.

### Required files (skill won't run without these)

| File | Purpose |
|---|---|
| `.env.test` (project root) | URLs, credentials, per-app auth flags |
| `playwright.config.ts` (project root) | `webServer` commands, projects, ports |

### Recommended files (unlock better output)

| File | Unlocks |
|---|---|
| `e2e/HUNTER_NOTES.md` | Scope/focus directives; dev-mode-quirk classification; fix-loop guardrails |
| `data-testid` / `aria-label` / `htmlFor` on interactive UI | Raises readiness scores → skill generates real interaction tests instead of smoke-only |
| DTO validators (`class-validator`, `Zod`, `Yup`, `Joi`) | Skill auto-derives boundary/validation tests from decorators |
| A seed script (`npm run seed`, etc.) | Skill suggests running it before Phase 5 so data-dependent tests don't skip |

### Optional

| File | Purpose |
|---|---|
| OpenAPI / Swagger spec | Fallback endpoint discovery when backend is non-JS |
| Docker compose | Service graph mapping for cross-app tests |

---

## Step-by-step install

### Step 1 — Drop the skill into `.claude/`

Standard Claude Code layout:

```bash
mkdir -p .claude/skills
# Option A: copy
cp -r /path/to/e2e-hunter .claude/skills/
# Option B: symlink (recommended — one copy, shared across projects)
ln -s ~/shared/skills/e2e-hunter .claude/skills/e2e-hunter
```

### Step 2 — Register the skill in `CLAUDE.md`

Add this block so Claude auto-invokes the skill on trigger phrases:

```markdown
## Available Skills

### E2E Hunter — Bug Hunting
Skill: .claude/skills/e2e-hunter/SKILL.md
When asked to hunt bugs, generate E2E tests, or scan scenarios,
read this skill first before doing anything.
```

### Step 3 — Copy the Playwright config template

```bash
cp .claude/skills/e2e-hunter/templates/playwright.config.ts ./playwright.config.ts
```

The template auto-loads `.env.test` from its own directory via
`dotenv.config({ path: path.resolve(__dirname, '.env.test') })`.

Adjust the `webServer` blocks and `projects` array to match your app(s) —
ports, start commands, and which test folders map to which Playwright project.

### Step 4 — Create `.env.test` at project root

```bash
cp .claude/skills/e2e-hunter/templates/.env.test.example .env.test
```

Fill in real values:

```bash
# ── Backend API
API_URL=http://localhost:3000/api

# ── Apps (registry — skill iterates over this list)
APPS=admin,candidate

# ── admin portal
APP_ADMIN_URL=http://localhost:3001
APP_ADMIN_EMAIL=admin@example.com
APP_ADMIN_PASSWORD=your-admin-password
APP_ADMIN_AUTH=true

# ── candidate portal
APP_CANDIDATE_URL=http://localhost:3003
APP_CANDIDATE_EMAIL=candidate@example.com
APP_CANDIDATE_PASSWORD=your-candidate-password
APP_CANDIDATE_AUTH=true
```

**How it scales:** add or remove a name in `APPS` and its matching
`APP_<NAME>_*` keys. Nothing in the skill changes. Works for 1 app or 10.

**Auth-free mode:** set `APP_<NAME>_AUTH=false` if your app doesn't require
login in dev (e.g., mock guard). The skill will skip `auth.setup.ts` for that
app and use a raw browser context.

### Step 5 — Gitignore `.env.test`

```bash
echo ".env.test" >> .gitignore
```

Commit the `.env.test.example` template instead.

### Step 6 — Install Playwright

```bash
npm install -D @playwright/test dotenv
npx playwright install chromium
```

### Step 7 — (Strongly recommended) Write `e2e/HUNTER_NOTES.md`

```bash
cp .claude/skills/e2e-hunter/templates/HUNTER_NOTES.md.example e2e/HUNTER_NOTES.md
# then edit to your project's realities
```

Structure (every section optional):

```markdown
## Scope                        # exclude listed areas from scanning + matrix
## Focus                        # cover these areas deeply (more scenarios, P0)
## Constraints                  # fix-loop guardrails ("don't touch backend/auth")
## Known dev-mode quirks        # tag matching failures as KNOWN_QUIRK, not a bug
## Test-readiness notes         # override auto-scores on specific components
## Ask user before generating   # questions the skill asks before Phase 4
```

**Precedence:** chat instructions > `HUNTER_NOTES.md` > skill defaults.

### Step 8 — Trigger the skill

In Claude Code, say:

> Hunt for bugs in this project

The skill detects your stack, builds a scenario matrix, **stops for your
approval**, generates tests, runs them, and produces a classified bug report.

---

## How to use e2e-hunter (daily workflow)

**Core rule: tests are CODE — reused, committed, maintained. The skill is a
one-time bootstrap + incremental extender, not a regenerator.**

After the initial run, run `npx playwright test` daily. Only invoke
e2e-hunter when you need to **add** coverage, never to regenerate it.

### When to invoke e2e-hunter

| Situation | Action |
|---|---|
| Daily dev / CI | `npx playwright test` — no hunter needed |
| New endpoint / module added | Invoke hunter targeted at the new module |
| New bug class suspected | Invoke hunter with a specific Phase by name |
| Monthly / quarterly drift check | Invoke hunter broadly, merge new tests |
| Skill itself updated (new phases shipped) | Invoke hunter broadly, review new matrix rows |

### Five invocation patterns (use the one that fits)

**1. New endpoint / module added**

> "I just added `backend/src/modules/invoice/`. Use e2e-hunter to scan it and
> **add tests to `e2e/api/` without touching existing specs**."

The skill scans only the new module → produces new spec files → leaves every
existing file alone.

**2. Target a specific bug class**

> "Use e2e-hunter **Phase 1I (IDOR scan)** on `/api/candidates/*`. **Add a
> new `hunt-authz.spec.ts`** with the probes — don't modify existing tests."

Phase names you can cite:

- **Phase 1G** → side-effect sinks (audit logs, emails, queues)
- **Phase 1H** → cascade cleanup (DELETE parent → children)
- **Phase 1I** → IDOR / authorization matrix
- **Phase 1J** → file-upload hardening
- **Phase 1K** → time / expiry fields
- **Phase 1L** → PII redaction
- **Phase 1M** → backwards compatibility
- **Phase 1N** → webhook delivery
- **Phase 2D.2** → multi-hop state chains
- **Phase 2D.5** → pagination deep-probes
- **Phase 2D.6** → accessibility (axe-core)
- **Phase 2D.7** → responsive viewport

**3. Describe a user flow in plain English**

> "Add tests for the **candidate move-between-SRs flow** — admin moves
> candidate A from SR1 to SR2, verify old SR hides them, new SR shows them,
> docs migrate."

The skill treats flow descriptions as `## Focus` directives and generates
end-to-end probes.

**4. Extend an existing test file**

> "Add 3 more boundary probes to `e2e/api/hunt-boundaries.spec.ts` — cover
> `Date` fields on `CandidateDto` with H28, H29, H30."

Explicit file + test numbers + target DTO. Skill appends to existing file.

**5. Write a regression test for a bug-report finding**

> "BUG_REPORT.md Finding #14 says `?search=` silently ignores input. **Add a
> regression test** under `e2e/api/` that catches this specifically."

Direct reference to the finding number → skill reads the report context
and writes the probe.

**6. PR mode — scan only what changed in the current branch**

> "Use e2e-hunter in **PR mode** — scan the diff against `main` and add tests
> for the changed code only."

Or set `E2E_HUNTER_DIFF_BASE=main` in `.env.test` once and just say:

> "Scan my PR and add missing tests."

The skill runs `git diff --name-only <base>...HEAD`, filters to source
files, expands scope to direct importers (catches regressions in callers
of changed code), and restricts every Phase 1 scan to that file list.
Matrix rows produced this way are labeled `[PR]` so you can distinguish
them from pre-existing coverage.

**Works across all supported languages** (TS / JS / Python / Java / Go /
Ruby / PHP / Kotlin) because it's pure `git diff` + file-path filtering
— no per-language AST parsing.

CI integration example (GitHub Actions):

```yaml
- name: e2e-hunter PR scan
  if: github.event_name == 'pull_request'
  env:
    E2E_HUNTER_DIFF_BASE: ${{ github.base_ref }}
  run: |
    # Invoke Claude Code with e2e-hunter, trigger PR mode
    # (exact CLI depends on your agent runner)
    claude-code --skill e2e-hunter --prompt "Scan my PR and add missing tests"
```

### The one-liner that works 80% of the time

> **"Use e2e-hunter to find coverage gaps in `<specific area>` and add tests
> in `<target file OR new file>` that catch `<what bug class you care about>`."**

Example:
> "Use e2e-hunter to find coverage gaps in the **messaging module** and add
> tests in a **new `hunt-messaging.spec.ts`** that catch **cascade-on-delete
> and PII-leak** issues."

### Anti-patterns (don't say these)

| ❌ Don't say | ✅ Say instead |
|---|---|
| "regenerate e2e tests" | "add tests for X that aren't covered yet" |
| "run e2e-hunter" (vague) | "run e2e-hunter Phase 1I on `/candidates`" |
| "make tests for everything" | list the specific resource / flow / bug class |
| "overwrite my tests" | "extend file X" or "create new file Y" |
| "rerun all the hunters" | `npx playwright test` — the tests are already there |

### What the skill needs every time

Every invocation should carry three things:

1. **Target** — which resource, module, flow, or Phase number
2. **Scope** — "add new file" vs "extend existing file X" vs "only if missing"
3. **Guardrails** — automatic from `e2e/HUNTER_NOTES.md`; mention exceptions inline

### Golden rule

> **Skill = tool to set up and extend tests.**
> **Tests = code, committed and maintained like any other code.**

Treat hunter output the same way you'd treat code from a scaffolding tool
(Nest CLI, Rails generators): the tool bootstraps, humans iterate, git
tracks the result.

---

## Making your project more hunter-friendly

Most bugs the hunter can detect depend on signals in your codebase. Here's
what to add to get deeper, less brittle tests.

### Frontend — raise test-readiness scores

The hunter scores every dialog / modal / wizard / drawer on a 0–1 scale:

```
score = (data-testid + aria-label + htmlFor count) / interactive targets
```

| Score | Band | What gets generated |
|---|---|---|
| ≥ 0.80 | 🟢 Green | Full interaction tests using `getByRole` / `getByLabel` / `getByTestId` |
| 0.30–0.80 | 🟡 Amber | Happy-path + one edge case; brittle steps wrapped in `.catch(() => skip)` |
| < 0.30 | 🔴 Red | **Mount-only** smoke tests + a line in the bug report: "add X testids to raise to Green" |

**To move components from Red → Green:**

1. Add `data-testid` on named action buttons: `<Button data-testid="sr-submit">Submit</Button>`
2. Pair every `<Input>` / `<Textarea>` with `<label htmlFor="...">` (not just `<Label>` parents)
3. Add `aria-label` on icon-only buttons and pagination controls
4. Use `role="dialog"` / `role="heading"` on containers

### Backend — unlock auto-derived boundary tests

The hunter reads DTO validators and generates boundary tests automatically:

```typescript
// packages/common/src/dtos/service-request.ts
export class CreateServiceRequestDto {
  @IsString()
  @MinLength(5)          // → generates test: length=4 expects 400
  @MaxLength(500)        // → generates test: length=501 expects 400
  serviceDescription!: string;

  @IsEnum(ServiceType)   // → generates test: "NOT_A_TYPE" expects 400
  serviceType!: ServiceType;

  @IsEmail()             // → generates test: "not-an-email" expects 400
  contactEmail?: string;
}
```

Works with `class-validator` (NestJS), `Zod` (anywhere), `Yup` (anywhere),
`Joi` (Express/Hapi) — the skill detects which you use.

### Backend — unlock state-machine tests

Expose a status enum on entities and the hunter generates a transition matrix:

```typescript
export enum ServiceRequestStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
}
```

Every `PATCH /:id/status` is probed with every combination. Invalid
transitions must return 400/409, valid ones must round-trip on re-read.

### Test data — make cleanup visible

Use a unique prefix on all test-created data so orphans are greppable:

```typescript
import { uniq } from '../helpers/api';

const description = `HUNT SR ${uniq()}`;  // HUNT-prefixed, timestamp-suffixed
```

Then grep the DB for cleanup:

```sql
SELECT id, description, deleted_at FROM service_requests
WHERE description ILIKE 'HUNT%' OR description ILIKE 'E2E-HUNTER%';
```

---

## How it works — phases

### Pre-flight (always first)
- **Read `HUNTER_NOTES.md`** — apply scope/focus/constraints/quirks for the run.
- **Infrastructure scan** — dev server health, conditional base paths, seed scripts, Docker compose. Flags dev-server overload, base-path conflicts, missing fixtures.

### Phase 0 — Detect tech stack
Language, framework, router type, port, auth method, start command per app.

### Phase 1 — Discovery
| Sub-phase | What it does |
|---|---|
| 1A | Frontend route scan |
| 1B | Backend endpoint scan |
| 1C | Auth boundary detection |
| 1D | UI component enumeration (dialog/modal/wizard/drawer/sheet) |
| 1E | Test-readiness scoring per component |
| 1F | Cross-app relationship detection |

### Phase 2 — Build scenario matrix
| Sub-phase | What it does |
|---|---|
| 2A | Tech stack map |
| 2B | App inventory |
| 2C | Scenario matrix (with readiness column) |
| 2D | Required coverage per route/endpoint |
| 2E | Required coverage per cross-app relationship |
| 2F | Summary counts |
| 2G | Apply HUNTER_NOTES scope/focus |
| 2H | Persist to `e2e/SCENARIO_MATRIX.md` |

**→ STOP for your approval.** Nothing is generated without sign-off.

### Phase 3 — Playwright setup
Install deps, adapt config to detected stack, generate `auth.setup.ts` per app.

### Phase 4 — Generate test files
Page tests (browser), API tests (HTTP-only), cross-app tests (multi-app only).
Readiness gates depth: Green gets full interactions, Red gets mount-only.

### Phase 5 — Run
Headless batch first, then headed per failure for investigation. Artifacts
(screenshots, videos, traces) on fail.

### Phase 6 — Bug report
Every failure classified by type + stack layer. Persisted to
`e2e/BUG_REPORT.md`.

### Phase 7 — Fix-and-retest loop (max 5 rounds)
Minimal-diff fixes, retest, regression detection, auto-revert on regression.
Respects `HUNTER_NOTES.md` constraints (LOC caps, DNT paths, "propose don't apply" rules).

---

## Per-project configuration summary

Everything that varies between projects lives in **three places**:

| File | Purpose | Required? |
|---|---|---|
| `.env.test` (project root) | URLs, credentials, test secrets | **Required** |
| `playwright.config.ts` (project root) | webServer commands, ports, projects | **Required** |
| `e2e/HUNTER_NOTES.md` | Scope, focus, quirks, fix-loop rules | Strongly recommended |

The skill itself (`.claude/skills/e2e-hunter/`) is never edited — reusable
across all your projects.

---

## Manual prompt sequence

If you prefer driving the skill manually without triggers, paste from
`prompts/` in order:

1. `05-multi-app-context.md` — optional, multi-app without docs only
2. `01-discover.md` — pre-flight + Phase 0 + 1 + 2 (stops for approval)
3. `02-generate.md` — Phase 3 + 4 (stops for confirmation)
4. `03-run-and-report.md` — Phase 5 + 6
5. `04-fix-loop.md` — Phase 7 until clean or 5 rounds

---

## Files included

```
e2e-hunter/
├── SKILL.md                         # Full 7-phase methodology
├── README.md                        # This file
├── prompts/
│   ├── 01-discover.md               # Pre-flight + Phase 0 + 1 + 2
│   ├── 02-generate.md               # Phase 3 + 4
│   ├── 03-run-and-report.md         # Phase 5 + 6
│   ├── 04-fix-loop.md               # Phase 7
│   └── 05-multi-app-context.md      # Optional seed for multi-app projects
└── templates/
    ├── playwright.config.ts         # Auto-loads .env.test via dotenv
    ├── auth.setup.ts                # JWT / session / SSO-bypass per-stack
    ├── multi-app.fixture.ts         # Iterates APPS list at runtime
    ├── multi-actor.fixture.ts       # N parallel sessions of same role (Gap E)
    ├── wait-for-sync.ts             # Cross-app consistency polling helper
    ├── page.spec.ts.template        # Browser test boilerplate
    ├── api.spec.ts.template         # HTTP-only test boilerplate
    ├── cross-app.spec.ts.template   # Multi-app test boilerplate (+assertEntityRoundTrip)
    ├── HUNTER_NOTES.md.example      # Copy to e2e/HUNTER_NOTES.md
    └── .env.test.example            # Copy to .env.test
```

---

## Bug classes auto-detected by the skill

All scenario generation is driven by scanning your codebase — the skill reads
DTO validators, ORM relationships, status enums, conditional JSX, sink calls,
and bulk-endpoint signatures, then emits matrix rows you approve before
anything is generated. Zero per-project manual bullets required.

| Bug class | Where it's detected | Matrix label |
|---|---|---|
| Unauth / 401 | Phase 1C auth boundaries | baseline |
| Invalid input / 400 | DTO validators (class-validator, Zod, Yup, Joi) | baseline |
| Not found / 404 | Phase 1B endpoints | baseline |
| Conditional UI branches (Gap F) | Phase 1E.2 — `{state === 'X' && ...}` scan | STATE-FIXTURE |
| Cross-portal field sync (Gap C) | Phase 2E field-level round-trip via `assertEntityRoundTrip` | cross-app |
| Side-effect sinks (Gap A) | Phase 1G — audit/email/event/webhook grep | SIDE-EFFECT |
| Cascade cleanup (Gap B) | Phase 1H — ORM relationship scan (TypeORM / Prisma / Sequelize / Django / ActiveRecord / GORM / JPA) | CASCADE |
| Multi-hop state chains (Gap D) | Phase 2D.2 — DFS depth 3 over status enum transitions | STATE-CHAIN |
| Multi-actor scenarios (Gap E) | Phase 1B — `recipientIds[]` / `broadcast` / `bulkCreate` endpoint signatures | MULTI-ACTOR |
| Dialog interaction sequences (Gap G) | Phase 4B — auto-generated per Green-readiness dialog | UI (sequence) |
| **Authorization / IDOR (Gap H)** | Phase 1I — scoped route params (`:userId`, `:tenantId`) | AUTHZ |
| **Cache / stale data (Gap I)** | Phase 2D — paired with every mutation | baseline |
| **File-upload hardening (Gap J)** | Phase 1J — multer / UploadFile / ActiveStorage scan | FILE-UPLOAD |
| **Time / timezone / expiry (Gap K)** | Phase 1K — date DTO fields + validity-window names | TIME |
| **Optimistic concurrency (Gap L)** | Phase 2D — auto-activates when `version`/`etag`/`If-Match` detected | baseline |
| **Accessibility (Gap M)** | Phase 2D.6 — axe-core injection per Green page | A11Y |
| **Pagination deep-probes (Gap N)** | Phase 2D.5 — extends baseline pagination (cursor + sort stability) | PAGINATION |
| **PII / secret redaction (Gap O)** | Phase 1L — sensitive-field scan + `assertNoSecretsLeaked` | PII-REDACTION |
| **Backwards compatibility (Gap P)** | Phase 1M — `@deprecated` + versioned-route scan | COMPAT |
| **Webhook delivery (Gap Q)** | Phase 1N — extends 1G sink scan | WEBHOOK |
| **Responsive viewport (Gap R)** | Phase 2D.7 — 375/768/1440px per Green page | RESPONSIVE |

For Gap E (multi-actor) and Gap H (IDOR), provision N actors in `.env.test`
with the `CANDIDATE_1_EMAIL` / `CANDIDATE_2_EMAIL` / ... convention — the
`multi-actor.fixture.ts` picks them up automatically.

For Gap A / Q (side-effect and webhook oracles against a DB), set
`TEST_DB_URL` in `.env.test` if you want direct DB probes; otherwise the
skill falls back to calling `/audit-logs` / `/events` list endpoints if
exposed. Set `WEBHOOK_URL` to a test-owned sink endpoint for webhook probes.

For Gap M (accessibility), install `@axe-core/playwright` — the skill
auto-injects it per Green page. `npm install -D @axe-core/playwright`.

For Gap J (file-upload), the skill generates deterministic fixture files
under `e2e/fixtures/files/` on the first run (tiny PDF, zero-byte, MIME-spoof,
path-traversal filename, zip bomb). No external binary required.

## PR mode — scan only what changed (multi-language)

For CI and day-to-day development, you usually don't want to re-scan your
entire repo — you want tests for **the code in this PR**. PR mode does
exactly that, and it works across every language the skill supports.

### When to use

| Situation | Mode | Why |
|---|---|---|
| Daily dev / full refactor audit | Full scan | Catches drift anywhere in the repo |
| Every PR in CI | **PR mode** | Adds only the tests the diff needs |
| New module added | Full scan | Nothing to diff against yet |
| Small feature branch | **PR mode** | Fast, relevant, no noise |

### How it works (3 steps, language-agnostic)

1. **Resolve base + diff**
   ```bash
   BASE="${E2E_HUNTER_DIFF_BASE:-main}"
   CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR "${BASE}...HEAD")
   ```
2. **Filter to source files** (one regex covers all supported languages):
   ```bash
   SOURCE_EXT='\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|kt|php|vue|svelte)$'
   SCOPE=$(echo "$CHANGED_FILES" | grep -E "$SOURCE_EXT")
   ```
3. **Expand to direct importers** (one grep per extension catches "service
   changed, controllers still need regression tests") — again, purely
   file-path / symbol-name based, no AST parsing.

Every existing Phase 1 scan then restricts to `SCOPE`. Matrix rows emitted
this way are labeled `[PR]` so humans can distinguish them from pre-existing
coverage.

### Supported languages

`.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` `.py` `.rb` `.go` `.java` `.kt`
`.php` `.vue` `.svelte` — the entire matrix the skill already supports
works identically in PR mode, because the added logic is pure `git` +
file-extension filtering.

### Benefits

| Benefit | Full scan | PR mode |
|---|---|---|
| Time on small PR (5 changed files) | ~2 min | **~15 sec** |
| Generated tests match PR surface | ❌ noisy | ✅ exact |
| Fits CI `pull_request` trigger | awkward | **natural** |
| Works for TS + Java + Python + JS | ✅ | ✅ (one code path) |

### CI example (GitHub Actions)

```yaml
- name: e2e-hunter PR scan
  if: github.event_name == 'pull_request'
  env:
    E2E_HUNTER_DIFF_BASE: ${{ github.base_ref }}
  run: |
    claude-code --skill e2e-hunter \
      --prompt "Scan my PR and add missing tests"
```

### Fallback behavior

- `E2E_HUNTER_DIFF_BASE` unset and user didn't mention PR → **full scan**.
- Changed files exist but touch no testable surface (config / docs / tests
  only) → skill stops with "changed files touch no testable surface."
- No files changed vs base → skill stops with "nothing to test."

### How to invoke

Either of these activates PR mode:

```
> "Scan my PR against main and add missing tests."
> "Use e2e-hunter in PR mode."
```

Or set the env var once in `.env.test`:

```bash
E2E_HUNTER_DIFF_BASE=main
```

…and every subsequent invocation runs in PR mode automatically.

---

## Troubleshooting

**`.env.test` values not loading?**
Confirm `playwright.config.ts` has the `dotenv.config(...)` call at the top:

```ts
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env.test') });
```

**Module not found: `dotenv`?** `npm install -D dotenv`.

**Tests hit a real server instead of using Playwright's webServer?**
Another process is on the configured port — `reuseExistingServer: !CI` picks
it up. Stop the other process or change ports in `.env.test`.

**Dev server crashes under parallel load (`Target page, context or browser has been closed`)?**
Known `next dev` / `vite` quirk. Either drop `workers: 1` on the affected
project, or build once (`npm run build`) and point `webServer.command` at the
prod `start` script. Document the choice in `HUNTER_NOTES.md` under
`## Known dev-mode quirks` so the skill classifies future flakes correctly.

**Every UI test is mount-only — why?**
Components scored Red (< 0.30 readiness). Open `e2e/BUG_REPORT.md` — the
classification section lists specific testids / aria-labels / htmlFors to add.
Applying them and re-running the hunter re-scores the components upward.

**Test DB filled with `HUNT*` rows?**
Tests clean up with `DELETE` at end of each run, but some APIs soft-delete
(rows still in table with `deleted_at` set, just hidden from default lists).
Periodic hard-delete:

```sql
DELETE FROM service_requests WHERE service_description LIKE 'HUNT%' OR service_description LIKE 'E2E-HUNTER%';
```

**Skill doesn't auto-trigger on my phrase?**
Check `CLAUDE.md` — the "Available Skills" block must reference the skill
file path exactly. Or invoke manually: "read .claude/skills/e2e-hunter/SKILL.md and follow it".
