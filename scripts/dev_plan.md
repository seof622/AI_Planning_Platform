# scripts Development Plan

## 역할

`scripts`는 로컬 개발, DB 초기화, fixture 생성, AI workflow 검증을 자동화하는 스크립트를 담는다.

초기에는 반복 작업을 줄이는 작은 helper 중심으로 시작하고, 실행 경로가 안정된 뒤 운영성 스크립트를 추가한다.

## 개발 순서

1. 프로젝트 skeleton이 생긴 뒤 local setup helper를 추가한다.
2. Web/API mock fixture를 생성하거나 검증하는 script를 추가한다.
3. Docker Compose 실행과 DB 초기화 helper를 추가한다.
4. AI workflow를 고정 입력으로 실행하는 smoke test script를 추가한다.
5. persistence 단계에서 seed data와 migration helper를 추가한다.

## 주요 산출물

- Local setup helper
- Mock fixture validation script
- Docker helper commands
- DB initialization script
- AI workflow smoke test script
- Seed data loader

## 테스트 또는 검증 기준

- script는 같은 입력에 대해 반복 실행 가능해야 한다.
- 실패 시 원인을 알 수 있는 exit code와 message를 제공한다.
- repo root 기준으로 실행 경로가 명확해야 한다.
- scripts가 source code contract와 drift되지 않도록 테스트 또는 CI에서 검증한다.

## 후순위 항목

- Release automation
- Deployment helper
- Data migration assistant
- AI evaluation batch runner
