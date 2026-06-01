# infra/docker Development Plan

## 역할

`infra/docker`는 local development runtime을 재현 가능하게 만드는 Docker 관련 파일을 담는다.

Docker는 FastAPI 기본 서버가 실행 가능한 상태가 된 직후 도입한다. 그래야 Docker 환경을 `/health` endpoint로 바로 검증할 수 있다.

## 개발 순서

1. `apps/api`에 FastAPI skeleton과 `/health` endpoint를 만든다.
2. API Dockerfile을 작성한다.
3. Docker Compose에 API service를 추가한다.
4. PostgreSQL service와 named volume을 추가한다.
5. `.env.example` 기준으로 환경 변수를 정리한다.
6. DB persistence 단계에서 migration 실행 command를 Compose 흐름에 연결한다.

## 주요 산출물

- API Dockerfile
- Docker Compose file
- PostgreSQL service
- Named database volume
- Local environment example
- Container health check guide

## 테스트 또는 검증 기준

- Docker Compose 실행 후 API container가 올라온다.
- `/health`가 host에서 접근 가능하다.
- PostgreSQL container가 정상 실행된다.
- compose down/up 이후 DB volume 유지 여부를 확인할 수 있다.

## 후순위 항목

- Web container
- Production Dockerfile
- Multi-stage build optimization
- Container-based test runner
