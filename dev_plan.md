# AI Planning Platform Development Plan

## 문서 운영 원칙

- 이 문서는 제품 완성을 위해 순서대로 진행하는 필수 개발 로드맵의 기준이다.
- 다음 작업과 구현 우선순위는 이 문서를 기준으로 결정한다.
- `docs/development-reminders.md`는 장기 고도화, 선택 기능, 기술 부채를
  보관하는 참고 문서이며 필수 로드맵의 우선순위를 바꾸지 않는다.
- 다른 환경이나 브랜치에서 진행 중인 작업은 동기화하기 전까지 중복 수정하지
  않는다.

## 현재 제품 로드맵 2026-10-19

핵심 Planning 생성, 모델 선택·추천, PostgreSQL persistence, 생성 이력·복원,
실제 환경 E2E, Graph·Roadmap 편집과 편집 버전 관리까지 완료했다.
개인 전용 사용을 기준으로 인증·소유권과 배포 준비는 보류한다.
2026-10-19 후속 기능으로 Graph 노드·연결 편집과 Roadmap 단계·참조 편집까지 구현했다.

### Phase 1. Graph 편집

상태: 구현, 자동 검증, 실제 PostgreSQL 저장 검증, 브라우저 UI E2E 완료

- 선택한 node의 label, description, category, priority를 편집한다.
- Canvas에서 node를 이동하고 위치를 편집 결과에 반영한다.
- AI 생성 원본과 과거 이력을 직접 덮어쓰지 않고 편집본을 새 결과 버전으로
  저장한다.
- 저장 전 Shared/API graph consistency 검증을 적용한다.
- 완료 기준: 편집본 저장 후 생성 이력에 새 버전이 추가되고 새로고침 후 같은
  graph가 복원된다.

진행 메모 2026-08-21:

- node 이름, 설명, 분류, 우선순위 편집 UI를 추가했다.
- React Flow drag 종료 위치를 편집 결과에 반영한다.
- 원본 node ID 집합을 유지하도록 API에서 검증하고, 편집본을 새 planning result
  버전으로 저장한다.
- Shared/Web typecheck, Web test 16개, lint, production build, 관련 API test
  9개가 통과했다.
- 실제 PostgreSQL에서 편집본 저장, 최신 결과 조회, 이력 증가와
  `editedFromResultId` 일치를 확인했다.
- 브라우저에서 node 편집·drag·저장·새로고침 복원을 2026-10-01 후속 E2E에서 확인했다.

### Phase 2. Roadmap 편집

상태: 구현, 자동 검증, 실제 PostgreSQL 저장 검증, 브라우저 UI E2E 완료

- 단계 내용, 우선순위, 예상 effort와 순서를 편집한다.
- dependency와 component node reference 일관성을 유지한다.
- Graph 편집과 동일한 새 버전 저장 원칙을 사용한다.

진행 메모 2026-09-28:

- 단계 제목, 설명, 우선순위, 예상 effort 편집 UI와 단계 순서 변경을 추가했다.
- 순서 변경 시 dependency가 선행 단계를 가리키는지 Web과 API에서 검증한다.
- 원본 roadmap step ID 집합, 연속된 order, component node reference를 API에서
  검증하고 편집본을 새 planning result 버전으로 저장한다.
- Web test 18개, Shared/Web typecheck, lint, production build, 평가 검증과
  API test 15개가 통과했다.
- 실제 PostgreSQL에서 roadmap 제목과 우선순위 편집본 저장, 최신 결과 복원,
  이력 증가와 `editedFromResultId` 일치를 확인했다.
- 브라우저에서 Graph와 Roadmap 편집·저장·새로고침 복원을 2026-10-01 후속 E2E에서 함께 확인했다.

진행 메모 2026-10-01:

- Playwright Chromium과 실제 API·PostgreSQL을 연결한 편집 E2E를 추가했다.
- node 이름·설명·분류·우선순위와 drag 위치의 새로고침 복원을 확인했다.
- roadmap 제목·설명·우선순위·effort와 유효한 순서 변경의 복원을 확인했다.
- dependency 위반 이동 차단, Graph·Roadmap 동시 저장, 원본과 중간 버전 보존,
  과거 원본의 새 최신 버전 복원을 확인했다.
- Node 패널이 로드맵 저장 버튼을 가리는 문제를 수정하고 패널 닫기 버튼을 추가했다.
- 브라우저 E2E, Web test 18개, typecheck, lint, production build가 통과했다.
- 증빙과 실행 안내는 `docs/reports/browser-editing-e2e-2026-10-01.md`와
  `tests/e2e/README.md`에 기록했다.

### Phase 3. 편집 버전 관리 완성

상태: 구현 및 자동·브라우저·PostgreSQL 동시 저장 검증 완료

- AI 생성 원본, 복원본, 사용자 편집본의 출처를 구분한다.
- 버전 비교, 복원, 충돌 및 변경 이력 UX를 정리한다.

진행 메모 2026-10-01:

- 이력에 v1·v2 버전 번호, AI 원본·사용자 편집본·복원본 및 직접 출처를 표시한다.
- 기준 버전과 현재 화면의 노드·연결·로드맵·요구사항·요약 변경을 필드별로 비교한다.
- 편집·복원 시 확인한 최신 버전 ID를 검사하고, 프로젝트 행 잠금으로 동시 저장을 직렬화한다.
- 충돌 시 로컬 편집본을 보존하고 최신 버전 비교, 명시적 새 버전 저장 또는 최신 결과 불러오기를 제공한다.
- 미저장 편집 상태에서 프로젝트·버전 이동, 새 생성·초기화 및 페이지 이탈을 확인한다.
- 조회 시점이 다른 최신 결과와 이력을 실제 결과 ID로 맞추고 저장 기준 버전을 고정한다.
- Web test 25개, API test 17개, 브라우저 E2E 3개, 타입·린트·production build를 통과했다.
- 구현과 검증 범위는 `docs/reports/version-management-implementation-report.md`에 기록했다.

### 후속 기능. Graph 노드·연결 추가/삭제

상태: 2026-10-19 구현 및 자동·브라우저·PostgreSQL 저장 검증 완료

- 노드를 추가하고 유형·이름·설명·분류·우선순위와 위치를 편집한다.
- 새 연결 유형을 고른 뒤 Canvas의 노드 오른쪽 점을 다른 노드 왼쪽 점으로 드래그해 연결한다.
- 연결선·라벨을 클릭해 유형 변경·삭제를 수행하고, 연결선 끝을 드래그해 출발·도착 노드를 바꾼다.
- 연결을 개별 삭제하고, 노드 삭제 시 연결과 로드맵의 해당 노드 참조를 함께 제거한다.
- 마지막 노드 삭제, 자기 자신 연결, 유형에 관계없이 같은 출발·도착 노드의 중복 연결과 잘못된 참조를 차단한다.
- Graph 구조 변경을 새 결과 버전으로 저장하며 과거 버전과 저장 충돌 처리를 유지한다.
- Web test 31개, API test 28개, 브라우저 E2E 4개, 타입 검사·린트·production build를 통과했다.
- 검증 범위와 사용법은 `docs/reports/graph-structure-editing-implementation-report.md`에 기록한다.

### 후속 기능. Roadmap 단계·참조 편집

상태: 2026-10-19 구현 및 자동·브라우저·PostgreSQL 저장 검증 완료

- 로드맵 단계를 추가·삭제하고 마지막 단계까지 삭제한 빈 로드맵도 저장한다.
- 각 단계의 관련 Graph 노드를 연결·해제하고 선행 단계를 설정한다.
- 선행 단계가 뒤에 있으면 의존성을 만족하는 순서로 자동 정렬하고 번호를 다시 매긴다.
- 순환·자기 참조, 존재하지 않는 단계·노드, 중복 참조와 잘못된 순서를 Web·Shared·API에서 차단한다.
- 단계 삭제 시 영향을 받는 단계를 확인한 뒤 해당 선행 참조를 해제하고 남은 순서를 정리한다.
- Graph 편집과 같은 새 버전 저장·비교·복원·저장 충돌 처리를 사용한다.
- Web test 36개, API test 39개, 브라우저 E2E 5개와 타입·린트·production build를 통과했다.
- 사용법과 검증 범위는 `docs/reports/roadmap-structure-editing-implementation-report.md`에 기록한다.

### 후속 기능. 작업 화면 UI 정리

상태: 2026-10-19 구현 및 기능·화면 배치 검증 완료

- Pretendard 글꼴을 앱에 포함하고 제목·본문·라벨의 크기와 굵기, 여백을 정리한다.
- 입력창·선택창·버튼·카드를 공통 스타일로 통일하고 밝은 배경과 차분한 그린 포인트를 사용한다.
- 화면 높이에 맞춘 작업 공간, 독립 스크롤 사이드바, 분리된 그래프·로드맵과 노드 편집 영역을 제공한다.
- 패널 크기 변경 시 그래프를 다시 맞추고 미니맵은 필요할 때 표시한다.
- Web test 36개, 브라우저 E2E 7개, 타입·린트·production build를 통과하고 데스크톱·모바일 배치를 확인했다.
- 상세 내역은 `docs/reports/workspace-ui-refresh-implementation-report.md`에 기록한다.

### 후속 기능. Markdown 내보내기

상태: 2026-10-20 구현 및 자동·브라우저 다운로드 검증 완료

- 사이드바의 내보내기 영역에서 선택한 결과를 UTF-8 Markdown 파일로 내려받는다.
- 프로젝트명, 결과 버전·편집 상태, 생성 시각·모델, 결과의 요구사항·요약,
  노드·연결과 순서대로 정렬한 로드맵을 포함한다.
- 노드와 선행 단계 참조를 번호와 이름으로 표시하고 우선순위·작업량을 함께 기록한다.
- 미저장 Graph·Roadmap 편집을 포함하며 문서와 파일명에 편집 상태를 표시한다.
- 과거 결과도 내보낼 수 있으며 결과가 없거나 불러오는 동안에는 버튼을 비활성화한다.
- Web test 39개, 다운로드·화면 배치 브라우저 E2E 4개, 타입·린트·production build를 통과했다.
- 사용법과 범위는 `docs/reports/markdown-export-implementation-report.md`에 기록한다.

### 후속 기능. 작업 도구 위치 재배치

상태: 2026-10-21 구현 및 자동·브라우저 검증 완료

- 프로젝트 선택과 새 프로젝트 추가를 상단 헤더로 옮긴다.
- 버전 선택·복원과 Markdown 내보내기를 상단 작업 줄에 배치하고,
  결과 요약·생성 정보·비교는 필요할 때 열어 본다.
- 노드 추가·연결 유형·그래프 저장은 캔버스 안의 도구 모음으로 옮긴다.
- 왼쪽에는 계획 입력을 배치하며 세부 조건·입력 요약·기타 도구를 접어 둔다.
- 모델 선택과 생성 버튼은 입력 패널 아래에 두고 입력 스크롤·모델 안내 펼침 중에도
  생성 버튼에 접근할 수 있도록 한다.
- 새 프로젝트·버전 정보·연결 도움말 창은 닫기 버튼, Escape와 바깥 클릭으로 닫는다.
- Web test 39개, 브라우저 E2E 10개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/workspace-layout-reorganization-report.md`에 기록한다.

### 후속 개선. 저장 범위와 생성 조건 안내

상태: 2026-10-21 구현 및 자동·브라우저 검증 완료

- 그래프·노드·로드맵의 저장 버튼을 **변경 내용을 새 버전으로 저장**으로 통일하고,
  노드·연결·로드맵 편집 전체를 저장한다는 설명을 함께 표시한다.
- 입력 초안 자동 저장의 대기·진행·완료·실패를 결과 편집 저장 상태와 구분하고 재시도를 제공한다.
- 자동 저장을 직렬화하고 이전 입력·프로젝트의 응답이 현재 초안 상태를 바꾸지 않게 한다.
- 필수 입력과 생성 불가 사유를 버튼 가까이에 표시하고 기존 결과가 있으면 **새 버전으로 다시 생성**으로 안내한다.
- 결과 버전의 입력 스냅샷과 현재 입력·모델을 비교해 결과에 아직 반영되지 않은 입력을 안내한다.
  초안을 저장하거나 페이지를 새로고침해도 이 안내를 유지한다.
- Web test 47개, 브라우저 E2E 11개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/save-generation-guidance-implementation-report.md`에 기록한다.

### 후속 개선. 작업 화면 텍스트 최소화

상태: 2026-10-21 구현 및 자동·브라우저 검증 완료

- 반복 안내를 툴팁·정보 팝업으로 옮기고 도구를 공통 SVG 아이콘과 짧은 이름으로 표현한다.
- 저장·생성 안내의 의미, 접근성 이름·설명과 오류·재시도 동작을 유지한다.
- 프로젝트 추가·버전 정보·내보내기·미니맵·닫기·단계 삭제를 아이콘으로 표시한다.
- 초안·결과 저장 상태, 버전 목록과 로드맵의 반복 라벨을 간결하게 정리한다.
- Web test 47개, 브라우저 E2E 11개, 타입 검사·린트·production build를 통과했다.
- 상세 범위는 `docs/reports/minimal-workspace-implementation-report.md`에 기록한다.

### 후속 개선. 로딩 구분과 실패 복구

상태: 2026-10-21 구현 및 자동·브라우저 검증 완료

- 조회·생성·복원 상태와 실제 경과 시간을 구분해 안내한다.
- 재생성·버전 조회 중 기존 결과를 표시하고 실패 시 입력·선택·미저장 편집을 보존한다.
- 실패한 생성·조회, 모델 목록과 이력을 각각 다시 시도한다. 성공한 생성을 이력 오류 때문에 반복하지 않는다.
- 빈 화면에서 입력 또는 프로젝트 만들기로 이동하고, 모바일 오류 안내를 바로 확인할 수 있게 한다.
- 늦은 응답이 이후 화면을 덮어쓰지 않게 하고 중복 생성을 차단한다.
- Web test 60개, 전체 브라우저 E2E 17개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/loading-recovery-implementation-report.md`에 기록한다.

### 후속 개선. 로드맵 읽기와 선택 기반 상세 편집

상태: 2026-10-21 구현 및 자동·브라우저·PostgreSQL 저장 검증 완료

- 기본 로드맵은 순서·제목·설명·우선순위·선행 번호를 읽는 목록으로 표시한다.
- 단계를 선택하면 오른쪽에서 해당 단계만 편집하며 노드 편집과 같은 영역을 사용한다.
- 단계 추가 시 바로 편집하고, 순서 변경 후에도 같은 단계 선택을 유지한다.
- 노드·단계 전환과 편집기 닫기는 미저장 변경을 보존한다. 닫으면 선택했던 목록 항목으로 초점을 돌린다.
- 기존 참조·의존성 정렬·삭제 확인·전체 결과 저장·버전 복원·충돌 처리를 유지한다.
- Web test 65개, 전체 브라우저 E2E 19개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/roadmap-reading-implementation-report.md`에 기록한다.

### 후속 개선. 집중 보기와 패널 크기 조절

상태: 2026-10-21 구현 및 자동·브라우저·PostgreSQL 회귀 검증 완료

- 함께 보기·그래프 집중 보기·로드맵 집중 보기를 아이콘 도구로 전환한다.
- 계획 입력을 접고 펼치며 입력·세부 조건·선택·미저장 편집을 유지한다.
- 데스크톱에서 입력·상세 편집 너비와 그래프·로드맵 높이 비율을 경계선으로 조절한다.
- 드래그·방향키·Home/End를 지원하고 최소·최대 크기를 제한한다.
- 화면 설정은 브라우저에 보존하며 배치 초기화는 계획 데이터와 편집을 유지한다.
- 모바일에는 보기·입력 접기와 고정된 크기를 적용한다. 로드맵 집중 보기에서도 진행·오류·재시도를 표시한다.
- Web test 67개, 전체 브라우저 E2E 23개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/workspace-focus-resize-implementation-report.md`에 기록한다.
- 후속 실행 취소·다시 실행과 캔버스 위치 유지는 아래 2026-10-26 작업에서 구현했다.

### 후속 개선. 편집 실행 취소·다시 실행과 캔버스 위치 유지

상태: 2026-10-26 구현 및 자동·브라우저·PostgreSQL 회귀 검증 완료

- 노드·연결·로드맵 편집을 하나의 로컬 기록으로 관리하고 최대 100개 작업을 되돌린다.
- 같은 텍스트 필드의 연속 입력을 묶고, 노드·단계 삭제에 따른 참조 정리를 함께 복구한다.
- 상단 아이콘과 Ctrl/⌘+Z, Ctrl+Y, Ctrl/⌘+Shift+Z를 제공한다. 입력란의 기본 실행 취소는 유지한다.
- 저장 후에도 기록을 유지하고 마지막 저장 내용과 비교해 미저장 상태를 계산한다.
- 프로젝트·결과 버전 전환, 새 생성·복원과 초기화 시 로컬 기록을 비운다. 조회·생성 실패 시에는 유지한다.
- 편집·패널 조절·집중 보기 전환 중 그래프 확대율과 중심을 유지한다.
- 새 결과는 노드 측정과 위치 반영 후 한 번 자동 맞춤하고, `전체 보기`로 언제든 다시 맞춘다.
- Web test 76개, 전체 브라우저 E2E 28개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/undo-viewport-implementation-report.md`에 기록한다.
- 관련 노드·로드맵 단계 강조와 노드 검색·유형 필터는 아래 2026-10-27 작업에서 구현했다.

### 후속 개선. Graph·Roadmap 연결 탐색과 노드 검색

상태: 2026-10-27 구현 및 자동·브라우저·PostgreSQL 회귀 검증 완료

- 노드를 선택하면 관련 로드맵 단계와 개수를 표시하고, 단계를 선택하면 관련 노드를 강조한다.
- 로드맵 목록과 상세 편집기의 관련 노드 버튼으로 해당 노드를 선택하고 화면 중심으로 이동한다.
- 로드맵 집중 보기에서 이동하면 그래프를 함께 표시하며, 필터에 가려진 대상 노드는 필터를 풀어 보여준다.
- 이름 검색과 유형 필터를 함께 적용하고 표시할 노드와 연결만 화면에서 추린다.
- 검색 결과 없음·필터 초기화·선택한 노드 표시를 제공한다. 검색 결과 이동 후 노드에 키보드 초점을 둔다.
- 탐색은 저장 내용·입력 초안·실행 취소 기록을 바꾸지 않으며 편집·삭제·실행 취소 후 참조와 검색을 갱신한다.
- 저장·보기 전환 중 필터를 유지하고 새 프로젝트·결과 진입 시 초기화한다. 조회 실패는 기존 상태를 유지한다.
- Web test 82개, 전체 브라우저 E2E 35개, 타입 검사·린트·production build를 통과했다.
- 상세 내역은 `docs/reports/graph-navigation-implementation-report.md`에 기록한다.
- 다음 우선순위는 프로젝트별 마지막 작업 위치 복원이다.

### 사용성 조정. 로드맵 가로 카드 배치 — 2026-10-27

- 로드맵 단계를 왼쪽에서 오른쪽으로 나열하고 목록 내부에서 가로 스크롤한다.
- 하단 스크롤바를 숨기고 마우스 드래그·모바일 기본 터치 스와이프로 넘긴다. 드래그 종료 시 단계 선택·노드 이동을 실행하지 않는다.
- 단계 선택·관련 노드 선택·패널 너비 변경 시 해당 카드가 보이도록 가로 위치를 맞춘다.
- 상세 편집과 관련 노드 이동을 유지하고, 순서 변경 버튼도 가로 방향으로 표시한다.
- 데스크톱 드래그·모바일 터치 스와이프, 배치와 검색·연결 탐색 브라우저 테스트 16개 및 TypeScript·린트 검사를 통과했다.

### 사용성 조정. 로드맵 강조 효과 — 2026-10-27

- 관련 단계와 선택한 단계는 흰색·연초록 그라데이션, 상단 반사광과 부드러운 외부 그림자로 볼록하게 떠 있는 표면처럼 강조한다. 번호는 흑연색으로 표시한다.
- 마우스 호버 테두리와 단계 선택 버튼의 키보드 초점 표시는 카드 전체를 감싸며, 내부 제목·설명 영역에 별도 테두리를 만들지 않는다.
- 강조 시 살짝 올라온 위치로 전환하고, 이후에는 그림자만 천천히 변화시킨다. 카드 위치를 반복해서 움직이지 않아 클릭·읽기를 안정적으로 유지한다.
- 강조 중에는 다른 카드를 반투명·회색·약한 블러로 처리한다. 마우스를 올리거나 키보드로 초점을 주면 다시 읽기 쉽게 표시한다.
- 관련 단계가 없거나 선택을 해제하면 모든 카드를 정상 표시하고, 동작 줄이기 설정에서는 애니메이션을 끈다.
- 브라우저 회귀 테스트 16개와 TypeScript·린트 검사를 통과하고 관련 단계·선택 단계의 화면 캡처를 확인했다.
- 표면과 그림자로 강조하는 방식은 [Atlassian Elevation](https://atlassian.design/foundations/elevation/)과 [Material 카드 가이드](https://m1.material.io/components/cards.html)를 참고했다.

### Phase 4. 사용자 인증과 프로젝트 소유권 — 보류

상태: 2026-10-19 사용자 결정으로 개인 전용 사용 범위에서 제외

- 인증, 사용자별 프로젝트 접근, ownership과 기본 권한은 현재 구현하지 않는다.
- 여러 사용자 지원이나 공유·협업이 필요해질 때 재검토한다.

### Phase 5. 배포와 운영 준비 — 보류

상태: 2026-10-19 개인 전용 사용 범위에서 다음 필수 작업에서 제외

- 배포를 전제로 한 운영 환경 구성과 모니터링 체계는 현재 추진하지 않는다.
- 배포가 필요해질 때 운영 환경, secret·migration 정책, 비용 관측과 복구 절차를 재검토한다.

### 필수 로드맵에서 보류한 항목

- 프로젝트별 기본 모델은 현재 Draft의 `selectedModel` 복원으로 충분하므로
  조직 정책이나 일시적 선택 구분이 필요해질 때 고도화 항목으로 재검토한다.
- 모델 추천 학습, RAG, Vector DB, 고급 협업, 평가 대시보드는
  `docs/development-reminders.md`에서 관리한다.

## 추가 작업 계획 2026-07-26 - AI 모델 선택 UI

상태: 구현 및 기본 검증 완료

- 모델 카탈로그 API, 요청별 모델 선택, Web select UI 연결 완료.
- Shared/Web typecheck, canonical mock validation, API test 13개 통과.
- Web production build와 Docker API model catalog smoke test 통과.
- API 크레딧 충전 후 Web에서 실제 OpenAI 계획 생성 성공을 확인했다.
- 새로고침 후 DB 결과 복원과 허용 모델별 smoke test는 후속 E2E로 진행한다.

### 목표

사용자가 계획 생성 전에 서버가 허용한 OpenAI 모델 중 하나를 선택하고,
API가 선택값을 검증한 뒤 해당 모델로 계획을 생성하도록 한다.
클라이언트가 임의의 모델 ID를 직접 지정하는 방식은 허용하지 않는다.

### 현재 구조 분석

- 현재 기본 모델은 루트 `.env`와 `compose.yaml`의 `OPENAI_MODEL` 한 개로 결정된다.
- `OpenAIPlanningProvider`는 생성 시 모델을 고정하며 `PlanningWorkflow`도 API에서
  `lru_cache`로 재사용되므로 요청별 모델 선택을 처리할 수 없다.
- Web의 `PlanningRequest`와 API의 Pydantic schema에는 모델 선택 필드가 없다.
- `PlanningResult.metadata.model`과 `planning_results.model` 컬럼에는 실제 사용
  모델이 이미 저장되므로 첫 구현에는 DB migration이 필요하지 않다.
- Web에 모델 ID를 하드코딩하면 지원 모델 변경, 계정별 접근 권한, 비용 정책과
  쉽게 불일치한다.

### 설계 원칙

1. 모델 허용 목록과 기본 모델의 최종 권한은 API 서버가 가진다.
2. Web은 서버가 반환한 허용 목록만 표시하고 임의 문자열을 전송하지 않는다.
3. `OPENAI_MODEL`은 기본 선택값으로 유지하고 `OPENAI_ALLOWED_MODELS`를 추가한다.
4. 선택 모델은 Planning 요청의 명시적 options 필드로 전달한다.
5. 실제 사용 모델은 기존 `PlanningResult.metadata.model`과 DB `model` 컬럼에
   계속 기록한다.
6. 허용되지 않거나 사용할 수 없는 모델은 생성 전에 422 응답으로 차단한다.
7. 모델 접근 권한, quota, rate limit 오류는 현재 provider 오류 형식을 유지해
   사용자가 원인을 확인할 수 있게 한다.

### 변경 대상

#### 1. 환경 설정과 API 모델 카탈로그

- `.env.example`에 쉼표 구분 `OPENAI_ALLOWED_MODELS` 예시를 추가한다.
- `OPENAI_MODEL`이 허용 목록에 포함되는지 API 시작 또는 설정 로드 시 검증한다.
- `GET /planning/models` endpoint를 추가한다.
- 응답에는 모델 ID, 사용자 표시명, 기본 선택 여부만 포함한다.
- API key, 내부 비용 한도, provider credential은 응답에 포함하지 않는다.

#### 2. Shared Planning 계약

- `packages/shared`에 모델 option과 모델 카탈로그 응답 타입을 추가한다.
- `PlanningRequest.options.model`을 명시적 필드로 정의한다.
- 문자열 길이와 빈 값 검증은 shared helper와 API schema 양쪽에서 일치시킨다.
- `docs/planning-result-contract.md`에 모델 선택 요청·응답 규칙을 문서화한다.

#### 3. API와 AI workflow

- API Pydantic `PlanningOptions`에 `model` 필드를 추가한다.
- 요청 모델이 서버 허용 목록에 속하는지 검증한다.
- 전역으로 캐시된 단일 모델 workflow 구조를 요청 모델별 provider/workflow
  생성 또는 모델별 안전한 cache 구조로 변경한다.
- `OpenAIPlanningProvider`가 검증된 요청 모델을 사용하도록 연결한다.
- 요청값이 없으면 `OPENAI_MODEL` 기본값을 사용해 기존 호출과 호환한다.
- normalization 결과의 `metadata.model`이 실제 호출 모델과 동일한지 검증한다.

#### 4. Web UI와 상태

- 계획 입력 영역에 `AI 모델` select를 추가한다.
- 초기 화면에서 `GET /planning/models`를 호출해 허용 모델 목록과 기본값을
  불러온다.
- 목록 loading, 조회 실패, 빈 목록 상태를 처리한다.
- 모델 목록이 없거나 선택값이 없으면 계획 생성 버튼을 비활성화한다.
- 선택 모델을 Zustand state에 보관하고 `PlanningRequest.options.model`로 보낸다.
- 저장된 최신 결과를 불러오면 `metadata.model`을 결과 정보로 표시한다.
- 이전 결과의 모델이 현재 허용 목록에서 제거됐더라도 결과 열람은 허용하되,
  새 생성에는 현재 허용 모델을 다시 선택하게 한다.

#### 5. 테스트

- shared: 모델 option validation과 기존 model 없는 요청의 하위 호환성 테스트.
- API: 모델 목록, 기본 모델, 허용 모델, 비허용 모델 422 응답 테스트.
- AI: 요청별 모델 전달과 `metadata.model` 일치 테스트.
- Web: 목록 loading/error/empty, 기본 선택, 생성 request payload 테스트.
- persistence: 선택 모델이 JSONB metadata와 `planning_results.model`에 동일하게
  저장되는지 round-trip 테스트.
- E2E: 서로 다른 허용 모델로 생성 후 프로젝트 최신 결과 복원까지 확인한다.

### 구현 순서

1. 서버 설정과 모델 카탈로그 endpoint를 먼저 구현한다.
2. Shared/API request contract와 검증을 추가한다.
3. AI workflow를 요청별 모델 실행 구조로 변경한다.
4. API 단위 테스트와 persistence 테스트를 통과시킨다.
5. Web select UI와 Zustand/request 연결을 구현한다.
6. Web typecheck/build와 전체 API 테스트를 실행한다.
7. 실제 API key 환경에서 허용 모델별 smoke test를 수행한다.

### 완료 기준

- Web에서 서버 허용 모델만 선택할 수 있다.
- 선택한 모델이 실제 OpenAI 요청과 결과 metadata, DB 저장값에 일관되게 반영된다.
- 모델을 선택하지 않은 기존 요청은 서버 기본 모델로 정상 동작한다.
- 비허용 모델은 OpenAI 호출 전에 차단된다.
- 모델 목록 조회 실패가 기존 프로젝트와 저장 결과 열람을 막지 않는다.
- 비밀값이 Web bundle, API 응답, Git diff에 포함되지 않는다.

### 후속 검토

- 모델별 예상 비용·속도·품질 설명과 추천 표시.
- 프로젝트별 기본 모델 저장.
- 관리자 역할 기반 모델 허용 정책.
- 생성 이력과 모델별 품질·비용 평가 대시보드.

## 목표

AI Planning Platform은 사용자의 아이디어와 요구사항을 구조화된 설계, dependency graph, 실행 가능한 로드맵으로 변환하는 플랫폼이다.

초기 개발 목표는 AI 품질을 완성하기 전에 제품의 핵심 사용 흐름을 눈으로 확인할 수 있는 MVP를 만드는 것이다. 따라서 개발은 Canvas UI를 먼저 만들고, 이후 FastAPI, Docker, API 연결, AI layer, DB persistence 순서로 확장한다.

## 전체 개발 순서

1. 공통 도메인 모델 정의
2. Frontend Canvas MVP 구축
3. AI 결과 계약 설계
4. FastAPI 기본 서버 구축
5. Docker Compose 구축
6. Web과 API 연결
7. AI Layer 실제 연동
8. PostgreSQL persistence 추가
9. 제품 기능 고도화

## 단계별 상세 계획

1. 공통 도메인 모델 정의
   - `packages/shared`에 project, requirement, component node, dependency edge, roadmap step의 기본 구조를 정의한다.
   - Web, API, AI layer가 같은 graph contract를 바라보도록 한다.

2. Frontend Canvas MVP 구축
   - `apps/web`에 Next.js, React, React Flow, Zustand 기반 UI를 구성한다.
   - 요구사항 입력 패널, graph canvas, node detail panel, roadmap panel을 mock data로 먼저 완성한다.

3. AI 결과 계약 설계
   - mock data를 기준으로 AI 출력 JSON 구조를 고정한다.
   - malformed output을 줄이기 위해 필수 필드와 허용 가능한 node/edge/roadmap 형태를 문서화한다.

4. FastAPI 기본 서버 구축
   - `apps/api`에 `/health`, `/planning/mock`, `/planning/generate`의 기본 구조를 만든다.
   - 처음에는 DB 없이 request/response contract와 CORS 설정을 검증한다.

5. Docker Compose 구축
   - FastAPI 서버가 실행 가능한 상태가 된 직후 Docker를 도입한다.
   - API container, PostgreSQL container, volume, `.env.example`을 준비한다.

6. Web과 API 연결
   - Web의 mock data 직접 참조를 API 호출 방식으로 전환한다.
   - loading, error, empty state를 UI에서 처리한다.

7. AI Layer 실제 연동
   - `packages/ai`에서 LangGraph와 OpenAI API 기반 planning workflow를 구현한다.
   - API는 AI output을 shared contract에 맞게 정규화해 반환한다.

8. PostgreSQL persistence 추가
   - project, requirement, generated graph, roadmap 저장 구조를 추가한다.
   - migration과 local seed data를 준비한다.

9. 제품 기능 고도화
   - graph 수정, roadmap 편집, 재생성 버전 관리, 인증, 협업 기능을 MVP 이후에 검토한다.

## Docker 도입 시점

Docker는 FastAPI 기본 서버가 만들어진 직후, PostgreSQL persistence를 구현하기 전에 도입한다.

이 시점이 적절한 이유는 다음과 같다.

- `/health`로 API container 실행 여부를 검증할 수 있다.
- DB schema가 확정되기 전에도 PostgreSQL runtime을 먼저 고정할 수 있다.
- persistence 구현 시 로컬 환경 차이로 인한 문제를 줄일 수 있다.

## 테스트 전략

- `packages/shared`: graph model과 fixture가 contract를 만족하는지 검증한다.
- `apps/web`: mock graph 렌더링, node 선택, roadmap 표시, empty/error state를 검증한다.
- `apps/api`: health check, mock planning response, invalid request validation을 검증한다.
- `packages/ai`: 고정 입력에 대해 schema-valid output을 반환하는지 검증한다.
- `tests`: 요구사항 입력 후 graph와 roadmap이 표시되는 end-to-end happy path를 검증한다.

## MVP 이후 확장 항목

- 실제 AI output 품질 개선과 prompt/version 관리
- 프로젝트 저장, graph versioning, regeneration history
- 사용자 인증과 project ownership
- Vector DB와 RAG pipeline
- tldraw SDK 또는 고급 canvas editing
- 배포 환경, observability, 비용 모니터링

## 현재 다음 실행 계획

현재 구현은 `packages/shared`의 TypeScript 도메인 모델과 `apps/web`의 프론트엔드 Canvas MVP가 어느 정도 갖춰진 상태다.
따라서 바로 API 서버를 만들기 전에, Web, API, AI Layer가 함께 사용할 planning contract를 먼저 안정화한다.

### Step 1. Planning Result 계약 문서화

- `docs/planning-result-contract.md`를 작성한다.
- Web, API, AI가 주고받는 `PlanningRequest`와 `PlanningResult` 구조를 문서화한다.
- 필수 필드, enum 값, graph consistency 규칙, empty/error state 처리 기준을 정의한다.
- 완료 기준: 이 문서가 `/planning/mock`, `/planning/generate`, AI output normalization의 기준 문서로 사용될 수 있어야 한다.

### Step 2. Shared 런타임 검증 추가

- `packages/shared`에 런타임 검증 helper를 추가한다.
- 필수 배열, node id, edge reference, roadmap dependency, metadata 기본 조건을 검증한다.
- API layer에서 더 엄격한 schema library가 필요해지기 전까지는 dependency-free 방식으로 가볍게 유지한다.
- 완료 기준: shared typecheck가 통과하고, mock fixture를 코드로 검증할 수 있어야 한다.

### Step 3. Mock Fixture 정리

- UI나 terminal에서 한글 mock fixture 텍스트가 깨져 보이면 정상 한글 문구로 정리한다.
- Web, API, tests가 같은 fixture를 재사용할 수 있도록 id와 구조 필드는 안정적으로 유지한다.
- 완료 기준: mock result가 graph consistency를 유지하면서 canonical example로 읽기 쉬운 상태여야 한다.

### Step 4. FastAPI Skeleton 구현

- `apps/api`에 `/health`, `/planning/mock`, `/planning/generate` 기본 endpoint 구조를 만든다.
- `/planning/mock`은 shared mock contract와 같은 shape를 반환한다.
- 문서화된 contract 기준으로 request/response validation을 추가한다.
- 완료 기준: API가 로컬에서 실행되고, 이후 Web이 직접 mock fixture를 import하는 방식에서 HTTP 호출 방식으로 전환할 수 있어야 한다.

### Step 5. Web/API 연결

- `apps/web/src/lib/mockPlanningClient.ts`의 직접 fixture 접근을 API 호출 방식으로 교체한다.
- 기존 loading, error, empty state 동작은 유지한다.
- 완료 기준: Web이 API response로부터 기존과 동일한 graph와 roadmap을 렌더링해야 한다.

## 진행 메모 2026-07-12

- `packages/shared` typecheck와 mock fixture contract 검증 통과.
- `apps/api` FastAPI 테스트 통과.
- `apps/web` typecheck 통과.
- `compose.yaml`, `apps/api/Dockerfile`, 루트 `.env.example`로 Docker Compose 로컬 런타임 초안 추가.
- Docker Compose 설정 문법 검증 통과.
- `docker compose build api` 통과.
- `docker compose up -d api postgres` 실행 후 API와 PostgreSQL healthcheck 통과.
- `GET /health`가 `{"status":"ok"}`를 반환하는 것을 확인.

### 다음 작업

1. API key가 설정된 환경에서 실제 생성 결과의 canvas/roadmap 렌더링을 검증한다.
2. 대표 요구사항을 모아 AI output 품질과 graph consistency를 평가한다.
3. 이후 PostgreSQL persistence 단계로 넘어간다.

## 진행 메모 2026-07-24

- `packages/ai`에 LangGraph planning workflow 추가.
- OpenAI Responses API와 Pydantic Structured Outputs 기반 provider adapter 추가.
- AI 결과의 node/edge/roadmap reference 검증과 canvas position 정규화 추가.
- `/planning/generate`를 실제 AI workflow에 연결하고 provider 오류를 HTTP 응답으로 변환.
- Web 계획 생성 요청을 `/planning/mock`에서 `/planning/generate`로 전환.
- API 테스트, Web typecheck/build, API Docker image build 통과.
- `OPENAI_API_KEY`와 API 크레딧 설정 후 Web의 실제 OpenAI 계획 생성 성공 확인.

## 진행 메모 2026-07-24 - PostgreSQL Persistence

- SQLAlchemy repository layer와 PostgreSQL Psycopg driver 추가.
- `projects`, `requirements`, `planning_results` 초기 Alembic migration 추가.
- PlanningResult 전체 계약을 JSONB로 저장하고 그대로 복원하는 구조 적용.
- 프로젝트 생성, 목록, 상세, 프로젝트별 계획 생성, 최신 결과 조회 API 추가.
- API container 시작 시 PostgreSQL migration 자동 적용.
- canonical mock fixture를 저장하는 local seed script 추가.
- SQLite repository round-trip 테스트 및 PostgreSQL migration 검증 추가.

### 다음 작업

1. 실제 AI 생성 성공은 확인했으며, 새로고침 후 DB 결과 복원까지 end-to-end로 검증한다.
2. Web 프로젝트·모델 선택·결과 복원 흐름의 자동화 테스트 5개 추가 완료.
3. Planning brief 전체를 저장하고 프로젝트 재선택 시 복원하도록 확장한다.
4. 대표 입력 평가와 AI prompt/version 품질 관리를 시작한다.
5. Next.js와 ESLint config를 15.5.22로 업데이트해 Next 직접 취약점을 해결했다.
   - Web test 5개, typecheck, lint, production build 통과.
   - 현재 Next 15·16이 고정하는 PostCSS 8.4.31과 Sharp 0.34.x 관련 audit
     경고는 upstream 안전 버전 반영 후 후속 패치한다.

## 진행 메모 2026-07-27 - Planning Brief 저장 및 복원

- 프로젝트에 현재 계획 주제, Planning Brief 전체, 선택 모델을 저장하는 컬럼과
  Alembic migration을 추가했다.
- `GET/PUT /projects/{project_id}/planning-brief` API를 추가했다.
- Web 입력 변경을 debounce 방식으로 자동 저장하고 프로젝트 선택·새로고침 시
  최신 생성 결과와 별개로 입력 Draft를 복원한다.
- 계획 생성 시에도 동일한 Brief와 실제 선택 모델을 프로젝트에 확정 저장한다.
- Web test 6개, Shared/Web typecheck, Web production build, API test 13개 통과.
- 실제 PostgreSQL에 `20260727_0002` migration 적용 및 API healthcheck 통과.

## 진행 메모 2026-07-27 - 계획 생성 이력 조회 및 복원

- 프로젝트별 계획 결과 목록과 ID 기반 상세 조회 API를 추가했다.
- 이력에는 생성 시각, 사용 모델, workflow 버전, 결과 요약을 제공한다.
- Web 사이드바에 최신순 생성 이력 선택 UI를 추가하고 과거 결과의 graph와
  roadmap을 현재 Planning Brief 변경 없이 열람하도록 연결했다.
- 새 계획 생성 후 이력 목록과 최신 선택 상태를 자동 갱신한다.
- 각 생성 결과에 당시 Planning Brief 스냅샷을 저장한다.
- 과거 결과 복원 시 원본을 덮어쓰지 않고 새 최신 버전을 생성하며
  `restoredFromResultId`로 출처를 기록한다.
- 복원된 결과와 함께 당시 계획 주제, Brief, 실제 사용 모델을 현재 Draft로
  복원한다.
- 이력 선택 시 해당 결과의 Brief 스냅샷도 함께 표시해 최신 제약조건 등이
  과거 버전에 남아 보이지 않도록 한다.
- 과거 버전 단순 열람 중에는 Brief 자동 저장을 차단하고, 사용자가 입력을
  편집하기 시작한 경우에만 현재 Draft로 전환한다.
- 스냅샷 도입 전에 생성된 결과는 열람만 허용하고 복원 버튼을 비활성화한다.
- Web test 9개, Shared/Web typecheck, lint, Web production build,
  API test 13개 통과.
- 실제 PostgreSQL 데이터로 이력 목록 및 상세 조회 smoke test를 통과했다.

## 진행 메모 2026-07-27 - AI 품질 평가 기반과 Prompt 버전

- AI system prompt에 `planning-prompt-v1` 식별자를 추가했다.
- 생성 결과 metadata, PostgreSQL 결과 레코드, 생성 이력 UI에 Prompt 버전을
  기록하고 표시한다.
- 프로젝트, 여행, 학습, 일상, 의사결정, 창작 유형의 대표 입력 6개와
  필수·금지 용어, 최소 graph·roadmap 조건을 정의했다.
- API를 호출해 구조 일관성과 기대 조건을 검사하고 JSON/Markdown 보고서를
  생성하는 `evaluate:planning` 스크립트를 추가했다.
- OpenAI 호출 없이 데이터셋 형식만 검사하는 `evaluate:planning:check`
  명령을 추가했다.

## 진행 메모 2026-07-29 - Prompt v2 및 품질 회귀 평가

- AI system prompt를 `planning-prompt-v2`로 올리고 중복 책임 제거, graph·roadmap
  비순환성, 연속된 단계 순서, dependency 선행, 전체 node 실행 단계 연결,
  제약조건을 반영한 실행 가능한 설명 규칙을 추가했다.
- 대표 평가 데이터에 상충 제약, 작은 개인 업무, 선택 기능 과다 입력의 경계
  사례 3개를 추가해 총 9개로 확장했다.
- 평가기에 component graph와 roadmap cycle, node label 중복, roadmap 순서와
  dependency 역전, node coverage, 실행 설명 품질 검사를 추가했다.
- `requiredRoadmapTerms`로 핵심 일정·제약이 실행 단계에 실제 반영되는지
  검사할 수 있도록 확장했다.
- `--baseline <v1-report.json>` 옵션으로 동일 데이터셋의 prompt v1/v2 평균 및
  케이스별 점수 증감 비교 보고서를 생성하도록 추가했다.

## 진행 메모 2026-07-29 - Prompt 버전 선택

- `planning-prompt-v1`, `planning-prompt-v2` 내용을 registry로 함께 유지하고
  `PLANNING_PROMPT_VERSION` 환경변수로 API 시작 시 버전을 선택하도록 했다.
- 기본 버전은 v2이며, 등록되지 않은 버전은 조용히 fallback하지 않고
  `PlanningConfigurationError`로 거부한다.
- 실제 사용한 prompt 내용과 결과 metadata의 `promptVersion`이 동일한 provider
  설정에서 나오도록 연결해 비교 결과의 추적 가능성을 보장했다.
- Docker Compose와 환경변수 예시, API·평가 실행 문서를 v1 baseline 생성 후
  v2 비교 실행 흐름에 맞게 갱신했다.

## 진행 메모 2026-07-29 - 평가 엔진 자동 테스트

- 평가 스크립트의 case validation, graph issue 탐지, 결과 평가, baseline 검증,
  비교 계산 함수를 부작용 없이 import할 수 있도록 공개했다.
- 정상 결과 전체 통과, component·roadmap cycle 탐지, node label 중복,
  roadmap 순서 누락과 dependency 역전, node coverage·실행 설명 실패를
  검증하는 Node 내장 test runner 기반 테스트를 추가했다.
- 중복 case id와 잘못된 `requiredRoadmapTerms`, baseline schema 불일치,
  v1/v2 점수 개선 계산도 고정 테스트로 추가했다.
- `evaluate:planning:test` 명령을 추가했으며 5개 테스트와 9개 평가 case
  dry-run 검증이 통과했다.

## 진행 메모 2026-07-30 - CI 회귀 검사

- Shared typecheck·mock fixture 검증, Web typecheck·test·lint·production build,
  평가 dataset·engine 검증을 묶은 `verify:node` 명령을 추가했다.
- GitHub Actions에서 Node 검증과 FastAPI pytest를 별도 job으로 병렬 실행하는
  CI workflow를 추가했다.
- workflow는 pull request와 main push에서 실행하고 중복 실행을 취소하며,
  `contents: read` 최소 권한과 job timeout을 적용했다.
- Node dependency는 `npm ci`, Python dependency는 lockfile 기반
  `uv sync --frozen --extra dev`로 재현 가능하게 설치한다.

## 진행 메모 2026-08-19 - 평가 재개와 timeout 복원력

- 긴 Structured Output 생성을 고려해 API provider timeout 기본값을 60초에서
  180초로 상향했다.
- 평가 결과를 case 완료 직후 `checkpoint.json`에 저장하고 `--resume` 실행 시
  완료된 case를 건너뛰도록 했다.
- checkpoint의 평가 schema, 정렬된 case id, 요청 model이 현재 실행과 다르면
  재사용을 거부해 서로 다른 평가 결과가 섞이지 않게 했다.
- HTTP 408·429·502·503·504만 지수 backoff로 최대 2회 시도하고, 입력 오류 등
  비일시적 실패는 즉시 반환하도록 했다.
- 정상 완료 checkpoint도 유지해 추가 API 호출 없이 report를 재생성할 수
  있도록 했다.
- 개선 후 실제 `gpt-5-mini` 평가를 완료했으며 prompt v1은 7/9·평균 0.984,
  prompt v2는 7/9·평균 0.975로 v2가 0.009 낮았다.
- v2는 워크숍 종료 시각 `6시`와 독서 MVP 기간 `2주`를 roadmap에 반영하지
  못했고, 선택 기능인 `전자책 구매`도 결과에 포함해 해당 case 점수가 v1보다
  0.077 낮아졌다.
- 완료 checkpoint에 `--resume`을 적용했을 때 9개 case를 모두 건너뛰고 API
  재호출 없이 비교 report를 다시 생성하는 것을 확인했다.
