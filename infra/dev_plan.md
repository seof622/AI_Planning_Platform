# infra Development Plan

## 역할

`infra`는 local runtime, Docker, PostgreSQL, migration, future deployment configuration을 관리한다.

초기에는 개발자가 같은 방식으로 API와 DB를 실행할 수 있게 만드는 데 집중한다.

## 개발 순서

1. FastAPI 기본 서버가 만들어질 때까지 기다린다.
2. API가 `/health`를 제공하면 Docker Compose를 추가한다.
3. PostgreSQL container, volume, environment variable 구조를 준비한다.
4. DB persistence 단계에서 migration 실행 방식을 추가한다.
5. 이후 deployment와 observability 설정을 확장한다.

## 주요 산출물

- Dockerfile for API
- Docker Compose configuration
- PostgreSQL service definition
- Environment example
- DB volume configuration
- Migration execution guide

## 테스트 또는 검증 기준

- Docker Compose로 API와 PostgreSQL이 함께 실행된다.
- API container의 `/health` endpoint가 정상 응답한다.
- PostgreSQL data가 volume에 유지된다.
- migration command가 로컬과 container 환경에서 동일하게 동작한다.

## 후순위 항목

- Production deployment configuration
- Managed database configuration
- Monitoring and logging stack
- Secret management
