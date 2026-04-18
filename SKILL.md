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

### 2E — Required coverage per cross-app relationship

- Create in A → appears in B
- Action in B → reflected in A
- Delete in A → gone from B
- Permission boundary
- Failure isolation (B down → A degrades gracefully)
- Data consistency (same record, identical values in both)

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
