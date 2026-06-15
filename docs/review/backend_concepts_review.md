# 백엔드 개념 리뷰: OOP, 에러 처리, 테스트, API 설계, GraphQL, WebSocket, SSE, Rate Limit, CSRF/CORS

이 문서는 현재 백엔드 코드를 기준으로 주요 백엔드 개념을 정리한 문서다. 초보자는 각 개념이 무엇인지 이해하고, 경험자는 이 프로젝트가 어느 수준까지 적용하고 있는지 판단할 수 있도록 작성했다.

현재 백엔드는 크게 두 부분으로 나뉜다.

- `apps/nest-api`: NestJS 기반 메인 API 서버
- `apps/fastapi-api`: FastAPI 기반 좌석 추천, MCP, Agent 보조 API

대부분의 도메인 API는 NestJS가 담당한다. FastAPI는 Agent, MCP seat layout, 좌석 추천 같은 보조 기능을 담당한다.

## 현재 백엔드 구조 요약

Nest API의 주요 구조는 다음과 같다.

```text
apps/nest-api/src
  app.module.ts
  main.ts
  admin/
  auth/
  comments/
  common/
  database/
  health/
  metadata/
  rag/
  seat-reviews/
  tags/
  users/
```

요청 흐름은 보통 다음과 같다.

```text
HTTP 요청
  -> Controller
  -> DTO Validation
  -> Guard 인증/권한 검사
  -> Service
  -> PrismaService
  -> Database
  -> 응답 객체 반환
```

예를 들어 `seat-reviews` 도메인은 다음 파일들로 구성된다.

- Controller: `seat-reviews/seat-reviews.controller.ts`
- Service: `seat-reviews/seat-reviews.service.ts`
- DTO: `seat-reviews/dto/*.ts`
- Module: `seat-reviews/seat-reviews.module.ts`

FastAPI 쪽은 다음 구조에 가깝다.

```text
apps/fastapi-api/app
  main.py
  routers/
  schemas/
  services/
```

FastAPI 요청 흐름은 보통 다음과 같다.

```text
HTTP 요청
  -> Router
  -> Pydantic Schema Validation
  -> Service Function
  -> NestClient 또는 좌석 메타데이터 로직
  -> Pydantic Response
```

## 1. OOP를 지금 지키고 있는지

### OOP란 무엇인가

OOP는 Object-Oriented Programming, 즉 객체지향 프로그래밍이다.

객체지향은 코드를 "데이터와 행동을 가진 객체" 중심으로 나누는 방식이다. 백엔드에서는 보통 다음 형태로 나타난다.

- Controller: HTTP 요청을 받는 객체
- Service: 비즈니스 로직을 처리하는 객체
- Repository 또는 PrismaService: 데이터 저장소 접근을 담당하는 객체
- DTO: 요청/응답 데이터 구조를 표현하는 객체
- Guard: 인증, 권한, 제한을 검사하는 객체
- Module: 관련 객체들을 묶는 단위

OOP의 핵심은 "각 객체가 자기 책임을 가진다"는 점이다.

좋은 객체지향 설계에서는 다음 질문에 답할 수 있어야 한다.

- 이 클래스는 무엇을 책임지는가?
- 이 클래스가 몰라도 되는 것을 알고 있지는 않은가?
- 변경이 생겼을 때 어디를 고치면 되는가?
- 의존성을 직접 만들지 않고 주입받는가?
- 테스트할 때 의존성을 바꿔 끼울 수 있는가?

### 이 프로젝트는 OOP를 지키고 있는가

NestJS API는 OOP 구조를 꽤 잘 따른다.

NestJS 자체가 클래스, 데코레이터, 의존성 주입을 중심으로 설계된 프레임워크이기 때문이다.

예를 들어 `SeatReviewsController`는 HTTP 요청을 받는 역할에 집중한다.

```ts
@Controller('seat-reviews')
export class SeatReviewsController {
  constructor(private readonly seatReviewsService: SeatReviewsService) {}

  @Get()
  findAll(@Query() query: SeatReviewQueryDto) {
    return this.seatReviewsService.findAll(query);
  }
}
```

Controller는 직접 DB를 조회하지 않는다. `SeatReviewsService`를 주입받고, 실제 로직은 Service에 맡긴다.

`SeatReviewsService`는 후기 생성, 조회, 수정, 삭제, 공개 응답 변환, RAG embedding 갱신 트리거 같은 비즈니스 로직을 담당한다.

```ts
@Injectable()
export class SeatReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
  ) {}
}
```

`new PrismaService()`처럼 직접 객체를 만들지 않고 Nest의 의존성 주입을 통해 필요한 객체를 받는다. 이 구조는 OOP와 DI를 함께 사용하는 방식이다.

### 어떻게 지켜지고 있는가

Controller와 Service가 분리되어 있다.

- `auth.controller.ts` -> `auth.service.ts`
- `seat-reviews.controller.ts` -> `seat-reviews.service.ts`
- `comments.controller.ts` -> `comments.service.ts`
- `admin.controller.ts` -> `admin.service.ts`
- `tags.controller.ts` -> `tags.service.ts`
- `metadata.controller.ts` -> `metadata.service.ts`
- `rag.controller.ts` -> `rag.service.ts`

Module이 기능 단위로 나뉘어 있다.

- `AuthModule`
- `SeatReviewsModule`
- `CommentsModule`
- `AdminModule`
- `TagsModule`
- `MetadataModule`
- `RagModule`
- `DatabaseModule`

DTO 클래스로 입력 구조를 표현한다.

- `CreateSeatReviewDto`
- `UpdateSeatReviewDto`
- `SeatReviewQueryDto`
- `RegisterDto`
- `LoginDto`
- `PasswordResetRequestDto`
- `PasswordResetConfirmDto`
- `CreateCommentDto`
- `ReportReviewDto`
- `ModerateReviewDto`

Guard 클래스로 인증/권한 책임을 분리한다.

- `JwtAuthGuard`
- `AdminGuard`
- `LoginRateLimitGuard`

DB 연결은 `PrismaService`가 담당한다.

```ts
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
```

현재 구조는 객체지향에서 말하는 책임 분리와 캡슐화에 대체로 맞다.

### 부족하거나 개선할 수 있는 부분

현재 구조는 OOP를 지키고 있지만 일부 Service는 비대해지고 있다.

예를 들어 `SeatReviewsService`는 다음 책임을 많이 가진다.

- 후기 생성
- 후기 목록 검색
- 상세 조회
- 수정/삭제 권한 검증
- 태그 검증
- 공연/극장/작품 매칭 검증
- 검색 조건 조립
- 정렬 조건 조립
- public response 변환
- RAG embedding 갱신 트리거

서비스가 더 커지면 다음처럼 분리할 수 있다.

- `SeatReviewSearchService`: 검색 조건, 정렬, 페이지네이션
- `SeatReviewMutationService`: 생성, 수정, 삭제
- `SeatReviewPolicy`: 작성자/관리자 권한 검증
- `SeatReviewPresenter` 또는 mapper: DB 모델을 public response로 변환
- `ReviewEmbeddingIndexer`: RAG embedding 갱신 책임

하지만 지금 단계에서 무리하게 쪼갤 필요는 없다. 현재 규모에서는 Controller/Service/DTO/Module 분리만으로도 충분히 이해 가능한 구조다.

## 2. Error Handling은 어떻게 되고 있는지

### Error Handling이란 무엇인가

Error Handling은 오류가 발생했을 때 서버가 어떻게 감지하고, 어떤 응답으로 바꾸고, 어디까지 사용자에게 알려줄지 정하는 방식이다.

백엔드에서 에러 처리가 중요한 이유는 다음과 같다.

- 잘못된 요청은 400으로 응답해야 한다.
- 인증 실패는 401로 구분해야 한다.
- 권한 없음은 403으로 구분해야 한다.
- 없는 데이터는 404로 구분해야 한다.
- 중복 같은 충돌은 409로 구분해야 한다.
- 서버 내부 문제는 500으로 숨겨야 한다.
- 너무 자세한 에러 메시지는 보안 정보를 노출할 수 있다.

### NestJS 에러 처리 방식

NestJS는 `HttpException` 계열 예외를 던지면 자동으로 HTTP 응답으로 변환한다.

현재 프로젝트에서 사용하는 주요 예외는 다음과 같다.

- `BadRequestException`: 요청 값이 잘못됨, 400
- `UnauthorizedException`: 인증 실패, 401
- `ForbiddenException`: 권한 없음, 403
- `NotFoundException`: 리소스 없음, 404
- `ConflictException`: 중복 또는 충돌, 409
- `InternalServerErrorException`: 서버 내부 오류, 500
- `HttpException`: 직접 status code 지정

예를 들어 회원가입 중 이메일이 이미 있으면 다음처럼 처리한다.

```ts
if (existingUser) {
  throw new ConflictException('Email already exists');
}
```

로그인 실패는 이메일 존재 여부와 비밀번호 오류를 구분하지 않고 같은 메시지를 반환한다.

```ts
throw new UnauthorizedException('Invalid email or password');
```

이 방식은 공격자가 이메일 존재 여부를 추측하기 어렵게 해주므로 보안상 좋다.

관리자 기능에서는 관리자 권한이 없으면 `AdminGuard`가 403을 반환한다. 없는 후기나 댓글을 처리하려 하면 `NotFoundException`을 쓴다.

### ValidationPipe 기반 에러 처리

`main.ts`에서는 전역 `ValidationPipe`를 사용한다.

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

설정 의미는 다음과 같다.

- `whitelist: true`: DTO에 정의되지 않은 필드는 제거한다.
- `forbidNonWhitelisted: true`: DTO에 없는 필드가 들어오면 에러를 낸다.
- `transform: true`: query/body 값을 DTO 타입에 맞게 변환한다.

예를 들어 `SeatReviewQueryDto`에서 숫자 query를 검증한다.

```ts
@Type(() => Number)
@IsInt()
@Min(1)
@Max(50)
limit?: number = 20;
```

사용자가 `?limit=abc`를 보내면 validation 단계에서 막힌다. 잘못된 값이 service 로직까지 내려가지 않게 하는 구조다.

### 현재 에러 처리 평가

좋은 점:

- 비즈니스 상황에 맞는 HTTP status를 사용한다.
- DTO validation이 전역으로 적용되어 있다.
- 인증 실패와 권한 실패를 구분한다.
- 로그인 실패 메시지는 보안상 안전하게 통일되어 있다.
- 관리자 기능과 신고 기능도 권한/대상 없음 에러를 구분한다.

개선할 점:

- custom global exception filter는 아직 없다.
- 에러 응답 포맷이 프로젝트 표준으로 강제되어 있지는 않다.
- Prisma 에러를 도메인 에러로 변환하는 계층은 제한적이다.
- request-id는 응답과 로그에 붙지만, 에러 응답 body에 항상 포함되는 구조는 아니다.

현재는 "프레임워크 기본 에러 처리 + 도메인별 명시적 예외" 수준이다. 운영 단계에서는 에러 응답 표준화와 로깅/모니터링 연결을 더 강화하는 것이 좋다.

## 3. Test Framework가 뭔지, 여기에서는 어떻게 되고 있는지

### Test Framework란 무엇인가

테스트 프레임워크는 테스트를 작성하고 실행하고 결과를 보여주는 도구다.

백엔드 테스트 프레임워크는 보통 다음 기능을 제공한다.

- 테스트 케이스 정의
- assertion
- mock/stub 지원
- 테스트 실행기
- 테스트 결과 리포트
- coverage 측정
- 비동기 테스트 지원

대표적인 테스트 프레임워크는 다음과 같다.

- JavaScript/TypeScript: Jest, Vitest, Mocha
- Python: unittest, pytest
- Java: JUnit
- Go: testing package

### NestJS에서는 무엇을 쓰는가

Nest API는 Jest를 사용한다.

`apps/nest-api/package.json`에는 다음 script가 있다.

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config ./test/jest-e2e.json"
}
```

Jest 설정은 같은 파일에 있다.

```json
{
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node"
}
```

즉 `src` 아래의 `*.spec.ts` 파일을 Jest가 실행한다.

현재 주요 테스트 파일은 다음과 같다.

- `auth/auth-cookie.utils.spec.ts`
- `auth/auth.controller.spec.ts`
- `auth/auth.service.spec.ts`
- `auth/login-rate-limit.guard.spec.ts`
- `admin/admin.service.spec.ts`
- `comments/comments.service.spec.ts`
- `common/cors-options.spec.ts`
- `common/request-logging.middleware.spec.ts`
- `health/health.controller.spec.ts`
- `rag/rag-document.builder.spec.ts`
- `rag/rag-query-parser.spec.ts`
- `seat-reviews/seat-reviews.service.spec.ts`
- `tags/tags.service.spec.ts`

현재 `npm.cmd --prefix apps/nest-api test -- --runInBand` 기준 전체 13개 test suite, 50개 test가 통과한다.

### 어떤 테스트를 진행하는가

현재 Nest 테스트는 주로 단위 테스트와 service 중심 테스트다.

검증하는 내용은 다음과 같다.

- 쿠키에서 access/refresh token을 추출하는지
- 로그인 시 access/refresh cookie를 설정하고 response body에는 token을 노출하지 않는지
- refresh token rotation과 session revoke가 동작하는지
- password reset 요청/확인이 동작하는지
- CORS가 credentialed request를 허용하되 origin allowlist를 쓰는지
- request-id middleware가 응답 header와 로그에 requestId를 남기는지
- 댓글 답글, 좋아요, 멘션, 숨김 필터가 동작하는지
- 관리자 신고, 숨김, 복구, 강제 삭제, 감사 로그가 동작하는지
- 후기 조회에서 숨김/삭제된 후기가 공개 목록에서 제외되는지
- RAG 문서 metadata가 올바르게 만들어지는지
- RAG query parser가 질문에서 극장/좌석/의도를 파싱하는지
- 로그인 rate limit guard가 일정 횟수 이후 429를 반환하는지

실제 DB를 붙이기보다는 service 의존성을 mock으로 대체하는 테스트가 많다. 빠르고 안정적이라는 장점이 있다.

### FastAPI에서는 무엇을 쓰는가

FastAPI 쪽 테스트는 Python 표준 `unittest` 스타일을 사용한다.

예:

- `tests/test_seat_agent_service.py`
- `tests/test_seat_metadata_service.py`

`unittest.mock.patch`로 `NestClient` 등을 fake 객체로 바꿔 외부 API 없이 좌석 추천 로직을 검증한다.

### 현재 테스트 평가

좋은 점:

- Nest는 Jest 기반 테스트 설정이 명확하다.
- 인증, 세션, 쿠키, CORS, request logging, 관리자, 댓글, RAG 같은 주요 변경 지점에 테스트가 있다.
- 보안 관련 기능인 rate limit과 cookie auth도 테스트한다.
- mock 기반이라 빠르게 실행된다.

개선할 점:

- Nest `test:e2e` script는 있지만 실제 e2e 범위는 아직 넓지 않다.
- 테스트 DB 기반 통합 테스트는 제한적이다.
- OpenAPI snapshot이나 API contract 검증은 없다.
- FastAPI 테스트 의존성은 더 명확히 정리할 필요가 있다.

다음 단계로는 인증/후기/댓글/관리자 흐름을 실제 테스트 DB로 검증하는 통합 테스트를 일부 추가하는 것이 좋다.

## 4. API Design이 뭔지, 어떻게 되고 있는지

### API Design이란 무엇인가

API Design은 클라이언트가 서버 기능을 어떻게 사용할지 정하는 설계다.

좋은 API 설계는 다음 질문에 답할 수 있어야 한다.

- 어떤 URL로 접근하는가?
- 어떤 HTTP method를 쓰는가?
- 요청 body, query, path parameter는 무엇인가?
- 성공 응답 구조는 무엇인가?
- 실패 응답은 어떤 status code와 메시지를 주는가?
- 공개 API와 인증 API는 어떻게 나뉘는가?
- pagination, filtering, sorting 규칙은 무엇인가?
- 리소스 이름이 일관적인가?

### 현재 API 스타일

현재 프로젝트는 REST API 중심이다.

인증:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/password-reset/request
POST /auth/password-reset/confirm
GET  /auth/me
GET  /auth/check-email?email=...
```

인증은 현재 httpOnly cookie 기반이다.

- `jungle_access_token`: protected API 인증용 access JWT cookie
- `jungle_refresh_token`: `/auth/refresh`, `/auth/logout`에 쓰는 opaque refresh cookie
- refresh token 원문은 DB에 저장하지 않고 hash만 `auth_sessions`에 저장한다.

메타데이터:

```text
GET /theaters
GET /musicals
GET /performances?theaterId=...&musicalId=...
```

후기:

```text
POST   /seat-reviews
GET    /seat-reviews
GET    /seat-reviews/search
GET    /seat-reviews/:id
PATCH  /seat-reviews/:id
DELETE /seat-reviews/:id
POST   /seat-reviews/:reviewId/reports
```

댓글:

```text
POST   /seat-reviews/:reviewId/comments
GET    /seat-reviews/:reviewId/comments
PATCH  /comments/:id
DELETE /comments/:id
POST   /comments/:id/like
DELETE /comments/:id/like
POST   /comments/:commentId/reports
```

관리자:

```text
GET    /admin/reports
PATCH  /admin/seat-reviews/:id/hide
PATCH  /admin/seat-reviews/:id/restore
DELETE /admin/seat-reviews/:id/force
PATCH  /admin/comments/:id/hide
PATCH  /admin/comments/:id/restore
DELETE /admin/comments/:id/force
GET    /admin/audit-logs
```

태그:

```text
GET /tags
GET /tags/:tagId/seat-reviews
```

RAG:

```text
POST /rag/questions
```

FastAPI:

```text
POST /agent/seat-recommendations
GET  /mcp/seat-layouts/{theater_name}
POST /mcp/cache/refresh
```

### 현재 API 설계의 좋은 점

리소스 중심 이름을 사용한다.

- `seat-reviews`
- `comments`
- `tags`
- `theaters`
- `musicals`
- `performances`
- `admin/reports`
- `admin/audit-logs`

HTTP method도 대체로 REST 관례를 따른다.

- 조회: `GET`
- 생성: `POST`
- 수정: `PATCH`
- 삭제: `DELETE`

공개 API와 인증 필요 API가 구분되어 있다.

- 후기 목록/상세 조회는 공개
- 댓글 조회는 공개
- 후기 작성/수정/삭제는 인증 필요
- 댓글 작성/수정/삭제/좋아요/신고는 인증 필요
- 관리자 API는 인증 + `AdminGuard` 필요

목록 API는 pagination 정보를 포함한다.

```ts
{
  items,
  total,
  page,
  limit,
  hasNext
}
```

관리자 기능은 public delete와 moderation delete를 구분한다.

- 일반 삭제: 사용자가 자기 글/댓글을 삭제
- 숨김: 관리자가 공개 목록에서 제외
- 복구: 관리자가 다시 공개
- 강제 삭제: 관리자가 실제 삭제
- 감사 로그: 민감한 관리자 액션 기록

### 현재 API 설계의 개선점

`GET /seat-reviews`와 `GET /seat-reviews/search`가 둘 다 검색성 조회를 담당한다. 기능적으로 문제는 없지만 API 의미가 약간 중복된다.

선택지는 다음과 같다.

- `/seat-reviews` 하나로 통합하고 query가 있으면 검색으로 간주
- `/seat-reviews/search`를 명확한 검색 endpoint로 유지하되 `/seat-reviews`는 기본 목록만 담당

현재는 같은 동작이라 프론트 입장에서는 큰 문제는 없지만, 문서화가 필요하다.

또한 OpenAPI/Swagger 문서화는 아직 없다. API가 많아졌기 때문에 `@nestjs/swagger`를 도입하면 프론트/백엔드 협업이 쉬워진다.

## 5. GraphQL이 뭔지, 사용하는지, 언제 어떻게 사용하는지

### GraphQL이란 무엇인가

GraphQL은 클라이언트가 필요한 데이터를 query 형태로 직접 지정해서 가져오는 API 방식이다.

REST에서는 endpoint가 고정되어 있다.

```text
GET /seat-reviews/1
```

GraphQL에서는 클라이언트가 필요한 필드를 직접 고른다.

```graphql
query {
  seatReview(id: "1") {
    id
    content
    theater {
      name
    }
    tags {
      name
    }
  }
}
```

장점:

- 필요한 필드만 받을 수 있다.
- 여러 리소스를 한 요청으로 가져올 수 있다.
- 화면별 데이터 요구사항을 명확히 표현할 수 있다.
- schema 기반 타입 작업이 좋다.

단점:

- 서버 구현이 복잡해진다.
- 캐싱이 REST보다 어려울 수 있다.
- N+1 query 문제를 관리해야 한다.
- 인증/권한을 field 단위로 세밀하게 설계해야 한다.

### 이 프로젝트에서 GraphQL을 사용하는가

현재는 사용하지 않는다.

근거:

- Nest 의존성에 `@nestjs/graphql`, `graphql`, `apollo` 계열이 없다.
- GraphQL resolver나 schema 파일이 없다.
- API는 Controller 기반 REST endpoint로 구성되어 있다.
- FastAPI에도 GraphQL router가 없다.

### 언제 도입하면 좋은가

이 프로젝트에서 GraphQL 도입을 검토할 만한 시점은 다음과 같다.

- 화면마다 필요한 후기/극장/공연/태그 조합이 크게 달라질 때
- REST endpoint가 화면 요구사항마다 계속 늘어날 때
- 모바일, 관리자, 웹이 서로 다른 필드 조합을 강하게 요구할 때
- nested relation 조회가 많아져 over-fetching이 문제가 될 때

예를 들어 관리자 대시보드에서 극장, 공연, 후기 통계, 태그 통계, 최근 댓글, 신고 내역을 한 번에 유연하게 조합해야 한다면 GraphQL이 매력적일 수 있다.

하지만 현재 서비스는 REST query parameter로 충분히 표현 가능하다. 지금 GraphQL을 넣는 것은 복잡도 대비 이득이 크지 않다.

## 6. WebSocket이 뭔지, 사용하는지, 어떻게 사용하는지

### WebSocket이란 무엇인가

WebSocket은 클라이언트와 서버가 연결을 계속 유지하면서 양방향으로 메시지를 주고받는 기술이다.

일반 HTTP는 보통 다음 흐름이다.

```text
클라이언트 요청 -> 서버 응답 -> 연결 종료
```

WebSocket은 다음 흐름이다.

```text
연결 생성
  -> 클라이언트가 서버로 메시지 전송
  -> 서버가 클라이언트로 메시지 전송
  -> 연결 유지
```

WebSocket은 실시간 양방향 통신에 적합하다.

예:

- 채팅
- 실시간 알림
- 협업 편집
- 실시간 좌석 선택
- 게임
- 라이브 대시보드

### 이 프로젝트에서 WebSocket을 사용하는가

현재 사용하지 않는다.

근거:

- Nest 의존성에 `@nestjs/websockets`, `socket.io`, `ws`가 없다.
- 코드에 WebSocket Gateway가 없다.
- FastAPI 쪽에도 websocket route가 없다.
- 현재 기능은 대부분 요청/응답 기반 REST로 충분하다.

### 언제 도입하면 좋은가

다음 기능이 생기면 WebSocket을 검토할 수 있다.

- 실시간 댓글 알림
- 누군가 내 후기에 댓글을 달았을 때 즉시 알림
- 관리자 대시보드 실시간 신고 모니터링
- 여러 사용자가 같은 공연/좌석 정보를 동시에 보고 상호작용
- 좌석 추천 Agent의 진행 상태를 양방향으로 제어

현재 후기 조회, 작성, 검색은 실시간 양방향 연결이 필요하지 않다. 그래서 지금 WebSocket을 쓰지 않는 것이 적절하다.

## 7. SSE가 뭔지, 사용하는지, 어떻게 사용하는지

### SSE란 무엇인가

SSE는 Server-Sent Events의 줄임말이다. 서버가 클라이언트에게 단방향으로 이벤트를 계속 보내는 기술이다.

WebSocket과 비교하면 다음과 같다.

```text
WebSocket: 클라이언트 <-> 서버 양방향
SSE: 서버 -> 클라이언트 단방향
```

SSE는 HTTP 기반이라 WebSocket보다 단순하다. 브라우저에서는 `EventSource`로 받을 수 있다.

```ts
const source = new EventSource("/events");
source.onmessage = (event) => {
  console.log(event.data);
};
```

SSE가 잘 맞는 경우:

- 알림 피드
- 서버 작업 진행률
- AI 응답 스트리밍
- 로그 스트리밍
- 상태 업데이트

### 이 프로젝트에서 SSE를 사용하는가

현재 사용하지 않는다.

근거:

- Nest 코드에 `@Sse()` 사용이 없다.
- 프론트에 `EventSource` 사용이 없다.
- FastAPI에도 SSE용 `StreamingResponse` endpoint가 없다.

### 언제 도입하면 좋은가

이 프로젝트에서는 AI/RAG/Agent 기능과 SSE가 잘 맞을 수 있다.

예:

- 좌석 추천 답변을 한 번에 기다리지 않고 토큰 단위로 보여주기
- RAG 검색 진행 상태 보여주기
- "후기 검색 중 -> 근거 정리 중 -> 추천 생성 중" 같은 단계 표시
- 관리자에게 백그라운드 작업 로그 표시

사용자가 서버로 계속 메시지를 보내야 하는 기능이 아니라면 WebSocket보다 SSE가 더 단순하다. 현재는 추천 결과를 일반 `POST /agent/seat-recommendations` 응답으로 받기 때문에 SSE가 없어도 충분하다.

## 8. Rate Limit이 뭔지, 언제 사용하는지, 어떻게 사용하는지

### Rate Limit이란 무엇인가

Rate Limit은 특정 시간 동안 요청 횟수를 제한하는 기능이다.

예:

```text
같은 IP와 이메일 조합에서 로그인 요청은 1분에 5번까지만 허용
```

Rate Limit을 쓰는 이유는 다음과 같다.

- brute-force 로그인 공격 방어
- API 남용 방지
- 서버 부하 방지
- 외부 API 비용 폭증 방지
- 스팸 작성 방지

### 언제 사용하는가

Rate Limit은 특히 다음 endpoint에 중요하다.

- 로그인
- 회원가입
- 이메일 중복 확인
- 비밀번호 재설정 요청
- 댓글/후기 작성
- 신고 생성
- AI/RAG 호출
- 외부 API를 호출하는 endpoint

모든 API에 무조건 같은 제한을 걸면 사용자 경험이 나빠질 수 있다. 위험하거나 비용이 큰 endpoint부터 적용하는 것이 좋다.

### 이 프로젝트에서 어떻게 사용하는가

현재 Nest API에는 로그인 endpoint에 rate limit이 적용되어 있다.

파일:

- `auth/login-rate-limit.guard.ts`
- `auth/login-rate-limit.guard.spec.ts`
- `auth/auth.controller.ts`

Controller에서는 다음처럼 사용한다.

```ts
@Post('login')
@UseGuards(LoginRateLimitGuard)
async login(...) {
  ...
}
```

현재 규칙은 다음과 같다.

```ts
const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
```

즉 같은 key 기준 60초 동안 5번까지 허용하고, 이후에는 429를 반환한다.

key는 IP와 email 조합으로 만든다.

```text
ip + email
```

초과하면 429 Too Many Requests가 반환된다.

### 현재 Rate Limit의 한계

현재 구현은 in-memory `Map` 기반이다.

장점:

- 구현이 단순하다.
- 테스트하기 쉽다.
- 단일 서버 개발 환경에서는 잘 동작한다.

한계:

- 서버를 재시작하면 기록이 사라진다.
- 서버 인스턴스가 여러 개면 각각 따로 제한한다.
- 프록시 환경에서는 실제 IP 추출을 더 신중히 해야 한다.
- 로그인 외의 비용 큰 endpoint에는 아직 적용되어 있지 않다.

운영 단계에서는 Redis 기반 rate limit이나 `@nestjs/throttler` 같은 라이브러리를 검토하는 것이 좋다.

## 9. CSRF/CORS가 뭔지, 사용하는지, 어떻게 사용하는지

### CORS란 무엇인가

CORS는 Cross-Origin Resource Sharing의 줄임말이다.

브라우저는 보안상 다른 origin의 API 호출을 기본적으로 제한한다. origin은 scheme, host, port 조합이다.

예:

```text
프론트: http://localhost:5173
백엔드: http://localhost:3000
```

host가 같아도 port가 다르면 다른 origin이다. 따라서 백엔드가 "이 프론트 origin은 허용한다"고 알려줘야 브라우저가 요청을 허용한다.

### 이 프로젝트에서 CORS를 사용하는가

사용한다.

Nest API는 `main.ts`에서 다음 방식으로 CORS를 켠다.

```ts
app.enableCors(createCorsOptions(process.env.CORS_ORIGINS));
```

`createCorsOptions`는 다음 정책을 쓴다.

- `credentials: true`
- `CORS_ORIGINS` 환경 변수 기반 allowlist
- local 기본값: `http://localhost:5173`, `http://127.0.0.1:5173`

쿠키 인증을 쓰기 때문에 `credentials: true`가 필요하다. 이때 `origin: "*"`는 쓰면 안 된다.

FastAPI도 CORS middleware를 사용한다.

```py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### CSRF란 무엇인가

CSRF는 Cross-Site Request Forgery의 줄임말이다. 한국어로는 사이트 간 요청 위조라고 부를 수 있다.

CSRF는 사용자가 로그인된 상태를 악용한다.

예를 들어 cookie 기반 인증을 쓰는 서비스가 있다고 하자.

1. 사용자가 `bank.com`에 로그인되어 있다.
2. 공격자가 만든 `evil.com`에 접속한다.
3. `evil.com`이 몰래 `bank.com/transfer`로 요청을 보낸다.
4. 브라우저는 `bank.com` cookie를 자동으로 붙인다.
5. 서버가 이 요청을 진짜 사용자 요청으로 착각할 수 있다.

이것이 CSRF다.

### 이 프로젝트에서 CSRF를 사용하는가

별도 CSRF token flow는 아직 사용하지 않는다. 하지만 이유가 이전과 달라졌다.

이전 구조는 `localStorage`에 JWT를 저장하고 `Authorization: Bearer <token>` header로 보내는 방식이었다. 그때는 브라우저가 인증 header를 자동으로 붙이지 않으므로 전통적인 CSRF 위험이 상대적으로 낮았다.

현재 구조는 httpOnly cookie 기반 인증이다.

- `jungle_access_token`: httpOnly access token cookie
- `jungle_refresh_token`: httpOnly refresh token cookie
- 프론트 요청은 `credentials: "include"`를 사용한다.

cookie 기반 인증이므로 CSRF를 반드시 검토해야 한다.

현재 별도 CSRF token을 넣지 않은 이유는 다음 조건을 전제로 한다.

- cookie 기본값이 `SameSite=Lax`다.
- API 요청은 JSON 기반이다.
- credentialed CORS는 허용된 프론트 origin allowlist에만 열린다.
- production에서 cross-site cookie가 필요해져 `SameSite=None`을 쓰는 순간 CSRF token flow를 추가해야 한다.

이 판단은 `docs/review/backend_auth_cookie_csrf_notes.md`에도 별도로 정리되어 있다.

### 지금 CSRF를 추가해야 하는 경우

다음 상황이면 CSRF token을 추가해야 한다.

- 프론트와 API가 cross-site로 배포된다.
- `AUTH_COOKIE_SAME_SITE=none`을 사용한다.
- 운영 환경에서 cookie가 third-party context로 전송될 수 있다.
- 중요한 mutation endpoint의 위험도를 더 낮춰야 한다.

추가한다면 보통 다음 흐름이 된다.

- API가 읽을 수 있는 CSRF token을 발급한다.
- 프론트가 mutating request에 `X-CSRF-Token` 같은 custom header를 붙인다.
- 서버가 cookie/session과 header token을 함께 검증한다.
- Origin/Referer 검증도 보조로 사용한다.

## 전체 평가

현재 백엔드는 다음 수준으로 정리할 수 있다.

- OOP: NestJS의 Controller/Service/Module/DTO/Guard 구조로 잘 지키고 있다.
- Error Handling: Nest exception과 ValidationPipe를 사용한다. 에러 응답 표준화는 다음 단계다.
- Test Framework: Nest는 Jest, FastAPI는 unittest 스타일 테스트를 사용한다. Nest는 13 suites, 50 tests가 통과한다.
- API Design: REST 중심이며 인증, 댓글, 신고, 관리자, RAG API가 도메인별로 나뉘어 있다.
- GraphQL: 사용하지 않는다. 현재 규모에서는 REST가 더 단순하고 적절하다.
- WebSocket: 사용하지 않는다. 실시간 양방향 요구가 아직 없다.
- SSE: 사용하지 않는다. AI/RAG 스트리밍이 필요해지면 우선 검토할 만하다.
- Rate Limit: 로그인에 in-memory guard 방식으로 적용되어 있다.
- CORS: Nest와 FastAPI 모두 개발 프론트 origin을 허용한다. Nest는 credentialed CORS allowlist를 사용한다.
- CSRF: 현재는 SameSite=Lax, JSON API, credentialed CORS allowlist를 전제로 별도 token을 두지 않았다. cross-site cookie 배포 시 추가해야 한다.

## 다음 개선 우선순위

1. OpenAPI/Swagger 문서화 도입
2. 에러 응답 표준화와 request-id 포함
3. 인증/후기/댓글/관리자 실제 DB 통합 테스트 추가
4. Redis 기반 rate limit 검토
5. 비밀번호 재설정 요청과 RAG/Agent 호출에도 rate limit 확대
6. 운영 배포 전 CORS origin, cookie domain, `AUTH_COOKIE_SECURE` 점검
7. cross-site cookie가 필요하면 CSRF token flow 추가
8. AI/RAG 응답이 길어지면 SSE 스트리밍 검토
