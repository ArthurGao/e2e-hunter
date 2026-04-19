---
name: e2e-hunter
description: >
  Use this skill to hunt bugs by generating and running comprehensive E2E tests
  for any full-stack project using Playwright with Chrome. Trigger with phrases
  like "hunt for bugs", "run e2e-hunter", "scan test scenarios", "generate
  Playwright tests", "find bugs automatically", or "set up E2E testing".
  Supports any frontend (Next.js, React, Vue, Nuxt, Angular, SvelteKit) and any
  backend (NestJS, Express, Fastify, Django, FastAPI, Rails, Laravel, Go,
  Spring Boot). Works for single-app and multi-app monorepos with cross-app
  interactions. Follow phases in order — never skip Phase 0 (tech stack
  detection) or the Phase 2 approval step.
---

# E2E Hunter — Universal Full-Stack Bug Hunting Skill

Framework-agnostic Playwright E2E testing for any full-stack project.

---

## Core principle — detect over force

When a UI surface is test-hostile (no `data-testid`, no `aria-label`, no
`htmlFor` associations, dynamic portals, unstable copy), the skill's first
job is to **surface that fact with evidence and specific improvement
actions** — NOT to generate brittle tests that pass once and break on the
next refactor.

For every component in Phase 1, score its test-readiness (see Phase 1F).
Components below a threshold get smoke-only tests plus a concrete list of
project-side changes that would unlock deeper coverage. Don't grind on
heuristic selectors where stable handles are simply absent.

---

## Pre-flight — Read Project Notes (ALWAYS do this before Phase 0)

Before any scanning or planning, check for `e2e/HUNTER_NOTES.md` at the
project root. If present, read it and carry the content as context through
every subsequent phase.

```bash
# Read if exists; skip silently if not
test -f e2e/HUNTER_NOTES.md && cat e2e/HUNTER_NOTES.md
```

Parse the four standard sections (all optional):

| Section | Applied in | Behavior |
|---------|-----------|----------|
| `## Scope` | Phase 1 + 2 | Exclude listed areas from scanning and the matrix |
| `## Focus` | Phase 2 + 4 | Boost coverage: more scenarios per focus item; mark as P0 |
| `## Constraints` | Phase 7 | Respect DNT paths, LOC caps, and "never modify X" rules in the fix loop |
| `## Known dev-mode quirks` | Phase 6 | Classify matching failures as `KNOWN_QUIRK` rather than a bug |
| `## Ask user before generating` (optional) | Before Phase 4 | Stop and ask each listed question before writing test files |

### Precedence

1. **User's chat instructions in the current session** — highest priority.
2. **`HUNTER_NOTES.md`** — project defaults.
3. **Skill defaults** — fallback.

When a chat instruction conflicts with the file, the chat wins for this
run. At the end of the session, offer to update `HUNTER_NOTES.md` to
reflect the new preference.

### When `HUNTER_NOTES.md` does not exist

Proceed with skill defaults and, at the end of Phase 2, suggest creating
one if the project has recurring preferences worth persisting (e.g.
"you keep asking me to skip auth — want me to write that into
`e2e/HUNTER_NOTES.md`?").

A template lives at `.claude/skills/e2e-hunter/templates/HUNTER_NOTES.md.example`.

---

## Pre-flight — Infrastructure scan (ALWAYS do this before Phase 0)

Detect project-level conditions that force test strategy decisions. Results
become warnings or constraints carried through every later phase.

### Dev server behavior

```bash
# Hot-reload dev server?
grep -rE '"dev":\s*"(next dev|vite|nuxi dev|ng serve|webpack-dev-server)' \
  --include=package.json . 2>/dev/null | grep -v node_modules
```

If present, warn: running many UI tests in parallel may overload the compiler.
Default recommendation: `--workers=1` for UI project runs.

### Conditional base paths or host-based routing

```bash
# Next.js / React — basePath or assetPrefix gated on NODE_ENV
grep -rnE 'basePath|assetPrefix' --include='next.config.*' \
  --include='vite.config.*' . 2>/dev/null | grep -v node_modules

# Nuxt / Angular / SvelteKit equivalents
grep -rnE 'app\.baseURL|appDir|paths\.base|PUBLIC_BASE_PATH' \
  --include='nuxt.config.*' --include='angular.json' \
  --include='svelte.config.*' . 2>/dev/null | grep -v node_modules
```

If a base path is conditional on env (`NODE_ENV`, `DEPLOY_TARGET`, etc.),
warn: running tests against a production build may require path rewrites.
Record the prod-mode base path in the Tech Stack Map.

### Test data / seed scripts

```bash
# JS ecosystem
grep -rE '"(seed|db:seed|migrate:seed|fixtures|e2e:seed)"' \
  --include=package.json . 2>/dev/null | grep -v node_modules

# Other ecosystems
find . -maxdepth 3 \( -name 'seed*.{py,rb,go,sh,sql}' -o -name 'fixtures*' \
  -o -name 'factories*' \) 2>/dev/null | grep -v node_modules
```

If a seed script exists, suggest running it before Phase 5. If none exists,
warn that tests depending on listed entities will skip on a cold DB.

### Docker compose / service graph

```bash
ls -1 docker-compose*.y*ml compose*.y*ml 2>/dev/null
```

If present, note which services the tests need up (typical: db, cache,
message broker). Skipping these causes silent 500s downstream.

### Record findings in the Tech Stack Map under "Infrastructure notes":

```markdown
| Condition | Impact | Recommendation |
|-----------|--------|----------------|
| `next dev` hot reload | UI parallelism unsafe | `--workers=1` for UI project |
| `basePath` gated on NODE_ENV | Prod-build tests need path rewrite | Stick to dev for UI tests OR rewrite URLs |
| `npm run seed` present | Some tests depend on seeded data | Run seed before Phase 5 |
```

---

## Phase 0.5 — PR-mode diff scope (opt-in, language-agnostic)

When `E2E_HUNTER_DIFF_BASE` is set OR the user says "PR mode" / "scan my
PR" / "scan the diff", restrict ALL Phase 1 scans to files that changed
relative to the base branch. Dramatically faster and produces tests that
match the scope of the PR under review.

```bash
# 1. Resolve base branch
BASE="${E2E_HUNTER_DIFF_BASE:-main}"
# Fall back gracefully if the named base doesn't exist
git rev-parse --verify "$BASE" >/dev/null 2>&1 \
  || BASE="$(git rev-parse --abbrev-ref --verify @{upstream} 2>/dev/null || echo main)"

# 2. List changed + new files (added, copied, modified, renamed)
CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR "${BASE}...HEAD")

# 3. Keep only files any of the existing Phase 1 greps would scan
SOURCE_EXT='\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|kt|php|vue|svelte)$'
RELEVANT_FILES=$(echo "$CHANGED_FILES" | grep -E "$SOURCE_EXT" || true)

# 4. Also pull in direct importers of changed files (one grep per language).
#    Covers "service method changed, controllers still need regression tests."
IMPORTERS=""
for f in $RELEVANT_FILES; do
  basename=$(basename "$f" | sed 's/\.[^.]*$//')
  # TS/JS: import ... from '.../basename'
  # Python: from ... import basename / import basename
  # Java:   import <pkg>.basename; (name-only match is a superset — ok for filtering)
  # Ruby:   require 'basename' / require_relative 'basename'
  # Go:     import path segment
  IMPORTERS+=$(grep -rlE "\\b${basename}\\b" --include="*.ts" --include="*.tsx" \
    --include="*.js" --include="*.py" --include="*.rb" --include="*.go" \
    --include="*.java" --include="*.kt" 2>/dev/null \
    | grep -v node_modules | grep -v venv || true)
  IMPORTERS+=$'\n'
done

# 5. Deduplicated scope — Phase 1 scans restrict to this list
SCOPE=$(printf '%s\n%s\n' "$RELEVANT_FILES" "$IMPORTERS" | sort -u | grep -v '^$')
```

How Phase 1 uses the scope:

- **1A frontend routes** — intersect with `SCOPE`; only changed pages become matrix rows
- **1B backend endpoints** — grep on the intersection; only changed controllers emit rows
- **1D UI components** — only components in `SCOPE` get readiness-scored / conditional-scanned
- **1G side-effect sinks** — detect sinks in changed service files; pair with their mutations
- **1H cascades** — rescan ORM relationships only for entities that changed
- **1I/1J/1K/1L/1M** — same pattern: restrict greps to `SCOPE`

Matrix rows produced in PR mode are **labeled with `[PR]`** so humans can
distinguish "tests added because of this PR" from "tests that already existed."

**Zero language-specific code** — step 1 uses git, step 2 is a regex on file
paths. Works identically on TypeScript, Java, Python, JavaScript, Go, Ruby,
PHP, or any future language the skill supports.

### Fallback behavior

- `E2E_HUNTER_DIFF_BASE` unset and user didn't mention PR → full scan (current
  default).
- `CHANGED_FILES` empty (branch matches base) → skip generation, print
  "no files changed vs ${BASE} — nothing to test."
- `SCOPE` is non-empty but maps to zero endpoints/components → emit "changed
  files touch no testable surface (e.g., only config/docs)" and stop.

---

## Phase 0 — Detect Tech Stack (ALWAYS run this first)

Before any scanning, identify exactly what is in the repo.
This phase determines which scanning commands to use in Phase 1.

```bash
# 1. Find all apps / packages
find . -name "package.json" -not -path "*/node_modules/*" -maxdepth 4 \
  | xargs grep -l '"scripts"' 2>/dev/null

# Also check for non-JS projects
find . -name "requirements.txt" -o -name "Pipfile" -o -name "pyproject.toml" \
  -o -name "Gemfile" -o -name "go.mod" -o -name "pom.xml" -o -name "build.gradle" \
  -o -name "Cargo.toml" \
  | grep -v node_modules | grep -v ".git"

# 2. Per JS app: detect frontend framework
cat <app>/package.json | grep -E '"next"|"nuxt"|"@angular/core"|"svelte"|"@sveltejs/kit"|"vue"|"react"'

# 3. Per JS app: detect backend framework
cat <app>/package.json | grep -E '"@nestjs/core"|"express"|"fastify"|"koa"|"hapi"|"@hapi/hapi"'

# 4. Detect non-JS backend language
# Python:  grep -rn "flask\|fastapi\|django" requirements.txt Pipfile pyproject.toml 2>/dev/null
# Ruby:    cat Gemfile | grep -E "rails|sinatra"
# Go:      cat go.mod | grep -E "gin|echo|fiber|chi"
# Java:    cat pom.xml build.gradle | grep -E "spring-boot|quarkus|micronaut"
# PHP:     cat composer.json | grep -E "laravel|symfony|slim"
# Rust:    cat Cargo.toml | grep -E "actix|axum|rocket|warp"
```

After detection, build a **Tech Stack Map**:

```markdown
| App | Directory | Language | Framework | Router Type | Port | Auth Method | Start Command |
|-----|-----------|----------|-----------|-------------|------|-------------|---------------|
| frontend | apps/web | TypeScript | Next.js 14 | App Router | 3000 | JWT | npm run dev |
| backend | apps/api | TypeScript | NestJS | REST | 3001 | JWT | npm run start:dev |
```

**Use the Tech Stack Map to select the correct scanning strategy in Phase 1.**

---

## Phase 1 — Route & Endpoint Discovery

Use the correct strategy per detected framework.

### 1A — Frontend Route Scanning

#### Next.js App Router
```bash
find . -path "*/app/**/page.tsx" -o -path "*/app/**/page.jsx" \
  -o -path "*/app/**/page.ts" -o -path "*/app/**/page.js" \
  | grep -v node_modules | sort
```

#### Next.js Pages Router
```bash
find ./pages ./src/pages -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \
  2>/dev/null | grep -v node_modules | grep -v "_app\|_document\|api/" | sort
```

#### React (React Router v6)
```bash
grep -rn "createBrowserRouter\|<Routes\|<Route " --include="*.tsx" --include="*.jsx" \
  --include="*.ts" --include="*.js" . | grep -v node_modules
grep -rn 'path="' --include="*.tsx" --include="*.jsx" . | grep -v node_modules
```

#### Vue / Nuxt 3
```bash
# Nuxt: file-based routing
find . -path "*/pages/**/*.vue" | grep -v node_modules | sort

# Vue Router: find router config
find . -name "router.ts" -o -name "router.js" \
  | xargs grep -l "createRouter\|createWebHistory" 2>/dev/null | grep -v node_modules
grep -rn "path:" --include="*.ts" --include="*.js" . \
  | grep -v node_modules | grep -E "createRouter|routes"
```

#### SvelteKit
```bash
find . -path "*/routes/**" \( -name "+page.svelte" -o -name "+page.server.ts" \) \
  | grep -v node_modules | sort
```

#### Angular
```bash
grep -rn "path:" --include="*.ts" . | grep -v node_modules \
  | grep -E "Routes|RouterModule|loadComponent|loadChildren"
```

#### Generic fallback (any framework)
```bash
find . \( -name "*router*" -o -name "*routes*" -o -name "*routing*" \) \
  \( -name "*.ts" -o -name "*.js" -o -name "*.json" \) \
  | grep -v node_modules | grep -v ".spec." | head -20
```

---

### 1B — Backend Endpoint Scanning

#### NestJS
```bash
grep -rn "@Get\|@Post\|@Put\|@Delete\|@Patch\|@Controller" \
  --include="*.ts" . | grep -v node_modules | grep -v ".spec.ts"
```

#### Express / Koa / Fastify (Node.js)
```bash
grep -rn "router\.\(get\|post\|put\|delete\|patch\)\|app\.\(get\|post\|put\|delete\|patch\)" \
  --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v ".spec."

grep -rn "fastify\.route\|\.register\(" --include="*.ts" --include="*.js" . \
  | grep -v node_modules
```

#### Django / Django REST Framework (Python)
```bash
find . -name "urls.py" | grep -v node_modules | xargs grep -n "path\|re_path\|url" 2>/dev/null
grep -rn "class.*ViewSet\|class.*APIView\|@api_view" --include="*.py" . | grep -v node_modules
```

#### FastAPI (Python)
```bash
grep -rn "@app\.\(get\|post\|put\|delete\|patch\)\|@router\.\(get\|post\|put\|delete\|patch\)" \
  --include="*.py" . | grep -v node_modules
```

#### Ruby on Rails
```bash
cat config/routes.rb 2>/dev/null
grep -rn "get\|post\|put\|delete\|patch\|resources\|resource " config/routes.rb 2>/dev/null
```

#### Go (Gin / Echo / Chi / Fiber)
```bash
grep -rn '\.GET\|\.POST\|\.PUT\|\.DELETE\|\.PATCH\|\.Handle\|\.Any' \
  --include="*.go" . | grep -v "_test.go"
grep -rn 'r\.GET\|e\.GET\|app\.Get\|router\.Get' --include="*.go" . | grep -v "_test.go"
```

#### Spring Boot (Java / Kotlin)
```bash
grep -rn "@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping\|@PatchMapping\|@RequestMapping" \
  --include="*.java" --include="*.kt" . | grep -v "src/test"
```

#### Laravel (PHP)
```bash
cat routes/api.php routes/web.php 2>/dev/null
grep -rn "Route::get\|Route::post\|Route::put\|Route::delete\|Route::patch\|Route::resource" \
  routes/ 2>/dev/null
```

#### Generic fallback — OpenAPI / Swagger spec
```bash
find . -name "openapi.json" -o -name "openapi.yaml" -o -name "swagger.json" \
  -o -name "swagger.yaml" | grep -v node_modules

# Parse openapi.json if found
cat openapi.json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
for path, methods in d.get('paths', {}).items():
    for method in methods:
        if method in ['get','post','put','delete','patch']:
            print(method.upper(), path)
" 2>/dev/null
```

---

### 1C — Auth Boundary Detection (all stacks)

```bash
# JS/TS
grep -rn "middleware\|guard\|auth\|protected\|requiresAuth\|isAuthenticated\|withAuth\|useAuth" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . \
  | grep -v node_modules | grep -v ".spec." | head -30

# Python
grep -rn "login_required\|permission_classes\|IsAuthenticated\|@requires_auth\|Depends.*auth" \
  --include="*.py" . | head -20

# Ruby
grep -rn "before_action.*authenticate\|before_filter.*require_login\|authenticate_user!" \
  --include="*.rb" . | head -20

# Go
grep -rn "middleware.*auth\|jwt\|bearer\|AuthMiddleware" --include="*.go" . | head -20

# Java
grep -rn "@PreAuthorize\|@Secured\|SecurityConfig\|antMatchers\|requestMatchers" \
  --include="*.java" --include="*.kt" . | head -20
```

---

### 1D — UI Component Enumeration (dialogs, modals, wizards, drawers)

Pages contain interactive surfaces — Dialog, Modal, Wizard, Drawer, Sheet,
Popover — that may have multiple conditional variants depending on props,
permissions, or domain state. They're NOT discovered by the route scan
in 1A. Enumerate them so they get their own scenarios in the matrix.

#### File-name scan (all frameworks)

```bash
# Component files by name
find . \( -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  | grep -iE "(dialog|modal|wizard|drawer|sheet|popover|stepper|overlay)" \
  | sort
```

#### Usage scan (catches inline dialogs + named variants)

```bash
# React + shadcn/ui + Radix + MUI + Ant
grep -rn "<Dialog\|<Modal\|<Drawer\|<Sheet\|<Wizard\|<Stepper\|<Popover\|<AlertDialog" \
  --include="*.tsx" --include="*.jsx" . | grep -v node_modules | head -40

# Vue / Nuxt
grep -rn "<v-dialog\|<a-modal\|<el-dialog\|<n-modal" --include="*.vue" . \
  | grep -v node_modules | head -20

# Angular Material / PrimeNG
grep -rn "MatDialog\|MatBottomSheet\|DialogService\|mat-dialog\|p-dialog\|p-sidebar" \
  --include="*.ts" --include="*.html" . | grep -v node_modules | head -20
```

#### Variant detection (the important part)

A single dialog file often renders different UI depending on props/state. Find
conditional branches that gate **visible content, tabs, form fields, or upload
slots** — each distinct branch is a test variant.

```bash
# Conditional rendering patterns inside dialog files
# Run this per dialog file to see what varies:
grep -nE "(if|&&|\?\s*\()\s*(is|has|requires|show|mode|type|variant|kind)" \
  path/to/Dialog.tsx
```

Common variant axes to capture:

- **Form-only vs file-upload vs hybrid** — driven by flags like `requiresFileUpload`, `hasFormFields`, `formTemplate`
- **Single-file vs multi-file** — driven by `isMultiple` / `maxFileCount`
- **Create vs edit** — same dialog, pre-filled data when editing
- **Permission / role gating** — different buttons for admin vs regular user
- **Status-locked** — dialog read-only when entity is submitted/approved
- **Step count** — wizards with 3 steps vs 7 steps

Record findings in the Tech Stack Map as a new sub-table:

```markdown
| Component File | App | Variants detected | Action |
|----------------|-----|-------------------|--------|
| UploadModal.tsx | candidate | file-only, form-only, hybrid, template | test each variant independently |
| DocDefDialog.tsx | admin | create, edit, history | test each mode |
```

**Rule:** every detected variant produces at least one test scenario in 2C.

---

### 1E — Test-Readiness Scan (score each UI component)

For every component found in 1D, compute a readiness score. This score
decides how aggressive Phase 4 can be for that component, and produces
concrete project-side improvement actions in Phase 2.

#### Per-component metric (bash)

```bash
# For a given component file, count stable test handles:
file=path/to/Component.tsx

stable_handles=$(grep -cE 'data-testid=|data-cy=|aria-label=|aria-labelledby=' "$file")
label_associations=$(grep -cE '<label[^>]*htmlFor=|<Label[^>]*htmlFor=' "$file")
role_annotations=$(grep -cE 'role="(dialog|button|textbox|combobox|tab|heading)"' "$file")

# Count interactive targets (buttons, inputs, selects, textareas, tabs):
interactive_total=$(grep -cE '<(Input|Button|Textarea|Select|Tab|Checkbox|Switch|RadioGroup|button|input|textarea|select)' "$file")
```

#### Score formula

```
coverage = (stable_handles + label_associations + role_annotations) / interactive_total
```

#### Score bands

| Band | Coverage | Deep interaction tests viable? | Generation strategy |
|------|----------|-------------------------------|---------------------|
| 🟢 Green | ≥ 0.80 | Yes | Full matrix coverage. Selectors use `getByRole`/`getByLabel`/`getByTestId` with confidence. |
| 🟡 Amber | 0.30 – 0.80 | Partial | Smoke + happy-path only. Heuristic selectors, `.catch(() => skip)` on interaction-gated assertions. |
| 🔴 Red | < 0.30 | No | Mount-level tests only (render without error, open without crashing). Primary output is the improvement-actions list. |

#### Improvement-actions list (generic)

For every Red or Amber component, include in Phase 2 output:

```markdown
**<Component X>** — score: 12% (Red) — 2 of 17 interactive elements have stable handles

Recommended project-side changes:
- Add `data-testid="<semantic-name>"` to: Submit, Cancel, Next, Back buttons
- Add `htmlFor=` on the 6 label/input pairs at lines N, M, ...
- Surface step headings as `<h2>` or `role="heading"`
- If using shadcn `<Select>`, pass `id=` to `<SelectTrigger>` so `<label htmlFor>` associates

Estimated readiness after changes: 85% (Green) — unlocks ~N deep tests.
```

Keep the recommendations **framework-agnostic** — `data-testid`, `aria-*`, and
`<label for>` work everywhere. Avoid project-specific advice.

---

### 1E.2 — Conditional-Render Scan (state-driven UI branches)

Test-readiness scoring tells you IF a component is testable; this step tells
you WHAT states need fixtures to exercise the component. Dialogs that render
different branches based on entity status (locked badge, completion banner,
"already approved" warning) are invisible to API tests — the API returns
`status: "approved"`, but did the UI actually show the lock icon?

Run per UI component found in 1D:

```bash
# Entity-status-driven branches
grep -nE '\{[a-zA-Z_]+\.(status|state|type|kind|role)\s*===?\s*["'"'"'][^"'"'"']+["'"'"']' <file>

# Boolean-flag-driven branches
grep -nE '(if|&&|\?)\s*\(?\s*[a-zA-Z_]+\.(locked|disabled|readonly|expired|archived|approved|rejected|completed)\b' <file>

# Prop-driven variants
grep -nE '(if|&&)\s*\(?\s*(mode|variant|kind|type)\s*===?' <file>

# Permission / role gates
grep -nE '(hasPermission|canAccess|isAdmin|userRole\s*===?)' <file>
```

Record each distinct branch with the state it depends on:

```
<component>.tsx:
  branch A — rendered when entity.status === 'approved'  (expect: <Badge>Approved</Badge>, upload disabled)
  branch B — rendered when entity.status === 'rejected'  (expect: rejection reason visible, re-upload button)
  branch C — rendered when entity.locked === true        (expect: lock icon, submit disabled)
```

Each distinct branch = one **state-fixture test** in the Phase 2 matrix:

| Test row | Setup (API) | Render (UI) | Assert |
|---|---|---|---|
| Component X with entity in state A | `POST /resource` + `PATCH /:id/status → A` | Load page, open component | Branch A visible, Branch B hidden |
| Component X with entity in state B | setup as above with status B | Load page, open component | Branch B visible, Branch A hidden |

These rows go into the matrix labeled `Test Layer: STATE-FIXTURE` so Phase 4
generates setup-via-API + render-in-browser + branch-assertion tests rather
than generic happy-path tests that pick whichever state happens to be seeded.

**When skipping is OK:** if a component scored Red in 1E, state-fixture tests
are also Red — note the branches but don't generate tests until readiness
rises.

---

### 1G — Side-Effect Sink Scan (audit logs, emails, webhooks, queued jobs)

Many bugs hide in side effects that are invisible from HTTP responses — the
mutation returns 200, but no audit row was written, no email was sent, no
webhook fired. Detect these sinks and pair each mutation with a probe.

**Scan for sinks (per language):**

```bash
# Audit / activity logs (JS/TS)
grep -rn "AuditLogService\.\|auditLog\.\|activityLog\.\|logger\.audit" \
  --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v spec

# Email sending
grep -rn "emailService\.send\|mailer\.send\|sendgrid\|postmark\|ses\.send\|@InjectQueue.*mail\|nodemailer" \
  --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v spec

# Event emitters / message queues
grep -rn "@OnEvent\|eventEmitter\.emit\|@EventHandler\|@Subscribe\|kafka.*publish\|rabbitmq.*publish\|sqs.*send" \
  --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v spec

# Outgoing webhooks
grep -rn "webhook\.post\|axios\.post.*webhook\|fetch.*webhook" \
  --include="*.ts" --include="*.js" . | grep -v node_modules | grep -v spec

# Python
grep -rn "celery\.\|\.delay(\|tasks\.send_task\|signals\.\|post_save\|django.*signals\|audit_log" \
  --include="*.py" . | grep -v venv

# Ruby
grep -rn "ActiveJob\|sidekiq\|perform_later\|after_commit\|audit.*log\|ActionMailer" \
  --include="*.rb" . | grep -v vendor

# Go
grep -rn "nats\.Publish\|kafka\.Writer\|ch\s*<-\|log\.Audit" --include="*.go" . | grep -v vendor
```

**For each detected sink, emit into the matrix:**

| Mutation | Sink | Oracle |
|---|---|---|
| `POST /candidates/signup` | `email_log` table | After signup, `SELECT count(*) FROM email_log WHERE recipient = ... AND template = 'welcome'` increments by 1 |
| `PATCH /service-requests/:id/status` | `audit_log` table | After status change, audit log has a row with `action=STATUS_CHANGE`, correct `entity_id` |
| `DELETE /candidates/:id` | `activity_events` | Deletion produces an `activity_events` row with `type=candidate_deleted` |
| `POST /notifications/broadcast` | outbound webhook | Webhook endpoint sees a POST with `event=broadcast.sent` within 5s |

**How the oracle is implemented:**

For DB-sink oracles, the test either:
1. Calls a `/audit-logs` or `/events` list endpoint (if exposed) to verify count delta, OR
2. Uses a direct DB probe via a test-only helper (requires `TEST_DB_URL` in `.env.test`).

For webhook/queue sinks, use a mock receiver (ngrok-style local listener, or
set `WEBHOOK_URL` to a test endpoint the test spec owns).

**What NOT to probe:** logger.info(), console.log(), metrics.increment — these
are observability, not side effects that need correctness verification.

---

### 1H — Relationship & Cascade Scan (ORM-aware)

After DELETE parent, what happens to children? After DELETE user, what about
their documents, messages, assignments? Skill reads ORM metadata and generates
cascade probes automatically.

**Scan ORM relationships:**

```bash
# TypeORM (NestJS / Express)
grep -rn "@ManyToOne\|@OneToMany\|@ManyToMany\|@OneToOne" \
  --include="*.entity.ts" . | grep -v node_modules

# Prisma
find . -name "schema.prisma" -not -path "*/node_modules/*" \
  | xargs grep -n "@relation\|references:" 2>/dev/null

# Sequelize
grep -rn "belongsTo\|hasMany\|hasOne\|belongsToMany" \
  --include="*.ts" --include="*.js" . | grep -v node_modules

# Django ORM (Python)
grep -rn "ForeignKey\|OneToOneField\|ManyToManyField" \
  --include="*.py" . | grep -v venv

# ActiveRecord (Ruby)
grep -rn "belongs_to\|has_many\|has_one" \
  --include="*.rb" . | grep -v vendor

# GORM (Go)
grep -rn "gorm:\"foreignKey\|gorm:\"references" --include="*.go" . | grep -v vendor

# JPA (Java/Kotlin)
grep -rn "@OneToMany\|@ManyToOne\|@ManyToMany\|@OneToOne" \
  --include="*.java" --include="*.kt" . | grep -v "src/test"
```

**Build a relationship map:**

```
parent: ServiceRequest
  ↓ @OneToMany(documents)        → child: Document (srId FK)
  ↓ @OneToMany(assignments)      → child: ServiceRequestAssignment
  ↓ @ManyToOne(candidate)        → candidate: Candidate

parent: Candidate
  ↓ @OneToMany(serviceRequests)  → child: ServiceRequest (candidateId FK)
  ↓ @OneToMany(documents)        → child: Document
```

**For each parent→child relationship, emit into matrix:**

| Action | Cascade probe |
|---|---|
| `DELETE /parent/:id` | After delete, child endpoint returns 404 OR `child.parentId === null` OR child is also soft-deleted |
| `DELETE /parent/:id` with `cascade=false` | Returns 409 if children exist, or leaves children orphaned (verify DB state) |
| Archive parent (`archived=true`) | Children remain accessible (soft-archive shouldn't cascade by default) |

This catches the common bug class: soft-delete deletes parent, children still
appear in list endpoints, creating orphans.

---

### 1I — Authorization Boundary Scan (IDOR — OWASP Broken Access Control)

OWASP's #1 application-security risk. Every endpoint that scopes to a user,
tenant, or account ID is vulnerable if it doesn't verify the caller owns that
scope. Scan for user-scoped route params and auto-generate cross-user probes.

**Scan for scoped route params:**

```bash
# Route definitions with user/tenant/account-scoped params
grep -rnE '(\/:[a-zA-Z_]*(user|tenant|account|candidate|owner|member)Id|<[a-zA-Z_]*(user|tenant|account|candidate)Id>)' \
  --include="*.ts" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
  | grep -v node_modules | grep -v spec

# Entity ownership fields (things that define "whose resource is this")
grep -rnE '(userId|ownerId|tenantId|accountId|candidateId|createdBy)(\s*:\s*|\s*=)' \
  --include="*.entity.ts" --include="*.model.ts" --include="*.py" . \
  | grep -v node_modules | head -40
```

**For each scoped endpoint, emit AUTHZ matrix rows:**

| Action | Probe | Expected |
|---|---|---|
| GET `/users/:id/resource` | as user A, request user B's resource | 403 or 404 (never 200 + B's data) |
| PATCH `/users/:id/resource` | as user A, mutate user B's resource | 403 or 404, B's data unchanged |
| DELETE `/users/:id/resource` | as user A, delete user B's resource | 403 or 404, B's resource still exists |
| POST `/resource` with `ownerId: B` as user A | create-on-behalf-of | 403 or silently rewrite ownerId=A |
| Same-role tenant isolation | as tenant-A user, query tenant-B's list | empty results or 403 |

Requires two actor contexts in `.env.test` (user A + user B of same role).
Reuses `multi-actor.fixture.ts` with same-role numbering.

**What NOT to probe:** endpoints that are explicitly documented as public
read (e.g., `/visa-types` catalog, `/health`). Detect via HUNTER_NOTES or
OpenAPI `security: []` declaration.

---

### 1J — File-Upload Surface Scan

Every multipart endpoint is a security + correctness minefield. Scan for
upload handlers and auto-generate 6 probes per endpoint.

**Scan:**

```bash
# Multer / express upload
grep -rn "multer\|upload\.single\|upload\.array\|FileInterceptor\|FilesInterceptor\|@UploadedFile\|@UploadedFiles" \
  --include="*.ts" --include="*.js" . | grep -v node_modules

# Python (FastAPI UploadFile, Django FILES)
grep -rn "UploadFile\|request\.FILES\|FileField\|InMemoryUploadedFile" \
  --include="*.py" . | grep -v venv

# Rails ActiveStorage
grep -rn "has_one_attached\|has_many_attached\|attach(" --include="*.rb" . | grep -v vendor

# Go
grep -rn "multipart\.\|FormFile\|multipart.File" --include="*.go" . | grep -v vendor
```

**For each detected endpoint, emit FILE-UPLOAD matrix rows:**

| Probe | Input | Expected |
|---|---|---|
| Oversized | file > max_size (detect from multer/FileInterceptor config) | 400/413 naming size limit |
| Zero-byte | empty file buffer | 400 or cleanly accepted per policy; never 500 |
| MIME spoof | rename `.exe` as `.pdf`; send PDF extension + EXE magic bytes | 400 (magic-byte check), not 200 |
| Path traversal filename | filename = `../../etc/passwd` | filename sanitized / 400; file not saved outside uploads dir |
| Zip bomb | 10KB zip that decompresses to 10GB | rejected without processing |
| No file supplied | multipart POST with no file part | 400 naming missing file |
| Wrong field name | file sent as `image` instead of `document` | 400 |

Helpers: the skill generates a `e2e/fixtures/files/` directory with
deterministic fixture files (tinyPdf, zeroByte, oversizedPdf, zipBomb,
spoofed). Framework-agnostic.

---

### 1K — Time / Timezone / Expiry Field Scan

Date fields drive compliance logic (expired visas, pre-dated docs, DST
rollovers). Scan DTO / entity decorators for date-typed fields and generate
boundary probes per field.

**Scan:**

```bash
# class-validator / TypeORM date fields
grep -rnE "@IsDate|@IsDateString|@Column\(.*['\"](date|datetime|timestamp)" \
  --include="*.ts" . | grep -v node_modules

# Field names suggesting validity windows
grep -rnE "(expir|issued|valid|start|end|effective|renewal)[A-Z][a-z]" \
  --include="*.ts" --include="*.py" --include="*.go" . | grep -v node_modules | grep -v spec

# Python — pydantic / Django
grep -rnE "datetime|date\s*=|DateField|DateTimeField" \
  --include="*.py" . | grep -v venv

# Rails
grep -rn "datetime\|date\|timestamp" db/schema.rb 2>/dev/null
```

**For each date field, emit TIME matrix rows:**

| Probe | Input | Expected |
|---|---|---|
| Past date on future-only field (e.g., `startDate`) | yesterday | 400 |
| Future date on past-only field (e.g., `issueDate`) | tomorrow | 400 |
| `expiryDate < issueDate` | inverted window | 400 |
| `expiryDate == issueDate` | zero window | 400 or accepted per policy |
| DST rollover date | local time that doesn't exist (spring-forward gap) | normalized, no crash |
| Leap day (Feb 29, 2024) | create on leap day, read back | round-trips exactly |
| ISO 8601 vs epoch ms | same date in both formats | both accepted or one 400 — consistent |
| TZ mismatch | `+12:00` sent, server in UTC | normalized correctly on read |
| Far-future (year 9999) | edge of DB timestamp range | accepted or 400 |

---

### 1L — PII / Secret Redaction Scan

Logs and API responses must never contain passwords, tokens, SSNs, or raw
PII. Scan sink call sites for accidental leakage.

**Scan:**

```bash
# Suspicious logging — full object dumps near auth
grep -rnE "(logger|log|console)\.(log|info|debug|warn|error)\s*\(.*(user|request|body|password|token|session)" \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" . \
  | grep -v node_modules | grep -v spec | head -20

# Response DTOs — check if sensitive fields are explicitly excluded
grep -rnE "@Exclude\|@Expose\|serialize|toJSON" \
  --include="*.ts" . | grep -v node_modules
```

**Emit PII-REDACTION matrix rows (one per sensitive resource):**

| Probe | Expected |
|---|---|
| GET `/users` or `/users/:id` response body | no `password`, `passwordHash`, `secret`, `apiKey`, raw `token` fields |
| Error response on invalid login | no echoed password in error message |
| Audit log entries (if exposed) | no raw tokens / passwords / SSNs |
| Webhook payload (if present) | no PII beyond what's declared in contract |

The existing `assertNoSecretsLeaked` helper in api.ts extends to this.

---

### 1M — Backwards-Compatibility Surface Scan

APIs evolve. A v2 field is added, a v1 field is deprecated — old clients
must keep working until a documented sunset date.

**Scan:**

```bash
# OpenAPI / JSDoc @deprecated
grep -rnE "@deprecated|\"deprecated\":\s*true" \
  --include="*.ts" --include="*.js" --include="*.yaml" --include="*.json" . \
  | grep -v node_modules

# Versioned route prefixes
grep -rnE "/v[0-9]+/|@Controller\(['\"]v[0-9]+" \
  --include="*.ts" --include="*.py" --include="*.go" . | grep -v node_modules
```

**For each detected deprecated field or versioned route, emit COMPAT rows:**

| Probe | Expected |
|---|---|
| POST with deprecated field populated | 200/201 (still accepted); response may show warning header |
| GET response includes deprecated field | still present until sunset date |
| Old `/v1/...` route still handles payload lacking v2-only fields | 200 with sensible defaults |
| Sunset-date check | if `Deprecation: <date>` header present, date is in the future |

---

### 1N — Webhook Delivery Surface Scan (extends 1G)

Outgoing webhooks are a specific side-effect class with stronger oracles:
signature verification, retry-on-5xx, at-least-once delivery.

Scan builds on 1G webhook detection. Emit WEBHOOK matrix rows:

| Probe | Expected |
|---|---|
| Webhook payload shape | matches documented schema exactly |
| Signature header present | valid HMAC of body using shared secret |
| Receiver returns 500 | sender retries with exponential backoff |
| Receiver returns 400 | sender does NOT retry (poison-pill protection) |
| Idempotency key present | same event id never delivered twice unless receiver 5xxs |

Requires a test-owned webhook receiver. Use `WEBHOOK_URL` from `.env.test`
pointing to a local listener (e.g., `http://localhost:4000/webhook-sink`).

---

### 1F — Cross-App Relationship Detection

```bash
# Shared env vars pointing to other apps
find . -name ".env*" -not -path "*/node_modules/*" \
  | xargs grep -rn "APP_.*URL\|API_URL\|SERVICE_URL\|NEXT_PUBLIC_" 2>/dev/null

# Event / message passing
grep -rn "emit\|publish\|subscribe\|EventEmitter\|BullQueue\|kafkaClient\|rabbitMQ\|celery\|sidekiq\|NATS\|webhook" \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
  | grep -v node_modules | grep -v "test\|spec" | head -20

# Shared database
find . -name ".env*" -not -path "*/node_modules/*" \
  | xargs grep -rn "DATABASE_URL\|DB_HOST\|MONGO_URI\|REDIS_URL" 2>/dev/null

# Direct HTTP calls between apps
grep -rn "fetch\|axios\|httpClient\|requests\.\|urllib\|RestTemplate\|WebClient\|http\.Get" \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
  | grep -v node_modules | grep -v "test\|spec" | head -20
```

---

## Phase 2 — Build Scenario Matrix

### 2A — Tech Stack Map (from Phase 0)

```markdown
| App | Directory | Language | Framework | Router | Port | Auth Method | Start Command |
|-----|-----------|----------|-----------|--------|------|-------------|---------------|
```

### 2B — App Inventory & Cross-App Relationships

```markdown
| App Name | Directory | Port | Type | Key Responsibility |
```

```markdown
| From App | To App | Mechanism | Evidence (file:line) | Direction |
```

### 2C — Scenario Matrix

```markdown
| # | App | Target (Page / Endpoint / Component) | Readiness | Method / Trigger | Variant | Scenario | User Action | Expected Result | Priority | Test Layer |
|---|-----|--------------------------------------|-----------|------------------|---------|----------|-------------|-----------------|----------|------------|
```

- **Target** — the page (`/dashboard`), endpoint (`POST /candidates`), OR component (`UploadModal`).
- **Readiness** — `🟢 Green` / `🟡 Amber` / `🔴 Red` from 1E. Blank for routes
  and endpoints (they're always Green — HTTP is deterministic).
- **Variant** — required when Target is a component with conditional branches
  (from 1D). Leave blank for routes / endpoints.
- One variant = one matrix row minimum. A dialog with 4 variants must produce
  at least 4 rows.

**Readiness gates what Phase 4 generates for each row:**
- Green → full happy-path + edge cases
- Amber → happy-path + one edge case, with `.catch(() => skip)` on brittle steps
- Red → mount-level only (renders without error, opens without crashing)

Test Layer:
- `E2E` — browser-driven (Playwright page)
- `API` — HTTP-only (Playwright request, no browser)
- `UI_COMPONENT` — focused interaction with a specific dialog/modal/wizard
- `CROSS` — spans two apps

### 2D — Required coverage per route/endpoint

- Happy path
- Unauthenticated (401)
- Invalid input (400)
- Server error (500)
- Empty state (list pages)
- Forbidden (403, if roles exist)
- Not found (404)

**Additionally per mutation (POST/PUT/PATCH/DELETE):**

- **Side-effect probe** (Phase 1G): if a sink was detected for this mutation,
  verify the sink fired (audit row count increment, email log entry,
  webhook invocation, queue message).
- **Cascade probe** for every DELETE (Phase 1H): for each child relationship,
  assert children are handled per the expected rule (cascade / nullify /
  soft-archive / prevent-if-children).
- **Idempotency probe** for POSTs with unique constraints: submit twice with
  the same unique key → first 201, second 409 (not 500). Also applies to
  PATCH of immutable fields (should 400/409, not silently ignore).
- **Oracle on success** (Test Oracle checklist): status + GET-after-write +
  no-secret-leak + list includes it (for creates) / list excludes it (for deletes).
- **Cache / stale-data probe** (Gap I — auto-paired with every PATCH/PUT):
  after successful mutation, GET `/:id` within 100ms must return new value.
  If `Cache-Control` / `ETag` headers present, verify sensible TTL. Catches
  stale-cache bugs between request layers (CDN, Redis, service cache).
- **Optimistic-concurrency probe** (Gap L — auto-activate when `version` /
  `etag` / `lastModified` / `If-Match` detected in DTO or headers):
  two PATCHes with same stale version → first succeeds, second gets
  409 or last-write-wins per documented policy. Prevents lost-update.
- **Authorization-matrix probe** (Gap H, Phase 1I): for scoped endpoints,
  every CRUD verb gets an IDOR probe as another actor.

### 2D.3 — Required per file-upload endpoint (Gap J, Phase 1J)

Six probes per multipart endpoint: oversized, zero-byte, MIME-spoof,
path-traversal filename, zip bomb, no-file-supplied. Test Layer = FILE-UPLOAD.

### 2D.4 — Required per date field (Gap K, Phase 1K)

Per date field in mutation DTOs: past-on-future-only, future-on-past-only,
inverted window (expiry < issue), DST rollover, leap day, ISO-vs-epoch,
timezone round-trip. Test Layer = TIME.

### 2D.5 — Required per list endpoint with pagination (Gap N extension)

Beyond the baseline pagination test (H6) — emit deeper PAGINATION rows:

| Probe | Expected |
|---|---|
| Sort stability across page boundary | same ordering key → same row never appears on two pages |
| Cursor stability when row added mid-pagination | no duplicate on subsequent pages; new row either included or cleanly excluded |
| Cursor stability when row deleted mid-pagination | no skipped rows; consistent total count |
| Tie-breaking on equal sort key | secondary sort (e.g., id) ensures deterministic order |
| limit=1 + page-through-all | total count matches sum of individual pages |

### 2D.6 — Accessibility smoke (Gap M — apply per every page route)

For every Green-readiness page found in Phase 1A, auto-inject axe-core:

```typescript
import AxeBuilder from '@axe-core/playwright';
const { violations } = await new AxeBuilder({ page }).analyze();
expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
```

Flags WCAG A+AA violations: missing alt text, label/input disassociation,
color-contrast failures, non-semantic heading order, keyboard-trap dialogs.
Test Layer = A11Y.

Skip for Red pages (same rationale as 1E.2 conditional-render).

### 2D.7 — Responsive viewport (Gap R — apply per every page route)

For every Green-readiness page, auto-generate 3 viewport probes:

| Viewport | Width | Probe |
|---|---|---|
| Mobile | 375px | no horizontal scroll on `<body>`; primary action button reachable without scroll |
| Tablet | 768px | navigation accessible (hamburger expanded OR sidebar pinned) |
| Desktop | 1440px | no orphan whitespace ratio > 40%; no overlapping absolute-positioned elements |

Test Layer = RESPONSIVE. Use `page.setViewportSize({ width, height })`.

### 2D.8 — PII / secret redaction oracles (Gap O, Phase 1L)

For every GET that returns user/auth data, run `assertNoSecretsLeaked` over
the entire response tree. For every error response, scan body for any field
named `password*`, `token*`, `secret*`, `apiKey*`, `ssn*`. Test Layer = PII.

### 2D.9 — Backwards-compatibility probes (Gap P, Phase 1M)

Per deprecated field or versioned route: POST with deprecated field still
succeeds; sunset-date header in the future. Test Layer = COMPAT.

### 2D.2 — Required coverage per status-enum field (multi-hop state chains)

For every entity with a status enum, Phase 2E is not enough — single `A→B`
transitions miss chain bugs like "after REJECT you can't RESUBMIT". Generate
chains up to depth 3 via DFS over valid transitions.

**Algorithm:**

1. Read the enum (e.g., `ServiceRequestStatus { DRAFT, ACTIVE, ON_HOLD, COMPLETED }`).
2. Read the state-transition table (either explicit `canTransitionTo()` method,
   decorator, or infer from status-change handler code).
3. DFS from each starting state, depth 3, no-repeat. Each distinct path = one
   test row.

**Required chains per enum:**

| Chain | Assertion |
|---|---|
| Full happy path (first → last terminal state) | Every hop returns 200, final state reached, entity has expected fields at each step |
| Reverse / recovery chain (e.g., REJECTED → RESUBMIT → UNDER_REVIEW → APPROVED) | User can recover from non-terminal failure states |
| Dead-end chain attempt (terminal → anywhere) | COMPLETED / DELETED states cannot transition out; 400/409 |
| Skip-hop attempt (DRAFT → COMPLETED directly) | Returns 400/409 naming the illegal transition |

Each distinct chain → one matrix row labeled `Test Layer: STATE-CHAIN`.

### 2E — Required coverage per cross-app relationship

- Create in A → appears in B
- Action in B → reflected in A
- Delete in A → gone from B
- Permission boundary
- Failure isolation (B down → A degrades gracefully)
- Data consistency (same record, identical values in both)

**Field-level round-trip — mandatory for every "Create in A → appears in B" test:**

It is NOT enough to assert `entityOnB.id === entityOnA.id`. That misses the
most common cross-portal bug class: admin edits a field → candidate sees a
stale or missing value. For every cross-app assertion, iterate every visible
DTO field and assert round-trip equality.

Detection input:
- Read the entity's response DTO (from `@visaplatform/common`, `packages/*/dtos`,
  OpenAPI schema, or direct response shape).
- For each primitive / string / enum / date / number field, add an assertion.
- For nested objects (address, customFields, metadata JSON), recurse.
- Skip server-generated fields: `id`, `createdAt`, `updatedAt`, `deletedAt`,
  `version`, `checksum`.

Emit the assertion through the shared helper (see `templates/cross-app.spec.ts.template`):

```typescript
assertEntityRoundTrip(entityFromA, entityFromB, {
  skip: ['id', 'createdAt', 'updatedAt'],  // server-generated
});
```

The helper diffs every field and throws with a clear path like
`expected candidate.customFields.visaType "Skilled" but got "Student"`.

For entities with **custom-field / dynamic-schema** columns (JSON/JSONB
blobs that hold arbitrary keys), iterate keys — don't just compare objects
by reference.

### 2F — Summary to output

- Total apps: N
- Cross-app relationships: N
- Single-app scenarios: N
- Cross-app scenarios: N
- Auth method per app: list
- Recommended fixture count: N

### 2G — Apply HUNTER_NOTES.md

If `e2e/HUNTER_NOTES.md` was read in the pre-flight step:

- Remove any scenarios that match the `## Scope` exclusions and record the
  removal count in the summary ("Excluded N scenarios per HUNTER_NOTES.md scope").
- For each item in `## Focus`, expand coverage: add deeper scenarios
  (edge cases, full lifecycle, permutations) and mark them P0.
- Honor `## Ask user before generating`: list the open questions in the
  matrix file under a `## Open Questions` heading so they are answered
  before Phase 4.

### 2H — Persist the matrix to disk

Before stopping for approval, write the full output of 2A–2F to
`e2e/SCENARIO_MATRIX.md` (create the `e2e/` directory if missing) so the
user can review, edit, and version-control it independently of chat.

Format the file as a single markdown document with one `## ` heading per
sub-section (Tech Stack Map, App Inventory, Cross-App Relationships,
Scenario Matrix, Coverage Checklist, Summary).

Report the file path to the user when printing the matrix in chat.

**STOP. Wait for user approval before Phase 3.**

---

## Phase 3 — Playwright Setup

Playwright always lives in its own directory and calls apps over HTTP.
Backend language is irrelevant to Playwright — it only cares about HTTP.

### 3.1 Install

```bash
npm list @playwright/test 2>/dev/null || npm install -D @playwright/test
npx playwright install chromium
```

### 3.2 playwright.config.ts — adaptive webServer

Use the **Start Command** from the Tech Stack Map.
See `templates/playwright.config.ts` — fill in the real commands.

**Common start command patterns:**
```
Next.js:      npm run dev
NestJS:       npm run start:dev
FastAPI:      uvicorn main:app --port 3001 --reload
Django:       python manage.py runserver 3001
Rails:        bundle exec rails server -p 3001
Go:           go run main.go
Spring Boot:  ./mvnw spring-boot:run
Laravel:      php artisan serve --port=3001
```

### 3.3 Auth setup — per backend auth mechanism

#### JWT (NestJS, FastAPI, Express, Go, Spring Boot)
```typescript
setup('authenticate', async ({ request }) => {
  const res = await request.post(`${process.env.API_URL}/auth/login`, {
    data: { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
  });
  const body = await res.json();
  const token = body.access_token || body.accessToken || body.token;
  fs.writeFileSync('e2e/.auth/token.json', JSON.stringify({ token }));
});
```

#### Session / Cookie (Rails, Django, Laravel)
```typescript
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.TEST_PASSWORD!);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/dashboard|home|\//);
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

#### OAuth / SSO (Auth0, Clerk, Google)
```typescript
// Bypass OAuth UI — use backend test-token endpoint
setup('authenticate', async ({ request }) => {
  const res = await request.post(`${process.env.API_URL}/auth/test-token`, {
    data: { userId: process.env.TEST_USER_ID },
    headers: { 'X-Test-Secret': process.env.TEST_SECRET! },
  });
  const { token } = await res.json();
  fs.writeFileSync('e2e/.auth/token.json', JSON.stringify({ token }));
});
```

### 3.4 File structure (same for all stacks)

```
e2e/
├── auth.setup.ts
├── setup-multi-app.ts       # multi-app only
├── .auth/                   # gitignored
├── fixtures/
│   └── multi-app.fixture.ts # multi-app only
├── helpers/
│   ├── api.ts
│   └── wait-for-sync.ts     # multi-app only
├── api/                     # backend endpoint tests
├── pages/                   # frontend page tests
└── cross-app/               # multi-app only
```

---

## Phase 4 — Test File Generation

### 4.1 Page tests — selector strategy per frontend

**React / Next.js / SvelteKit / Vue / Angular** — same priority:
1. `getByRole('button', { name: /text/i })`
2. `getByLabel('Email')`
3. `getByText('Submit')`
4. `getByTestId('id')`
5. `locator('[name="fieldName"]')` — for v-model inputs without labels
6. `locator('.class')` — last resort

**SvelteKit SSR note:** use `waitForLoadState('networkidle')` after navigation.

**Angular lazy loading note:** wait for route module before asserting.

### 4.1b UI component tests — dialog/modal/wizard/drawer

Dialogs and modals need scoping so selectors don't accidentally match
elements on the underlying page. Standard pattern:

```ts
// 1. Trigger the dialog
await page.getByRole('button', { name: /open|add|edit|upload/i }).click();

// 2. Scope all further queries to the dialog
const dlg = page.getByRole('dialog');
await expect(dlg).toBeVisible();

// 3. Interact inside the scope
await dlg.getByLabel(/name/i).fill('value');
await dlg.getByRole('button', { name: /save|submit|confirm/i }).click();

// 4. Wait for it to close on success
await expect(dlg).toBeHidden();
```

**Tabs inside dialogs** (common for complex forms):

```ts
await dlg.getByRole('tab', { name: /details/i }).click();
await dlg.getByRole('tab', { name: /upload/i }).click();
```

**File upload**:

```ts
const fileInput = dlg.locator('input[type="file"]');
await fileInput.setInputFiles('e2e/fixtures/sample.pdf');
// Or drag-drop UI that hides the native input:
await fileInput.setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf',
                                buffer: Buffer.from('...') });
```

**Wizard / stepper** — drive via Next / Back buttons, assert step heading per step:

```ts
await expect(dlg.getByRole('heading', { name: /step 1/i })).toBeVisible();
await dlg.getByRole('button', { name: /next/i }).click();
await expect(dlg.getByRole('heading', { name: /step 2/i })).toBeVisible();
```

**Form validation inside dialogs** — assert error state and that the dialog
stays open (a common regression is the dialog closing on validation error):

```ts
await dlg.getByRole('button', { name: /submit/i }).click();
await expect(dlg.getByText(/required|invalid/i).first()).toBeVisible();
await expect(dlg).toBeVisible(); // still open
```

**Close/cancel** — verify the dialog actually unmounts, not just becomes
invisible (a dialog that remains in the DOM can cause ghost-click bugs):

```ts
await dlg.getByRole('button', { name: /cancel|close/i }).click();
await expect(page.getByRole('dialog')).toHaveCount(0);
```

**One test per variant** — if a dialog has 4 conditional modes (e.g.
file-only / form-only / hybrid / template), write a separate test per mode
with a focused assertion on what's unique to that mode. Don't multiplex
modes into one test.

**Interaction-sequence tests (generate three per dialog, Green readiness only):**

Dialogs are stateful — single-open-submit-close misses sequence bugs. For
each Green-readiness dialog, generate these three scenarios:

1. **Reopen-after-submit** (state reset oracle)
   ```ts
   await openDialog(page, 'Create Thing');
   await dlg.getByLabel(/name/i).fill('First');
   await dlg.getByRole('button', { name: /submit/i }).click();
   await expect(page.getByRole('dialog')).toHaveCount(0);  // closed
   // Reopen — must be empty, not pre-filled with 'First'
   await openDialog(page, 'Create Thing');
   await expect(dlg.getByLabel(/name/i)).toHaveValue('');
   ```

2. **Double-submit / rapid-click** (idempotency / loading-state oracle)
   ```ts
   await openDialog(page, 'Create Thing');
   await dlg.getByLabel(/name/i).fill('Unique ' + Date.now());
   const submit = dlg.getByRole('button', { name: /submit/i });
   await Promise.all([submit.click(), submit.click()]);
   // Only one entity should be created — probe via API count
   ```

3. **ESC-discard mid-edit** (draft-discard oracle)
   ```ts
   await openDialog(page, 'Create Thing');
   await dlg.getByLabel(/name/i).fill('Draft content');
   await page.keyboard.press('Escape');
   await expect(page.getByRole('dialog')).toHaveCount(0);
   // Reopen — draft should NOT persist (unless product policy says otherwise)
   await openDialog(page, 'Create Thing');
   await expect(dlg.getByLabel(/name/i)).toHaveValue('');
   ```

Skip these sequences for Amber/Red dialogs — they rely on stable handles
that don't exist yet.

### 4.1c Multi-actor scenario tests (bulk recipients, concurrent users)

Trigger condition — auto-activate when any of these holds:

- An endpoint accepts `recipientIds[]`, `userIds[]`, `candidateIds[]`, or similar array fields
- HUNTER_NOTES `## Focus` or `## Multi-actor scenarios` section names it
- Phase 1F cross-app detection found an "A broadcasts to N B's" pattern

Use `templates/multi-actor.fixture.ts` which provisions N parallel sessions
from `.env.test` keys:

```bash
# .env.test — declare N actors of the same role
CANDIDATE_1_EMAIL=candidate1@test.com
CANDIDATE_1_PASSWORD=...
CANDIDATE_2_EMAIL=candidate2@test.com
CANDIDATE_2_PASSWORD=...
CANDIDATE_3_EMAIL=candidate3@test.com
CANDIDATE_3_PASSWORD=...
```

Each multi-actor test covers:

- **Broadcast fanout** — admin sends to N recipients, every recipient sees it
- **Concurrent edit** — two admins edit same entity, second save gets 409 or overwrites per defined policy
- **Race on unique** — two actors try to create the same unique entity simultaneously, exactly one succeeds
- **Parallel independence** — N candidates submit different documents in parallel, no cross-contamination in review queue

### 4.2 API tests — auth header per backend

```typescript
// JWT (NestJS, FastAPI, Express, Go, Spring)
headers: { Authorization: `Bearer ${token}` }

// Django Token Auth
headers: { Authorization: `Token ${token}` }

// Session cookie — already in storageState, no extra header

// API Key
headers: { 'X-API-Key': process.env.TEST_API_KEY! }

// Basic Auth
headers: { Authorization: `Basic ${btoa('user:pass')}` }
```

Every API test must assert:
- Correct status codes (200/201, 400, 401, 403, 404)
- Response schema does not include: `password`, `passwordHash`, `secret`, `apiKey`, `token` (in list responses)

### 4.3 Cross-app tests — stack-agnostic

Backend language does not affect cross-app tests.
Always import from `multi-app.fixture.ts` and use `waitForSync`.
See `templates/cross-app.spec.ts.template`.

---

## Phase 5 — Run Tests

```bash
# Headless (default — batch discovery)
npx playwright test --browser=chromium 2>&1 | tee test-output.log

# Headed (failure investigation)
npx playwright test "<test name>" --headed --slowmo=500 --browser=chromium

# UI mode (interactive debugging)
npx playwright test --ui

# View HTML report
npx playwright show-report
```

---

## Phase 6 — Bug Report

Classify each failure:
- `UI_BUG` — element not found, wrong text, layout broken
- `API_BUG` — wrong status, missing field, schema mismatch
- `AUTH_BUG` — wrong redirect, token not sent, session issue
- `SYNC_BUG` — cross-app data did not propagate
- `TIMEOUT` — page/request too slow
- `TEST_BUG` — stale selector or wrong assertion
- `TEST_HOSTILE_UI` — the failure is not a functional defect; the UI lacks
  stable handles (no `data-testid`, no `aria-label`, no `<label htmlFor>`)
  that any automated test (Playwright, Cypress, RTL, axe-core) needs to
  target reliably. These are discovered in Phase 1E. Each `TEST_HOSTILE_UI`
  entry must include the specific project-side changes that would unlock
  reliable testing — not just a description of the failure.
- `KNOWN_QUIRK` — matches an entry in `HUNTER_NOTES.md` "Known dev-mode
  quirks" — classify here instead of treating as a bug.

Add per bug: **Stack layer** (frontend-framework / backend-framework /
cross-app / test-infrastructure) to route the fix to the right developer.

**Ranking rule for the summary table:** real code bugs first, then
`TEST_HOSTILE_UI` findings (since they block future test coverage), then
`KNOWN_QUIRK` (FYI only), then `TEST_BUG` (fix within the skill session).

---

## Phase 7 — Fix-and-Retest Loop

Max 5 iterations. Each round:
1. Fix minimal — do not refactor unrelated code
2. Retest: `npx playwright test --browser=chromium 2>&1 | tee test-output-round-N.log`
3. Diff: ✅ fixed / 🔄 still failing / ⚠️ regression → revert immediately
4. Output progress table

Stop when: all pass / only TEST_BUG remain / 5 rounds reached / blocked.

---

## Framework Support Matrix

| Frontend | Scan Strategy |
|----------|---------------|
| Next.js App Router | `find */app/**/page.tsx` |
| Next.js Pages Router | `find ./pages` |
| React + React Router | grep `createBrowserRouter` |
| Vue 3 + Vue Router | grep router config |
| Nuxt 3 | `find */pages/*.vue` |
| SvelteKit | `find */routes/+page.svelte` |
| Angular | grep `Routes` in TS |

| Backend | Scan Strategy |
|---------|---------------|
| NestJS | grep `@Get\|@Post...` |
| Express / Koa | grep `router.get\|app.get` |
| Fastify | grep `fastify.route` |
| FastAPI | grep `@router.get` |
| Django | find `urls.py` |
| Rails | cat `routes.rb` |
| Go (Gin/Echo/Chi) | grep `.GET\|.POST` |
| Spring Boot | grep `@GetMapping` |
| Laravel | cat `routes/api.php` |
| Any (OpenAPI) | parse `openapi.json` |

---

## Prompt Templates

- `prompts/01-discover.md` — Phase 0 + 1 + 2
- `prompts/02-generate.md` — Phase 3 + 4
- `prompts/03-run-and-report.md` — Phase 5 + 6
- `prompts/04-fix-loop.md` — Phase 7
- `prompts/05-multi-app-context.md` — optional business context seed

---

## Common Pitfalls

- **Wrong start command** — always read actual `scripts` in package.json / Makefile
- **Non-JS backend not starting** — check missing env vars, DB, migrations
- **Session vs JWT confusion** — use the right auth setup template
- **SvelteKit SSR timing** — use `waitForLoadState('networkidle')`
- **Angular lazy loading** — wait for route module before asserting
- **Cross-app flakiness** — use `waitForSync`, never `waitForTimeout`
- **OpenAPI spec outdated** — verify scanned endpoints still exist in code
- **Missing `await`** — every Playwright action must be awaited
- **Phase 2 skipped** — always show matrix and wait for approval
