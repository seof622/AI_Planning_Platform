# 실제 환경 Planning E2E Smoke Test

- 실행일: 2026-08-21
- 환경: 로컬 Web, Docker Compose API, PostgreSQL, 실제 OpenAI API
- 테스트 프로젝트: `project-80763933-3f8d-424e-a6f5-1d37ffe6ead1`
- 범위: API·DB 수준 E2E 및 허용 모델별 실제 생성

## 결과 요약

| 검증 항목 | 결과 |
| --- | --- |
| API 및 PostgreSQL health | 통과 |
| 프로젝트 생성 | 통과 |
| Planning Brief 저장·조회 | 통과 |
| Mini 실제 생성 | 통과 |
| Luna 실제 생성 | 통과 |
| Terra 실제 생성 | 통과 |
| Sol 실제 생성 | 통과 |
| 최신 결과 복원 | 통과 |
| 모델별 생성 이력 조회 | 통과 |
| 과거 결과 새 버전 복원 | 통과 |
| 브라우저 새로고침 UI 복원 | 통과 |
| 브라우저 모델 추천·수동 선택 | 통과 |
| 브라우저 이력 선택·복원 | 통과 |
| Graph 편집 API·DB 새 버전 저장 | 통과 |

## 모델별 생성 결과

동일한 Planning Brief로 각 허용 모델을 한 번씩 호출했다.

| 모델 | metadata.model | Node | Roadmap | 결과 |
| --- | --- | ---: | ---: | --- |
| `gpt-5-mini` | `gpt-5-mini` | 6 | 5 | 통과 |
| `gpt-5.6-luna` | `gpt-5.6-luna` | 5 | 4 | 통과 |
| `gpt-5.6-terra` | `gpt-5.6-terra` | 5 | 5 | 통과 |
| `gpt-5.6-sol` | `gpt-5.6-sol` | 5 | 4 | 통과 |

각 결과는 비어 있지 않은 graph와 roadmap을 반환했으며 요청 모델과
`metadata.model`이 일치했다. 이 smoke test의 단일 관측 시간은 성능 비교
자료로 사용하지 않는다.

## Persistence 및 복원

1. 프로젝트 생성 후 Planning Brief를 저장했다.
2. Brief 조회 결과에서 요구사항, context 2개, 선택 모델을 확인했다.
3. 네 모델로 생성한 뒤 최신 결과와 프로젝트 Brief 모델이
   `gpt-5.6-sol`로 일치했다.
4. 생성 이력에 Mini, Luna, Terra, Sol 결과 4건이 최신순으로 저장됐다.
5. Mini 결과를 복원하자 원본을 수정하지 않고 새 결과가 생성되어 이력이
   5건으로 증가했다.
6. 새 이력의 `restoredFromResultId`가 원본 Mini 결과 ID와 일치했다.
7. 최신 결과와 Planning Brief의 선택 모델이 모두 `gpt-5-mini`로 복원됐다.

## 브라우저 UI 검증

인앱 브라우저 세션을 다시 연결해 동일 테스트 프로젝트에서 다음 UI 흐름을
후속 검증했다.

1. 모델 추천 표시에서 `gpt-5.6-terra`가 추천 옵션으로 노출되는 것을 확인했다.
2. AI 모델 select를 `gpt-5.6-sol`로 수동 변경하자 선택값과 모델 설명이
   Sol 기준으로 전환됐다.
3. 다시 `gpt-5-mini`로 되돌린 뒤 화면 새로고침을 수행했다.
4. 새로고침 후 테스트 프로젝트, Brief, 최신 결과, graph, roadmap이 복원됐다.
5. 생성 이력에서 과거 Sol 결과를 선택하자 폼의 최근 결과 모델이 Sol로
   동기화되고 `이 버전 복원` 버튼이 표시됐다.
6. 복원 버튼 실행 후 최신 Sol 결과가 새 버전으로 추가되어 생성 이력이
   6건으로 증가했다.

브라우저 콘솔의 error/warn 로그는 검증 중 관찰되지 않았다. 다만 인앱
브라우저의 DOM snapshot API가 현재 환경에서 동작하지 않아, UI 검증은
읽기 전용 page evaluate와 명시적 form control 조작으로 수행했다.

## Graph 편집 후속 Smoke Test

동일 E2E 프로젝트의 최신 결과에서 첫 node 이름과 x 위치를 변경한 뒤 Graph
편집 endpoint로 저장했다.

- 저장 전 이력: 6건
- 저장 후 이력: 7건
- 최신 node label: `요구사항 및 범위 정의 [편집 E2E]`
- 최신 node x 위치: `20`
- 새 결과의 `editedFromResultId`: 편집 대상 결과 ID와 일치
- 이력 응답의 `editedFromResultId`: 편집 대상 결과 ID와 일치

## 데이터 정리 참고

이번 테스트는 실제 PostgreSQL에 E2E 전용 프로젝트와 계획 결과 7건을 남겼다.
테스트 데이터 자동 정리 API가 없으므로 삭제가 필요하면 명시적인 관리 절차를
정의한 뒤 처리한다.
