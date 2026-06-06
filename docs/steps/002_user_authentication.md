# 002_user_authentication

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

```powershell
npm run nest:install
```

### 6.3 프론트엔드 패키지 설치

```powershell
npm run web:install
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

### 11.1 `authenticated-user.interface.ts`

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

### 11.2 `jwt-payload.interface.ts`

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

### 11.3 `users.service.ts`

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

### 11.4 `users.module.ts`

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

### 11.5 `register.dto.ts`

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

### 11.6 `login.dto.ts`

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

### 11.7 `jwt-auth.guard.ts`

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

### 11.8 `jwt.strategy.ts`

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

### 11.9 `current-user.decorator.ts`

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

### 11.10 `auth.service.ts`

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

### 11.11 `auth.controller.ts`

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

### 11.12 `auth.module.ts`

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

### 11.13 `app.module.ts` 수정

파일:

- `apps/nest-api/src/app.module.ts`

아래처럼 수정한다.

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

여기서 `AuthModule`을 import해야 `/auth/...` 라우트가 실제로 등록된다.

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

이제 React 초보자 기준으로, 복잡한 상태관리 라이브러리 없이 가장 단순한 방식으로 인증을 붙여 본다.

이번 단계 목표:

- 회원가입 폼 하나
- 로그인 폼 하나
- `GET /auth/me` 버튼 하나
- 로그아웃 버튼 하나

라우터, Context, 전역 상태관리는 지금 하지 않아도 된다.

### 15.1 먼저 알아둘 점

현재 React 앱은 기본 Vite 시작 화면이다.  
즉 인증 UI는 아직 하나도 없다.

그래서 가장 쉬운 방법은 `App.tsx`를 임시로 인증 테스트 화면으로 바꾸는 것이다.

### 15.2 토큰 저장 방식

이번 단계에서는 `localStorage`를 사용한다.

이유:

- 구현이 단순하다
- 초보자가 동작 원리를 이해하기 쉽다

나중에 보안을 더 강화하고 싶으면 `httpOnly cookie` 방식으로 옮기면 된다.

### 15.3 `App.tsx` 전체 예시

파일:

- `apps/web-react/src/App.tsx`

현재 내용을 잠시 치우고 아래처럼 바꿔도 된다.

```tsx
import { FormEvent, useEffect, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:3000'
const TOKEN_KEY = 'agentic_board_access_token'

type PublicUser = {
  id: string
  email: string
  nickname: string
}

type LoginResponse = {
  accessToken: string
  user: PublicUser
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : 'Request failed'

    throw new Error(message)
  }

  return data as T
}

function App() {
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerNickname, setRegisterNickname] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [token, setToken] = useState<string | null>(
    localStorage.getItem(TOKEN_KEY),
  )
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loadingMe, setLoadingMe] = useState(false)

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      return
    }

    void loadMe(token)
  }, [token])

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      const user = await apiRequest<PublicUser>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          nickname: registerNickname,
        }),
      })

      setMessage(`회원가입 성공: ${user.nickname}`)
      setRegisterEmail('')
      setRegisterPassword('')
      setRegisterNickname('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 실패')
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')

    try {
      const result = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      })

      localStorage.setItem(TOKEN_KEY, result.accessToken)
      setToken(result.accessToken)
      setCurrentUser(result.user)
      setMessage(`로그인 성공: ${result.user.nickname}`)
      setLoginEmail('')
      setLoginPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    }
  }

  async function loadMe(tokenValue: string) {
    setLoadingMe(true)
    setError('')

    try {
      const user = await apiRequest<PublicUser>(
        '/auth/me',
        { method: 'GET' },
        tokenValue,
      )

      setCurrentUser(user)
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setCurrentUser(null)
      setError(err instanceof Error ? err.message : '사용자 조회 실패')
    } finally {
      setLoadingMe(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setCurrentUser(null)
    setMessage('로그아웃 완료')
    setError('')
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Agentic Board Auth Test</h1>
      <p>NestJS + React 인증 동작 확인용 임시 화면</p>

      <section style={{ marginTop: 32 }}>
        <h2>회원가입</h2>
        <form onSubmit={handleRegister} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            placeholder="email"
            value={registerEmail}
            onChange={(event) => setRegisterEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="password"
            value={registerPassword}
            onChange={(event) => setRegisterPassword(event.target.value)}
          />
          <input
            type="text"
            placeholder="nickname"
            value={registerNickname}
            onChange={(event) => setRegisterNickname(event.target.value)}
          />
          <button type="submit">회원가입</button>
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>로그인</h2>
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
          <input
            type="email"
            placeholder="email"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
          />
          <input
            type="password"
            placeholder="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
          />
          <button type="submit">로그인</button>
        </form>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>현재 사용자</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => token && void loadMe(token)}
            disabled={!token || loadingMe}
          >
            {loadingMe ? '불러오는 중...' : 'GET /auth/me'}
          </button>
          <button type="button" onClick={handleLogout}>
            로그아웃
          </button>
        </div>

        <pre style={{ background: '#f4f4f4', padding: 16 }}>
          {JSON.stringify(
            {
              token,
              currentUser,
            },
            null,
            2,
          )}
        </pre>
      </section>

      {message ? <p style={{ color: 'green' }}>{message}</p> : null}
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
    </main>
  )
}

export default App
```

### 15.4 이 코드가 하는 일

회원가입 폼

- 이메일, 비밀번호, 닉네임을 입력받아 `/auth/register` 호출

로그인 폼

- 이메일, 비밀번호를 입력받아 `/auth/login` 호출
- 성공하면 JWT를 `localStorage`에 저장

`useEffect`

- 앱이 새로 렌더링되었을 때 토큰이 있으면 `GET /auth/me` 호출
- 새로고침해도 로그인 상태를 복원

로그아웃

- 저장된 토큰 제거
- 사용자 상태 초기화

### 15.5 왜 `id` 타입이 string인가

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

## 19. 나중에 e2e 테스트로 옮기면 좋은 것

처음에는 손으로 테스트해도 되지만, 나중에는 e2e 테스트로 자동화하는 것이 좋다.

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
10. `apps/web-react/src/App.tsx`를 임시 인증 화면으로 바꿔서 프론트 연결 확인

---

## 다음 단계

이 단계가 끝나면 다음은 `좌석 후기 CRUD` 구현이다.

그때는 이 인증 구조를 그대로 재사용해서:

- 후기 작성 시 현재 로그인 사용자 id를 `authorId`에 넣고
- 수정/삭제 시 `authorId === currentUser.id`인지 검사하면 된다.

즉 지금 만드는 인증은 이후 모든 기능의 기반이 된다.
