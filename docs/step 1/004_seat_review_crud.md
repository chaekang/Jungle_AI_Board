# 004_seat_review_crud

## 목표

이 문서는 좌석 후기 CRUD를 실제로 완성하기 위한 구현 문서다.

이 단계가 끝나면 아래 API가 동작해야 한다.

- `POST /seat-reviews` 후기 작성
- `GET /seat-reviews` 후기 목록 조회
- `GET /seat-reviews/:id` 후기 상세 조회
- `PATCH /seat-reviews/:id` 후기 수정
- `DELETE /seat-reviews/:id` 후기 삭제

후기 작성, 수정, 삭제는 로그인한 사용자만 가능하게 만든다.
목록과 상세 조회는 일단 누구나 볼 수 있게 만든다.

## 현재 코드 기준

앞 단계에서 메타데이터 구조가 바뀌었으므로 CRUD도 이 기준을 따라야 한다.

- `performanceId`는 프론트에서 필수처럼 보낸다.
- `musicalId`는 선택된 `performance`에서 자동으로 가져온다.
- `seasonLabel`은 `performances` 테이블에 문자열로 저장된다.
  - 예: `25시즌`, `24-25시즌`
- `seatSection`은 optional이다.
  - 두산아트센터처럼 공식 구역이 있으면 `A`, `B`, `C` 같은 값을 저장한다.
  - 예스24스테이지처럼 공식 구역이 없으면 아예 보내지 않는다.
- 열은 프론트에서 제출할 때 대문자로 정규화한다.
  - `a` 입력 -> `A`
  - `1` 입력 -> `1`

현재 Prisma의 `SeatReview.performanceId`는 nullable이지만, 새 CRUD API에서는 요청값으로 필수처럼 받는다.
기존 데이터와의 호환 때문에 DB 컬럼은 nullable로 남아 있을 수 있지만, 새로 만드는 리뷰는 `performanceId`를 넣는 규칙으로 간다.

## 파일 경로 규칙

Nest 후기 도메인 코드는 아래에 둔다.

```text
apps/nest-api/src/seat-reviews
```

React 후기 기능 코드는 기존 폴더를 계속 사용한다.

```text
apps/web-react/src/features/reviews
```

공통 API 요청 함수는 이미 있는 파일을 사용한다.

```text
apps/web-react/src/shared/api.ts
```

## 1. 백엔드 폴더 만들기

먼저 Nest에 후기 도메인 폴더를 만든다.

```text
apps/nest-api/src/seat-reviews
apps/nest-api/src/seat-reviews/dto
```

최종적으로 백엔드 파일은 이렇게 생긴다.

```text
apps/nest-api/src/seat-reviews
  dto
    create-seat-review.dto.ts
    update-seat-review.dto.ts
    seat-review-query.dto.ts
  seat-reviews.controller.ts
  seat-reviews.module.ts
  seat-reviews.service.ts
```

각 파일의 역할은 이렇다.

| 파일 | 역할 |
| --- | --- |
| `create-seat-review.dto.ts` | 후기 작성 요청 body 검사 |
| `update-seat-review.dto.ts` | 후기 수정 요청 body 검사 |
| `seat-review-query.dto.ts` | 목록 조회 query string 검사 |
| `seat-reviews.controller.ts` | URL과 service 함수 연결 |
| `seat-reviews.service.ts` | 실제 DB 작업과 권한 검사 |
| `seat-reviews.module.ts` | controller/service를 Nest에 등록 |

## 2. 작성 DTO 만들기

파일:

```text
apps/nest-api/src/seat-reviews/dto/create-seat-review.dto.ts
```

코드:

```ts
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class CreateSeatReviewDto {
  @IsString()
  theaterId: string;

  @IsString()
  musicalId: string;

  @IsString()
  performanceId: string;

  @IsString()
  seatFloor: string;

  @IsOptional()
  @IsString()
  seatSection?: string;

  @IsString()
  seatRow: string;

  @IsString()
  seatNumber: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  viewRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  soundRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  comfortRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  expressionRating: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stageVisibilityRating: number;

  @IsString()
  @MinLength(10)
  content: string;
}
```

설명:

- `theaterId`, `musicalId`, `performanceId`는 브라우저에서 문자열로 온다.
- Prisma에 넣을 때는 service에서 `BigInt`로 바꾼다.
- `seatSection`은 공식 구역이 없는 공연장 때문에 `@IsOptional()`이다.
- 평점은 1점부터 5점까지만 허용한다.
- `@Type(() => Number)`는 요청으로 들어온 값을 숫자로 변환하려고 시도한다.
- `content`는 너무 짧은 후기를 막기 위해 최소 10자로 둔다.

## 3. 수정 DTO 만들기

파일:

```text
apps/nest-api/src/seat-reviews/dto/update-seat-review.dto.ts
```

코드:

```ts
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class UpdateSeatReviewDto {
  @IsOptional()
  @IsString()
  seatFloor?: string;

  @IsOptional()
  @IsString()
  seatSection?: string;

  @IsOptional()
  @IsString()
  seatRow?: string;

  @IsOptional()
  @IsString()
  seatNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  viewRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  soundRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  comfortRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  expressionRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stageVisibilityRating?: number;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;
}
```

설명:

- 수정 DTO는 모든 필드가 optional이다.
- 수정 화면에서 본문만 고칠 수도 있고, 평점만 고칠 수도 있기 때문이다.
- `theaterId`, `musicalId`, `performanceId`는 여기서 수정하지 않는다.
  - 후기의 대상 공연을 바꾸는 것은 실수 가능성이 크다.
  - 필요해지면 나중에 별도 기능으로 만든다.

## 4. 목록 조회 DTO 만들기

파일:

```text
apps/nest-api/src/seat-reviews/dto/seat-review-query.dto.ts
```

코드:

```ts
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class SeatReviewQueryDto {
  @IsOptional()
  @IsString()
  theaterId?: string;

  @IsOptional()
  @IsString()
  musicalId?: string;

  @IsOptional()
  @IsString()
  performanceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
```

설명:

- `GET /seat-reviews?theaterId=1`처럼 필터링할 수 있게 한다.
- 시즌까지 정확히 좁히고 싶으면 `performanceId`로 조회한다.
- `page`, `limit`은 페이지네이션용이다.
- `limit`은 너무 큰 조회를 막기 위해 최대 50으로 둔다.

## 5. Service 만들기

파일:

```text
apps/nest-api/src/seat-reviews/seat-reviews.service.ts
```

코드:

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "src/database/prisma.service";
import type { AuthenticatedUser } from "src/common/interfaces/authenticated-user.interface";
import { CreateSeatReviewDto } from "./dto/create-seat-review.dto";
import { SeatReviewQueryDto } from "./dto/seat-review-query.dto";
import { UpdateSeatReviewDto } from "./dto/update-seat-review.dto";

const seatReviewInclude = {
  author: true,
  theater: true,
  musical: true,
  performance: true,
} satisfies Prisma.SeatReviewInclude;

type SeatReviewWithRelations = Prisma.SeatReviewGetPayload<{
  include: typeof seatReviewInclude;
}>;

@Injectable()
export class SeatReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateSeatReviewDto) {
    const authorId = this.parseId(user.id, "userId");
    const theaterId = this.parseId(dto.theaterId, "theaterId");
    const musicalId = this.parseId(dto.musicalId, "musicalId");
    const performanceId = this.parseId(dto.performanceId, "performanceId");

    await this.assertPerformanceMatches({
      performanceId,
      theaterId,
      musicalId,
    });

    const review = await this.prisma.seatReview.create({
      data: {
        authorId,
        theaterId,
        musicalId,
        performanceId,
        seatFloor: dto.seatFloor.trim(),
        seatSection: this.normalizeOptionalText(dto.seatSection),
        seatRow: dto.seatRow.trim().toUpperCase(),
        seatNumber: dto.seatNumber.trim(),
        viewRating: dto.viewRating,
        soundRating: dto.soundRating,
        comfortRating: dto.comfortRating,
        expressionRating: dto.expressionRating,
        stageVisibilityRating: dto.stageVisibilityRating,
        content: dto.content.trim(),
      },
      include: seatReviewInclude,
    });

    return this.toPublicReview(review);
  }

  async findAll(query: SeatReviewQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SeatReviewWhereInput = {
      ...(query.theaterId ? { theaterId: this.parseId(query.theaterId, "theaterId") } : {}),
      ...(query.musicalId ? { musicalId: this.parseId(query.musicalId, "musicalId") } : {}),
      ...(query.performanceId
        ? { performanceId: this.parseId(query.performanceId, "performanceId") }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.seatReview.findMany({
        where,
        include: seatReviewInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.seatReview.count({ where }),
    ]);

    return {
      items: items.map((review) => this.toPublicReview(review)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const review = await this.prisma.seatReview.findUnique({
      where: { id: this.parseId(id, "id") },
      include: seatReviewInclude,
    });

    if (!review) {
      throw new NotFoundException("Seat review not found.");
    }

    return this.toPublicReview(review);
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateSeatReviewDto) {
    const reviewId = this.parseId(id, "id");
    const existingReview = await this.prisma.seatReview.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      throw new NotFoundException("Seat review not found.");
    }

    this.assertAuthor(existingReview.authorId, user.id);

    const updatedReview = await this.prisma.seatReview.update({
      where: { id: reviewId },
      data: {
        ...(dto.seatFloor !== undefined ? { seatFloor: dto.seatFloor.trim() } : {}),
        ...(dto.seatSection !== undefined
          ? { seatSection: this.normalizeOptionalText(dto.seatSection) }
          : {}),
        ...(dto.seatRow !== undefined ? { seatRow: dto.seatRow.trim().toUpperCase() } : {}),
        ...(dto.seatNumber !== undefined ? { seatNumber: dto.seatNumber.trim() } : {}),
        ...(dto.viewRating !== undefined ? { viewRating: dto.viewRating } : {}),
        ...(dto.soundRating !== undefined ? { soundRating: dto.soundRating } : {}),
        ...(dto.comfortRating !== undefined ? { comfortRating: dto.comfortRating } : {}),
        ...(dto.expressionRating !== undefined
          ? { expressionRating: dto.expressionRating }
          : {}),
        ...(dto.stageVisibilityRating !== undefined
          ? { stageVisibilityRating: dto.stageVisibilityRating }
          : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
      },
      include: seatReviewInclude,
    });

    return this.toPublicReview(updatedReview);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const reviewId = this.parseId(id, "id");
    const existingReview = await this.prisma.seatReview.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      throw new NotFoundException("Seat review not found.");
    }

    this.assertAuthor(existingReview.authorId, user.id);

    await this.prisma.$transaction([
      this.prisma.seatReviewTag.deleteMany({ where: { seatReviewId: reviewId } }),
      this.prisma.comment.deleteMany({ where: { seatReviewId: reviewId } }),
      this.prisma.seatReview.delete({ where: { id: reviewId } }),
    ]);

    return { deleted: true };
  }

  private async assertPerformanceMatches(input: {
    performanceId: bigint;
    theaterId: bigint;
    musicalId: bigint;
  }) {
    const performance = await this.prisma.performance.findUnique({
      where: { id: input.performanceId },
    });

    if (!performance) {
      throw new BadRequestException("Performance not found.");
    }

    if (performance.theaterId !== input.theaterId || performance.musicalId !== input.musicalId) {
      throw new BadRequestException("Performance does not match theaterId or musicalId.");
    }
  }

  private assertAuthor(authorId: bigint, currentUserId: string) {
    if (authorId !== this.parseId(currentUserId, "userId")) {
      throw new ForbiddenException("You can only modify your own review.");
    }
  }

  private parseId(value: string, fieldName: string) {
    try {
      const parsed = BigInt(value);

      if (parsed <= 0n) {
        throw new Error("ID must be positive.");
      }

      return parsed;
    } catch {
      throw new BadRequestException(`${fieldName} must be a positive integer string.`);
    }
  }

  private normalizeOptionalText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private toPublicReview(review: SeatReviewWithRelations) {
    return {
      id: review.id.toString(),
      author: {
        id: review.author.id.toString(),
        nickname: review.author.nickname,
      },
      theater: {
        id: review.theater.id.toString(),
        name: review.theater.name,
      },
      musical: {
        id: review.musical.id.toString(),
        title: review.musical.title,
      },
      performance: review.performance
        ? {
            id: review.performance.id.toString(),
            seasonLabel: review.performance.seasonLabel,
          }
        : null,
      seat: {
        floor: review.seatFloor,
        section: review.seatSection,
        row: review.seatRow,
        number: review.seatNumber,
      },
      ratings: {
        view: review.viewRating,
        sound: review.soundRating,
        comfort: review.comfortRating,
        expression: review.expressionRating,
        stageVisibility: review.stageVisibilityRating,
      },
      content: review.content,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
  }
}
```

설명:

- `create()`는 로그인한 사용자 ID를 `authorId`로 저장한다.
- `assertPerformanceMatches()`는 사용자가 보낸 `performanceId`, `theaterId`, `musicalId`가 서로 맞는 조합인지 확인한다.
  - 예를 들어 `두산아트센터 + 베어더뮤지컬` performance를 골랐는데 `musicalId`만 다른 작품으로 보내면 막는다.
- `findAll()`은 목록과 총 개수를 같이 반환한다.
- `findOne()`은 상세 조회다.
- `update()`와 `remove()`는 먼저 기존 후기를 찾고, 작성자 본인인지 확인한다.
- `remove()`는 현재 스키마에 `deletedAt`이 없으므로 하드 삭제로 구현한다.
  - 댓글과 태그 연결이 있으면 FK 때문에 삭제가 막힐 수 있어서 먼저 지운다.
- `toPublicReview()`는 BigInt를 문자열로 바꿔서 JSON 응답이 안전하게 나가도록 한다.

## 6. Controller 만들기

파일:

```text
apps/nest-api/src/seat-reviews/seat-reviews.controller.ts
```

코드:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import type { AuthenticatedUser } from "src/common/interfaces/authenticated-user.interface";
import { CreateSeatReviewDto } from "./dto/create-seat-review.dto";
import { SeatReviewQueryDto } from "./dto/seat-review-query.dto";
import { UpdateSeatReviewDto } from "./dto/update-seat-review.dto";
import { SeatReviewsService } from "./seat-reviews.service";

@Controller("seat-reviews")
export class SeatReviewsController {
  constructor(private readonly seatReviewsService: SeatReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSeatReviewDto) {
    return this.seatReviewsService.create(user, dto);
  }

  @Get()
  findAll(@Query() query: SeatReviewQueryDto) {
    return this.seatReviewsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.seatReviewsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSeatReviewDto,
  ) {
    return this.seatReviewsService.update(id, user, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.seatReviewsService.remove(id, user);
  }
}
```

설명:

- `@Controller("seat-reviews")` 때문에 모든 URL 앞에 `/seat-reviews`가 붙는다.
- `@Post()`는 `POST /seat-reviews`다.
- `@Get(":id")`는 `GET /seat-reviews/1` 같은 상세 조회다.
- 작성, 수정, 삭제에만 `@UseGuards(JwtAuthGuard)`를 붙인다.
- `@CurrentUser()`는 JWT 검증 후 들어온 `request.user`를 꺼내준다.

## 7. Module 만들기

파일:

```text
apps/nest-api/src/seat-reviews/seat-reviews.module.ts
```

코드:

```ts
import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { SeatReviewsController } from "./seat-reviews.controller";
import { SeatReviewsService } from "./seat-reviews.service";

@Module({
  imports: [DatabaseModule],
  controllers: [SeatReviewsController],
  providers: [SeatReviewsService],
})
export class SeatReviewsModule {}
```

설명:

- `SeatReviewsService`가 `PrismaService`를 쓰므로 `DatabaseModule`을 import한다.
- controller와 service를 Nest에 등록한다.

## 8. AppModule에 연결하기

파일:

```text
apps/nest-api/src/app.module.ts
```

기존 import 아래에 추가한다.

```ts
import { SeatReviewsModule } from "./seat-reviews/seat-reviews.module";
```

`imports` 배열에도 추가한다.

```ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    MetadataModule,
    SeatReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

설명:

- Nest는 module에 등록된 controller만 실제 URL로 열어준다.
- 파일을 만들어도 `AppModule`에 연결하지 않으면 API가 동작하지 않는다.

## 9. 백엔드 실행 확인

Nest 서버를 실행한다.

```powershell
cd apps/nest-api
npm run start:dev
```

로그인해서 토큰을 얻는다.

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"viewer1@example.com","password":"password123"}'

$token = $login.accessToken
```

후기를 작성한다.

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/seat-reviews `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{
    "theaterId": "1",
    "musicalId": "1",
    "performanceId": "1",
    "seatFloor": "1층",
    "seatSection": "A",
    "seatRow": "f",
    "seatNumber": "18",
    "viewRating": 5,
    "soundRating": 4,
    "comfortRating": 4,
    "expressionRating": 5,
    "stageVisibilityRating": 5,
    "content": "무대와 배우 표정이 잘 보여서 만족스러운 좌석이었다."
  }'
```

응답에서 `seat.row`가 `"F"`로 오면 열 대문자 정규화가 잘 된 것이다.

목록 조회:

```powershell
Invoke-RestMethod http://localhost:3000/seat-reviews
```

공연별 조회:

```powershell
Invoke-RestMethod "http://localhost:3000/seat-reviews?performanceId=1"
```

상세 조회:

```powershell
Invoke-RestMethod http://localhost:3000/seat-reviews/1
```

수정:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri http://localhost:3000/seat-reviews/1 `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"content":"수정한 후기입니다. 다시 보니 음향이 더 안정적으로 느껴졌다.","soundRating":5}'
```

삭제:

```powershell
Invoke-RestMethod `
  -Method Delete `
  -Uri http://localhost:3000/seat-reviews/1 `
  -Headers @{ Authorization = "Bearer $token" }
```

## 10. 프론트 타입 확장하기

파일:

```text
apps/web-react/src/features/reviews/types.ts
```

기존 타입 아래에 추가한다.

```ts
export type ReviewRatingDraft = {
  viewRating: number
  soundRating: number
  comfortRating: number
  expressionRating: number
  stageVisibilityRating: number
}

export type CreateSeatReviewPayload = ReviewDraftPayload &
  ReviewRatingDraft & {
    content: string
  }

export type PublicSeatReview = {
  id: string
  author: {
    id: string
    nickname: string
  }
  theater: {
    id: string
    name: string
  }
  musical: {
    id: string
    title: string
  }
  performance: {
    id: string
    seasonLabel?: string | null
  } | null
  seat: {
    floor: string
    section?: string | null
    row: string
    number: string
  }
  ratings: {
    view: number
    sound: number
    comfort: number
    expression: number
    stageVisibility: number
  }
  content: string
  createdAt: string
  updatedAt: string
}

export type SeatReviewListResponse = {
  items: PublicSeatReview[]
  total: number
  page: number
  limit: number
}
```

설명:

- `ReviewDraftPayload`는 이미 극장, 공연, 좌석 위치를 담고 있다.
- `CreateSeatReviewPayload`는 여기에 평점과 본문을 더한 실제 POST body다.
- `PublicSeatReview`는 백엔드 응답 모양과 맞춘다.

## 11. 프론트 API 함수 추가하기

파일:

```text
apps/web-react/src/features/reviews/api.ts
```

기존 메타데이터 함수 아래에 추가한다.

```ts
import type {
  CreateSeatReviewPayload,
  SeatReviewListResponse,
  PublicSeatReview,
} from "./types"

export function createSeatReview(input: CreateSeatReviewPayload, token: string) {
  return apiRequest<PublicSeatReview>(
    "/seat-reviews",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    token,
  )
}

export function getSeatReviews(params: { performanceId?: string } = {}) {
  const searchParams = new URLSearchParams()

  if (params.performanceId) {
    searchParams.set("performanceId", params.performanceId)
  }

  const queryString = searchParams.toString()
  const path = queryString ? `/seat-reviews?${queryString}` : "/seat-reviews"

  return apiRequest<SeatReviewListResponse>(path)
}

export function getSeatReview(id: string) {
  return apiRequest<PublicSeatReview>(`/seat-reviews/${id}`)
}
```

설명:

- 작성 API는 JWT가 필요하므로 `token`을 세 번째 인자로 넘긴다.
- 목록/상세 조회는 일단 공개로 두었으므로 토큰 없이 호출한다.
- 나중에 수정/삭제 화면을 만들면 `updateSeatReview`, `deleteSeatReview`도 같은 파일에 추가한다.

## 12. 토큰 키를 공유 상수로 빼기

현재 `AuthPage.tsx` 안에 토큰 키가 있다.
리뷰 작성 화면에서도 토큰이 필요하므로 공통 파일로 빼는 편이 좋다.

파일:

```text
apps/web-react/src/features/auth/constants.ts
```

코드:

```ts
export const TOKEN_KEY = "jungle_ai_board_access_token"
```

`AuthPage.tsx`에서는 기존 상수 선언을 지우고 import한다.

```ts
import { TOKEN_KEY } from "./constants"
```

설명:

- 토큰 키 문자열을 여러 파일에 복사하면 나중에 하나만 바꿨을 때 로그인 상태가 깨질 수 있다.
- 상수 파일 하나를 같이 쓰면 같은 localStorage 키를 안정적으로 사용한다.

## 13. ReviewCreatePage를 실제 저장까지 연결하기

파일:

```text
apps/web-react/src/features/reviews/ReviewCreatePage.tsx
```

위쪽 import에 추가한다.

```ts
import { TOKEN_KEY } from "../auth/constants"
import { createSeatReview } from "./api"
```

`useState`를 추가한다.

```ts
const [content, setContent] = useState("")
const [ratings, setRatings] = useState({
  viewRating: 5,
  soundRating: 5,
  comfortRating: 5,
  expressionRating: 5,
  stageVisibilityRating: 5,
})
const [submitMessage, setSubmitMessage] = useState("")
const [isSubmitting, setIsSubmitting] = useState(false)
```

`handleSubmit`을 `async`로 바꾸고, payload에 평점과 본문을 더한다.

```ts
async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  if (
    !selectedTheaterId ||
    !selectedPerformanceId ||
    !selectedPerformance ||
    !seatLocation.seatFloor ||
    (needsOfficialSection && !seatLocation.seatSection) ||
    !seatLocation.seatRow.trim() ||
    !seatLocation.seatNumber.trim() ||
    !content.trim()
  ) {
    setFormError("공연장, 작품, 좌석 위치, 후기를 모두 입력해주세요.")
    setPreviewPayload(null)
    return
  }

  const payload = {
    theaterId: selectedTheaterId,
    musicalId: selectedPerformance.musicalId,
    performanceId: selectedPerformance.id,
    seatFloor: normalizeSeatText(seatLocation.seatFloor),
    seatRow: normalizeSeatRow(seatLocation.seatRow),
    seatNumber: normalizeSeatText(seatLocation.seatNumber),
    ...(needsOfficialSection
      ? { seatSection: normalizeSeatText(seatLocation.seatSection) }
      : {}),
    ...ratings,
    content: content.trim(),
  }

  setFormError("")
  setPreviewPayload(payload)
  setSubmitMessage("")
  setIsSubmitting(true)

  try {
    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      throw new Error("로그인 후 후기를 작성할 수 있습니다.")
    }

    await createSeatReview(payload, token)
    setSubmitMessage("후기가 저장되었습니다.")
  } catch (err) {
    setFormError(err instanceof Error ? err.message : "후기 저장에 실패했습니다.")
  } finally {
    setIsSubmitting(false)
  }
}
```

form 안에 본문 입력과 평점 입력을 추가한다.

```tsx
<fieldset style={{ marginBottom: 16 }}>
  <legend>평점</legend>

  <label>
    시야
    <input
      type="number"
      min={1}
      max={5}
      value={ratings.viewRating}
      onChange={(event) =>
        setRatings({ ...ratings, viewRating: Number(event.target.value) })
      }
    />
  </label>

  <label>
    음향
    <input
      type="number"
      min={1}
      max={5}
      value={ratings.soundRating}
      onChange={(event) =>
        setRatings({ ...ratings, soundRating: Number(event.target.value) })
      }
    />
  </label>

  <label>
    편의성
    <input
      type="number"
      min={1}
      max={5}
      value={ratings.comfortRating}
      onChange={(event) =>
        setRatings({ ...ratings, comfortRating: Number(event.target.value) })
      }
    />
  </label>

  <label>
    표정 체감
    <input
      type="number"
      min={1}
      max={5}
      value={ratings.expressionRating}
      onChange={(event) =>
        setRatings({ ...ratings, expressionRating: Number(event.target.value) })
      }
    />
  </label>

  <label>
    무대 전체 체감
    <input
      type="number"
      min={1}
      max={5}
      value={ratings.stageVisibilityRating}
      onChange={(event) =>
        setRatings({ ...ratings, stageVisibilityRating: Number(event.target.value) })
      }
    />
  </label>
</fieldset>

<label>
  후기
  <textarea
    value={content}
    onChange={(event) => setContent(event.target.value)}
    placeholder="좌석에서 느낀 시야, 음향, 배우 표정, 불편한 점을 적어주세요."
  />
</label>

{submitMessage ? <p>{submitMessage}</p> : null}

<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "저장 중..." : "후기 저장"}
</button>
```

설명:

- 기존 `ReviewCreatePage`는 payload 미리보기까지만 했다.
- 이제 같은 payload에 `ratings`, `content`를 붙여서 `POST /seat-reviews`로 보낸다.
- `TOKEN_KEY`로 localStorage에서 JWT를 꺼낸다.
- 토큰이 없으면 백엔드에 보내기 전에 프론트에서 먼저 막는다.

## 14. 목록 화면은 다음 단계로 분리해도 된다

CRUD API는 목록 조회까지 만들지만, React 화면은 한 번에 다 만들면 복잡해진다.

최소 확인용 목록 컴포넌트는 이렇게 만들 수 있다.

파일:

```text
apps/web-react/src/features/reviews/components/SeatReviewList.tsx
```

코드:

```tsx
import { useEffect, useState } from "react"
import { getSeatReviews } from "../api"
import type { PublicSeatReview } from "../types"

type SeatReviewListProps = {
  performanceId?: string
}

export default function SeatReviewList({ performanceId }: SeatReviewListProps) {
  const [reviews, setReviews] = useState<PublicSeatReview[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadReviews() {
      try {
        const result = await getSeatReviews({ performanceId })
        setReviews(result.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : "후기 목록을 불러오지 못했습니다.")
      }
    }

    void loadReviews()
  }, [performanceId])

  if (error) {
    return <p style={{ color: "crimson" }}>{error}</p>
  }

  return (
    <section>
      <h2>최근 후기</h2>
      {reviews.map((review) => (
        <article key={review.id}>
          <h3>
            {review.theater.name} / {review.musical.title}
          </h3>
          <p>
            {review.seat.floor}
            {review.seat.section ? ` ${review.seat.section}구역` : ""} {review.seat.row}열{" "}
            {review.seat.number}번
          </p>
          <p>{review.content}</p>
        </article>
      ))}
    </section>
  )
}
```

설명:

- `getSeatReviews()`로 목록 API를 호출한다.
- `performanceId`를 넘기면 특정 공연/시즌 후기만 보여줄 수 있다.
- 화면 스타일은 나중에 다듬고, 지금은 API 연결 확인이 목적이다.

## 15. 흔한 에러와 해결

### `401 Unauthorized`

원인:

- 토큰 없이 `POST`, `PATCH`, `DELETE`를 호출했다.
- localStorage의 토큰이 만료되었거나 잘못되었다.

해결:

- 로그인 후 다시 시도한다.
- 프론트에서 `Authorization: Bearer 토큰`이 붙는지 확인한다.

### `Performance does not match theaterId or musicalId`

원인:

- `performanceId`는 A 공연인데 `theaterId`나 `musicalId`를 다른 값으로 보냈다.

해결:

- 프론트에서 사용자가 직접 `musicalId`를 고르게 하지 않는다.
- 선택된 `PerformanceOption`에서 `musicalId`를 꺼내 payload에 넣는다.

### `Do not know how to serialize a BigInt`

원인:

- Prisma에서 받은 BigInt를 그대로 JSON 응답으로 보냈다.

해결:

- service의 `toPublicReview()`처럼 `id.toString()`으로 변환해서 반환한다.

### 삭제가 FK 에러로 실패함

원인:

- 댓글이나 태그 연결이 남아 있는데 후기를 먼저 삭제했다.

해결:

- `seatReviewTag.deleteMany`
- `comment.deleteMany`
- `seatReview.delete`

이 순서로 transaction 안에서 삭제한다.

## 완료 기준

아래가 모두 되면 이 단계는 끝난 것이다.

- 로그인한 사용자는 후기를 작성할 수 있다.
- 비로그인 사용자는 후기를 작성할 수 없다.
- 후기 목록이 최신순으로 조회된다.
- 후기 상세 조회가 된다.
- 작성자 본인만 후기를 수정할 수 있다.
- 작성자 본인만 후기를 삭제할 수 있다.
- `seatSection` 없이도 예스24스테이지 같은 공연장 후기를 저장할 수 있다.
- `seatRow`에 `a`를 보내도 응답에서는 `A`로 확인된다.
- `performanceId` 기준으로 시즌이 분리된다.

## 나중에 확장할 것

현재 문서는 지금 스키마에 맞춰 하드 삭제로 구현한다.
나중에 소프트 삭제가 필요하면 Prisma에 아래 필드를 추가한다.

```prisma
deletedAt DateTime? @map("deleted_at")
```

그 다음 목록/상세 조회에는 항상 아래 조건을 넣는다.

```ts
where: {
  deletedAt: null
}
```

삭제는 `delete()`가 아니라 `update()`로 바꾼다.

```ts
await this.prisma.seatReview.update({
  where: { id: reviewId },
  data: { deletedAt: new Date() },
})
```

소프트 삭제는 검색, 댓글, RAG 단계와도 연결되므로 지금 바로 섞기보다 CRUD가 먼저 안정적으로 끝난 뒤 추가하는 편이 좋다.
