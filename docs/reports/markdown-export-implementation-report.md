# Markdown 내보내기 — 2026-10-20

사이드바의 **내보내기 → Markdown 내보내기** 버튼으로 선택한 결과를 `.md` 파일로 저장한다.
파일은 브라우저에서 UTF-8로 생성한다.

## 문서 내용

- 프로젝트명, 선택 버전, 저장 전 편집 포함 여부, 결과 생성 시각과 사용 모델
- 선택한 결과의 요구사항과 요약
- 노드 이름, 유형, 분류, 우선순위와 설명
- 시작·대상 노드, 관계 유형과 연결 설명 표
- 실행 순서대로 정렬한 로드맵과 설명, 우선순위, 예상 작업량, 선행 단계와 관련 노드

노드와 단계 참조는 문서의 번호와 이름으로 표시한다. 연결이나 실행 단계가 없는 경우에도
빈 상태를 표시하며 파일을 생성한다. 입력의 Markdown 구문과 HTML은 일반 텍스트로 처리한다.

## 동작과 범위

- 현재 화면의 Graph·Roadmap 편집을 반영하며 미저장 상태는 본문과 `-편집중` 파일명에 표시한다.
- 선택한 과거 결과도 그대로 내려받을 수 있다.
- 결과가 없거나 불러오기·저장 중이면 버튼을 비활성화한다.
- 파일명 예: `나의 계획-계획-v2.md`, `나의 계획-계획-v2-편집중.md`.
- 한글 파일명을 유지하고 파일명에 사용할 수 없는 문자와 제어 문자를 정리한다.
- 요구사항은 선택한 결과에 기록된 내용을 사용한다. 생성 이후 별도로 수정한 입력 Draft와
  Planning Brief는 이번 내보내기에 포함하지 않는다.
- 내보내기는 결과 저장·복원을 호출하지 않으며 선택 버전과 미저장 편집 상태를 유지한다.
- 다운로드에 실패하면 재시도 안내를 표시한다.

이미지와 PDF 출력은 후속 작업으로 남긴다.

## 구현

- `apps/web/src/lib/planningMarkdown.ts`: 문서 생성, 파일명 정리와 브라우저 다운로드
- `apps/web/src/components/PlanningExportPanel.tsx`: 버튼과 상태 안내
- `PlanningWorkspace.tsx`, `globals.css`: 사이드바 연결과 공통 스타일 적용

## 검증

- Web Vitest 39개 통과. 편집 내용·참조 표시·실행 순서, 원본 데이터 보존,
  특수문자·HTML·여러 줄 입력과 빈 로드맵·파일명을 포함한다.
- Web TypeScript 검사와 ESLint 통과.
- Playwright Chromium 4개 통과: Markdown 다운로드 2개, 기존 데스크톱·모바일 배치 2개.
- 실제 다운로드 파일의 이름과 내용을 읽어 저장된 결과, 미저장 편집본, 과거 결과를 검증했다.
- 내보내기 후 버전 수·미저장 상태를 유지하고 편집 저장·복원 요청이 없는지 확인했다.
- 브라우저 테스트는 API fixture를 사용하여 기존 개인 프로젝트나 DB를 변경하지 않았다.
- 실행 중인 개발 서버와 분리한 `build/markdown-export-web`의 소스·글꼴 복사본으로
  Next.js production build를 통과했다.

```powershell
npm run web:test
npm run web:typecheck
npm run lint -w apps/web
npm run test:e2e -- tests/e2e/markdown-export.spec.ts tests/e2e/ui-layout.spec.ts
```
