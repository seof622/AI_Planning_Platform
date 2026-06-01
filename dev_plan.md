# AI Planning Platform Development Plan

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
