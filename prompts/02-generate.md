# Prompt 2 — Generate Test Files (Universal)

---

```
Based on the approved scenario matrix and Tech Stack Map, generate the Playwright E2E test suite.

SETUP:

1. Install Playwright if not present:
   npm install -D @playwright/test
   npx playwright install chromium

2. Create playwright.config.ts using the Start Commands from the Tech Stack Map.
   Common patterns:
     Next.js:      npm run dev
     NestJS:       npm run start:dev
     FastAPI:      uvicorn main:app --port <N> --reload
     Django:       python manage.py runserver <N>
     Rails:        bundle exec rails server -p <N>
     Go:           go run main.go
     Spring Boot:  ./mvnw spring-boot:run
     Laravel:      php artisan serve --port=<N>
   Settings:
     - testDir: './e2e'
     - Desktop Chrome only
     - screenshot: 'only-on-failure'
     - video: 'retain-on-failure'
     - trace: 'on-first-retry'
     - projects: setup, unauthenticated, authenticated, api, cross-app (if needed)

3. Create auth.setup.ts using the correct method for the detected Auth Method:
     JWT (NestJS/FastAPI/Express/Go/Spring):
       POST to /auth/login, save token to e2e/.auth/token.json
     Session/Cookie (Rails/Django/Laravel):
       page.goto('/login'), fill form, save storageState to e2e/.auth/user.json
     OAuth/SSO (Auth0/Clerk/Google):
       Use backend test-token endpoint, bypass OAuth UI entirely

4. Create file structure:
   e2e/
   ├── auth.setup.ts
   ├── setup-multi-app.ts         (only if multi-app)
   ├── .auth/                     (gitignored)
   ├── fixtures/
   │   └── multi-app.fixture.ts   (only if multi-app)
   ├── helpers/
   │   ├── api.ts
   │   └── wait-for-sync.ts       (only if multi-app)
   ├── api/
   ├── pages/
   └── cross-app/                 (only if multi-app)

5. Add to .gitignore:
   e2e/.auth/
   test-results/
   playwright-report/

TEST FILE PATTERNS:

For each PAGE test (e2e/pages/<page>.spec.ts):
  1. Unauthenticated block — auth guard test
  2. Authenticated block — happy path + data visible
  3. Form interaction block — validation + submit (if page has forms)
  4. Error state block — mock 500 via page.route(), mock abort for network error

For each API test (e2e/api/<resource>.api.spec.ts):
  - Use Playwright request fixture (no browser)
  - Get auth token in beforeAll using the correct auth method:
      JWT:      POST /auth/login → extract access_token
      Session:  use storageState cookies
      API Key:  read from process.env.TEST_API_KEY
  - Set auth header correctly:
      JWT:      Authorization: `Bearer ${token}`
      Django:   Authorization: `Token ${token}`
      API Key:  X-API-Key: token
      Cookie:   already in storageState
  - Test: 200 happy, 401 no auth, 403 wrong role, 400 bad input, 404 not found
  - ALWAYS assert response schema excludes sensitive fields:
      expect(item).not.toHaveProperty('password')
      expect(item).not.toHaveProperty('passwordHash')
      expect(item).not.toHaveProperty('secret')

For each CROSS-APP test (e2e/cross-app/<flow>.spec.ts):
  - import { test, expect } from '../fixtures/multi-app.fixture'
  - import { waitForSync } from '../helpers/wait-for-sync'
  - Use { appA, appB } fixture
  - Pattern: trigger in appA → waitForSync(appB.page, ...) → assert in appB
  - Add reverse flow test
  - Add failure isolation test (block appB requests → appA still works)

SELECTOR PRIORITY (all frameworks):
  1. getByRole('button', { name: /text/i })
  2. getByLabel('Email')
  3. getByText('Submit')
  4. getByTestId('id')
  5. locator('[name="fieldName"]')   — for v-model inputs without labels (Vue)
  6. locator('.class')              — last resort

FRAMEWORK-SPECIFIC NOTES:
  SvelteKit:  add waitForLoadState('networkidle') after navigation
  Angular:    wait for lazy-loaded route module before asserting
  Vue:        use locator('[name="..."]') for inputs without explicit labels

AFTER GENERATION:
  - List all files created
  - Total test count by layer (api / pages / cross-app)
  - Scenarios that could not be automated and why
  - All env vars needed (as .env.test template)
  - Next command: npx playwright test --browser=chromium

Do NOT run tests yet. Wait for confirmation.
```
