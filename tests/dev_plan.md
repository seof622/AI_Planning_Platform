# tests Development Plan

## 역할

`tests`는 web, API, AI, database가 함께 동작하는지 검증하는 cross-layer 테스트를 담는다.

각 패키지 내부 단위 테스트와 별개로, 사용자의 핵심 흐름이 실제로 연결되는지를 확인하는 데 집중한다.

## 개발 순서

1. shared fixture를 기준으로 graph contract 검증 테스트를 만든다.
2. Web mock graph rendering 테스트를 추가한다.
3. API mock planning endpoint 통합 테스트를 추가한다.
4. Web과 API를 연결한 happy path E2E 테스트를 추가한다.
5. AI layer가 붙은 뒤 schema-valid output integration test를 추가한다.
6. DB persistence가 붙은 뒤 project save/load scenario를 추가한다.

## 주요 산출물

- Shared contract tests
- Web rendering tests
- API integration tests
- AI workflow integration tests
- E2E happy path tests
- Persistence scenario tests

## 테스트 또는 검증 기준

- 요구사항 입력 후 graph와 roadmap이 표시된다.
- API mock response가 frontend contract와 일치한다.
- AI output이 shared schema를 만족한다.
- 저장한 project를 다시 불러오면 graph와 roadmap이 유지된다.
- Docker 환경에서도 핵심 API 테스트가 통과한다.

## 후순위 항목

- Visual regression tests
- Load tests for AI generation
- Contract tests against generated OpenAPI client
- Long-running evaluation suite
