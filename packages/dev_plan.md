# packages Development Plan

## 역할

`packages`는 application layer에서 재사용되는 핵심 도메인 모델과 AI planning logic을 담는다.

`packages/shared`는 계약과 타입을 고정하고, `packages/ai`는 요구사항을 graph와 roadmap으로 변환하는 지능형 workflow를 담당한다.

## 개발 순서

1. `packages/shared`에서 graph와 roadmap contract를 먼저 정의한다.
2. Web mock data와 API response가 shared contract를 따르도록 한다.
3. `packages/ai`에서 contract를 입력/출력 경계로 사용하는 planning workflow를 설계한다.
4. AI output validation과 normalization을 추가한다.
5. API가 `packages/ai`를 호출하도록 연결한다.

## 주요 산출물

- Shared graph model
- Shared roadmap model
- Planning request/response contract
- AI workflow module
- Output normalization utility
- Test fixtures

## 테스트 또는 검증 기준

- fixture graph가 shared contract를 만족한다.
- Web/API/AI 문서에서 같은 field naming을 사용한다.
- AI workflow output이 node, edge, roadmap 필수 필드를 포함한다.

## 후순위 항목

- Versioned schema management
- Multi-provider AI abstraction
- Advanced planning heuristics
- RAG pipeline integration
