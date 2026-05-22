# Project Structure

```text
AI_Planning_Platform/
├─ apps/
│  ├─ web/                 # Next.js, React, React Flow, Zustand
│  └─ api/                 # FastAPI or NestJS backend application
├─ packages/
│  ├─ ai/                  # LangGraph workflows, OpenAI integration, planning agents
│  └─ shared/              # Shared types, schemas, constants, utilities
├─ infra/
│  ├─ docker/              # Docker and local runtime configuration
│  └─ db/
│     └─ migrations/       # PostgreSQL migration files
├─ docs/                   # Product, architecture, and planning documents
├─ scripts/                # Local development and automation scripts
├─ tests/                  # Cross-layer or integration tests
├─ README.md
└─ AI_Planning_Platform_Concept.pdf
```

## Layer Responsibilities

- `apps/web`: visual planning canvas, requirement input UI, graph rendering, roadmap views.
- `apps/api`: authentication, project APIs, persistence, AI orchestration endpoints.
- `packages/ai`: requirement analysis, component recommendation, dependency graph generation, roadmap generation.
- `packages/shared`: DTOs, validation schemas, graph models, common domain types.
- `infra`: PostgreSQL, container setup, environment examples, deployment support.
- `docs`: concept notes, architecture decisions, API contracts, user flows.
- `tests`: end-to-end scenarios and integration coverage across web, API, and AI flow.

## Design Rationale

This structure is based on the product goal described in the concept document:
turning a user's idea into a structured design and an executable plan.
The directories are separated by product responsibility, not only by technology.

```text
User interface          -> apps/web
Server API              -> apps/api
AI planning engine      -> packages/ai
Shared domain models    -> packages/shared
Runtime infrastructure  -> infra
Docs, tests, automation -> docs, tests, scripts
```

### `apps/web`

`apps/web` contains the user-facing application.
This is where requirement input screens, React Flow canvas views, generated component graphs,
roadmap views, and client-side state management belong.

The README lists Next.js, React, React Flow, and Zustand as frontend technologies,
so the frontend is isolated as its own application.

### `apps/api`

`apps/api` is the boundary between the frontend, AI layer, and database.
It is responsible for API endpoints, project persistence, authentication,
AI execution requests, and returning structured results to the web app.

The README mentions FastAPI or NestJS, so the folder is named `api`
instead of choosing a framework-specific name too early.

### `packages/ai`

`packages/ai` contains the core intelligence of the product.
This includes requirement analysis, AI component recommendation,
dependency graph generation, roadmap generation, LangGraph workflows,
and OpenAI API integration.

The AI logic could live inside the API server at first, but separating it early
makes the core planning engine easier to test, reuse, and evolve independently.

### `packages/shared`

`packages/shared` contains data structures and utilities used across multiple layers.
Examples include graph node models, dependency edge models, project plan schemas,
roadmap step types, validation schemas, constants, and shared helpers.

Keeping shared domain definitions in one place reduces mismatches between
frontend rendering, API responses, and AI-generated output.

### `infra`

`infra` contains runtime and environment-related configuration.
This includes Docker setup, PostgreSQL migration files, local development services,
and future deployment or Vector DB configuration.

Separating infrastructure from application code makes local development,
deployment, and database management easier to reason about.

### `docs`

`docs` is for product and engineering knowledge.
Concept notes, architecture decisions, API contracts, user flows,
and planning documents should live here.

Because this project is itself a planning platform,
keeping design decisions visible and versioned is especially useful.

### `scripts` and `tests`

`scripts` is reserved for local development and operational automation,
such as database initialization, seed data generation, or AI workflow utilities.

`tests` is reserved for cross-layer verification,
including integration tests, API tests, and end-to-end scenarios.

## Why This Helps

This layout keeps the early project lightweight while still giving it room to grow.
The frontend, backend, AI workflow, shared models, and infrastructure can evolve
without becoming tightly coupled too quickly.

As the platform grows, each layer has a clear home:

- UI complexity grows inside `apps/web`.
- API and persistence complexity grows inside `apps/api`.
- planning and reasoning complexity grows inside `packages/ai`.
- shared contracts stay centralized in `packages/shared`.
- environment and deployment concerns stay in `infra`.
