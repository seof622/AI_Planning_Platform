# apps/web Development Plan

## 역할

`apps/web`은 사용자가 AI planning 결과를 보고 조작하는 핵심 인터페이스이다.

초기 MVP에서는 실제 AI 호출보다 요구사항 입력, graph canvas, node detail, roadmap view가 자연스럽게 이어지는 사용 경험을 먼저 완성한다.

## 개발 순서

1. Next.js application skeleton을 생성한다.
2. 기본 layout을 만들고 requirement input, canvas, detail panel, roadmap panel의 화면 영역을 나눈다.
3. React Flow로 component node와 dependency edge를 렌더링한다.
4. Zustand store에 requirement, graph, selected node, roadmap state를 둔다.
5. mock planning data로 전체 흐름을 검증한다.
6. FastAPI mock endpoint가 준비되면 fetch layer를 붙이고 mock file 의존을 제거한다.
7. loading, empty, error state를 추가한다.

## 주요 산출물

- Requirement input form
- React Flow graph canvas
- Component node renderer
- Dependency edge renderer
- Node detail panel
- Roadmap panel
- Planning state store
- API client module

## 테스트 또는 검증 기준

- 빈 상태에서 요구사항 입력 UI가 보인다.
- mock graph의 node와 edge가 canvas에 표시된다.
- node 선택 시 상세 정보가 표시된다.
- roadmap step이 우선순위 또는 순서대로 표시된다.
- API 오류 발생 시 사용자에게 복구 가능한 error state가 보인다.

## 후순위 항목

- Graph manual editing
- Drag and layout persistence
- Roadmap inline editing
- Export to image, PDF, or markdown
- tldraw SDK integration
