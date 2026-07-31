# 커튼콜 시트

커튼콜 시트는 뮤지컬 관람객의 좌석 후기를 극장·공연·층·구역·열 단위로 구조화하고, 실제 후기 근거를 바탕으로 좌석을 비교·추천하는 AI 좌석 탐색 서비스입니다.

좌석 후기가 커뮤니티와 SNS에 흩어져 있어 원하는 정보를 찾기 어렵고, 같은 공연장에서도 좌석 위치에 따라 시야·음향·배우 표정·무대 체감이 크게 달라지는 문제를 해결하고자 만들었습니다. 누적된 후기를 검색하는 후기 탐색 기능에 RAG·MCP·Agent를 연결해 좌석 질문에 근거 후기와 함께 답하도록 구성했습니다.

## 주요 기능

- 극장·작품·공연 시즌·좌석 위치를 기준으로 한 후기 작성·조회·수정·삭제
- 시야·음향·편안함·배우 표정·무대 전체 체감 평점과 태그 관리
- 극장·작품·층·구역·열·번호·태그·시야방해·평점 조합 검색
- 최신순·평점순 정렬, 페이지네이션, 극장별 탐색 화면과 좌석 배치도
- PostgreSQL과 pgvector를 이용한 좌석 후기 RAG
- 실제 후기와 외부 공연 메타데이터를 함께 사용하는 좌석 비교·추천 Agent
- HttpOnly Cookie 기반 인증, Google OAuth, 비밀번호 재설정
- 후기·댓글 신고, 관리자 숨김·복구·강제 삭제, 감사 로그

## Evidence-first 좌석 비교 워크스페이스

후기 카드나 좌석 상세에서 같은 극장·공연의 좌석을 최대 3개까지 비교함에 담을 수 있습니다. 비교 워크스페이스는 각 좌석의 실제 후기 수, 시야·음향·편안함·배우 표정·무대 전체 체감 평균, 자주 등장한 태그, 긍정 근거와 주의 근거를 함께 보여 줍니다. 근거 문장을 선택하면 원문 후기 상세를 다시 확인할 수 있습니다.

정확한 좌석 후기 수가 적으면 같은 열의 인접 좌석, 같은 구역 순서로 참고 범위를 넓히되 이를 직접 후기처럼 표시하지 않습니다. 비교 후보 중 직접 후기가 없는 좌석이 있으면 Agent는 승자를 만들지 않고 비교를 보류하며, 사용자가 조건을 완화하거나 후기를 작성할 수 있는 다음 행동을 안내합니다. 상세 설계와 이후 단계는 [Evidence-first Seat Workspace 로드맵](docs/evidence-first-seat-workspace-roadmap.md)에 정리했습니다.
## 핵심 구현

### 후기 근거 기반 좌석 비교·추천 Agent

초기 Agent는 두 좌석을 비교해도 한 후보의 조건으로 합치거나, OP석과 배역 중심 질문에도 일반적인 중앙블록 추천을 반환했습니다.

층·구역·열·방향별 후보를 분리하고 각 후보의 후기를 독립적으로 검색·점수화하도록 개선했습니다. 정확한 조건의 후기가 부족하면 인접 열과 같은 층 순서로 검색 범위를 넓히고, 추천 이유·주의사항·근거 후기를 함께 반환합니다.

외부 공연 메타데이터와 좌석 배치 정보는 MCP 경로로 보강합니다. 작품 후기가 없거나 외부 조회가 실패할 때는 같은 극장의 다른 작품 후기를 참고했다는 한계를 함께 안내합니다.

1층과 3층 비교, 사이드 앞열과 중앙 뒷열 비교, 좌우 블록, 극사이드, OP석, 배역·배우 별칭, 인접 통로석 등 실제로 실패했던 17개 질문을 회귀 테스트로 관리합니다.

### pgvector 기반 좌석 후기 RAG

별도 벡터 DB를 추가하는 대신 서비스 데이터가 저장된 PostgreSQL에 pgvector를 결합했습니다. 후기 본문뿐 아니라 극장·작품·시즌·좌석 위치·5개 평점·태그를 하나의 검색 문서로 구성합니다.

질문에서 극장·작품·층·구역·열·번호와 질문 의도를 추출한 뒤, 구조화 필터와 벡터 검색을 함께 적용합니다. 선택된 후기만 LLM에 전달하고 답변·추천 이유·적용 조건·근거 후기를 함께 반환합니다.

후기 생성·수정 시 임베딩을 자동으로 갱신하며 기존 후기는 백필 스크립트로 다시 색인할 수 있습니다. 숨김·삭제된 후기는 검색 대상에서 제외합니다.

작품 줄거리처럼 좌석 후기 범위 밖의 질문은 모델 호출 전에 차단합니다. 근거가 없을 때의 안전 응답, 질문 500자 제한, IP별 요청 제한, 관리자 전용 재색인을 적용했습니다. 질문·적용 조건·근거 후기 ID·응답 시간을 로그로 남겨 검색 실패와 답변 생성 실패를 구분할 수 있습니다.

### HttpOnly Cookie 기반 인증과 운영 기능

초기 localStorage 기반 인증을 HttpOnly Cookie 중심으로 전환했습니다. Access Token과 Refresh Token의 책임을 분리하고, Refresh Token 회전·폐기와 서버 세션 추적을 적용했습니다.

SameSite·Secure Cookie, 허용 Origin 기반 CORS, Reverse Proxy 환경의 실제 클라이언트 IP 처리, Google OAuth state 검증을 함께 관리합니다. 비밀번호 재설정과 Google OAuth 로그인도 같은 인증 흐름에 연결했습니다.

후기·댓글 신고, 관리자 숨김·복구·강제 삭제, 소프트 삭제, 감사 로그를 추가해 일반 사용자 API와 관리자 API의 권한 경계를 분리했습니다.

### 구조화된 후기와 검색·탐색 흐름

극장·작품·공연 시즌·좌석 후기·댓글·태그의 관계를 분리하고, 층·구역·열·번호와 시야·음향·편안함·배우 표정·무대 전체 체감 평점을 구조화했습니다.

공연 시즌을 선택한 뒤 좌석 배치도에서 위치를 확인해 후기를 작성할 수 있습니다. 극장·작품·좌석·태그·평점 조건을 조합한 검색과 정렬·페이지네이션을 지원하며, 극장별 탐색 화면에서 후기 상세와 댓글까지 이어서 확인할 수 있습니다.

회원가입·로그인부터 후기 작성, 작성자별 수정·삭제 권한, 댓글, 태그 검색, 404·403 오류 형식까지 실제 DB를 사용하는 통합 E2E 시나리오로 관리합니다.

### 멀티 서비스 컨테이너 실행 구조

React·NestJS·FastAPI·PostgreSQL/pgvector를 하나의 Docker Compose로 실행합니다. PostgreSQL, NestJS, FastAPI, Web 순서로 의존성과 Health Check를 확인한 뒤 기동합니다.

Nginx가 React 정적 파일을 제공하고 요청 경로에 따라 내부 서비스로 전달합니다.

```text
브라우저
  └─ Nginx / React
       ├─ /api   → NestJS
       ├─ /agent → FastAPI Agent
       ├─ /mcp   → FastAPI MCP
       └─ /demo  → FastAPI Demo

NestJS
  └─ PostgreSQL + pgvector

FastAPI
  └─ NestJS 내부 API
```

PostgreSQL은 호스트의 `127.0.0.1`에만 바인딩하고 API 컨테이너는 Docker 내부 네트워크에서 통신합니다. NestJS 기동 시 Prisma Migration을 자동으로 적용하며, 운영 Cookie·CORS·JWT·OAuth·OpenAI 설정은 환경변수로 분리했습니다.

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| Web | React, TypeScript, Vite, Nginx |
| API | NestJS, TypeScript, Prisma |
| AI | FastAPI, Python, OpenAI API, RAG, MCP, Agent |
| Database | PostgreSQL, pgvector |
| Auth | JWT, HttpOnly Cookie, Google OAuth |
| Deploy | Docker, Docker Compose, AWS |
| Test | Jest, Supertest, Node Test, Pytest |

## 프로젝트 구조

```text
apps/
  nest-api/      인증, 후기, 댓글, 태그, 관리자, RAG API
  fastapi-api/   좌석 추천 Agent, MCP, 외부 공연 메타데이터
  web-react/     후기 탐색, 좌석 배치도, 관리자 화면
docs/            구현 단계, 개념 설명, 품질 평가, 배포 문서
docker-compose.yml
```

## Docker로 실행하기

```powershell
npm run compose:up
```

실행 후 `http://localhost:8080`에서 확인할 수 있습니다.

```powershell
npm run compose:ps
npm run compose:logs
npm run compose:down
```

기본 실행 구성은 다음과 같습니다.

- Web: `http://localhost:8080`
- NestJS: Docker 내부 `nest-api:3000`, 외부에서는 `/api`로 접근
- FastAPI: Docker 내부 `fastapi-api:8000`, 외부에서는 `/agent`, `/mcp`, `/demo`로 접근
- PostgreSQL: Docker 내부 네트워크와 로컬 `127.0.0.1:5432`

## 로컬 개발

의존성을 설치합니다.

```powershell
npm run install:all
```

PostgreSQL만 실행합니다.

```powershell
npm run db:up
```

각 애플리케이션을 개발 모드로 실행합니다.

```powershell
npm run nest:start
npm run web:dev

cd apps/fastapi-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

NestJS Migration을 실행할 때는 `DATABASE_URL`을 설정합니다.

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agentic_board?schema=public"
npm run nest:migrate
```

## 운영 환경 설정

루트의 `.env`에 운영 값을 설정합니다.

```dotenv
WEB_PORT=80
POSTGRES_PASSWORD=replace-with-a-long-random-password
JWT_SECRET=replace-with-a-64-byte-random-secret
GOOGLE_OAUTH_STATE_SECRET=replace-with-a-64-byte-random-secret
CORS_ORIGINS=https://your-domain.com
WEB_APP_ORIGIN=https://your-domain.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
OPENAI_API_KEY=sk-...
```

기본 비밀번호와 JWT Secret을 사용한 상태로 외부에 공개하면 안 됩니다. Google OAuth Redirect URI는 실제 도메인과 일치해야 하며, HTTPS 환경에서는 `AUTH_COOKIE_SECURE=true`를 사용합니다.

AWS 배포 설정과 점검 항목은 [docs/deployment/aws.md](docs/deployment/aws.md)에 정리되어 있습니다.

## 검증

```powershell
npm --prefix apps/nest-api test -- --runInBand
npm --prefix apps/web-react run test
python -m pytest apps/fastapi-api/tests -p no:cacheprovider
npm run build
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml build
```

최근 로컬 검증에서 NestJS 19개 Test Suite·66개 테스트와 프론트 8개 스모크 테스트가 통과했습니다.

## 참고 문서

- [프로젝트 기획](docs/project_plan.md)
- [구현 순서](docs/implementation_order.md)
- [RAG 구현 문서](docs/step%201/009_rag.md)
- [MCP 구현 문서](docs/step%201/010_mcp_integration.md)
- [좌석 추천 Agent 구현 문서](docs/step%201/011_seat_selection_agent.md)
- [RAG 품질 평가 질문](docs/review/rag_quality_evaluation_questions.md)
- [Agent 품질 평가 질문](docs/review/agent_quality_sample_questions.md)