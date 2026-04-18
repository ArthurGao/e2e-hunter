# e2e-hunter

A Claude Code skill that **hunts bugs** by auto-generating and running
comprehensive E2E tests for any full-stack project using Playwright.
Framework-agnostic — works with any frontend and backend.

## Trigger phrases

In Claude Code, say any of these:

- "Hunt for bugs in this project"
- "Run e2e-hunter"
- "Scan test scenarios"
- "Generate Playwright tests"
- "Find bugs automatically"
- "Set up E2E testing"

## Supported stacks

| Frontend | Backend |
|----------|---------|
| Next.js (App Router + Pages Router) | NestJS |
| React + React Router | Express / Koa / Fastify |
| Vue 3 + Vue Router | FastAPI (Python) |
| Nuxt 3 | Django / DRF (Python) |
| SvelteKit | Ruby on Rails |
| Angular | Go (Gin / Echo / Chi / Fiber) |
| Any app with an OpenAPI spec | Spring Boot (Java / Kotlin) |
| | Laravel (PHP) |

Auth: JWT, Session/Cookie, OAuth/SSO bypass, API Key.

---

## Configuring e2e-hunter in a project

The skill is **project-agnostic**. You configure it for each project via a
single `.env.test` file — nothing in the skill itself changes.

### Step 1 — Install the skill

Drop the skill folder into your project (or symlink it from a shared location):

```bash
mkdir -p .claude/skills
# Option A: copy
cp -r /path/to/e2e-hunter .claude/skills/
# Option B: unzip a release
unzip e2e-hunter.zip -d .claude/skills/
# Option C: symlink (recommended — one copy, shared across projects)
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
`dotenv.config({ path: path.resolve(__dirname, '.env.test') })`, so it works
regardless of where Playwright is invoked from.

Adjust the `webServer` blocks and `projects` array to match your app(s) —
ports, start commands, and which test folders map to which project.

### Step 4 — Create `.env.test` at project root

```bash
cp .claude/skills/e2e-hunter/templates/.env.test.example .env.test
```

Fill in real values. `.env.test` is the **only project-specific configuration**
the skill needs:

```bash
# Single-app
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001
TEST_EMAIL=test@example.com
TEST_PASSWORD=your-test-password

# Multi-app (any number of apps — list them in APPS, then define per-app keys)
# APPS=admin,agency,candidate
#
# APP_ADMIN_URL=http://localhost:3001
# APP_ADMIN_EMAIL=admin@test.com
# APP_ADMIN_PASSWORD=admin-password
# APP_ADMIN_AUTH=true
#
# APP_AGENCY_URL=http://localhost:3002
# APP_AGENCY_EMAIL=agency@test.com
# APP_AGENCY_PASSWORD=agency-password
# APP_AGENCY_AUTH=true
#
# APP_CANDIDATE_URL=http://localhost:3003
# APP_CANDIDATE_EMAIL=candidate@test.com
# APP_CANDIDATE_PASSWORD=candidate-password
# APP_CANDIDATE_AUTH=true
```

**How it scales:** The fixture (`multi-app.fixture.ts`) and auth setup
(`auth.setup.ts`) both iterate over the `APPS` list at runtime — add or remove
a name in `APPS` and its matching `APP_<NAME>_*` keys, and everything works.
No code changes needed.

**In tests:**

```ts
import { test, expect } from './fixtures/multi-app.fixture';

test('candidate uploads doc, admin sees it', async ({ apps }) => {
  await apps.candidate.page.goto('/documents');
  // ...
  await apps.admin.page.goto('/candidates/123');
  await expect(apps.admin.page.getByText('...')).toBeVisible();
});
```

### Step 5 — Gitignore `.env.test`

```bash
echo ".env.test" >> .gitignore
```

Never commit real credentials. Commit `.env.test.example` instead as a template
for teammates.

### Step 6 — Install Playwright dependencies

```bash
npm install -D @playwright/test dotenv
npx playwright install chromium
```

### Step 6b — (optional) Write project notes

Drop an `e2e/HUNTER_NOTES.md` to steer the skill — what to ignore, what to
focus on, fix-loop constraints, known dev-mode quirks to not classify as bugs,
and questions the skill should ask before generating. Template:

```bash
cp .claude/skills/e2e-hunter/templates/HUNTER_NOTES.md.example e2e/HUNTER_NOTES.md
# then edit e2e/HUNTER_NOTES.md
```

Structure:

```markdown
## Scope                # Phase 1 + 2 — areas to exclude
## Focus                # Phase 2 + 4 — areas to cover more deeply
## Constraints          # Phase 7 — fix-loop rules ("do not touch X")
## Known dev-mode quirks # Phase 6 — classify as KNOWN_QUIRK not a bug
## Ask user before generating  # (optional) — stops before Phase 4 to ask
```

Precedence: chat instructions > `HUNTER_NOTES.md` > skill defaults.

### Step 7 — Trigger the skill

In Claude Code, say:

> Hunt for bugs in this project

The skill will detect your stack, build a Scenario Matrix, wait for your
approval, generate tests, run them, and produce a classified bug report.

---

## Per-project configuration summary

Everything that varies between projects lives in **two places**:

| File | Purpose |
|------|---------|
| `.env.test` (project root) | URLs, credentials, test secrets |
| `playwright.config.ts` (project root) | `webServer` commands, ports, projects |

The skill itself (`.claude/skills/e2e-hunter/`) stays untouched and reusable
across projects.

---

## How it works — 7 phases

| Phase | What happens |
|-------|-------------|
| 0 | Detect tech stack (language, framework, port, auth, start command) |
| 1 | Scan all routes, endpoints, auth boundaries, cross-app signals |
| 2 | Build Scenario Matrix → **wait for your approval** |
| 3 | Playwright setup (config, auth, file structure) |
| 4 | Generate test files (page, API, cross-app) |
| 5 | Run headless → headed per failure |
| 6 | Bug Report (classified by type + stack layer) |
| 7 | Fix-and-retest loop (max 5 rounds, regression detection) |

## Manual prompt sequence

If you prefer driving the skill manually, paste from `prompts/` in order:

1. `05-multi-app-context.md` — optional, multi-app with no docs only
2. `01-discover.md` — detect + matrix (stops for approval)
3. `02-generate.md` — generate files (stops for confirmation)
4. `03-run-and-report.md` — run + bug report
5. `04-fix-loop.md` — fix loop until clean

## Files included

```
e2e-hunter/
├── SKILL.md                         # 7-phase methodology
├── README.md
├── prompts/
│   ├── 01-discover.md               # Phase 0+1+2
│   ├── 02-generate.md               # Phase 3+4
│   ├── 03-run-and-report.md         # Phase 5+6
│   ├── 04-fix-loop.md               # Phase 7
│   └── 05-multi-app-context.md      # Optional seed
└── templates/
    ├── playwright.config.ts         # Auto-loads .env.test via dotenv
    ├── auth.setup.ts
    ├── multi-app.fixture.ts
    ├── wait-for-sync.ts
    ├── page.spec.ts.template
    ├── api.spec.ts.template
    ├── cross-app.spec.ts.template
    └── .env.test.example            # Copy to project root as .env.test
```

## Troubleshooting

**`.env.test` values not loading?**
Confirm your `playwright.config.ts` has the `dotenv.config(...)` call at the
top (the template includes it). If you copied an older template, add:

```ts
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env.test') });
```

**Module not found: `dotenv`?**
`npm install -D dotenv`.

**Tests hit a real server instead of failing?**
Another process is listening on the configured port — `reuseExistingServer`
will pick it up. Stop the other process or change ports in `.env.test`.
