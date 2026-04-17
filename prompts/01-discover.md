# Prompt 1 — Universal Discovery & Scenario Matrix

---

```
Scan this project and list ALL test scenarios. Do NOT write any test code yet.

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

STOP. Wait for approval before generating any test files.
```
