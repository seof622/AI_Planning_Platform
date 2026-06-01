# docs Development Plan

## 역할

`docs`는 제품 의도, architecture decision, API contract, user flow, planning process를 기록하는 공간이다.

이 프로젝트는 계획 수립 플랫폼이므로, 구현과 함께 의사결정의 이유를 문서로 남기는 것이 중요하다.

## 개발 순서

1. 현재 `project-structure.md`를 기준 문서로 유지한다.
2. MVP user flow를 문서화한다.
3. shared graph contract와 API response 예시를 문서화한다.
4. Docker local setup guide를 추가한다.
5. AI workflow와 prompt/versioning 정책을 문서화한다.
6. persistence와 migration 정책을 문서화한다.

## 주요 산출물

- User flow document
- API contract document
- Graph contract examples
- Architecture decision records
- Local development guide
- AI workflow notes

## 테스트 또는 검증 기준

- README의 개발 방향과 docs의 세부 문서가 충돌하지 않는다.
- API contract 문서와 실제 mock response field가 일치한다.
- Docker 도입 시점이 root plan, infra plan, docs guide에서 동일하게 설명된다.
- 새 기능 추가 시 관련 문서 업데이트 기준이 명확하다.

## 후순위 항목

- Product requirement document
- UX research notes
- Release notes
- Deployment runbook
