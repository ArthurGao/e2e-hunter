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

## Install (dev mode — editable alongside your project)

```bash
mkdir -p .claude/skills
unzip e2e-hunter.zip -d .claude/skills/
```

Then add to your `CLAUDE.md`:

```markdown
## Available Skills

### E2E Hunter — Bug Hunting
Skill: .claude/skills/e2e-hunter/SKILL.md
When asked to hunt bugs, generate E2E tests, or scan scenarios,
read this skill first before doing anything.
```

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

Paste from `prompts/` in order:

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
    ├── playwright.config.ts
    ├── auth.setup.ts
    ├── multi-app.fixture.ts
    ├── wait-for-sync.ts
    ├── page.spec.ts.template
    ├── api.spec.ts.template
    ├── cross-app.spec.ts.template
    └── .env.test.example
```
