# Browser Editing E2E

실제 Chromium, Next.js, FastAPI와 PostgreSQL을 연결해 편집 기능을 검증한다.
AI 생성 대신 canonical fixture를 전용 프로젝트에 저장하므로 OpenAI 호출은 없다.

## 실행

```powershell
npm ci
npx playwright install chromium
docker compose up -d --build api postgres
npm run test:e2e
```

Web은 localhost:3000, API는 localhost:8000을 사용한다. Playwright가 Web을
자동 시작하며 이미 실행 중이면 해당 서버를 사용한다. 다른 데이터베이스를
사용하려면 Docker Compose 환경을 먼저 구성한다.

현재 Windows에서 네이티브 SWC 로드가 차단되는 경우, 이 저장소의 Next 버전과
동일한 WASM 컴파일러를 로컬 설치한 뒤 실행할 수 있다.

```powershell
npm install --no-save @next/swc-wasm-nodejs@15.5.22
```

이 명령은 package.json과 lockfile을 변경하지 않으며 `npm ci` 후에는 다시
설치해야 한다. Next 버전을 변경할 때는 컴파일러 버전도 맞춰야 한다.

## 검증 범위

- Node 이름·설명·분류·우선순위 변경과 실제 마우스 드래그
- 새 버전 저장 후 새로고침을 통한 필드와 위치 복원
- Roadmap 제목·설명·우선순위·작업량 편집과 유효한 단계 순서 변경
- 선행 단계보다 먼저 이동하는 순서 변경 차단
- Graph와 Roadmap 동시 편집 저장, 원본과 중간 버전 보존
- 과거 원본 선택 및 새 최신 버전으로 복원
- 브라우저 예외와 console error 검사
- 버전 번호·원본/편집본/복원본 출처와 필드별 비교 표시
- 미저장 편집 상태의 버전 이동 취소
- 두 탭의 저장 충돌, 편집본 보존·명시적 저장·최신 버전 불러오기
- 복원 충돌 후 미리보기 보존과 사용자 확인 후 재시도
- PostgreSQL에서 동일 최신 버전에 대한 동시 요청 2건 중 1건만 성공
- 노드 추가와 유형 변경, 실제 마우스 드래그 연결·유형이 달라도 같은 시작·끝 노드의 중복 연결 차단
- 연결선 라벨 선택·유형 변경, 끝점 드래그 재연결·삭제 후 새로고침 복원 및 이미 연결된 노드 쌍으로의 재연결 차단
- 노드 삭제 확인 취소·승인, 연결·로드맵 참조 정리와 과거 버전 보존
- 로드맵 단계 추가·삭제, Graph 노드 연결·해제, 선행 단계 선택에 따른 자동 정렬
- 순환 의존성 차단, 삭제 확인 취소·승인과 선행 참조 해제, 빈 로드맵 저장·재추가·원본 복원
- 1440×960 데스크톱에서 세로·가로 넘침과 그래프·로드맵·편집 패널 겹침 방지
- 390×844 모바일 배치, 로컬 Pretendard 글꼴 로딩, 미니맵 표시·숨기기와 패널 크기 변경 시 그래프 맞춤
- 실제 Markdown 파일 다운로드, UTF-8 한글 파일명과 요구사항·요약·노드·연결·로드맵 내용
- 미저장 노드 편집 포함·편집 상태 보존, 과거 버전 내보내기와 결과 없는 상태의 비활성화
- 내보내기가 편집 저장·복원 요청이나 추가 버전을 만들지 않는지 확인

성공 시 DB 이력 JSON과 최종 화면을 HTML 보고서에 첨부한다. 실패 시
스크린샷과 trace를 보존한다. 보고서는 `playwright-report/index.html`에 있다.

기능 테스트 5개는 각각 `Editing E2E <UTC timestamp>` 프로젝트를 하나 새로 만든다.
UI 배치 테스트 2개와 Markdown 내보내기 테스트 2개는 API fixture를 사용하며
DB에 프로젝트를 추가하거나 변경하지 않는다.
전체 9개 테스트 실행은 5개 프로젝트를 만들며, 편집 흐름은 5개 버전, Graph 구조 편집 흐름은
4개 버전, Roadmap 구조 편집 흐름은 6개 버전, 두 탭 충돌 흐름은 5개 버전,
동시 저장 흐름은 2개 버전을 남긴다. 기존 프로젝트를 수정하거나
테스트 데이터를 자동 삭제하지 않는다. 실패한 실행은 중간 결과를 남길 수 있다.

Markdown 다운로드와 화면 배치만 확인하려면 다음을 실행한다. 이 검증은 실제 OpenAI나 DB를 사용하지 않는다.

```powershell
npm run test:e2e -- tests/e2e/markdown-export.spec.ts tests/e2e/ui-layout.spec.ts
```
