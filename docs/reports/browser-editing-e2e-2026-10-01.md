# Graph·Roadmap 브라우저 편집 E2E

- 실행일: 2026-10-01
- 환경: Windows, Next.js 15.5.22, Playwright 1.63.0 Chromium, Docker FastAPI·PostgreSQL
- 화면: 1600 × 1000 데스크톱 viewport
- 데이터: 실행마다 새 E2E 프로젝트에 canonical fixture 저장. OpenAI 호출 없음
- 성공 검증 프로젝트: `project-82c193cf-74d7-46b9-b08f-e0a76ef02349`

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| Node 이름·설명·분류·우선순위 편집 | 통과 |
| 마우스 드래그 후 위치 저장 | 통과 |
| Graph 새로고침 후 필드·위치 복원 | 통과 |
| Node 패널 닫기 및 다시 열기 | 통과 |
| Roadmap 제목·설명·우선순위·effort 편집 | 통과 |
| 유효한 단계 순서 변경·저장·새로고침 복원 | 통과 |
| dependency 위반 이동 차단 | 통과 |
| Graph·Roadmap 동시 편집 새 버전 저장 | 통과 |
| 원본·중간 편집 버전 불변 | 통과 |
| 과거 원본 선택·새 최신 버전 복원 | 통과 |
| 브라우저 예외·console error | 0건 |
| Web 자동 테스트 | 18개 통과 |
| Web typecheck·lint·production build | 통과 |

저장 이력은 원본 1건 → Graph 편집 2건 → Roadmap 편집 3건 → 동시 편집
4건 → 원본 복원 5건으로 증가했다. 각 편집본의 `editedFromResultId`가
직전 편집 대상 ID와 일치하고, 복원본의 `restoredFromResultId`가 원본 ID와
일치했다. 새로고침 후 최신 결과를 API·DB 응답과 비교했다.

## 발견한 문제와 수정

Node 패널을 연 상태에서 패널이 로드맵의 저장 버튼을 덮었다. 실제 브라우저
클릭이 패널에 차단되어 E2E가 실패했다. 1180px보다 큰 화면에서는 Node 패널이
열리면 로드맵을 왼쪽 가용 공간에 배치하도록 수정했다. 작은 화면에서도 패널을
닫을 수 있도록 `Node 편집 닫기` 버튼을 추가했다. 이후 같은 클릭 흐름이 통과했다.

이번 E2E는 데스크톱 Chromium 검증이며 모바일 viewport와 다른 브라우저는
검증 범위에 포함하지 않았다.

## 실행과 증빙

```powershell
docker compose up -d --build api postgres
npx playwright install chromium
npm run test:e2e
```

Windows의 네이티브 SWC 로드 차단으로 같은 버전 WASM 컴파일러를 로컬 설치했다.
검증 전 `npm ci`로 lockfile의 버전을 복원했으며 설치·실행 안내는
`tests/e2e/README.md`에 있다.

Playwright HTML 보고서 `playwright-report/index.html`에 DB 이력 JSON과
최종 화면을 첨부했다. 실패 시 screenshot과 trace도 저장한다. 생성된 보고서와
브라우저 산출물은 Git에서 제외했다.

E2E 전용 프로젝트와 결과 버전은 DB에 남긴다. 실패한 실행의 중간 데이터도
남아 있을 수 있다. 기존 프로젝트는 수정하지 않았다.

## 다음 작업

Phase 1과 Phase 2의 브라우저 검증을 마쳤으므로 Phase 3의 생성본·편집본·복원본
출처 표시, 버전 비교·복원 및 충돌·변경 이력 UX를 진행한다.
