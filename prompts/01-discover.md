# Prompt 1 — Universal Discovery & Scenario Matrix

---

```
Scan this project and list ALL test scenarios. Do NOT write any test code yet.

STEP -1 — Read project notes (if present):
  test -f e2e/HUNTER_NOTES.md && cat e2e/HUNTER_NOTES.md

  Parse four optional sections:
    ## Scope               → exclude matched areas from the scan + matrix
    ## Focus               → boost coverage on these areas (more scenarios)
    ## Constraints         → rules for the Phase 7 fix loop
    ## Known dev-mode quirks → classify matching failures as KNOWN_QUIRK
    ## Ask user before generating (optional) → surface as Open Questions

  User's chat instructions this session override the file.
  If the file is absent, proceed with defaults.

STEP 0 — Detect tech stack:

Find all apps:
  find . -name "package.json" -not -path "*/node_modules/*" -maxdepth 4 | xargs grep -l '"scripts"' 2>/dev/null

Find non-JS projects:
  find . \( -name "requirements.txt" -o -name "Pipfile" -o -name "pyproject.toml" \
    -o -name "Gemfile" -o -name "go.mod" -o -name "pom.xml" \
    -o -name "build.gradle" -o -name "Cargo.toml" \) \
    | grep -v node_modules | grep -v ".git"

For each JS app found:
  cat <app>/package.json | grep -E '"next"|"nuxt"|"@angular/core"|"@sveltejs/kit"|"svelte"|"vue"|"react"|"@nestjs/core"|"express"|"fastify"|"koa"'

For each non-JS app found, check:
  Python:  grep -rn "flask\|fastapi\|django" requirements.txt Pipfile pyproject.toml 2>/dev/null
  Ruby:    cat Gemfile | grep -E "rails|sinatra"
  Go:      cat go.mod | grep -E "gin|echo|fiber|chi"
  Java:    cat pom.xml build.gradle 2>/dev/null | grep -E "spring-boot|quarkus"
  PHP:     cat composer.json 2>/dev/null | grep -E "laravel|symfony"

Output Tech Stack Map:
  | App | Directory | Language | Framework | Router Type | Port | Auth Method | Start Command |

STEP 1 — Scan routes and endpoints using the correct strategy per framework:

Frontend routes:
  Next.js App Router:    find . -path "*/app/**/page.tsx" | grep -v node_modules | sort
  Next.js Pages Router:  find ./pages ./src/pages -name "*.tsx" 2>/dev/null | grep -v node_modules | sort
  React Router:          grep -rn "createBrowserRouter\|<Route " --include="*.tsx" . | grep -v node_modules
  Vue Router / Nuxt:     find . -path "*/pages/**/*.vue" | grep -v node_modules | sort
  SvelteKit:             find . -path "*/routes/**" -name "+page.svelte" | grep -v node_modules | sort
  Angular:               grep -rn "path:" --include="*.ts" . | grep -v node_modules | grep -E "Routes|RouterModule"

Backend endpoints:
  NestJS:        grep -rn "@Get\|@Post\|@Put\|@Delete\|@Patch\|@Controller" --include="*.ts" . | grep -v ".spec.ts"
  Express/Koa:   grep -rn "router\.\(get\|post\|put\|delete\|patch\)\|app\.\(get\|post\|put\|delete\)" --include="*.js" --include="*.ts" . | grep -v node_modules
  Fastify:       grep -rn "fastify\.route\|fastify\.\(get\|post\)" --include="*.ts" --include="*.js" . | grep -v node_modules
  FastAPI:       grep -rn "@router\.\(get\|post\|put\|delete\|patch\)\|@app\." --include="*.py" .
  Django:        find . -name "urls.py" | xargs grep -n "path\|re_path" 2>/dev/null
  Rails:         cat config/routes.rb 2>/dev/null
  Go:            grep -rn '\.GET\|\.POST\|\.PUT\|\.DELETE\|\.PATCH' --include="*.go" . | grep -v "_test.go"
  Spring Boot:   grep -rn "@GetMapping\|@PostMapping\|@PutMapping\|@DeleteMapping" --include="*.java" --include="*.kt" . | grep -v "src/test"
  Laravel:       cat routes/api.php routes/web.php 2>/dev/null
  OpenAPI spec:  find . -name "openapi.json" -o -name "openapi.yaml" | grep -v node_modules

UI components (dialogs, modals, wizards, drawers, sheets, steppers):
  # File-name scan
  find . \( -name "*.tsx" -o -name "*.jsx" -o -name "*.vue" -o -name "*.svelte" \) \
    -not -path "*/node_modules/*" -not -path "*/dist/*" \
    | grep -iE "(dialog|modal|wizard|drawer|sheet|popover|stepper|overlay)" \
    | sort

  # Usage scan (React/shadcn/Radix/MUI/Ant)
  grep -rn "<Dialog\|<Modal\|<Drawer\|<Sheet\|<Wizard\|<Stepper\|<AlertDialog" \
    --include="*.tsx" --include="*.jsx" . | grep -v node_modules | head -20

  For each discovered component, look at conditional rendering in the file:
    grep -nE "(if|&&|\?\s*\()\s*(is|has|requires|show|mode|type|variant|kind)" <file>
  Each distinct branch = one test variant. Capture into the matrix.
  Common variant axes: file-only vs form-only vs hybrid, single vs multi file,
  create vs edit, permission/role-gated, status-locked (read-only), step count.

  When a user's Focus directive names a user-visible ACTION (upload / submit /
  review / create / edit), expand scope to include the dialog/modal that
  handles the action AND its variants — don't just test the API route.

Test-readiness score (per component):
  For each component found above, count stable test handles vs interactive
  targets — determines how deep Phase 4 can go.

    file=<component-file>
    handles=$(grep -cE 'data-testid=|data-cy=|aria-label=|aria-labelledby=' "$file")
    labels=$(grep -cE '<label[^>]*htmlFor=|<Label[^>]*htmlFor=' "$file")
    roles=$(grep -cE 'role="(dialog|button|textbox|combobox|tab|heading)"' "$file")
    targets=$(grep -cE '<(Input|Button|Textarea|Select|Tab|Checkbox|Switch|RadioGroup|button|input|textarea|select)' "$file")
    # coverage = (handles + labels + roles) / targets

  Bands:
    🟢 Green ≥0.80  → full interaction tests; selectors use getByRole/getByLabel/getByTestId
    🟡 Amber 0.30–0.80 → happy-path + one edge case, `.catch(() => skip)` on brittle steps
    🔴 Red <0.30  → mount-level tests only; output becomes "improvement actions" list

  Any Red or Amber component must get a line in Phase 2 output listing the
  specific project-side changes to raise its score (add data-testid on named
  buttons, add htmlFor on label/input pairs, expose step headings as role=heading).

Infrastructure preconditions (detect early, record in Tech Stack Map):
  # Hot-reload dev server?
  grep -rE '"dev":\s*"(next dev|vite|nuxi dev|ng serve|webpack-dev-server)' \
    --include=package.json . | grep -v node_modules

  # Conditional base path (Next.js / Vue / Svelte)
  grep -rnE 'basePath|assetPrefix|app\.baseURL|paths\.base' \
    --include='next.config.*' --include='nuxt.config.*' \
    --include='svelte.config.*' . | grep -v node_modules

  # Seed / fixtures scripts
  grep -rE '"(seed|db:seed|migrate:seed|fixtures)"' \
    --include=package.json . | grep -v node_modules

  Carry these findings as warnings through Phase 3 (setup) and Phase 5 (run):
  hot-reload → `--workers=1`, conditional basePath → tests stick to dev mode,
  seed script present → recommend running before Phase 5.

Auth boundaries:
  JS/TS:   grep -rn "@UseGuards\|middleware.*auth\|withAuth\|useAuth\|isAuthenticated" --include="*.ts" --include="*.tsx" . | grep -v node_modules | head -20
  Python:  grep -rn "login_required\|IsAuthenticated\|Depends.*auth" --include="*.py" . | head -20
  Ruby:    grep -rn "authenticate_user!\|before_action.*authenticate" --include="*.rb" . | head -20
  Go:      grep -rn "AuthMiddleware\|jwt\|bearer" --include="*.go" . | head -20
  Java:    grep -rn "@PreAuthorize\|SecurityConfig" --include="*.java" --include="*.kt" . | head -20

STEP 2 — Detect cross-app relationships (if multiple apps found):

  find . -name ".env*" -not -path "*/node_modules/*" | xargs grep -rn "APP_.*URL\|API_URL\|SERVICE_URL" 2>/dev/null
  grep -rn "emit\|publish\|subscribe\|kafka\|rabbit\|celery\|sidekiq\|webhook" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v "test\|spec" | head -20
  find . -name ".env*" -not -path "*/node_modules/*" | xargs grep -rn "DATABASE_URL\|DB_HOST" 2>/dev/null

STEP 3 — Output tables in this order:

A) Tech Stack Map
   | App | Directory | Language | Framework | Router | Port | Auth Method | Start Command |

B) App Inventory
   | App Name | Directory | Port | Type | Key Responsibility |

C) Cross-App Relationships (skip if single app)
   | From App | To App | Mechanism | Evidence (file:line) | Direction |

D) Scenario Matrix
   | # | App | Page / Endpoint | Method | Scenario | User Action | Expected Result | Priority | Test Layer |

   Test Layer: E2E (browser) / API (HTTP only) / CROSS (two apps)

E) Required scenarios for EVERY route/endpoint:
   - Happy path
   - Unauthenticated (no token / not logged in)
   - Invalid input / 400
   - Server error / 500
   - Empty state (list pages)
   - Forbidden / 403 (if roles exist)
   - Not found / 404

F) Required scenarios for EVERY cross-app relationship:
   - A creates → B sees it (REALTIME / EVENTUAL / MANUAL)
   - B acts → A reflects
   - A deletes → gone from B
   - Permission boundary
   - B is down → A degrades gracefully
   - Same record shows identical data in both

Priority:
  P0 = auth flows, core mutations, cross-app happy paths
  P1 = error handling, edge cases, failure isolation
  P2 = empty states, cosmetic, low-risk

STEP 4 — Summary:
  - Tech stacks detected: list
  - Total apps: N
  - Cross-app relationships: N
  - Single-app scenarios: N
  - Cross-app scenarios: N
  - Auth method per app: list

STEP 5 — Persist the scenario matrix to disk:
  Write everything from STEP 3 (tables A–F) and STEP 4 (summary) to
  `e2e/SCENARIO_MATRIX.md`. Create the `e2e/` directory if it does not
  exist. Use one `## ` heading per section:

    ## Tech Stack Map
    ## App Inventory
    ## Cross-App Relationships
    ## Scenario Matrix
    ## Coverage Checklist
    ## Summary

  After writing the file, print its path back to the user so they can
  open / edit / version-control it.

STOP. Wait for approval before generating any test files.
```
