# packages/shared Development Plan

## 역할

`packages/shared`는 frontend, backend, AI layer가 공통으로 이해해야 하는 domain contract를 정의한다.

이 패키지의 가장 중요한 목표는 graph, roadmap, planning response 구조가 각 계층에서 어긋나지 않도록 하는 것이다.

## 개발 순서

1. Project, Requirement, ComponentNode, DependencyEdge, RoadmapStep의 기본 타입을 정의한다.
2. PlanningRequest와 PlanningResult 구조를 정의한다.
3. Web mock data가 shared type을 따르도록 fixture를 만든다.
4. API의 Pydantic model과 동일한 field naming을 유지한다.
5. AI output validation에 사용할 schema 기준을 문서화한다.

## 주요 산출물

- Project type
- Requirement type
- ComponentNode type
- DependencyEdge type
- RoadmapStep type
- PlanningRequest type
- PlanningResult type
- Sample fixture data

## 테스트 또는 검증 기준

- sample fixture가 type check를 통과한다.
- node id와 edge source/target 참조가 일관된다.
- roadmap step order가 중복 없이 정렬 가능하다.
- 필수 field 누락을 테스트에서 잡을 수 있다.

## 후순위 항목

- Runtime validation library 도입
- Schema versioning
- Backward compatibility policy
- Generated OpenAPI client types
