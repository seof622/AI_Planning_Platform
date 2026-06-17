# packages/ai Development Plan

## 역할

`packages/ai`는 사용자의 요구사항을 분석해 추천 컴포넌트, dependency graph, roadmap으로 변환하는 핵심 planning engine이다.

초기에는 단순한 단계형 workflow로 시작하고, 품질과 복잡도가 올라가면 LangGraph 기반 orchestration을 확장한다.

## 개발 순서

1. shared planning contract를 입력과 출력 경계로 사용한다.
2. requirement analysis, component recommendation, dependency graph generation, roadmap generation 단계를 함수 단위로 분리한다.
3. mock 또는 deterministic generator로 API 연결을 먼저 검증한다.
4. OpenAI API 호출을 추가하고 response normalization을 구현한다.
5. LangGraph workflow로 단계 간 상태 전달과 실패 처리를 명확히 한다.
6. workflow 단계별 progress event를 정의해 API layer가 실시간 상태 표시로 전달할 수 있게 한다.
7. malformed output, timeout, partial result handling을 추가한다.

## 주요 산출물

- Requirement analysis module
- Component recommendation module
- Dependency graph generation module
- Roadmap generation module
- LangGraph workflow
- OpenAI provider adapter
- Planning progress event model
- Output normalization and validation utility

## 테스트 또는 검증 기준

- 고정 입력에 대해 schema-valid planning result를 반환한다.
- AI가 edge source/target에 존재하지 않는 node id를 사용하면 validation에서 잡는다.
- requirement analysis, graph generation, roadmap generation 단계가 progress event로 표현된다.
- malformed output을 contract에 맞는 error로 변환한다.
- provider error와 timeout이 API layer에서 처리 가능한 형태로 전달된다.

## 후순위 항목

- Prompt versioning
- Evaluation dataset
- RAG pipeline
- Vector DB integration
- Multi-agent planning workflow
- Realtime status streaming optimization
