# AI_Planning_Platform

## 1. 개요

AI_Planning_Platform은
사용자의 요구사항이나 목표를 기반으로 AI가 필요한 구성 요소를 추천하고,
관계와 흐름을 구조화하여 시각적인 설계 및 계획 초안을 자동 생성하는 플랫폼입니다.

단순 문서 생성이나 다이어그램 생성이 아닌,
사용자의 아이디어를 구조화된 사고 체계로 변환하는 것을 목표로 합니다.

---

## 2. 기술 스택

### Frontend

- Next.js
- React
- React Flow
- Zustand

### Backend

- FastAPI 또는 NestJS

### AI Layer

- LangGraph
- OpenAI API

### Database

- PostgreSQL

### Optional

- tldraw SDK
- Vector DB
- RAG Pipeline

---

## 3. 기능

### 3.1 요구사항 기반 AI 컴포넌트 추천

사용자의 목표와 요구사항을 분석하여 필요한 구성 요소를 자동 추천합니다.

---

### 3.2 Dependency Graph 생성

추천된 컴포넌트 간의 관계와 의존성을 자동으로 연결합니다.

---

### 3.3 시각적 캔버스 자동 생성

AI가 생성한 구조를 Node 기반 캔버스로 시각화합니다.

---

### 3.4 계획 및 로드맵 생성

구조화된 정보를 기반으로 일정, 단계, 우선순위 등을 자동 생성합니다.

---

### 3.5 구조화된 사고 지원

단순 답변 생성이 아닌 관계 분석, 흐름 설계, 단계적 사고 구조화를 지원합니다.

---

## 4. 목표

사용자의 아이디어를 구조화된 설계와 실행 가능한 계획으로 변환하는 AI 플랫폼 구축을 목표로 합니다.

---

## 5. 디렉토리 구조

```text
AI_Planning_Platform/
├─ apps/
│  ├─ web/                 # Next.js, React, React Flow, Zustand
│  └─ api/                 # FastAPI 또는 NestJS 백엔드
├─ packages/
│  ├─ ai/                  # LangGraph, OpenAI API, AI planning workflows
│  └─ shared/              # 공통 타입, 스키마, 유틸리티
├─ infra/
│  ├─ docker/              # Docker 및 로컬 실행 환경
│  └─ db/
│     └─ migrations/       # PostgreSQL migration
├─ docs/                   # 기획, 아키텍처, API 문서
├─ scripts/                # 개발/운영 자동화 스크립트
└─ tests/                  # 통합 테스트 및 E2E 테스트
```

자세한 설명은 `docs/project-structure.md`에 정리되어 있습니다.

---

## 6. Docker 로컬 실행

Windows에서는 Node.js와 Docker Desktop을 설치하고 Docker Desktop을 켠 뒤,
저장소 루트에서 다음 명령으로 DB·API·웹을 함께 실행합니다.

```powershell
npm.cmd run dev
```

시작 스크립트는 `.env`가 없으면 예시 설정을 복사하고, Node 의존성이 없으면 설치합니다.
API 이미지를 빌드하고 DB와 API의 정상 상태를 확인한 뒤 웹 개발 서버를 시작합니다.
화면은 `http://localhost:3000`에서 열 수 있습니다. AI 생성에는 루트 `.env`의
`OPENAI_API_KEY` 설정이 필요합니다. 키를 변경했다면 실행 명령을 다시 실행하세요.
웹 서버는 `Ctrl+C`, API와 DB는 `docker compose stop`으로 종료합니다.
기존 데이터는 Docker 볼륨에 유지됩니다.

프로젝트에서 계획 주제를 입력하고 `AI 입력 검토`를 선택하세요. 검토 창에서 질문에
답해 다시 검토하거나 현재 정보로 진행할 수 있습니다. 최종 입력, 진행 가정과 모델을
확인하고 `확인하고 계획 생성`을 선택하세요. `검토·추천 이력`에서 생성에 사용한
검토와 모델 선택 기록을 조회하고 결과 품질 피드백을 남길 수 있습니다.

API와 PostgreSQL 로컬 런타임은 Docker Compose로 실행할 수 있습니다.

```bash
docker compose up --build
```

API health check:

```text
http://localhost:8000/health
```

로컬 포트, CORS origin, PostgreSQL 계정을 바꾸려면 `.env.example`을 기준으로 `.env`를 생성해 수정합니다.

## 7. 검증

Node 기반 Shared, Web, 계획 평가 검증 전체를 한 번에 실행합니다.

```powershell
npm run verify:node
```

API 테스트는 `apps/api`에서 실행합니다.

```powershell
uv run --frozen pytest
```

GitHub Actions는 pull request와 `main` push에서 두 검증을 병렬 실행합니다.

Graph·Roadmap 편집의 실제 브라우저 검증은 로컬 API와 PostgreSQL을 실행한 뒤 수행합니다.

```powershell
docker compose up -d --build api postgres
npx playwright install chromium
npm run test:e2e
```

테스트는 웹 서버를 자동으로 시작하고 E2E 전용 프로젝트를 생성합니다.
검증 범위와 테스트 데이터 안내는 `tests/e2e/README.md`를 참고하세요.
