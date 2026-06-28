# Planning Result Contract

This document defines the planning request and result contract shared by the Web app, API server, and AI workflow.
It is the source of truth for `/planning/mock`, `/planning/generate`, and AI output normalization.

## Scope

- Web submits a `PlanningRequest`.
- API validates the request, calls either mock data or the AI workflow, and returns a `PlanningResult`.
- AI workflow output must be normalized into the same `PlanningResult` shape before reaching Web.
- Persistence can store the same shape or a decomposed equivalent later, but must preserve ids and references.

## Request Shape

`PlanningRequest` is defined in `packages/shared/src/types.ts`.

Required:

- `requirement`: non-empty user goal or requirement text after trimming.

Optional:

- `brief`: structured planning hints from the left input panel.
- `project`: existing project summary when regenerating or extending a plan.
- `options`: generation options.
- `metadata`: caller metadata for debugging or workflow routing.

### `brief`

`brief.actionItems`:

- Each item has `title` and `necessity`.
- `necessity` must be `required` or `optional`.
- Empty titles should be trimmed out before API or AI execution.

`brief.context`:

- List of non-empty target, situation, audience, or domain strings.
- Empty values should be trimmed out.

`brief.planType`:

- Allowed values: `daily`, `project`, `learning`, `event`, `decision`, `creative`.

`brief.successCriterion`:

- Allowed values: `clarity`, `speed`, `balance`, `quality`, `consistency`.

`brief.constraints`:

- Optional free-form constraints.
- Empty value should be omitted or treated as undefined.

## Result Shape

`PlanningResult` is defined in `packages/shared/src/types.ts`.

Required:

- `nodes`: array of `ComponentNode`.
- `edges`: array of `DependencyEdge`.
- `roadmap`: array of `RoadmapStep`.
- `summary`: human-readable summary.
- `metadata.generatedAt`: ISO date string.

Optional:

- `project`: project record when a project exists.
- `requirement`: requirement record when the result is tied to a persisted or generated requirement.
- `metadata.model`: model or mock source.
- `metadata.workflowVersion`: AI workflow or contract version.

## Component Nodes

Each `ComponentNode` must have:

- `id`: stable unique id within the result.
- `type`: one of `feature`, `system`, `api`, `data`, `ai`, `infra`, `ui`, `workflow`.
- `label`: display name.
- `description`: display description.
- `category`: grouping label.
- `priority`: one of `low`, `medium`, `high`.
- `position`: `{ x: number, y: number }` for canvas rendering.

Rules:

- Node ids must be unique.
- `position.x` and `position.y` must be finite numbers.
- `metadata` may contain arbitrary JSON-compatible values, but UI must not depend on unknown keys.

## Dependency Edges

Each `DependencyEdge` must have:

- `id`: stable unique id within the result.
- `source`: node id.
- `target`: node id.
- `label`: edge label.
- `dependencyType`: one of `requires`, `feeds`, `blocks`, `related`.

Rules:

- Edge ids must be unique.
- `source` and `target` must exist in `nodes`.
- Self-referencing edges are discouraged and should be rejected unless a future workflow explicitly needs them.

## Roadmap Steps

Each `RoadmapStep` must have:

- `id`: stable unique id within the result.
- `title`: step title.
- `description`: step description.
- `order`: positive integer ordering value.
- `priority`: one of `low`, `medium`, `high`.
- `estimatedEffort`: one of `small`, `medium`, `large`.
- `dependsOn`: list of roadmap step ids.
- `componentNodeIds`: optional list of related node ids.

Rules:

- Step ids must be unique.
- `order` values should be unique and sortable.
- Every `dependsOn` id must exist in `roadmap`.
- Every `componentNodeIds` id must exist in `nodes`.
- Dependency cycles should be avoided. The first API version may only validate references; AI workflow can add cycle checks later.

## Empty And Error States

API should use HTTP semantics for transport errors and return structured result data only for successful planning responses.

Recommended endpoints:

- `GET /health`: returns API status.
- `POST /planning/mock`: accepts `PlanningRequest`, returns mock `PlanningResult`.
- `POST /planning/generate`: accepts `PlanningRequest`, returns generated `PlanningResult`.

Web state mapping:

- Empty request or validation failure: show error state with a readable message.
- Successful response with no nodes: show empty state.
- Successful response with nodes: show ready state.
- Network or server failure: show error state.

## Mock Contract

The mock fixture in `packages/shared/src/fixtures/mockPlanningResult.ts` must satisfy this contract.
It should remain graph-consistent and readable because it is the canonical example for Web, API, and future tests.

Minimum mock requirements:

- At least one node.
- All edges reference existing nodes.
- At least one roadmap step.
- Roadmap step references point to existing steps and nodes.
- `metadata.model` should be `mock`.
- `metadata.workflowVersion` should identify the current contract version.

## Validation Strategy

Short term:

- Keep validation dependency-free in `packages/shared`.
- Provide a lightweight helper that reports contract errors.
- Use it in tests, API mock responses, and AI output normalization.

Later:

- Introduce a stricter schema library only when API runtime validation needs richer error details.
- Keep TypeScript types and runtime schema generated from one source or reviewed together.
