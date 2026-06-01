# infra/db Development Plan

## 역할

`infra/db`는 PostgreSQL schema, migration, seed data, local database operation을 관리한다.

`infra/db/migrations`는 migration 파일이 쌓이는 실행 폴더로 유지하고, 별도 계획 문서는 만들지 않는다.

## 개발 순서

1. Docker Compose에 PostgreSQL service를 먼저 준비한다.
2. API persistence가 필요해지는 시점에 migration tool을 선택한다.
3. Project, Requirement, GeneratedGraph, Roadmap 저장 구조를 설계한다.
4. 초기 migration을 작성한다.
5. local seed data 또는 fixture loading script를 추가한다.
6. API repository layer와 연결한다.

## 주요 산출물

- PostgreSQL schema
- Migration files
- Local seed data
- Database initialization guide
- Persistence verification scenario

## 테스트 또는 검증 기준

- migration이 빈 DB에서 성공한다.
- project 생성 후 graph와 roadmap을 저장할 수 있다.
- 저장된 project를 다시 조회하면 동일한 planning result를 복원할 수 있다.
- migration rollback 또는 재생성 정책이 문서화되어 있다.

## 후순위 항목

- Graph versioning table
- AI generation history
- Audit fields
- Backup and restore guide
