# apps/api Development Plan

## 역할

`apps/api`는 frontend, AI planning engine, PostgreSQL 사이의 server boundary이다.

초기에는 FastAPI 기반으로 request/response contract를 안정화하고, 이후 AI workflow와 persistence를 연결한다.

## 개발 순서

1. FastAPI application skeleton을 만든다.
2. `/health` endpoint로 서버 실행 상태를 검증한다.
3. CORS, environment variable, application settings 구조를 추가한다.
4. `/planning/mock` endpoint로 frontend 연동용 고정 응답을 제공한다.
5. `/planning/generate` endpoint의 request/response 형태를 정의한다.
6. Docker Compose 환경에서 API container 실행을 검증한다.
7. `packages/ai` workflow를 호출하도록 연결한다.
8. PostgreSQL persistence와 project API를 추가한다.

## 주요 산출물

- FastAPI server skeleton
- Health check endpoint
- Planning request/response models
- Mock planning endpoint
- AI orchestration endpoint
- Project persistence endpoint
- Environment configuration

## 테스트 또는 검증 기준

- `/health`가 200 응답을 반환한다.
- invalid planning request가 validation error를 반환한다.
- `/planning/mock`이 frontend contract와 일치하는 graph를 반환한다.
- AI 호출 실패 시 timeout, malformed output, provider error를 구분해 반환한다.
- Docker Compose 환경에서도 동일한 endpoint가 동작한다.

## 후순위 항목

- Authentication middleware
- Rate limiting
- Background job queue
- Streaming progress response
- API observability
