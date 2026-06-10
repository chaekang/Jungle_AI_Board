# 002_user_authentication

## 현재 파일 경로 규칙

이 문서에서 코드를 추가하거나 예시 경로를 적을 때는 아래 규칙을 따른다.

- Nest 인증 코드는 `apps/nest-api/src/auth`, 사용자 조회는 `apps/nest-api/src/users`, 공통 사용자 타입은 `apps/nest-api/src/common`에 둔다.
- React 인증 코드는 `apps/web-react/src/features/auth`에 둔다.
- React 공통 HTTP 요청 함수는 `apps/web-react/src/shared/api.ts`에 둔다.
- React 화면, 컴포넌트, 스타일, 타입, 요청 코드는 기능 폴더 안에서 역할별로 나눈다.
- DTO는 Nest 도메인 폴더 아래 `dto`, 타입/인터페이스는 해당 기능 폴더의 `types.ts` 또는 `interfaces`에 둔다.

## 이 문서의 목표

이 문서는 [implementation_order.md](../implementation_order.md)의 `3. 사용자 인증`을 실제로 구현하기 위한 아주 자세한 작업 가이드다.

특히 아래 상황을 전제로 썼다.

- NestJS를 한 번도 안 해봤다
- React를 한 번도 안 해봤다
- JWT 인증이 처음이다
- Prisma와 PostgreSQL도 아직 익숙하지 않다

그래서 이 문서는 단순한 체크리스트가 아니라, 아래 두 가지를 동시에 만족하도록 작성했다.

1. 왜 이 파일을 만들고 왜 이 코드를 넣는지 설명한다.
2. 그대로 따라 치거나 복사해서 붙여 넣으면 최소 인증 기능이 동작하도록 안내한다.

관련 개념 문서:

- [docs/step 1/concept/002_user_authentication.md](./concept/002_user_authentication.md)

## 이 문서를 끝내면 되는 것

이 단계가 끝나면 아래가 가능해야 한다.

- 회원가입: `POST /auth/register`
- 로그인: `POST /auth/login`
- 현재 로그인 사용자 조회: `GET /auth/me`
- JWT가 없는 사용자는 보호된 API에 접근할 수 없음
- 로그인한 사용자만 후기/댓글 작성 가능
- 작성자 본인만 후기/댓글 수정, 삭제 가능
- React에서 로그인 후 토큰을 저장하고 `GET /auth/me`로 로그인 상태 복구 가능

## 현재 프로젝트 기준

현재 레포 기준으로 인증은 아래 조합으로 구현한다.

- 백엔드: `apps/nest-api`
- 프론트엔드: `apps/web-react`
- 데이터베이스: PostgreSQL
- ORM: Prisma
- 인증 방식: 이메일/비밀번호 + JWT Access Token

현재 확인된 점:

- Prisma `User` 모델이 이미 있다
- `ConfigModule`은 이미 글로벌로 등록돼 있다
- `DatabaseModule`, `PrismaService`도 이미 있다
- React 쪽은 아직 기본 Vite 시작 화면 상태다

즉, 지금은 "인증 기능을 처음부터 새로 얹는 단계"라고 보면 된다.

---

## 1. 먼저 개념부터 아주 짧게 이해하기

처음 하는 사람은 파일을 만들기 전에, 각 역할이 뭔지 아주 짧게 알고 시작하는 편이 훨씬 덜 헷갈린다.

### 1.1 NestJS에서 꼭 알아야 하는 6개

`Module`

- 기능 묶음이다.
- 예를 들어 인증 기능은 `AuthModule`, 사용자 관련 기능은 `UsersModule`로 묶는다.

`Controller`

- HTTP 요청을 직접 받는 곳이다.
- 예: `POST /auth/login` 요청이 들어오면 `AuthController`가 받는다.

`Service`

- 실제 비즈니스 로직을 처리하는 곳이다.
- 예: 비밀번호 해시, JWT 발급, 이메일 중복 검사 같은 실제 작업은 `AuthService`에 둔다.

`DTO`

- 요청 바디가 어떤 모양이어야 하는지 정의하는 클래스다.
- 예: 회원가입은 `email`, `password`, `nickname`이 있어야 한다.

`Guard`

- 이 요청을 통과시켜도 되는지 막는 문지기다.
- JWT가 없거나 잘못됐으면 여기서 막는다.

`Strategy`

- "JWT를 어떻게 읽고 검증할지" 같은 인증 규칙이다.
- Guard가 내부적으로 Strategy를 사용한다.

### 1.2 React에서 꼭 알아야 하는 5개

`Component`

- 화면 조각이다.
- `App.tsx`도 하나의 컴포넌트다.

`state`

- 화면이 기억해야 하는 값이다.
- 예: 이메일 입력값, 로그인한 사용자 정보, 에러 메시지

`useEffect`

- 컴포넌트가 화면에 나타난 뒤 실행할 작업을 넣는다.
- 예: 앱 시작 시 `GET /auth/me` 호출

`fetch`

- 백엔드 API를 호출하는 기본 브라우저 함수다.

`localStorage`

- 브라우저에 문자열을 저장하는 공간이다.
- 이번 단계에서는 JWT 토큰을 여기에 저장해도 된다.

### 1.3 JWT를 아주 쉽게 이해하면

로그인에 성공하면 서버가 "이 사용자는 인증된 사람입니다"라는 서명된 토큰 문자열을 하나 준다.

이후 프론트엔드는 API 요청마다 이 토큰을 헤더에 붙여 보낸다.

```http
Authorization: Bearer <token>
```

서버는 이 토큰이 진짜인지 검사하고, 맞으면 "이 요청은 로그인한 사용자 요청이구나"라고 판단한다.

### 1.4 왜 이번 단계에서는 Session 대신 JWT를 쓰는가

인증 방식은 크게 Session 방식과 JWT 방식으로 나눠 생각할 수 있다.

- `Session`: 서버가 로그인 상태를 직접 저장
- `JWT`: 클라이언트가 서명된 토큰을 들고 다님

이번 프로젝트는 React 프론트와 Nest API가 분리돼 있으므로,
초기 구현은 JWT Access Token 방식이 가장 단순하다.

특히 이번 단계 목표가 아래 정도이기 때문이다.

- 회원가입
- 로그인
- 보호된 API 접근 제어
- 현재 로그인 사용자 조회

즉 지금은 "완성형 인증 플랫폼"보다
"후기와 댓글 작성자를 안정적으로 식별하는 최소 인증 구조"가 우선이다.

---

## 2. 이번 단계에서 만들 전체 흐름

전체 흐름을 먼저 그림처럼 보면 이해가 쉽다.

```text
회원가입 화면
  -> POST /auth/register
  -> DB(users)에 email, password_hash, nickname 저장

로그인 화면
  -> POST /auth/login
  -> 이메일로 사용자 조회
  -> 비밀번호 비교
  -> JWT 발급
  -> React가 토큰 저장

보호된 API 호출
  -> Authorization: Bearer <token>
  -> JwtAuthGuard
  -> JwtStrategy가 토큰 검증
  -> request.user 생성
  -> 컨트롤러/서비스에서 현재 사용자 사용

앱 새로고침
  -> localStorage에서 토큰 읽기
  -> GET /auth/me
  -> 토큰이 유효하면 로그인 상태 복구
```

---

## 3. 구현 범위는 여기까지만 한다

처음부터 너무 많은 인증 기능을 넣으면 초보자일수록 금방 꼬인다.

이번 단계에서는 아래만 구현한다.

- 이메일/비밀번호 회원가입
- 이메일/비밀번호 로그인
- Access Token 발급
- JWT Guard
- 현재 로그인 사용자 조회
- 작성자 본인 확인

이번 단계에서 일부러 하지 않는 것:

- 소셜 로그인
- Refresh Token
- 이메일 인증
- 비밀번호 재설정 메일
- 관리자 기능

이유는 간단하다.  
지금 필요한 것은 "게시글 작성자 식별"과 "권한 체크"이지, 완성형 대규모 인증 시스템이 아니기 때문이다.

### 3.1 그래도 같이 지켜야 하는 최소 보안 원칙

이번 단계가 MVP라고 해도 아래는 반드시 지키는 편이 좋다.

- 비밀번호 평문 저장 금지
- `JWT_SECRET`을 코드에 하드코딩하지 않기
- `passwordHash`를 응답으로 절대 내보내지 않기
- 인증 실패와 권한 실패를 구분하기
- 배포 환경에서는 반드시 HTTPS 사용하기

여기서 특히 많이 헷갈리는 것이 `401`과 `403` 차이다.

- `401 Unauthorized`: 로그인하지 않았거나 토큰이 잘못됨
- `403 Forbidden`: 로그인은 했지만 그 리소스를 수정할 권한은 없음

이 구분이 잘 되어 있어야 나중에 후기 / 댓글 권한 오류도 깔끔해진다.

### 3.2 이번 단계에서 구현하는 보안 항목과 제외하는 항목

이번 문서 기준으로 구현 여부를 아래처럼 고정한다.

- 이번 단계에서 구현
  - 로그인 시도 횟수 제한 `rate limit`
  - 예: Nest Throttler로 `POST /auth/login`, `POST /auth/register`부터 먼저 보호
- 이번 단계에서 구현하지 않음
  - 소셜 로그인 `OAuth2`, `OIDC`
  - Refresh Token
  - 이메일 인증

즉 이 문서를 그대로 따르면 `rate limit`은 구현하고,
나머지 항목은 현재 구현 범위에서 제외한다.

---

## 4. 시작 전에 현재 구조 이해하기

현재 백엔드 핵심 파일은 이미 일부 준비되어 있다.

- `apps/nest-api/src/app.module.ts`
- `apps/nest-api/src/main.ts`
- `apps/nest-api/src/database/database.module.ts`
- `apps/nest-api/src/database/prisma.service.ts`
- `apps/nest-api/prisma/schema.prisma`
- `apps/nest-api/prisma.config.ts`

현재 `User` 모델은 아래 필드를 가진다.

- `id`
- `email`
- `passwordHash`
- `nickname`
- `createdAt`
- `updatedAt`

이 정도면 인증 MVP를 시작하기 충분하다.

---

## 5. 가장 먼저 알아야 하는 함정: BigInt

이 프로젝트의 Prisma `User.id`는 `BigInt`다.

이게 왜 중요하냐면:

- JWT payload에 `BigInt`를 그대로 넣으면 안 된다
- JSON 응답에 `BigInt`를 그대로 넣으면 에러가 난다

즉 아래처럼 하면 안 된다.

```ts
return {
  id: user.id,
}
```

또 아래처럼 하면 안 된다.

```ts
const payload = {
  sub: user.id,
}
```

이렇게 하면 보통 아래와 비슷한 에러가 난다.

```text
Do not know how to serialize a BigInt
```

그래서 이번 문서에서는 `id`를 외부로 보낼 때 항상 문자열로 바꾼다.

예:

```ts
return {
  id: user.id.toString(),
  email: user.email,
  nickname: user.nickname,
}
```

JWT payload도 이렇게 만든다.

```ts
const payload = {
  sub: user.id.toString(),
  email: user.email,
}
```

그리고 나중에 DB 조회할 때 다시 `BigInt(user.id)`로 바꿔 쓴다.

이건 초반에 꼭 기억해두자.

---

## 6. 실행 준비

### 6.1 데이터베이스 올리기

루트에서 아래 명령을 실행한다.

```powershell
npm run db:up
```

로그를 보고 싶으면:

```powershell
npm run db:logs
```

끄려면:

```powershell
npm run db:down
```

현재 Docker Postgres 설정은 아래다.

- DB 이름: `agentic_board`
- 사용자: `postgres`
- 비밀번호: `postgres`
- 포트: `5432`

### 6.2 백엔드 패키지 설치

아래 명령은 레포 루트 `C:\Jungle\Jungle_AI_Board`에서 실행하는 명령이다.

```powershell
npm run nest:install
```

만약 이미 `apps/nest-api` 폴더 안으로 들어와 있다면 아래처럼 실행하면 된다.

```powershell
npm install
```

### 6.3 프론트엔드 패키지 설치

아래 명령도 레포 루트에서 실행하는 명령이다.

```powershell
npm run web:install
```

만약 이미 `apps/web-react` 폴더 안으로 들어와 있다면 아래처럼 실행하면 된다.

```powershell
npm install
```

---

## 7. 인증에 필요한 패키지 설치

현재 `apps/nest-api/package.json`에는 JWT 인증에 필요한 패키지가 아직 없다.

`apps/nest-api`에서 아래를 설치한다.

```powershell
cd apps/nest-api
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
npm install -D @types/passport-jwt @types/bcrypt
```

패키지 의미:

- `@nestjs/jwt`: JWT 발급
- `@nestjs/passport`: Nest에서 Passport 사용
- `passport`: 인증 프레임워크
- `passport-jwt`: JWT 인증 전략
- `bcrypt`: 비밀번호 해시
- `class-validator`: DTO 검증
- `class-transformer`: DTO 변환

### 여기서 꼭 이해할 점

비밀번호는 절대 그대로 저장하지 않는다.

- 사용자가 입력한 비밀번호: 평문
- DB에 저장하는 값: 해시된 문자열

로그인 시에는 "저장된 해시"와 "지금 입력한 평문 비밀번호"를 `bcrypt.compare()`로 비교한다.

---

## 8. 환경변수 설정

인증에 필요한 환경변수를 `apps/nest-api/.env`에 넣는다.

### 8.1 `apps/nest-api/.env`

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agentic_board?schema=public"
JWT_SECRET="change-this-to-a-long-random-string"
JWT_EXPIRES_IN="1d"
```

### 8.2 왜 `.env`만 쓰는가

이 프로젝트는 1인 프로젝트 기준으로 진행하므로, 이번 단계에서는 `.env.example`을 따로 관리하지 않는다.

즉 지금은 아래처럼 생각하면 된다.

- `.env`: 실제 실행에 필요한 설정 파일
- `.env.example`: 지금은 사용하지 않음

나중에 환경이 늘어나거나, 새 PC에서 세팅을 자주 반복하면서 필요해지면 그때 추가해도 충분하다.

### 8.3 왜 필요한가

`JWT_SECRET`

- 토큰에 서버 서명을 할 때 쓰는 비밀값이다.
- 이 값이 없으면 JWT를 만들거나 검증할 수 없다.

`JWT_EXPIRES_IN`

- 토큰 만료 시간이다.
- `1d`는 1일을 뜻한다.

### 8.4 `JWT_SECRET`은 어떻게 정하면 좋은가

개발용이라도 너무 짧거나 뻔한 문자열은 피하는 편이 좋다.

- 짧은 예시: `secret`
- 권장 방향: 충분히 긴 랜덤 문자열

중요한 점은 "값이 복잡해 보이느냐"보다
"코드에 박혀 있지 않고 환경변수로 분리돼 있느냐"다.

---

## 9. `main.ts` 먼저 고치기

React에서 `http://localhost:5173`으로 실행되는 프론트가 Nest API `http://localhost:3000`을 호출할 것이기 때문에, CORS 설정을 켜야 한다.

또 DTO 검증을 자동으로 적용하려면 `ValidationPipe`를 켜야 한다.

### 9.1 현재 파일

파일: `apps/nest-api/src/main.ts`

### 9.2 아래처럼 수정

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

### 9.3 이 코드가 하는 일

`app.enableCors(...)`

- React가 Nest API를 호출할 수 있게 허용한다.
- 지금은 `http://localhost:5173`만 허용하면 충분하다.
- 배포 환경이나 쿠키 기반 인증을 별도 단계로 도입할 때 CORS 설정을 다시 검토한다.

`whitelist: true`

- DTO에 없는 필드는 자동 제거한다.

`forbidNonWhitelisted: true`

- DTO에 없는 필드가 들어오면 에러를 낸다.

`transform: true`

- 요청 값을 DTO 타입에 맞게 변환하려고 시도한다.

---

## 10. 이번 단계에서 만들 폴더 구조

이제 인증 관련 파일을 실제로 만든다.

권장 구조는 아래다.

```text
apps/nest-api/src
  auth/
    auth.controller.ts
    auth.module.ts
    auth.service.ts
    jwt-auth.guard.ts
    jwt.strategy.ts
    decorators/
      current-user.decorator.ts
    dto/
      login.dto.ts
      register.dto.ts
    interfaces/
      jwt-payload.interface.ts
  common/
    interfaces/
      authenticated-user.interface.ts
  users/
    users.module.ts
    users.service.ts
```

여기서 역할은 다음과 같다.

- `auth`: 인증 그 자체
- `users`: 사용자 조회/생성
- `common/interfaces`: 여러 모듈에서 같이 쓸 타입

---

## 11. 백엔드 구현: 파일별로 하나씩 만들기

여기부터는 거의 "이 파일에 이 코드를 넣는다" 수준으로 적는다.

하지만 초보자 입장에서는 코드만 보면 바로 막히기 쉽다.  
그래서 이 섹션은 아래 순서로 읽는 것을 권장한다.

1. 먼저 "이 파일이 왜 필요한가"를 읽는다.
2. 그다음 코드 블록을 본다.
3. 마지막으로 "어떤 요청 흐름에서 호출되는가"를 연결해서 본다.

인증 기능 전체 흐름을 아주 짧게 다시 요약하면 이렇다.

```text
회원가입 요청
  -> AuthController
  -> AuthService
  -> UsersService
  -> Prisma
  -> users 테이블

로그인 요청
  -> AuthController
  -> AuthService
  -> UsersService
  -> bcrypt 비교
  -> JwtService로 토큰 발급

현재 사용자 조회 요청
  -> JwtAuthGuard
  -> JwtStrategy
  -> request.user 생성
  -> AuthController
  -> AuthService
  -> UsersService
```

즉 한 파일이 모든 걸 처리하는 구조가 아니라, 파일마다 역할을 나눠서 협업하는 구조라고 이해하면 된다.

### 11.1 `authenticated-user.interface.ts`

이 파일은 "로그인한 사용자"를 Nest 내부에서 어떤 모양으로 다룰지 정하는 타입 파일이다.

이 타입은 특히 아래 3군데에서 중요하다.

- `JwtStrategy`가 토큰 검증 후 사용자 정보를 반환할 때
- `CurrentUser` 데코레이터가 `request.user`를 꺼낼 때
- 컨트롤러와 서비스가 현재 사용자를 받을 때

즉 이 파일은 직접 기능을 실행하는 파일은 아니지만, 인증 흐름 전체의 공통 약속을 만드는 파일이다.

파일:

- `apps/nest-api/src/common/interfaces/authenticated-user.interface.ts`

코드:

```ts
export interface AuthenticatedUser {
  id: string;
  email: string;
}
```

왜 필요한가:

- JWT 검증이 끝난 뒤 `request.user`에 담길 사용자 타입이다.
- `id`를 문자열로 둔 이유는 앞에서 설명한 `BigInt` 문제 때문이다.

이 코드를 읽을 때 포인트:

- 여기의 `id`는 DB에 있는 `bigint` 자체가 아니라, 인증 컨텍스트에서 안전하게 쓰기 위한 문자열 버전이다.
- 로그인 이후 코드에서는 "현재 사용자"를 이 모양으로 계속 주고받게 된다.

지금 당장 기억할 것:

- DB 사용자 전체를 들고 다니지 않는다.
- 인증에 필요한 최소 정보만 들고 다닌다.

### 11.2 `jwt-payload.interface.ts`

이 파일은 JWT 토큰 안에 어떤 데이터를 넣을지 정하는 타입 파일이다.

중요한 점은 "토큰 안에 사용자 객체 전체를 넣는 게 아니다"라는 것이다.  
토큰에는 정말 필요한 최소한의 정보만 넣는 것이 기본 원칙이다.

파일:

- `apps/nest-api/src/auth/interfaces/jwt-payload.interface.ts`

코드:

```ts
export interface JwtPayload {
  sub: string;
  email: string;
}
```

왜 필요한가:

- 토큰 안에 어떤 정보를 넣을지 타입으로 명확히 하기 위해서다.

각 필드 의미:

- `sub`: 이 토큰의 주인공이 누구인지 나타내는 표준 필드다. 여기서는 사용자 id를 넣는다.
- `email`: 사용자 식별을 돕는 보조 정보다.

왜 `id`가 아니라 `sub`를 쓰는가:

- JWT에서는 사용자 식별자를 `sub`에 넣는 관례가 널리 쓰인다.
- 나중에 다른 예제나 문서를 볼 때도 같은 패턴이 많아서 익숙해지기 좋다.

### 11.3 `users.service.ts`

이 파일은 인증 자체를 담당하는 파일이 아니라, "사용자 데이터를 DB에서 읽고 쓰는 역할"을 담당하는 파일이다.

초보자가 가장 먼저 익혀야 하는 설계 감각이 여기 들어 있다.

- 인증 로직은 `AuthService`
- 사용자 DB 접근은 `UsersService`

이 둘을 나누는 이유는 역할을 분리하기 위해서다.  
회원가입, 로그인, 현재 사용자 조회는 모두 인증 기능이지만, 그 안에서 실제 사용자 조회/생성은 `UsersService`가 맡는 편이 깔끔하다.

파일:

- `apps/nest-api/src/users/users.service.ts`

코드:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findById(id: bigint) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  create(data: {
    email: string;
    passwordHash: string;
    nickname: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  toPublicUser(user: {
    id: bigint;
    email: string;
    nickname: string;
  }) {
    return {
      id: user.id.toString(),
      email: user.email,
      nickname: user.nickname,
    };
  }
}
```

이 파일이 하는 일:

- 이메일로 사용자 찾기
- ID로 사용자 찾기
- 사용자 만들기
- API 응답용 공개 사용자 객체로 변환하기

`toPublicUser()`를 따로 둔 이유:

- `passwordHash`를 절대 밖으로 내보내면 안 되기 때문이다.
- `BigInt`를 문자열로 바꿔 주는 역할도 한다.

각 함수가 실제로 어디서 쓰이는지:

- `findByEmail()`: 회원가입 중복 체크, 로그인 시 사용자 조회
- `findById()`: `GET /auth/me`에서 현재 사용자 재조회
- `create()`: 회원가입 시 새 사용자 저장
- `toPublicUser()`: 프론트로 안전한 사용자 정보 반환

왜 `toPublicUser()`가 중요한가:

- DB에서 꺼낸 객체를 그대로 반환하면 `passwordHash`가 섞여 나갈 위험이 있다.
- 또 `id`가 `BigInt`라면 JSON 직렬화 문제가 생길 수 있다.
- 그래서 "외부 공개용 사용자 객체"를 따로 만드는 습관이 중요하다.

이 파일을 읽을 때의 포인트:

- 여기에는 HTTP 개념이 없다.
- `POST`, `GET`, 헤더 같은 웹 개념은 컨트롤러가 담당하고, 이 서비스는 오직 사용자 데이터 작업만 담당한다.

### 11.4 `users.module.ts`

이 파일은 `UsersService`를 Nest 모듈 시스템에 등록하는 파일이다.

NestJS를 처음 하면 "서비스 파일만 만들면 바로 쓸 수 있는 것 아닌가?"라는 생각이 들기 쉽다.  
하지만 Nest는 모듈 단위로 서비스를 관리하므로, 서비스 파일을 만들었으면 그것을 모듈에 등록해야 한다.

파일:

- `apps/nest-api/src/users/users.module.ts`

코드:

```ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

왜 필요한가:

- `AuthModule`이 `UsersService`를 가져다 쓰려면 export가 필요하다.

여기서 꼭 이해할 것:

- `providers`: 이 모듈 안에서 사용할 서비스 목록
- `exports`: 다른 모듈에서도 가져다 쓸 수 있게 공개하는 서비스 목록

즉 이 파일은 "사용자 관련 서비스가 존재하고, 다른 모듈에서도 이걸 쓸 수 있다"는 선언문 역할을 한다.

### 11.5 `register.dto.ts`

이 파일은 회원가입 요청에서 "클라이언트가 어떤 데이터를 보내야 하는지"를 정의하는 DTO 파일이다.

DTO를 처음 접하면 단순 타입 선언처럼 보일 수 있지만, 실제로는 요청 데이터 검증 규칙을 모아 두는 아주 중요한 역할을 한다.

파일:

- `apps/nest-api/src/auth/dto/register.dto.ts`

코드:

```ts
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  nickname: string;
}
```

왜 필요한가:

- 회원가입 요청 바디가 올바른 모양인지 자동 검사한다.

예:

- 이메일 형식이 아니면 에러
- 비밀번호가 8자 미만이면 에러
- 닉네임이 너무 짧거나 길면 에러

왜 이런 검증을 DTO에 넣는가:

- 컨트롤러나 서비스 안에서 일일이 `if`문으로 검사하지 않아도 된다.
- 요청 검증 규칙이 한 파일에 모여서 읽기 쉬워진다.
- 나중에 회원가입 폼과 API 문서를 맞출 때도 기준점이 된다.

초보자 포인트:

- DTO는 DB 테이블 구조가 아니다.
- DTO는 "요청 바디가 어떤 모양이어야 하는가"를 정의하는 클래스다.

### 11.6 `login.dto.ts`

이 파일은 로그인 요청 전용 DTO다.

회원가입과 로그인은 비슷해 보여도, 실제로는 요구하는 데이터가 다르다.  
회원가입은 `nickname`까지 필요하지만 로그인은 `email`, `password`만 있으면 된다.

파일:

- `apps/nest-api/src/auth/dto/login.dto.ts`

코드:

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

이 DTO를 따로 두는 이유:

- 로그인 요청의 목적이 더 명확해진다.
- 회원가입 DTO를 억지로 재사용하지 않아도 된다.
- 나중에 로그인 방식이 바뀌어도 이 DTO만 수정하면 된다.

### 11.7 `jwt-auth.guard.ts`

이 파일은 "이 라우트는 JWT 인증이 필요하다"는 것을 선언하는 Guard 파일이다.

Guard를 처음 보면 막연할 수 있는데, 아주 단순하게 생각하면 된다.

- 컨트롤러 앞단에서 서 있는 문지기
- 통과 조건에 맞지 않으면 서비스까지 못 들어가게 막는 장치

파일:

- `apps/nest-api/src/auth/jwt-auth.guard.ts`

코드:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

왜 이렇게 짧은가:

- 실제 JWT 검증 규칙은 `JwtStrategy`에 있다.
- Guard는 "이 전략을 사용해서 막아라"라는 연결 역할이다.

즉 역할 분리는 이렇게 된다.

- `JwtAuthGuard`: 이 요청은 보호하라
- `JwtStrategy`: 보호할 때 어떤 규칙으로 토큰을 검사할지 정의하라

초보자 포인트:

- Guard는 로그인 로직 자체를 처리하지 않는다.
- Guard는 이미 로그인해서 받은 JWT를 검사할 때 동작한다.

### 11.8 `jwt.strategy.ts`

이 파일은 JWT를 실제로 읽고 검증하는 핵심 파일이다.

초보자 기준으로 이 파일은 이렇게 이해하면 된다.

- 로그인 시 토큰을 "만드는 곳"은 `AuthService`
- 보호된 API 요청에서 토큰을 "읽고 검사하는 곳"은 `JwtStrategy`

파일:

- `apps/nest-api/src/auth/jwt.strategy.ts`

코드:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
```

중요한 포인트:

`ExtractJwt.fromAuthHeaderAsBearerToken()`

- `Authorization: Bearer <token>` 형식에서 토큰을 꺼낸다.

`validate(payload)`

- 토큰이 유효하면 이 함수가 실행된다.
- 여기서 리턴한 값이 `request.user`가 된다.

코드 흐름을 말로 풀면:

1. 브라우저가 `Authorization: Bearer ...` 헤더를 보낸다.
2. Guard가 이 Strategy를 실행한다.
3. Strategy가 헤더에서 토큰을 꺼낸다.
4. `JWT_SECRET`으로 진짜 토큰인지 확인한다.
5. 통과하면 payload를 꺼낸다.
6. `validate()`가 실행된다.
7. 여기서 리턴한 객체가 `request.user`가 된다.

왜 DB 조회를 여기서 바로 하지 않는가:

- 지금 단계에서는 최소 정보만 request에 담아도 충분하다.
- 실제 사용자 재확인은 `AuthService.getMe()`에서 하도록 두는 편이 단순하다.

### 11.9 `current-user.decorator.ts`

이 파일은 컨트롤러에서 현재 로그인 사용자 정보를 더 편하게 받기 위한 커스텀 데코레이터다.

기능을 추가한다기보다, 이미 존재하는 `request.user`를 사람이 읽기 좋은 형태로 꺼내 쓰게 도와주는 도구라고 생각하면 된다.

파일:

- `apps/nest-api/src/auth/decorators/current-user.decorator.ts`

코드:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();

    return request.user;
  },
);
```

왜 필요한가:

나중에 컨트롤러에서 아래처럼 깔끔하게 쓸 수 있다.

```ts
getMe(@CurrentUser() user: AuthenticatedUser) {
  return user;
}
```

이 데코레이터가 없으면 `req.user`를 직접 매번 꺼내야 해서 코드가 지저분해진다.

왜 좋은가:

- 컨트롤러 메서드 시그니처가 깔끔해진다.
- `request` 전체를 받지 않고 필요한 값만 받을 수 있다.
- 나중에 다른 인증된 API에서도 같은 방식으로 재사용할 수 있다.

초보자 포인트:

- 이 데코레이터는 Guard와 Strategy가 먼저 성공해야 의미가 있다.
- `request.user`가 비어 있다면, 문제는 보통 데코레이터가 아니라 Guard/Strategy 쪽이다.

### 11.10 `auth.service.ts`

이 파일은 인증 로직의 중심이다.

파일이 길어 보일 수 있지만, 실제로는 아래 3가지 일만 한다.

- 회원가입
- 로그인
- 현재 로그인 사용자 조회

컨트롤러는 요청을 받기만 하고, 실제 판단과 처리의 대부분은 이 서비스에서 이뤄진다.

파일:

- `apps/nest-api/src/auth/auth.service.ts`

코드:

```ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash,
      nickname: registerDto.nickname,
    });

    return this.usersService.toPublicUser(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: this.usersService.toPublicUser(user),
    };
  }

  async getMe(currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(BigInt(currentUser.id));

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.usersService.toPublicUser(user);
  }
}
```

이 파일이 하는 일:

`register()`

- 중복 이메일 체크
- 비밀번호 해시
- 사용자 생성
- 공개 가능한 정보만 반환

`login()`

- 이메일로 사용자 찾기
- 비밀번호 비교
- JWT 발급
- 토큰과 사용자 공개 정보 반환

`getMe()`

- 토큰 안에 있던 사용자 id로 DB에서 사용자 다시 찾기
- 존재하지 않으면 인증 실패 처리

이 파일을 읽을 때의 핵심:

- 회원가입과 로그인은 전혀 다른 작업이다.
- 회원가입은 "새 사용자를 만든다"
- 로그인은 "기존 사용자를 확인하고 토큰을 발급한다"

왜 예외를 여기서 던지는가:

- 인증 정책 자체가 이 서비스의 책임이기 때문이다.
- 예: 중복 이메일은 `ConflictException`
- 예: 로그인 실패는 `UnauthorizedException`

초보자 포인트:

- `bcrypt.hash()`는 회원가입 때 사용
- `bcrypt.compare()`는 로그인 때 사용
- `JwtService.signAsync()`는 로그인 성공 후 토큰 발급에 사용

### 11.11 `auth.controller.ts`

이 파일은 인증 관련 HTTP 엔드포인트를 선언하는 컨트롤러다.

초보자 관점에서 가장 중요한 이해 포인트는 이것이다.

- 컨트롤러는 "어떤 URL이 어떤 함수를 부르는지"를 정하는 곳
- 서비스는 "그 함수 안에서 실제 무슨 일을 할지"를 정하는 곳

파일:

- `apps/nest-api/src/auth/auth.controller.ts`

코드:

```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }
}
```

여기서 중요한 흐름:

- `/auth/register`: 누구나 호출 가능
- `/auth/login`: 누구나 호출 가능
- `/auth/me`: JWT가 있어야만 호출 가능

각 메서드가 하는 일:

- `register()`: 요청 body를 `RegisterDto`로 받고 서비스에 넘긴다.
- `login()`: 요청 body를 `LoginDto`로 받고 서비스에 넘긴다.
- `getMe()`: Guard를 통과한 현재 사용자를 받아 서비스에 넘긴다.

왜 컨트롤러에서 직접 DB를 만지지 않는가:

- 컨트롤러는 가능한 얇게 유지하는 게 좋다.
- 그래야 로직이 흩어지지 않고 테스트도 쉬워진다.

### 11.12 `auth.module.ts`

이 파일은 인증 기능을 하나의 Nest 모듈로 묶는 설정 파일이다.

지금까지 만든 파일들을 떠올리면:

- DTO
- Controller
- Service
- Guard
- Strategy

이 부품들을 "실제로 앱에서 동작하는 기능 묶음"으로 등록하는 곳이 바로 이 모듈 파일이다.

파일:

- `apps/nest-api/src/auth/auth.module.ts`

코드:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') ?? '1d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

왜 `registerAsync`를 쓰는가:

- `.env` 값을 읽어서 JWT 설정을 주입하기 위해서다.

이 모듈을 이해할 때 봐야 할 것:

- `imports`: 인증 기능이 의존하는 다른 모듈들
- `controllers`: HTTP 요청을 받는 컨트롤러
- `providers`: 실제 동작하는 서비스와 전략

즉 이 파일은 "인증 기능에 필요한 부품 목록과 연결 관계"를 정리하는 파일이다.

### 11.13 `app.module.ts` 수정

마지막으로 이 인증 모듈을 앱 전체에 연결해야 한다.

초보자가 자주 하는 실수는:

- 파일은 다 만들었는데
- `AppModule`에 import를 안 해서
- 라우트가 아예 안 뜨는 경우다

파일:

- `apps/nest-api/src/app.module.ts`

아래처럼 수정한다.

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
```

여기서 `AuthModule`을 import해야 `/auth/...` 라우트가 실제로 등록된다.

한 줄로 정리하면:

- `AuthModule`을 만드는 것만으로는 부족하다.
- `AppModule`이 그것을 가져와야 비로소 애플리케이션의 일부가 된다.

섹션 11이 끝났을 때 스스로 답할 수 있어야 하는 질문:

- DTO는 왜 필요한가
- Guard와 Strategy는 왜 둘 다 필요한가
- 왜 `AuthService`와 `UsersService`를 나눴는가
- 왜 `toPublicUser()` 같은 변환 함수를 두는가

---

## 12. 백엔드 실행하기

이제 백엔드를 실행한다.

```powershell
cd apps/nest-api
npm run start:dev
```

성공적으로 뜨면 보통 `http://localhost:3000`에서 실행된다.

---

## 13. API를 손으로 테스트해보기

React 붙이기 전에 반드시 백엔드 API를 먼저 단독으로 테스트해야 한다.

이렇게 해야 문제가 생겼을 때 "React 문제인지 백엔드 문제인지" 구분이 된다.

### 13.1 회원가입 테스트

PowerShell에서:

```powershell
$registerBody = @{
  email = "user@example.com"
  password = "password1234"
  nickname = "뮤지컬덕후"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody
```

성공 예시:

```json
{
  "id": "1",
  "email": "user@example.com",
  "nickname": "뮤지컬덕후"
}
```

### 13.2 로그인 테스트

```powershell
$loginBody = @{
  email = "user@example.com"
  password = "password1234"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody

$loginResponse
```

성공 예시:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "user@example.com",
    "nickname": "뮤지컬덕후"
  }
}
```

### 13.3 `GET /auth/me` 테스트

```powershell
$token = $loginResponse.accessToken

Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/me" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" }
```

성공 예시:

```json
{
  "id": "1",
  "email": "user@example.com",
  "nickname": "뮤지컬덕후"
}
```

### 13.4 실패해야 정상인 경우도 테스트

토큰 없이:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/me" `
  -Method Get
```

이 경우 `401 Unauthorized`가 나와야 정상이다.

잘못된 비밀번호로 로그인:

```powershell
$badLoginBody = @{
  email = "user@example.com"
  password = "wrong-password"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $badLoginBody
```

이 경우도 `401 Unauthorized`가 나와야 정상이다.

---

## 14. 작성자 본인 확인 로직은 이렇게 붙인다

이 문서 단계에서는 아직 `seat-reviews`, `comments` 서비스가 완성되지 않았을 수 있다.  
그래도 나중에 어디에 어떤 로직이 들어가야 하는지는 지금 이해해두는 게 중요하다.

### 14.1 핵심 규칙

로그인 여부와 작성자 여부는 다르다.

- 로그인 여부: Guard가 처리
- 작성자 여부: 서비스 로직이 처리

즉 아래 두 조건이 모두 필요하다.

1. 로그인한 사용자여야 함
2. 그 리소스의 작성자 본인이어야 함

### 14.2 후기 수정 예시

예를 들어 `SeatReviewsService.update()` 안에서는 대략 이렇게 검사한다.

```ts
const review = await this.prisma.seatReview.findUnique({
  where: { id: BigInt(reviewId) },
});

if (!review) {
  throw new NotFoundException('Seat review not found');
}

if (review.authorId !== BigInt(currentUser.id)) {
  throw new ForbiddenException(
    'You do not have permission to modify this resource',
  );
}

return this.prisma.seatReview.update({
  where: { id: BigInt(reviewId) },
  data: updateData,
});
```

### 14.3 댓글 수정도 같은 원리

```ts
const comment = await this.prisma.comment.findUnique({
  where: { id: BigInt(commentId) },
});

if (!comment) {
  throw new NotFoundException('Comment not found');
}

if (comment.authorId !== BigInt(currentUser.id)) {
  throw new ForbiddenException(
    'You do not have permission to modify this resource',
  );
}
```

### 14.4 왜 Guard만으로 부족한가

Guard는 "로그인한 사람인가?"만 본다.

하지만 게시글 수정/삭제는 "그 글을 쓴 사람인가?"까지 봐야 한다.

그래서 소유권 검사는 서비스에서 리소스를 실제로 읽어 본 뒤 수행해야 한다.

---

## 15. React에서 최소한으로 붙여보기

이제 백엔드 인증 API를 React 화면에 연결한다.

이번 단계 목표:

- 로그인 화면과 회원가입 화면을 만든다
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /auth/check-email`을 연결한다
- 로그인 후 access token을 `localStorage`에 저장한다
- 새로고침 후에도 `GET /auth/me`로 로그인 상태를 복구한다

이번 문서에서는 라우터, Context, 전역 상태관리 라이브러리는 사용하지 않는다.
인증 상태는 `AuthPage` 한 곳에서 관리한다.

### 15.1 토큰 저장 방식

이번 단계에서는 `localStorage`를 사용한다.

이유:

- 구현이 가장 단순하다
- 토큰 저장과 복구 흐름을 눈으로 확인하기 쉽다

즉 이번 문서는 `localStorage` 기반 인증으로 고정해서 따라간다.
`httpOnly cookie` 기반 인증은 이 문서 범위에 포함하지 않는다.

### 15.2 현재 프론트 구조

현재 프론트는 기술별 폴더(`pages`, `components`, `types`, `styles`)로 흩어두기보다 기능별 폴더로 묶는다.

인증 기능은 아래 위치에 모은다.

- `apps/web-react/src/App.tsx`
  - 현재 보여줄 화면을 선택하는 앱 진입점
- `apps/web-react/src/shared/api.ts`
  - React 앱 전체에서 공통으로 쓰는 `apiRequest()` 함수
- `apps/web-react/src/features/auth/AuthPage.tsx`
  - 인증 상태, 입력값, 화면 전환 흐름 담당
- `apps/web-react/src/features/auth/api.ts`
  - `register`, `login`, `getCurrentUser`, `checkEmail` API 함수
- `apps/web-react/src/features/auth/types.ts`
  - `PublicUser`, `LoginResponse`, `CheckEmailResponse` 타입 정의
- `apps/web-react/src/features/auth/components/LoginPanel.tsx`
  - 로그인 화면 조각
- `apps/web-react/src/features/auth/components/SignupPanel.tsx`
  - 회원가입 화면 조각
- `apps/web-react/src/features/auth/styles/*`
  - 인증 페이지와 인증 컴포넌트 스타일

핵심 구조는 아래처럼 이해하면 된다.

- 공통 HTTP 요청 처리는 `shared/api.ts`가 가진다.
- 인증 API 경로와 요청 body 구성은 `features/auth/api.ts`가 가진다.
- 인증 상태와 화면 전환은 `AuthPage`가 가진다.
- 화면 조각은 `LoginPanel`, `SignupPanel`로 분리한다.

`App.tsx`는 아래처럼 단순하다.

```tsx
import AuthPage from "./features/auth/AuthPage"

export default function App() {
  return <AuthPage />
}
```

### 15.3 `AuthPage.tsx`가 관리하는 상태

`AuthPage.tsx`에서는 아래 상태를 관리한다.

- `mode`
  - `"login"` 또는 `"signup"`
- `registerName`
- `registerEmail`
- `registerPassword`
- `registerPasswordConfirm`
- `loginEmail`
- `loginPassword`
- `checkedEmail`
  - 마지막으로 중복 확인한 이메일
- `isEmailChecked`
  - 중복 확인을 한 적이 있는지 여부
- `isEmailAvailable`
  - 중복 확인 결과 사용 가능한 이메일인지 여부
- `token`
  - `localStorage`에서 읽어 온 access token
- `currentUser`
  - 현재 로그인한 사용자 정보
- `message`
  - 성공 메시지
- `error`
  - 실패 메시지

즉 로그인 입력값, 회원가입 입력값, 로그인 상태, 중복 확인 상태를 모두 부모인 `AuthPage`가 가지고 있다.
자식 컴포넌트는 props를 받아서 화면만 렌더링한다.

### 15.4 공통 API 호출 함수와 인증 API 함수

프론트에서는 `shared/api.ts`의 `apiRequest()` 헬퍼로 HTTP 요청 공통 처리를 한다.

파일:

- `apps/web-react/src/shared/api.ts`

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

type ApiErrorResponse = {
  message?: string | string[]
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => null)) as ApiErrorResponse | T | null

  if (!response.ok) {
    const errorMessage = (data as ApiErrorResponse | null)?.message
    const message = Array.isArray(errorMessage) ? errorMessage.join(", ") : errorMessage

    throw new Error(message ?? "API request failed.")
  }

  return data as T
}
```

인증 화면에서는 이 공통 함수를 직접 계속 부르지 않고, `features/auth/api.ts`에서 인증 API 함수로 한 번 감싼다.

파일:

- `apps/web-react/src/features/auth/api.ts`

```ts
import { apiRequest } from "../../shared/api"
import type { CheckEmailResponse, LoginResponse, PublicUser } from "./types"

export function register(input: { email: string; password: string; nickname: string }) {
  return apiRequest<PublicUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function login(input: { email: string; password: string }) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function getCurrentUser(token: string) {
  return apiRequest<PublicUser>("/auth/me", { method: "GET" }, token)
}

export function checkEmail(email: string) {
  return apiRequest<CheckEmailResponse>(
    `/auth/check-email?email=${encodeURIComponent(email)}`,
    { method: "GET" },
  )
}
```

이렇게 나누면 `AuthPage`는 URL 문자열을 직접 알 필요가 없다.

```ts
const result = await login({ email: loginEmail, password: loginPassword })
```

즉 `AuthPage`는 "로그인한다"는 흐름만 알고, `/auth/login`이라는 구체적인 경로는 `features/auth/api.ts`가 책임진다.
### 15.5 화면 전환 방식

현재 화면 전환은 `mode` 값으로 분기한다.

```tsx
{mode === "login" ? (
  <LoginPanel
    email={loginEmail}
    onChangeEmail={setLoginEmail}
    onChangePassword={setLoginPassword}
    onShowSignup={() => {
      setMessage("")
      setError("")
      setMode("signup")
    }}
    onSubmit={handleLogin}
    password={loginPassword}
  />
) : (
  <SignupPanel
    email={registerEmail}
    name={registerName}
    onChangeEmail={handleRegisterEmailChange}
    onChangeName={setRegisterName}
    onChangePassword={setRegisterPassword}
    onChangePasswordConfirm={setRegisterPasswordConfirm}
    onCheckDuplicate={handleDuplicateCheck}
    onShowLogin={() => {
      setMessage("")
      setError("")
      setMode("login")
    }}
    onSubmit={handleRegister}
    password={registerPassword}
    passwordConfirm={registerPasswordConfirm}
  />
)}
```

동작은 아래와 같다.

- `mode === "login"`이면 로그인 카드가 보인다
- `mode === "signup"`이면 회원가입 카드가 보인다
- 화면 전환 시 이전 성공 메시지와 에러 메시지는 함께 비운다

### 15.6 회원가입 흐름

회원가입 흐름은 아래 순서로 진행된다.

1. `SignupPanel`에서 이름, 이메일, 비밀번호, 비밀번호 재확인을 입력한다.
2. 이메일 입력이 바뀌면 `handleRegisterEmailChange()`가 실행된다.
3. 이때 `checkedEmail`, `isEmailChecked`, `isEmailAvailable`을 초기화한다.
4. 사용자가 중복 확인 버튼을 누르면 `handleDuplicateCheck()`가 실행된다.
5. `GET /auth/check-email?email=...`을 호출해 이메일 사용 가능 여부를 확인한다.
6. 사용 가능하면 `checkedEmail`과 `isEmailChecked`, `isEmailAvailable`을 갱신한다.
7. 사용 중인 이메일이면 에러 메시지를 보여 준다.
8. 사용자가 회원가입 submit을 누르면 `handleRegister()`가 실행된다.
9. 먼저 비밀번호와 비밀번호 재확인 값이 같은지 검사한다.
10. 그다음 현재 입력한 이메일이 방금 중복 확인한 이메일과 같은지 검사한다.
11. 중복 확인을 통과했으면 `POST /auth/register`를 호출한다.
12. 성공하면 성공 메시지를 보여 주고, 방금 가입한 이메일을 `loginEmail`에 넣어 둔다.
13. 회원가입 관련 입력값과 중복 확인 상태를 초기화한다.
14. `mode`를 `"login"`으로 바꿔 로그인 화면으로 돌려보낸다.

즉 현재 회원가입은 "이메일 중복 확인 완료"를 먼저 거친 뒤에만 진행된다.

### 15.7 로그인과 로그인 상태 복구 흐름

로그인 흐름은 아래 순서로 진행된다.

1. `LoginPanel`에서 이메일과 비밀번호를 입력한다.
2. submit 시 `handleLogin()`이 실행된다.
3. `POST /auth/login`을 호출한다.
4. 성공하면 `accessToken`을 `localStorage`에 저장한다.
5. `setToken(result.accessToken)`으로 React 상태도 갱신한다.
6. `setCurrentUser(result.user)`로 현재 로그인 사용자 정보를 즉시 반영한다.
7. 성공 메시지를 보여 주고 로그인 비밀번호 입력값은 비운다.

로그인 상태 복구 흐름은 아래와 같다.

1. `token` state의 초기값은 `localStorage.getItem(TOKEN_KEY)`다.
2. 즉 새로고침 직후에도 저장된 토큰이 있으면 React가 그 값을 먼저 읽는다.
3. `useEffect()`가 `token` 변경을 감지한다.
4. `token`이 있으면 `loadMe(token)`을 호출한다.
5. `loadMe()`는 `GET /auth/me`를 호출해 현재 사용자 정보를 다시 가져온다.
6. 토큰이 유효하면 `currentUser`를 유지한다.
7. 토큰이 만료되었거나 잘못되었으면 저장된 토큰을 삭제하고 로그아웃 상태로 정리한다.

즉 현재 프론트 흐름은 아래 한 줄로 요약할 수 있다.

`회원가입 -> 로그인 -> 토큰 저장 -> 새로고침 -> /auth/me로 로그인 상태 복구`

### 15.8 로그아웃 흐름

로그아웃은 `handleLogout()`에서 처리한다.

- `localStorage`에서 토큰을 삭제한다
- `token`을 `null`로 바꾼다
- `currentUser`를 `null`로 바꾼다
- 성공 메시지를 `"Signed out."`으로 바꾼다

즉 프론트 기준 로그아웃은 "브라우저에 저장해 둔 인증 정보를 지우고, 화면 상태도 초기화하는 작업"이다.

### 15.9 이 단계에서 기억할 포인트

- 인증 상태는 `AuthPage` 한 곳에서 관리한다
- access token은 `localStorage`에 저장한다
- 로그인 후 `GET /auth/me`로 현재 사용자 정보를 복구한다
- 회원가입 전에는 이메일 중복 확인을 먼저 통과해야 한다
- 이메일 입력값이 바뀌면 이전 중복 확인 결과는 무효가 된다
- 화면 조각은 `LoginPanel`, `SignupPanel`로 분리하고 실제 인증 로직은 부모가 가진다

### 15.10 왜 `id` 타입이 string인가

앞에서 설명한 `BigInt` 문제 때문이다.

백엔드에서 `id`를 문자열로 보내므로, 프론트 타입도 아래처럼 맞춘다.

```ts
type PublicUser = {
  id: string
  email: string
  nickname: string
}
```

---

## 16. 프론트엔드 실행하기

새 터미널에서:

```powershell
cd apps/web-react
npm run dev
```

또는 루트에서:

```powershell
npm run web:dev
```

브라우저에서 보통 아래 주소로 열린다.

```text
http://localhost:5173
```

이제 화면에서:

1. 회원가입
2. 로그인
3. `GET /auth/me`
4. 로그아웃

순서로 눌러 보면서 인증 흐름을 확인하면 된다.

---

## 17. 초보자가 특히 많이 막히는 지점

### 17.1 `401 Unauthorized`

주요 원인:

- 토큰을 안 보냈다
- `Bearer` 접두사를 안 붙였다
- 토큰이 만료됐다
- `JWT_SECRET`이 바뀌었다

정상 형식:

```http
Authorization: Bearer eyJhbGciOi...
```

### 17.2 `Do not know how to serialize a BigInt`

원인:

- `user.id`를 그대로 JSON 응답에 넣었다
- JWT payload에 `BigInt`를 그대로 넣었다

해결:

- 외부로 보낼 때는 항상 `toString()` 사용

### 17.3 CORS 에러

브라우저 콘솔에 CORS 관련 오류가 보이면:

- `main.ts`에서 `app.enableCors({ origin: 'http://localhost:5173' })`를 넣었는지 확인
- 백엔드가 3000 포트에서 실행 중인지 확인

### 17.4 `JWT_SECRET` 관련 에러

원인:

- `.env`에 `JWT_SECRET`이 없음
- 서버를 재시작하지 않음

해결:

1. `.env` 확인
2. Nest 서버 완전히 껐다가 다시 실행

### 17.5 로그인은 되는데 `GET /auth/me`가 실패

주요 원인:

- 토큰 저장은 됐지만 헤더에 안 붙였다
- `JwtStrategy`에서 payload 반환이 잘못됐다
- DB에서 `BigInt(currentUser.id)` 변환을 안 했다

### 17.6 회원가입은 되는데 로그인 실패

주요 원인:

- `passwordHash`가 아니라 평문으로 비교했다
- `bcrypt.compare()` 인자 순서가 틀렸다
- 이메일 중복 데이터가 꼬였다

정상 비교:

```ts
await bcrypt.compare(loginDto.password, user.passwordHash)
```

### 17.7 `users` 테이블이 없다고 나오는 경우

예를 들어 이런 에러가 날 수 있다.

```text
The table `users` does not exist
```

이 경우는 인증 코드 문제가 아니라 DB 스키마가 아직 안 올라간 경우다.

확인 순서:

1. Postgres 컨테이너가 켜져 있는지 확인
2. Prisma 마이그레이션이 적용됐는지 확인
3. `apps/nest-api` 기준으로 필요한 경우 아래 실행

```powershell
npx prisma migrate dev
```

현재 레포는 `prisma.config.ts`에서 `DATABASE_URL`을 읽도록 되어 있으므로, `.env`가 먼저 준비돼 있어야 한다.

---

## 18. 이 단계에서 테스트해야 하는 최소 시나리오

아래는 꼭 직접 해보는 것을 권장한다.

### 백엔드 API 테스트

- [ ] 정상 회원가입
- [ ] 중복 이메일 회원가입 실패
- [ ] 정상 로그인
- [ ] 잘못된 비밀번호 로그인 실패
- [ ] 토큰 없이 `GET /auth/me` 실패
- [ ] 올바른 토큰으로 `GET /auth/me` 성공

### 프론트엔드 테스트

- [ ] 회원가입 폼에서 가입 성공
- [ ] 회원가입 폼에서 검증 실패 메시지 확인
- [ ] 로그인 성공 후 토큰 저장
- [ ] 새로고침 후 로그인 상태 복원
- [ ] 로그아웃 시 토큰 제거

### 권한 테스트

이건 후기/댓글 API가 생긴 뒤 반드시 추가해야 한다.

- [ ] 로그인하지 않은 사용자는 후기 작성 불가
- [ ] 로그인한 사용자는 자기 후기 작성 가능
- [ ] 다른 사람 후기 수정 시 `403 Forbidden`
- [ ] 다른 사람 후기 삭제 시 `403 Forbidden`

---

## 19. 이후 자동화 테스트로 옮기면 좋은 것

처음에는 손으로 테스트해도 되지만,
이 단계가 끝난 뒤에는 인증 흐름을 e2e 테스트로 옮기는 편이 좋다.

권장 시나리오:

1. 회원가입 요청
2. 로그인 요청
3. 토큰 추출
4. 토큰으로 `GET /auth/me`
5. 보호된 API 호출
6. 권한 없는 수정 시도

지금 당장 테스트 코드까지 완벽하게 짜지 않아도 괜찮다.  
처음에는 "직접 호출해서 동작 확인"만 해도 큰 진전이다.

---

## 20. 이번 단계 완료 기준

아래를 모두 만족하면 `3. 사용자 인증` 단계는 완료로 봐도 된다.

- `POST /auth/register`가 동작한다
- `POST /auth/login`이 동작한다
- `GET /auth/me`가 동작한다
- JWT가 없는 요청은 보호 API에서 막힌다
- JWT가 있는 요청은 현재 사용자 정보를 읽을 수 있다
- 사용자 응답에서 `passwordHash`가 절대 노출되지 않는다
- `BigInt` 직렬화 에러가 없다
- React에서 로그인 후 새로고침해도 로그인 상태를 복구할 수 있다
- `/auth/login`에 기본 `rate limit`이 적용된다

---

## 21. 지금 바로 실전 순서만 다시 아주 짧게 요약

정말 실행 순서만 압축하면 아래다.

1. `npm run db:up`
2. `apps/nest-api`에서 인증 패키지 설치
3. `.env`에 `JWT_SECRET`, `JWT_EXPIRES_IN` 추가
4. `main.ts`에 `enableCors`, `ValidationPipe` 추가
5. `auth`, `users`, `common/interfaces` 파일 생성
6. 문서의 코드대로 각 파일 작성
7. `app.module.ts`에 `AuthModule` 등록
8. `npm run start:dev`
9. PowerShell로 회원가입, 로그인, `GET /auth/me` 테스트
10. `apps/web-react/src/App.tsx`를 인증 시작 화면으로 바꿔서 프론트 연결 확인

---

## 다음 단계

이 단계가 끝나면 다음은 `좌석 후기 CRUD` 구현이다.

그때는 이 인증 구조를 그대로 재사용해서:

- 후기 작성 시 현재 로그인 사용자 id를 `authorId`에 넣고
- 수정/삭제 시 `authorId === currentUser.id`인지 검사하면 된다.

즉 지금 만드는 인증은 이후 모든 기능의 기반이 된다.
