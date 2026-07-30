# Evidence-first Seat Workspace 로드맵

## 제품 원칙

AI Board의 핵심 콘텐츠는 뮤지컬 관객이 남긴 실제 좌석 후기다. AI는 후기를 대신해 새로운 좌석 사실을 만들지 않고, 사용자가 후기를 찾고 비교하고 원문을 확인하는 과정을 보조한다. 기존 후기 CRUD, 검색·필터, 좌석도, 댓글·좋아요·신고·관리자 흐름은 각 단계의 회귀 기준으로 유지한다.

이 로드맵은 현재 React/Vite Web, NestJS API, FastAPI Agent, PostgreSQL/pgvector 구조와 이미 정의된 Agent 응답 계약을 점진적으로 확장한다. 현재 좌석 메타데이터 연동은 내부 adapter/MCP 경로이며, 표준 MCP 서버를 구현했다고 표현하지 않는다.

## 조사 결과와 기준선

- Frontend는 React/Vite, 서비스 API는 NestJS, Agent는 FastAPI로 분리되어 있다.
- PostgreSQL/pgvector 후기 검색과 RAG가 있고, source가 없을 때 OpenAI 호출을 생략하는 안전 경로가 있다.
- 후기는 극장·공연·좌석과 시야, 음향, 편안함, 배우 표정, 무대 전체 체감의 다섯 평가축을 가진다.
- Agent 계약에는 `recommendation`, `reasons`, `cautions`, `evidenceReviews`, `filters`, `mcpStatus`, `ragStatus`, `ragAnswer`가 있지만 기존 좌석 도우미는 추천 문장 중심으로 표시했다.
- 비교 요청은 일반 RAG를 생략할 수 있다. 따라서 UI에서 이를 실패로 숨기거나 일반 RAG 답변처럼 표현하지 않는다.
- RAG query log에는 질문, 필터, source ID, 답변 미리보기, latency가 기록된다.
- 기준선 검증은 NestJS 19 suites/66 tests, FastAPI 25 passed/1 skipped, Web 기존 테스트 전체 통과였다. 브라우저 E2E와 고정 평가 시나리오의 자동 pass/fail 체계는 아직 충분하지 않다.

## Phase 1 — Evidence-first Seat Decision Workspace (구현)

### 사용자 흐름

1. 후기 카드 또는 좌석도 상세에서 같은 극장·공연의 좌석을 비교함에 담는다.
2. 최대 세 좌석의 직접 후기 수, 다섯 평가축 평균, 반복 태그, 긍정 근거와 주의 근거를 나란히 본다.
3. 표본이 적으면 평균보다 표본 경고를 먼저 확인하고, 인접 좌석 또는 같은 구역을 참고했다는 근거 수준을 구분한다.
4. 근거 문장을 눌러 원본 후기 상세를 연다.
5. 우선 기준과 예산 chip을 선택해 “후기 기반 비교 요약”을 요청한다.

### 안전 결정

- 정확한 좌석 후기가 없는 후보가 하나라도 있으면 Agent가 승자나 장단점을 새로 만들지 않고 비교를 보류한다.
- 직접 후기가 부족할 때 인접 좌석과 같은 구역 후기는 참고 근거로만 표시한다.
- 비교 경로가 일반 RAG를 사용하지 않으면 사용자 언어로 생성 방식을 설명한다.
- 생성형 응답이 없어도 정상적인 데이터 부족 상태로 취급하고, 조건 완화·극장 후기 탐색·후기 작성 행동을 제공한다.

### 구현 경계

Phase 1은 새로운 DB schema나 학습 파이프라인을 추가하지 않는다. 기존 후기 검색 API와 Agent 응답 계약을 재사용하고, Web 비교함은 이미 알고 있는 층·구역·열·번호를 구조화된 `candidates` 요청 필드로 전달한다. 기존 자유질문은 텍스트 파싱 경로를 유지한다. 근거 수준은 조회 범위와 직접 후기 수에서 계산한다. 실제 운영 데이터에서 “충분한 표본” 임계값은 아직 검증되지 않았으므로 현재 UI는 3건 미만을 소표본으로 경고한다. 좌석도 비교 선택은 현재 후기가 있는 좌석을 기준으로 하며, 후기와 독립된 빈 좌석 후보 모델은 이후 계약 정비 범위로 남긴다.

## Phase 2 — Seat Agent Evaluation Lab

- `eval/scenarios` 등 저장소에 맞는 위치에 20~30개 고정 fixture를 둔다.
- filter accuracy, allowed-source rate, citation coverage, abstention accuracy, fallback correctness, invalid seat fact, repeated-run stability, p50/p95 latency를 계산한다.
- Git revision, scenario·seed/snapshot·embedding document·prompt version, model과 주요 환경 설정을 manifest에 남긴다.
- filter/source/status는 결정론적으로 판정하고 LLM judge는 보조 평가로만 사용한다.
- 로컬과 CI에서 동일 runner를 실행해 버전 간 Markdown/JSON report를 비교한다.

완료 기준은 동일 snapshot과 설정에서 결과를 재현하고, 안전 회귀를 기계적으로 pass/fail 할 수 있는 것이다.

## Phase 3 — Request Trace, Replay and Browser E2E

- Web → FastAPI → NestJS/RAG → 좌석 메타데이터 adapter에 request ID를 전파한다.
- 입력 조건, 파싱된 filter, source ID, 도구 상태, fallback 이유, 단계별 latency, document/layout version을 하나의 trace로 연결한다.
- 민감한 원문과 사용자 정보를 최소화·마스킹한 관리자용 추천 영수증을 제공한다.
- replay는 seed/snapshot 기반 개발·테스트 환경에서만 허용한다.
- Playwright로 직접 근거, source 없음, RAG·메타데이터 fallback, 비교 RAG skip, 도메인 밖 질문, 숨김·삭제 source 제외를 검증한다.

## Phase 4 — Tool and Data Contracts

- 좌석 메타데이터에 `schemaVersion`, `source`, `verifiedAt`, `layoutVersion`, `fallbackReason` 계약을 정의한다.
- 극장 adapter 공통 schema, timeout, 오류 타입과 fallback 정책을 contract test로 검증한다.
- 후기 lifecycle과 embedding document metadata의 일치, 구버전 문서와 유효하지 않은 좌석·극장·공연 참조를 검사한다.
- 내부 adapter/tool registry와 표준 MCP 서버의 경계를 코드와 문서에서 명확히 구분한다.

## Phase 5 — Community-to-Benchmark Quality Loop

- 추천 결과에 도움됨, 조건 불일치, 근거 부적합, 좌석 정보 오류 피드백을 추가한다.
- 관리자가 request/source ID와 사유를 검토하고 개인정보 제거·승인한 사례만 회귀 시나리오 후보로 만든다.
- 피드백을 자동 학습 데이터나 fixture로 전환하지 않는다.
- 극장·층·구역·좌석·평가축별 후기 coverage map으로 데이터 공백을 보여 주고, 후기 작성 시 부족한 축을 선택적으로 안내한다.

## 단계별 공통 완료 기준

- 변경한 사용자 흐름과 실패 경로에 테스트가 있다.
- source가 없는 생성형 답변 차단과 fallback 표시는 약화되지 않는다.
- 모바일·데스크톱 게시판/좌석도 탐색을 회귀 검증한다.
- schema 변경 시 migration, seed, test와 문서를 함께 갱신한다.
- 구현하지 않은 기능, 표준, 운영 검증을 완료했다고 문서에 표현하지 않는다.
- 각 Phase는 독립 커밋으로 남기고 변경 파일, 테스트, 잔여 위험, 다음 단계를 보고한다.