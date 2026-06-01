# apps Development Plan

## 역할

`apps`는 사용자-facing web application과 backend API application을 담는 계층이다.

`apps/web`은 요구사항 입력, React Flow canvas, graph rendering, roadmap view를 담당한다. `apps/api`는 frontend, AI layer, database 사이의 안정적인 server boundary를 담당한다.

## 개발 순서

1. `apps/web`에서 mock data 기반 Canvas MVP를 먼저 만든다.
2. `apps/api`에서 FastAPI 기본 서버와 health endpoint를 만든다.
3. API mock planning endpoint를 만든 뒤 web이 API를 호출하도록 전환한다.
4. Docker Compose 환경에서 API가 실행되는지 확인한다.
5. AI layer와 DB persistence를 API 뒤쪽에 순차적으로 연결한다.

## 주요 산출물

- Next.js 기반 web application skeleton
- React Flow canvas와 roadmap panel
- Zustand 기반 client state
- FastAPI backend skeleton
- `/health`, `/planning/mock`, `/planning/generate` endpoint
- Web/API request-response contract

## 테스트 또는 검증 기준

- Web이 mock graph를 정상 렌더링한다.
- 사용자가 node를 선택하면 detail panel이 갱신된다.
- API `/health`가 정상 응답한다.
- Web이 API mock planning endpoint를 호출해 graph를 표시한다.

## 후순위 항목

- Authentication
- Multi-user collaboration
- Project permission model
- Production deployment routing
