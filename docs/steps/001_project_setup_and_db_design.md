# 001_project_setup_and_db_design

## 목적

이 문서는 [implementation_order.md](/c:/Jungle/agentic-board/docs/implementation_order.md)의
`2. 프로젝트 기본 세팅 / DB 설계`를 실제로 진행할 수 있도록
한 번에 따라가는 작업 가이드로 정리한 문서다.

현재 레포 구조를 기준으로 아래 조합을 전제로 한다.

- 백엔드: `apps/nest-api`
- 프론트엔드: `apps/web-react`
- 데이터베이스: PostgreSQL
- ORM: Prisma

## 1. 먼저 기준 스택 확정하기

현재 레포에는 선택지가 섞여 있다.

- `apps/nest-api`
- `apps/fastapi-api`
- `apps/web-react`
- `my-app`

이 상태로 진행하면 환경변수 위치, DB 연결 코드, 마이그레이션 위치가 계속 흔들린다.

우선 아래 기준으로 고정하는 것을 권장한다.

- 메인 API: `apps/nest-api`
- 메인 웹: `apps/web-react`
- DB: PostgreSQL
- ORM: Prisma

### 체크리스트

- [ ] `apps/nest-api`를 메인 API로 사용하기로 결정
- [ ] `apps/web-react`를 메인 프론트로 사용하기로 결정
- [ ] `apps/fastapi-api`는 당분간 사용하지 않기로 결정
- [ ] `my-app`은 실험용인지, 폐기할지, 통합할지 결정
- [ ] ORM을 `Prisma`로 확정

## 2. 로컬 PostgreSQL 실행하기

이 프로젝트에는 이미 Postgres용 도커 설정이 있다.

확인 파일:

- [package.json](/c:/Jungle/agentic-board/package.json)
- [infra/docker-compose.yml](/c:/Jungle/agentic-board/infra/docker-compose.yml)

현재 설정 기준 DB 정보:

- DB 이름: `agentic_board`
- 사용자명: `postgres`
- 비밀번호: `postgres`
- 포트: `5432`

### 실행 명령어

레포 루트에서 실행:

```powershell
npm run db:up
```

로그 보기:

```powershell
npm run db:logs
```

중지:

```powershell
npm run db:down
```

### 체크리스트

- [ ] PostgreSQL 컨테이너 실행
- [ ] `5432` 포트 충돌 없는지 확인
- [ ] DB 접속 정보 확인

## 3. Nest API에 환경변수 준비하기

다음으로 `apps/nest-api`에서 읽을 `.env`를 준비한다.

권장 예시:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agentic_board?schema=public"
```

권장 위치:

- `apps/nest-api/.env`
- 필요하면 `apps/nest-api/.env.example`

### 체크리스트

- [ ] `DATABASE_URL` 확정
- [ ] `.env` 파일 생성
- [ ] `.env.example`에 공유용 값 정리

## 4. Nest API에 DB 패키지 설치하기

현재 `apps/nest-api`는 기본 Nest 템플릿 수준이라
DB 연결용 패키지가 아직 없다.

확인 파일:

- [apps/nest-api/package.json](/c:/Jungle/agentic-board/apps/nest-api/package.json)
- [apps/nest-api/src/app.module.ts](/c:/Jungle/agentic-board/apps/nest-api/src/app.module.ts)

### 설치 명령어

```powershell
cd apps/nest-api
npm install @nestjs/config @prisma/client
npm install -D prisma
```

### 이후 만들 구조 예시

```text
apps/nest-api/src
  common/
  config/
  database/
  modules/
```

### 이 단계에서 할 일

- `@nestjs/config`로 환경변수 읽기
- Prisma Client 초기화 위치 정하기
- 공통 모듈 구조 정하기

### 체크리스트

- [ ] `@nestjs/config` 설치
- [ ] `@prisma/client` 설치
- [ ] `prisma` 설치
- [ ] `src/config`, `src/database`, `src/modules` 구조 초안 정리

## 5. DB 설계 규칙 먼저 정하기

ERD를 코드로 옮기기 전에 규칙을 먼저 고정해야 한다.

### 권장 규칙

- 테이블명: 복수형 `snake_case`
  - 예: `seat_reviews`, `performance_casts`
- 컬럼명: `snake_case`
  - 예: `seat_floor`, `comfort_rating`
- PK: `id bigint`
- FK: `xxx_id`
- 핵심 테이블 기본 시간 컬럼:
  - `created_at`
  - `updated_at`
- 후기와 댓글은 소프트 삭제 권장:
  - `is_deleted boolean`

### 평가값 규칙

초기에는 정수형 평가가 단순하다.

- 1: 매우 나쁨
- 2: 나쁨
- 3: 보통
- 4: 좋음
- 5: 매우 좋음

적용 대상:

- `view_rating`
- `sound_rating`
- `comfort_rating`
- `expression_rating`
- `stage_visibility_rating`

### 방향 값 규칙

아래 값 중 하나로 제한하는 것이 좋다.

- `left`
- `right`
- `center`
- `mixed`
- `none`

### 체크리스트

- [ ] 네이밍 규칙 확정
- [ ] PK / FK 규칙 확정
- [ ] 평가값 스케일 확정
- [ ] 소프트 삭제 적용 대상 확정
- [ ] 방향 값 후보 확정

## 6. 1차 핵심 테이블 범위 정하기

MVP에서는 모든 테이블을 한 번에 다 만들 필요는 없다.

우선 아래 테이블부터 시작하는 것이 적절하다.

- `users`
- `theaters`
- `musicals`
- `performances`
- `seat_reviews`
- `comments`
- `tags`
- `seat_review_tags`

### seat_reviews에서 우선 필요한 필드

사용자 입력 부담을 줄이기 위해,
아래 정도만 필수 데이터로 보고 시작하는 것이 좋다.

- 극장
- 공연명 또는 작품
- 층
- 구역
- 열
- 번호
- 후기 본문
- 시야 평가
- 음향 평가
- 좌석 편의성 평가
- 배우 표정 체감
- 무대 전체 체감

### DB 컬럼으로는 같이 고려할 값

입력은 선택이더라도 스키마상 자리는 미리 둘 수 있다.

- `has_obstruction`
- `obstruction_note`
- `side_preference`
- `comfort_note`
- `visit_date`
- `revisit_intent`
- `view_count`
- `is_deleted`

### 체크리스트

- [ ] 1차 테이블 목록 확정
- [ ] `seat_reviews` 필수 컬럼 확정
- [ ] nullable 컬럼 확정
- [ ] unique 제약 후보 정리
- [ ] index 후보 정리

## 7. 2차 확장 테이블 범위 정하기

아래 테이블은 배역/배우 검색과 RAG 정밀도를 높이는 용도라
1차 이후 추가해도 된다.

- `characters`
- `actors`
- `performance_casts`
- `seat_review_focuses`
- `documents`
- `embeddings`

### 왜 필요한가

- `characters`, `actors`, `performance_casts`
  - 작품 + 배역/배우 질문 대응
- `seat_review_focuses`
  - 좌우 추천, 동선, 특정 배역 체감 구조화
- `documents`, `embeddings`
  - RAG용 문서/임베딩 파이프라인

### documents에 넣으면 좋은 메타데이터

- `theater_id`
- `musical_id`
- `performance_id`
- `seat_floor`
- `seat_section`
- `seat_row`
- `seat_number`
- `side_preference`
- `comfort_rating`
- `character_names`
- `actor_names`

### 체크리스트

- [ ] 2차 확장 테이블 범위 확정
- [ ] `seat_review_focuses` 유지 여부 확정
- [ ] `documents.metadata_json` 구성 초안 정리
- [ ] 임베딩 저장 전략 초안 정리

## 8. Prisma 초기화와 1차 마이그레이션 준비

이제 실제 스키마 작업으로 넘어간다.

### 실행 명령어

```powershell
cd apps/nest-api
npx prisma init
```

그 다음 할 일:

1. `schema.prisma` 작성
2. 1차 핵심 테이블 반영
3. 마이그레이션 생성
4. DB 반영

### 마이그레이션 예시

```powershell
npx prisma migrate dev --name init_core_schema
```

Prisma Studio:

```powershell
npx prisma studio
```

### 체크리스트

- [ ] Prisma 초기화
- [ ] `schema.prisma` 생성
- [ ] 1차 핵심 테이블 작성
- [ ] 1차 마이그레이션 생성

## 9. 최소 seed 데이터 넣기

스키마만 만들고 끝내지 말고,
바로 확인 가능한 테스트 데이터를 조금 넣는 것이 좋다.

### 권장 seed 데이터

- 극장 2~3개
- 작품 2~3개
- 공연 2~3개
- 좌석 후기 3~5개
- 태그 몇 개

예:

- 블루스퀘어
- 샤롯데씨어터
- 어쩌면 해피엔딩
- 지킬앤하이드

### 체크리스트

- [ ] 극장 seed 데이터 입력
- [ ] 작품 seed 데이터 입력
- [ ] 공연 seed 데이터 입력
- [ ] 좌석 후기 seed 데이터 입력
- [ ] 태그 seed 데이터 입력

## 10. 마지막 검증

아래 항목을 확인하면 `2. 프로젝트 기본 세팅 / DB 설계`는 끝난다.

- `seat_reviews`가 `theaters`, `musicals`, `performances`와 연결되는가
- 좌석 위치 검색용 컬럼이 빠지지 않았는가
- `comfort_rating`이 있는가
- `view_rating`, `sound_rating`, `expression_rating`, `stage_visibility_rating`이 있는가
- 댓글이 `seat_review_id`로 연결되는가
- 태그가 N:M으로 붙는가
- Nest 앱이 DB에 연결되는가

## 완료 기준

아래가 가능하면 이 단계는 완료다.

- 로컬 Postgres가 정상 실행된다
- Nest 앱이 DB에 연결된다
- 1차 핵심 테이블이 모두 생성된다
- 최소 seed 데이터가 들어간다
- 다음 단계인 `좌석 후기 CRUD`로 바로 넘어갈 수 있다
