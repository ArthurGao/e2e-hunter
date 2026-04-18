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

Conditional-render scan (per component — STATE-FIXTURE tests):
  Components render different UI branches based on entity state, flags, or
  props. Each distinct branch must be tested by putting the entity into that
  state and asserting the right branch renders. API tests cannot catch these
  — the API returns status='approved' but the lock badge may still be broken.

    file=<component-file>

    # Entity status/state/type branches — {entity.status === 'approved' && ...}
    grep -nE '\{[a-zA-Z_]+\.(status|state|type|kind|role)\s*===?\s*["'"'"'][^"'"'"']+["'"'"']' "$file"

    # Boolean flag branches — if (doc.locked), {entity.expired && ...}
    grep -nE '(if|&&|\?)\s*\(?\s*[a-zA-Z_]+\.(locked|disabled|readonly|expired|archived|approved|rejected|completed)\b' "$file"

    # Prop variant branches — if (mode === 'edit')
    grep -nE '(if|&&)\s*\(?\s*(mode|variant|kind|type)\s*===?' "$file"

    # Permission/role gates — hasPermission, isAdmin, userRole === 'X'
    grep -nE '(hasPermission|canAccess|isAdmin|userRole\s*===?)' "$file"

  For each distinct branch, record one state-fixture test in the matrix:
    | setup state      | render           | assert branch           |
    | entity.status=X  | mount component  | X-branch visible, Y hidden |

  These rows get Test Layer = STATE-FIXTURE so Phase 4 generates
  setup-via-API + render-in-browser + branch-assertion tests.

  Skip for components scored Red (readiness < 0.30) — state-fixture tests
  inherit the same brittleness; note branches but don't generate.

Side-effect sink scan (per backend — emit SIDE-EFFECT matrix rows):
  # Audit logs
  grep -rn "AuditLogService\.\|auditLog\.\|activityLog\.\|logger\.audit\|audit_log\|activity_log" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v spec | grep -v test

  # Email sending
  grep -rn "emailService\.\|mailer\.send\|sendgrid\|postmark\|ses\.send\|nodemailer\|ActionMailer\|email_log" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v spec | grep -v test

  # Event / queue publishers
  grep -rn "@OnEvent\|eventEmitter\.emit\|kafka.*publish\|rabbitmq\|celery\|sidekiq\|bullQueue" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v spec | grep -v test

  # Outgoing webhooks
  grep -rn "webhook\.post\|sendWebhook\|WEBHOOK_URL" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" . \
    | grep -v node_modules | grep -v spec | grep -v test

  For each sink, pair it with the mutation(s) that trigger it (grep callers
  of the sink method within service files). Emit matrix rows labeled
  Test Layer = SIDE-EFFECT:
    | Mutation             | Sink              | Oracle                                       |
    | POST /candidates     | email_log table   | row count +1 WHERE template='welcome'        |
    | PATCH /sr/:id/status | audit_log table   | row WHERE action='STATUS_CHANGE' entity_id=X |
    | DELETE /candidates   | activity_events   | row WHERE type='candidate_deleted'           |

  DO NOT probe logger.info() / console.log() / metrics.increment — those
  are observability, not correctness.

Cascade / relationship scan (ORM-aware — emit CASCADE matrix rows):
  # TypeORM
  grep -rn "@ManyToOne\|@OneToMany\|@ManyToMany\|@OneToOne" --include="*.entity.ts" . | grep -v node_modules

  # Prisma
  find . -name "schema.prisma" -not -path "*/node_modules/*" | xargs grep -n "@relation\|references:" 2>/dev/null

  # Sequelize
  grep -rn "belongsTo\|hasMany\|hasOne\|belongsToMany" --include="*.ts" --include="*.js" . | grep -v node_modules

  # Django
  grep -rn "ForeignKey\|OneToOneField\|ManyToManyField" --include="*.py" . | grep -v venv

  # ActiveRecord
  grep -rn "belongs_to\|has_many\|has_one" --include="*.rb" . | grep -v vendor

  # GORM
  grep -rn "gorm:\"foreignKey\|gorm:\"references" --include="*.go" . | grep -v vendor

  # JPA
  grep -rn "@OneToMany\|@ManyToOne\|@ManyToMany\|@OneToOne" --include="*.java" --include="*.kt" . | grep -v "src/test"

  Build a parent→child relationship map. For every DELETE endpoint on a
  parent entity, emit one CASCADE matrix row per child:
    | Action                 | Child                  | Expected                                       |
    | DELETE /service-req/:id| documents              | child endpoint 404 OR soft-delete propagates   |
    | DELETE /candidate/:id  | service-requests       | SRs archived OR 409 if cascade=false           |
    | DELETE /checklist/:id  | checklist-items        | items gone or detached                         |

State-machine chain enumeration (DFS depth 3 — emit STATE-CHAIN rows):
  For every entity with a status enum detected in Phase 1B, build the
  transition graph and enumerate chains.

  # Find the enum definitions
  grep -rn "export enum .*Status\b\|enum .*Status\b" \
    --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" . \
    | grep -v node_modules | grep -v spec

  # Find transition-allowed tables (method names like canTransition, isValidTransition)
  grep -rn "canTransitionTo\|isValidTransition\|allowedTransitions\|TRANSITIONS\s*=" \
    --include="*.ts" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v spec

  If no explicit transition table, infer from status-change handler code
  (grep for `status =` assignments or `@OnStatusChange`). If neither exists,
  ASK the user for the transition table in Phase 2 approval.

  Run DFS from each starting state, depth 3, no-repeat. Each distinct path
  becomes one matrix row:
    | Chain                                    | Assertion                                    |
    | DRAFT→ACTIVE→ON_HOLD→ACTIVE→COMPLETED   | every hop returns 200, final state verified |
    | APPROVED→(anywhere)                      | 400/409, naming illegal transition           |
    | DRAFT→COMPLETED (skip-hop)              | 400/409                                      |
    | REJECTED→RESUBMIT→UNDER_REVIEW→APPROVED | recovery path works end-to-end               |

Authorization-boundary scan (IDOR — emit AUTHZ matrix rows):
  # Route params scoped to a user / tenant / account / owner
  grep -rnE '(\/:[a-zA-Z_]*(user|tenant|account|candidate|owner|member)Id|<[a-zA-Z_]*(user|tenant|account|candidate)Id>)' \
    --include="*.ts" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v spec

  # Entity ownership fields — which rows "belong to" someone
  grep -rnE '(userId|ownerId|tenantId|accountId|candidateId|createdBy)(\s*:\s*|\s*=)' \
    --include="*.entity.ts" --include="*.model.ts" --include="*.py" . \
    | grep -v node_modules | head -40

  For each scoped endpoint, emit 4 AUTHZ probes (GET/PATCH/DELETE user B's
  resource as user A, plus create-on-behalf-of check). Requires two actors
  from multi-actor.fixture.ts.

File-upload surface scan (emit FILE-UPLOAD matrix rows):
  # Node — multer / NestJS interceptors
  grep -rn "multer\|upload\.single\|upload\.array\|FileInterceptor\|FilesInterceptor\|@UploadedFile" \
    --include="*.ts" --include="*.js" . | grep -v node_modules

  # Python — FastAPI / Django
  grep -rn "UploadFile\|request\.FILES\|FileField\|InMemoryUploadedFile" \
    --include="*.py" . | grep -v venv

  # Rails ActiveStorage
  grep -rn "has_one_attached\|has_many_attached" --include="*.rb" . | grep -v vendor

  # Go
  grep -rn "multipart\.\|FormFile" --include="*.go" . | grep -v vendor

  For each detected upload endpoint, emit 6 FILE-UPLOAD probes: oversized,
  zero-byte, MIME spoof, path-traversal filename, zip bomb, no-file.

  Generate fixture files under e2e/fixtures/files/: tinyPdf, zeroByte,
  oversizedPdf, zipBomb, spoofedExe, emptyFormData.

Time / date / expiry field scan (emit TIME matrix rows):
  # class-validator / TypeORM
  grep -rnE "@IsDate|@IsDateString|@Column\(.*['\"](date|datetime|timestamp)" \
    --include="*.ts" . | grep -v node_modules

  # Suggestive field names — expiry/issued/valid/start/end
  grep -rnE "(expir|issued|valid|start|end|effective|renewal)[A-Z][a-z]" \
    --include="*.ts" --include="*.py" --include="*.go" . | grep -v node_modules | grep -v spec

  # Python / Django
  grep -rnE "datetime|date\s*=|DateField|DateTimeField" \
    --include="*.py" . | grep -v venv

  For each date field, emit TIME probes: past-on-future-only,
  future-on-past-only, inverted window (expiry<issue), DST rollover,
  leap day, ISO vs epoch, timezone round-trip.

PII / secret redaction scan (emit PII-REDACTION matrix rows):
  # Suspicious logging near auth/user/request
  grep -rnE "(logger|log|console)\.(log|info|debug|warn|error)\s*\(.*(user|request|body|password|token)" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" . \
    | grep -v node_modules | grep -v spec | head -20

  # Serialization hints — @Exclude, @Expose, toJSON
  grep -rnE "@Exclude|@Expose|serialize|toJSON" \
    --include="*.ts" . | grep -v node_modules

  Emit oracles for every GET returning user/auth data and every error
  response: run assertNoSecretsLeaked over response; no password/token/secret
  /apiKey/ssn fields anywhere in response tree.

Backwards-compatibility scan (emit COMPAT matrix rows):
  # @deprecated markers
  grep -rnE "@deprecated|\"deprecated\":\s*true" \
    --include="*.ts" --include="*.js" --include="*.yaml" --include="*.json" . \
    | grep -v node_modules

  # Versioned route prefixes
  grep -rnE "/v[0-9]+/|@Controller\(['\"]v[0-9]+" \
    --include="*.ts" --include="*.py" --include="*.go" . | grep -v node_modules

  For each deprecated field: POST with field populated → still 200/201.
  For each versioned route: old route still accepts payload lacking
  v2-only fields.

Webhook delivery scan (extends side-effect sink scan — emit WEBHOOK rows):
  Use results from the side-effect scan above; for each outgoing webhook,
  emit 5 WEBHOOK probes: payload shape matches schema, signature valid,
  receiver 500 → retry-with-backoff, receiver 400 → no retry, idempotency
  key deduplicates.

Accessibility + responsive (no scan needed — apply per Green page):
  For every page route from Phase 1A scored Green in 1E:
    - A11Y: inject axe-core, assert 0 WCAG A+AA violations
    - RESPONSIVE: test at 375px / 768px / 1440px, assert no horizontal
      scroll, primary action reachable, no overlap

Cache / stale-data + optimistic concurrency (no scan — apply per mutation):
  For every PATCH/PUT/POST:
    - CACHE: after 200, GET /:id within 100ms returns new value
    - OPTIMISTIC (if version/etag/If-Match detected): two parallel PATCHes
      with same stale version → one 200, one 409

Multi-actor detection (emit MULTI-ACTOR matrix rows when applicable):
  # Bulk-recipient / multi-target endpoint signatures
  grep -rn "recipientIds\|userIds\|candidateIds\|memberIds\|targetIds" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" --include="*.java" . \
    | grep -v node_modules | grep -v spec

  # Broadcast / bulk-operation endpoints
  grep -rn "broadcast\|sendBulk\|bulkCreate\|bulkDelete\|fanout" \
    --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" . \
    | grep -v node_modules | grep -v spec

  For each detection, emit matrix rows:
    | Scenario              | Actors needed | Assertion                                       |
    | Broadcast fanout      | 1 admin + N candidates | admin sends → every candidate sees        |
    | Concurrent edit       | 2 admins      | simultaneous save → 409 or last-write-wins per policy |
    | Race on unique        | 2 clients     | both POST same unique key → exactly 1 × 201, 1 × 409 |
    | Parallel independence | N candidates  | each uploads own doc → no cross-contamination   |

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
