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

성공 시 DB 이력 JSON과 최종 화면을 HTML 보고서에 첨부한다. 실패 시
스크린샷과 trace를 보존한다. 보고서는 `playwright-report/index.html`에 있다.

각 테스트는 `Editing E2E <UTC timestamp>` 프로젝트를 하나 새로 만든다.
전체 실행은 3개 프로젝트를 만들며, 편집 흐름은 5개 버전, 두 탭 충돌 흐름은
5개 버전, 동시 저장 흐름은 2개 버전을 남긴다. 기존 프로젝트를 수정하거나
테스트 데이터를 자동 삭제하지 않는다. 실패한 실행은 중간 결과를 남길 수 있다.
