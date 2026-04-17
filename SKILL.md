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

### 1D — Cross-App Relationship Detection

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
| # | App | Page / Endpoint | Method | Scenario | User Action | Expected Result | Priority | Test Layer |
|---|-----|-----------------|--------|----------|-------------|-----------------|----------|------------|
```

Test Layer:
- `E2E` — browser-driven (Playwright page)
- `API` — HTTP-only (Playwright request, no browser)
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

Add per bug: **Stack layer** (frontend-framework / backend-framework / cross-app)
to route the fix to the right developer in polyglot teams.

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
