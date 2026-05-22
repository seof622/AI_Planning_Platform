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
