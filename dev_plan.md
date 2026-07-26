# AI Planning Platform Development Plan

## 추가 작업 계획 2026-07-26 - AI 모델 선택 UI

상태: 구현 및 기본 검증 완료

- 모델 카탈로그 API, 요청별 모델 선택, Web select UI 연결 완료.
- Shared/Web typecheck, canonical mock validation, API test 13개 통과.
- Web production build와 Docker API model catalog smoke test 통과.
- API 크레딧 충전 후 Web에서 실제 OpenAI 계획 생성 성공을 확인했다.
- 새로고침 후 DB 결과 복원과 허용 모델별 smoke test는 후속 E2E로 진행한다.

### 목표

사용자가 계획 생성 전에 서버가 허용한 OpenAI 모델 중 하나를 선택하고,
API가 선택값을 검증한 뒤 해당 모델로 계획을 생성하도록 한다.
클라이언트가 임의의 모델 ID를 직접 지정하는 방식은 허용하지 않는다.

### 현재 구조 분석

- 현재 기본 모델은 루트 `.env`와 `compose.yaml`의 `OPENAI_MODEL` 한 개로 결정된다.
- `OpenAIPlanningProvider`는 생성 시 모델을 고정하며 `PlanningWorkflow`도 API에서
  `lru_cache`로 재사용되므로 요청별 모델 선택을 처리할 수 없다.
- Web의 `PlanningRequest`와 API의 Pydantic schema에는 모델 선택 필드가 없다.
- `PlanningResult.metadata.model`과 `planning_results.model` 컬럼에는 실제 사용
  모델이 이미 저장되므로 첫 구현에는 DB migration이 필요하지 않다.
- Web에 모델 ID를 하드코딩하면 지원 모델 변경, 계정별 접근 권한, 비용 정책과
  쉽게 불일치한다.

### 설계 원칙

1. 모델 허용 목록과 기본 모델의 최종 권한은 API 서버가 가진다.
2. Web은 서버가 반환한 허용 목록만 표시하고 임의 문자열을 전송하지 않는다.
3. `OPENAI_MODEL`은 기본 선택값으로 유지하고 `OPENAI_ALLOWED_MODELS`를 추가한다.
4. 선택 모델은 Planning 요청의 명시적 options 필드로 전달한다.
5. 실제 사용 모델은 기존 `PlanningResult.metadata.model`과 DB `model` 컬럼에
   계속 기록한다.
6. 허용되지 않거나 사용할 수 없는 모델은 생성 전에 422 응답으로 차단한다.
7. 모델 접근 권한, quota, rate limit 오류는 현재 provider 오류 형식을 유지해
   사용자가 원인을 확인할 수 있게 한다.

### 변경 대상

#### 1. 환경 설정과 API 모델 카탈로그

- `.env.example`에 쉼표 구분 `OPENAI_ALLOWED_MODELS` 예시를 추가한다.
- `OPENAI_MODEL`이 허용 목록에 포함되는지 API 시작 또는 설정 로드 시 검증한다.
- `GET /planning/models` endpoint를 추가한다.
- 응답에는 모델 ID, 사용자 표시명, 기본 선택 여부만 포함한다.
- API key, 내부 비용 한도, provider credential은 응답에 포함하지 않는다.

#### 2. Shared Planning 계약

- `packages/shared`에 모델 option과 모델 카탈로그 응답 타입을 추가한다.
- `PlanningRequest.options.model`을 명시적 필드로 정의한다.
- 문자열 길이와 빈 값 검증은 shared helper와 API schema 양쪽에서 일치시킨다.
- `docs/planning-result-contract.md`에 모델 선택 요청·응답 규칙을 문서화한다.

#### 3. API와 AI workflow

- API Pydantic `PlanningOptions`에 `model` 필드를 추가한다.
- 요청 모델이 서버 허용 목록에 속하는지 검증한다.
- 전역으로 캐시된 단일 모델 workflow 구조를 요청 모델별 provider/workflow
  생성 또는 모델별 안전한 cache 구조로 변경한다.
- `OpenAIPlanningProvider`가 검증된 요청 모델을 사용하도록 연결한다.
- 요청값이 없으면 `OPENAI_MODEL` 기본값을 사용해 기존 호출과 호환한다.
- normalization 결과의 `metadata.model`이 실제 호출 모델과 동일한지 검증한다.

#### 4. Web UI와 상태

- 계획 입력 영역에 `AI 모델` select를 추가한다.
- 초기 화면에서 `GET /planning/models`를 호출해 허용 모델 목록과 기본값을
  불러온다.
- 목록 loading, 조회 실패, 빈 목록 상태를 처리한다.
- 모델 목록이 없거나 선택값이 없으면 계획 생성 버튼을 비활성화한다.
- 선택 모델을 Zustand state에 보관하고 `PlanningRequest.options.model`로 보낸다.
- 저장된 최신 결과를 불러오면 `metadata.model`을 결과 정보로 표시한다.
- 이전 결과의 모델이 현재 허용 목록에서 제거됐더라도 결과 열람은 허용하되,
  새 생성에는 현재 허용 모델을 다시 선택하게 한다.

#### 5. 테스트

- shared: 모델 option validation과 기존 model 없는 요청의 하위 호환성 테스트.
- API: 모델 목록, 기본 모델, 허용 모델, 비허용 모델 422 응답 테스트.
- AI: 요청별 모델 전달과 `metadata.model` 일치 테스트.
- Web: 목록 loading/error/empty, 기본 선택, 생성 request payload 테스트.
- persistence: 선택 모델이 JSONB metadata와 `planning_results.model`에 동일하게
  저장되는지 round-trip 테스트.
- E2E: 서로 다른 허용 모델로 생성 후 프로젝트 최신 결과 복원까지 확인한다.

### 구현 순서

1. 서버 설정과 모델 카탈로그 endpoint를 먼저 구현한다.
2. Shared/API request contract와 검증을 추가한다.
3. AI workflow를 요청별 모델 실행 구조로 변경한다.
4. API 단위 테스트와 persistence 테스트를 통과시킨다.
5. Web select UI와 Zustand/request 연결을 구현한다.
6. Web typecheck/build와 전체 API 테스트를 실행한다.
7. 실제 API key 환경에서 허용 모델별 smoke test를 수행한다.

### 완료 기준

- Web에서 서버 허용 모델만 선택할 수 있다.
- 선택한 모델이 실제 OpenAI 요청과 결과 metadata, DB 저장값에 일관되게 반영된다.
- 모델을 선택하지 않은 기존 요청은 서버 기본 모델로 정상 동작한다.
- 비허용 모델은 OpenAI 호출 전에 차단된다.
- 모델 목록 조회 실패가 기존 프로젝트와 저장 결과 열람을 막지 않는다.
- 비밀값이 Web bundle, API 응답, Git diff에 포함되지 않는다.

### 후속 검토

- 모델별 예상 비용·속도·품질 설명과 추천 표시.
- 프로젝트별 기본 모델 저장.
- 관리자 역할 기반 모델 허용 정책.
- 생성 이력과 모델별 품질·비용 평가 대시보드.

## 목표

AI Planning Platform은 사용자의 아이디어와 요구사항을 구조화된 설계, dependency graph, 실행 가능한 로드맵으로 변환하는 플랫폼이다.

초기 개발 목표는 AI 품질을 완성하기 전에 제품의 핵심 사용 흐름을 눈으로 확인할 수 있는 MVP를 만드는 것이다. 따라서 개발은 Canvas UI를 먼저 만들고, 이후 FastAPI, Docker, API 연결, AI layer, DB persistence 순서로 확장한다.

## 전체 개발 순서

1. 공통 도메인 모델 정의
2. Frontend Canvas MVP 구축
3. AI 결과 계약 설계
4. FastAPI 기본 서버 구축
5. Docker Compose 구축
6. Web과 API 연결
7. AI Layer 실제 연동
8. PostgreSQL persistence 추가
9. 제품 기능 고도화

## 단계별 상세 계획

1. 공통 도메인 모델 정의
   - `packages/shared`에 project, requirement, component node, dependency edge, roadmap step의 기본 구조를 정의한다.
   - Web, API, AI layer가 같은 graph contract를 바라보도록 한다.

2. Frontend Canvas MVP 구축
   - `apps/web`에 Next.js, React, React Flow, Zustand 기반 UI를 구성한다.
   - 요구사항 입력 패널, graph canvas, node detail panel, roadmap panel을 mock data로 먼저 완성한다.

3. AI 결과 계약 설계
   - mock data를 기준으로 AI 출력 JSON 구조를 고정한다.
   - malformed output을 줄이기 위해 필수 필드와 허용 가능한 node/edge/roadmap 형태를 문서화한다.

4. FastAPI 기본 서버 구축
   - `apps/api`에 `/health`, `/planning/mock`, `/planning/generate`의 기본 구조를 만든다.
   - 처음에는 DB 없이 request/response contract와 CORS 설정을 검증한다.

5. Docker Compose 구축
   - FastAPI 서버가 실행 가능한 상태가 된 직후 Docker를 도입한다.
   - API container, PostgreSQL container, volume, `.env.example`을 준비한다.

6. Web과 API 연결
   - Web의 mock data 직접 참조를 API 호출 방식으로 전환한다.
   - loading, error, empty state를 UI에서 처리한다.

7. AI Layer 실제 연동
   - `packages/ai`에서 LangGraph와 OpenAI API 기반 planning workflow를 구현한다.
   - API는 AI output을 shared contract에 맞게 정규화해 반환한다.

8. PostgreSQL persistence 추가
   - project, requirement, generated graph, roadmap 저장 구조를 추가한다.
   - migration과 local seed data를 준비한다.

9. 제품 기능 고도화
   - graph 수정, roadmap 편집, 재생성 버전 관리, 인증, 협업 기능을 MVP 이후에 검토한다.

## Docker 도입 시점

Docker는 FastAPI 기본 서버가 만들어진 직후, PostgreSQL persistence를 구현하기 전에 도입한다.

이 시점이 적절한 이유는 다음과 같다.

- `/health`로 API container 실행 여부를 검증할 수 있다.
- DB schema가 확정되기 전에도 PostgreSQL runtime을 먼저 고정할 수 있다.
- persistence 구현 시 로컬 환경 차이로 인한 문제를 줄일 수 있다.

## 테스트 전략

- `packages/shared`: graph model과 fixture가 contract를 만족하는지 검증한다.
- `apps/web`: mock graph 렌더링, node 선택, roadmap 표시, empty/error state를 검증한다.
- `apps/api`: health check, mock planning response, invalid request validation을 검증한다.
- `packages/ai`: 고정 입력에 대해 schema-valid output을 반환하는지 검증한다.
- `tests`: 요구사항 입력 후 graph와 roadmap이 표시되는 end-to-end happy path를 검증한다.

## MVP 이후 확장 항목

- 실제 AI output 품질 개선과 prompt/version 관리
- 프로젝트 저장, graph versioning, regeneration history
- 사용자 인증과 project ownership
- Vector DB와 RAG pipeline
- tldraw SDK 또는 고급 canvas editing
- 배포 환경, observability, 비용 모니터링

## 현재 다음 실행 계획

현재 구현은 `packages/shared`의 TypeScript 도메인 모델과 `apps/web`의 프론트엔드 Canvas MVP가 어느 정도 갖춰진 상태다.
따라서 바로 API 서버를 만들기 전에, Web, API, AI Layer가 함께 사용할 planning contract를 먼저 안정화한다.

### Step 1. Planning Result 계약 문서화

- `docs/planning-result-contract.md`를 작성한다.
- Web, API, AI가 주고받는 `PlanningRequest`와 `PlanningResult` 구조를 문서화한다.
- 필수 필드, enum 값, graph consistency 규칙, empty/error state 처리 기준을 정의한다.
- 완료 기준: 이 문서가 `/planning/mock`, `/planning/generate`, AI output normalization의 기준 문서로 사용될 수 있어야 한다.

### Step 2. Shared 런타임 검증 추가

- `packages/shared`에 런타임 검증 helper를 추가한다.
- 필수 배열, node id, edge reference, roadmap dependency, metadata 기본 조건을 검증한다.
- API layer에서 더 엄격한 schema library가 필요해지기 전까지는 dependency-free 방식으로 가볍게 유지한다.
- 완료 기준: shared typecheck가 통과하고, mock fixture를 코드로 검증할 수 있어야 한다.

### Step 3. Mock Fixture 정리

- UI나 terminal에서 한글 mock fixture 텍스트가 깨져 보이면 정상 한글 문구로 정리한다.
- Web, API, tests가 같은 fixture를 재사용할 수 있도록 id와 구조 필드는 안정적으로 유지한다.
- 완료 기준: mock result가 graph consistency를 유지하면서 canonical example로 읽기 쉬운 상태여야 한다.

### Step 4. FastAPI Skeleton 구현

- `apps/api`에 `/health`, `/planning/mock`, `/planning/generate` 기본 endpoint 구조를 만든다.
- `/planning/mock`은 shared mock contract와 같은 shape를 반환한다.
- 문서화된 contract 기준으로 request/response validation을 추가한다.
- 완료 기준: API가 로컬에서 실행되고, 이후 Web이 직접 mock fixture를 import하는 방식에서 HTTP 호출 방식으로 전환할 수 있어야 한다.

### Step 5. Web/API 연결

- `apps/web/src/lib/mockPlanningClient.ts`의 직접 fixture 접근을 API 호출 방식으로 교체한다.
- 기존 loading, error, empty state 동작은 유지한다.
- 완료 기준: Web이 API response로부터 기존과 동일한 graph와 roadmap을 렌더링해야 한다.

## 진행 메모 2026-07-12

- `packages/shared` typecheck와 mock fixture contract 검증 통과.
- `apps/api` FastAPI 테스트 통과.
- `apps/web` typecheck 통과.
- `compose.yaml`, `apps/api/Dockerfile`, 루트 `.env.example`로 Docker Compose 로컬 런타임 초안 추가.
- Docker Compose 설정 문법 검증 통과.
- `docker compose build api` 통과.
- `docker compose up -d api postgres` 실행 후 API와 PostgreSQL healthcheck 통과.
- `GET /health`가 `{"status":"ok"}`를 반환하는 것을 확인.

### 다음 작업

1. API key가 설정된 환경에서 실제 생성 결과의 canvas/roadmap 렌더링을 검증한다.
2. 대표 요구사항을 모아 AI output 품질과 graph consistency를 평가한다.
3. 이후 PostgreSQL persistence 단계로 넘어간다.

## 진행 메모 2026-07-24

- `packages/ai`에 LangGraph planning workflow 추가.
- OpenAI Responses API와 Pydantic Structured Outputs 기반 provider adapter 추가.
- AI 결과의 node/edge/roadmap reference 검증과 canvas position 정규화 추가.
- `/planning/generate`를 실제 AI workflow에 연결하고 provider 오류를 HTTP 응답으로 변환.
- Web 계획 생성 요청을 `/planning/mock`에서 `/planning/generate`로 전환.
- API 테스트, Web typecheck/build, API Docker image build 통과.
- `OPENAI_API_KEY`와 API 크레딧 설정 후 Web의 실제 OpenAI 계획 생성 성공 확인.

## 진행 메모 2026-07-24 - PostgreSQL Persistence

- SQLAlchemy repository layer와 PostgreSQL Psycopg driver 추가.
- `projects`, `requirements`, `planning_results` 초기 Alembic migration 추가.
- PlanningResult 전체 계약을 JSONB로 저장하고 그대로 복원하는 구조 적용.
- 프로젝트 생성, 목록, 상세, 프로젝트별 계획 생성, 최신 결과 조회 API 추가.
- API container 시작 시 PostgreSQL migration 자동 적용.
- canonical mock fixture를 저장하는 local seed script 추가.
- SQLite repository round-trip 테스트 및 PostgreSQL migration 검증 추가.

### 다음 작업

1. 실제 AI 생성 성공은 확인했으며, 새로고침 후 DB 결과 복원까지 end-to-end로 검증한다.
2. Web 프로젝트·모델 선택·결과 복원 흐름의 자동화 테스트 5개 추가 완료.
3. Planning brief 전체를 저장하고 프로젝트 재선택 시 복원하도록 확장한다.
4. 대표 입력 평가와 AI prompt/version 품질 관리를 시작한다.
5. Next.js와 ESLint config를 15.5.22로 업데이트해 Next 직접 취약점을 해결했다.
   - Web test 5개, typecheck, lint, production build 통과.
   - 현재 Next 15·16이 고정하는 PostCSS 8.4.31과 Sharp 0.34.x 관련 audit
     경고는 upstream 안전 버전 반영 후 후속 패치한다.
