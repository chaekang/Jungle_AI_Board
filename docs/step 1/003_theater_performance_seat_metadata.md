# 003_theater_performance_seat_metadata

## 현재 코드 기준 업데이트

이 문서의 기준은 현재 코드에서 다음처럼 바뀌었다.

### 1. 공연 조합은 시즌을 포함한다

`Performance`는 이제 `작품 + 공연장`만 뜻하지 않는다. 같은 작품이 같은 공연장에서 여러 시즌으로 올라올 수 있으므로 `seasonLabel`을 함께 가진다.

예를 들어 두산아트센터에서 `베어더뮤지컬`이 여러 시즌으로 올라오면 화면에는 아래처럼 나와야 한다.

- `25시즌 베어더뮤지컬`
- `23시즌 베어더뮤지컬`
- `24-25시즌 베어더뮤지컬`

그래서 `seasonLabel`은 `INT`가 아니라 `String?`이다.

```prisma
model Performance {
  id          BigInt   @id @default(autoincrement())
  musicalId   BigInt   @map("musical_id")
  theaterId   BigInt   @map("theater_id")
  seasonLabel String?  @map("season_label")

  musical     Musical  @relation(fields: [musicalId], references: [id])
  theater     Theater  @relation(fields: [theaterId], references: [id])

  @@unique([musicalId, theaterId, seasonLabel])
  @@map("performances")
}
```

API 응답도 시즌 표시용 값을 내려준다.

```ts
{
  id: "7",
  theaterId: "3",
  theaterName: "두산아트센터",
  musicalId: "4",
  musicalTitle: "베어더뮤지컬",
  seasonLabel: "25시즌",
  displayTitle: "25시즌 베어더뮤지컬"
}
```

프론트에서는 작품 select의 실제 값으로 `musicalId`가 아니라 `performanceId`를 사용한다. 그래야 같은 `베어더뮤지컬`이라도 `23시즌`, `25시즌`을 서로 다른 선택지로 고를 수 있다. 저장 payload를 만들 때 `musicalId`는 선택된 `PerformanceOption`에서 자동으로 꺼낸다.

### 2. 작품 검색은 작품명 기준으로 동작한다

작품 선택지는 시즌까지 포함해서 보이지만, 검색은 작품명으로도 걸려야 한다.

예를 들어 검색창에 `베어더뮤지컬`을 입력하면 아래 선택지가 같이 보여야 한다.

- `25시즌 베어더뮤지컬`
- `23시즌 베어더뮤지컬`

이를 위해 프론트의 `ReviewWorkOption`은 `displayTitle`과 `searchText`를 분리한다.

```ts
export type ReviewWorkOption = {
  performanceId: string
  musicalId: string
  musicalTitle: string
  seasonLabel?: string | null
  displayTitle: string
  searchText: string
}
```

### 3. 공연 조합 입력은 받지 않는다

사용자가 별도로 공연 조합을 입력하거나 고르게 하지 않는다.

현재 흐름은 아래와 같다.

```text
공연장 선택
  -> 해당 공연장의 performance 목록 조회
  -> 작품/시즌 선택지를 performanceId 기준으로 표시
  -> 선택된 performance에서 musicalId, performanceId 자동 결정
```

즉 `ReviewCreatePage`는 제출 시 아래처럼 payload를 만든다.

```ts
const payload: ReviewDraftPayload = {
  theaterId: selectedTheaterId,
  musicalId: selectedPerformance.musicalId,
  performanceId: selectedPerformance.id,
  seatFloor,
  seatRow,
  seatNumber,
  ...(needsOfficialSection ? { seatSection } : {}),
}
```

### 4. 구역은 optional이다

모든 공연장이 공식 구역을 제공하는 것은 아니다. 예스24스테이지처럼 공식적으로 `A/B/C` 구역 정보가 없는 공연장은 화면에서 구역 입력을 받지 않는다.

그래서 DB와 프론트 타입 모두 `seatSection`은 optional이다.

```prisma
seatSection String? @map("seat_section")
```

```ts
export type ReviewDraftPayload = {
  theaterId: string
  musicalId: string
  performanceId: string
  seatFloor: string
  seatSection?: string
  seatRow: string
  seatNumber: string
}
```

공식 구역이 있는 공연장만 구역 토글을 보여준다. 공식 구역이 없는 공연장은 `층 / 열 / 번호`만 입력한다.

### 5. 공식 구역과 AI 설명용 블록은 다르다

공식 구역이 없는 공연장도 실제 관람자들은 복도 기준으로 `왼쪽블록 / 중앙블록 / 오른쪽블록`처럼 말할 수 있다. 다만 이것은 공식 저장값인 `seatSection`이 아니다.

프론트 좌석 layout에는 이를 위해 `aiBlocksByFloor`를 둘 수 있다.

```ts
export type TheaterSeatLayout = {
  floors: SeatOption[]
  sectionsByFloor: Record<string, SeatOption[]>
  aiBlocksByFloor?: Record<string, SeatOption[]>
}
```

예스24스테이지는 공식 구역 입력은 숨기고, AI 설명용으로만 아래 기준을 둔다.

```ts
const yes24StageLayout: TheaterSeatLayout = {
  floors: [{ value: "1층", label: "1층" }],
  sectionsByFloor: {},
  aiBlocksByFloor: {
    "1층": [
      { value: "left", label: "왼쪽블록" },
      { value: "center", label: "중앙블록" },
      { value: "right", label: "오른쪽블록" },
    ],
  },
}
```

### 6. 현재 공연장 좌석 구역 기준

현재 프론트의 `apps/web-react/src/features/reviews/theater-seat-layouts.ts` 기준은 아래와 같다.

| 공연장 | 공식 구역 입력 |
| --- | --- |
| 샤롯데씨어터 | 1층 A/B/C, 2층 A/B/C |
| 두산아트센터 | 1층 A/B/C, 2층 D/E/F |
| 홍익대 대학로 아트센터 | 1층 A/B/C, 2층 A/B/C |
| 예스24스테이지 | 공식 구역 입력 없음, AI용 왼쪽블록/중앙블록/오른쪽블록만 보조 보관 |
| 블루스퀘어 | 임시 기준 1층/2층/3층 A/B/C |

### 7. 이 변경에 필요한 마이그레이션

현재 코드 기준으로 아래 migration이 추가되어 있다.

- `20260610082000_add_performance_season_label`
- `20260610093000_make_seat_section_optional`

로컬 DB에 반영할 때는 아래 명령을 사용한다.

```powershell
cd apps/nest-api
npx prisma generate
npx prisma migrate deploy
```

### 8. 아래 본문을 읽을 때 주의할 점

아래 기존 본문에 `@@unique([musicalId, theaterId])`, 필수 `seatSection`, 별도 공연 조합 select처럼 적힌 예전 설명이 남아 있다면 위 기준이 최신이다. 실제 코드는 다음 파일들을 기준으로 확인한다.

- `apps/nest-api/prisma/schema.prisma`
- `apps/nest-api/src/metadata/metadata.service.ts`
- `apps/web-react/src/features/reviews/ReviewCreatePage.tsx`
- `apps/web-react/src/features/reviews/components/MetadataSelects.tsx`
- `apps/web-react/src/features/reviews/components/SeatLocationFields.tsx`
- `apps/web-react/src/features/reviews/theater-seat-layouts.ts`

## 현재 파일 경로 규칙

이 문서에서 코드를 추가하거나 예시 경로를 적을 때는 아래 규칙을 따른다.

- Nest 메타데이터 코드는 `apps/nest-api/src/metadata`에 둔다.
- React 메타데이터 선택 UI와 타입은 `apps/web-react/src/features/reviews`에 둔다.
- React 공통 HTTP 요청 함수는 `apps/web-react/src/shared/api.ts`에 둔다.
- React 화면, 컴포넌트, 스타일, 타입, 요청 코드는 기능 폴더 안에서 역할별로 나눈다.
- DTO는 Nest 도메인 폴더 아래 `dto`, 타입/인터페이스는 해당 기능 폴더의 `types.ts` 또는 `interfaces`에 둔다.

## 문서의 목표

이 문서는 [implementation_order.md](../implementation_order.md)의
`4. 극장 / 공연 / 좌석 메타데이터 구조 설계`를 실제 구현 관점에서 풀어쓴 작업 가이드다.

이 단계의 목표는 좌석 리뷰 CRUD를 만들기 전에,
리뷰가 기대고 설 수 있는 극장, 작품, 공연, 좌석 위치 메타데이터의 기준을 먼저 고정하는 것이다.

여기서 말하는 메타데이터는 리뷰 본문이 아니다.
리뷰가 어떤 극장, 어떤 작품, 어떤 공연 조합, 어떤 좌석 위치에 대한 것인지 구조적으로 저장하기 위한 기준 정보다.

관련 개념 문서:

- [docs/step 1/concept/003_theater_performance_seat_metadata.md](./concept/003_theater_performance_seat_metadata.md)

## 이 문서가 끝나면 되는 것

이 문서를 따라 구현한 뒤에는 아래가 가능해야 한다.

- Prisma에 `Theater`, `Musical`, `Performance` 모델이 정리되어 있다.
- `SeatReview`가 극장, 작품, 공연, 좌석 위치를 참조할 준비가 되어 있다.
- 좌석 위치를 `seatFloor`, `seatSection`, `seatRow`, `seatNumber`로 나누어 저장한다.
- seed 데이터를 넣으면 극장, 작품, 공연 목록이 실제 DB에 들어간다.
- NestJS에서 극장 목록, 작품 목록, 공연 목록 조회 API를 만들 수 있다.
- React 리뷰 작성 화면에서 극장, 작품, 공연, 좌석 위치 입력 UI를 만들 수 있다.
- 다음 단계인 `004_seat_review_crud.md`에서 어떤 필드를 써야 할지 다시 고민하지 않고 CRUD 구현으로 넘어갈 수 있다.

## 현재 프로젝트 기준

현재 레포 기준으로 이 단계에서 만지는 핵심 위치는 아래와 같다.

| 구분 | 경로 | 역할 |
| --- | --- | --- |
| Prisma 스키마 | `apps/nest-api/prisma/schema.prisma` | 데이터 모델 정의 |
| Prisma seed | `apps/nest-api/prisma/seed.ts` 또는 추가 seed 스크립트 | 테스트용 기본 데이터 입력 |
| Nest 루트 모듈 | `apps/nest-api/src/app.module.ts` | 전체 모듈 등록 |
| DB 서비스 | `apps/nest-api/src/database/prisma.service.ts` | Prisma 연결 |
| Metadata 모듈 | `apps/nest-api/src/metadata` | 극장, 작품, 공연 조회 API |
| React 앱 | `apps/web-react/src/features/reviews`, `apps/web-react/src/shared/api.ts` | API를 불러와 화면에 연결 |

중요한 전제:

- 현재 프로젝트는 NestJS + Prisma + PostgreSQL 조합이다.
- 주요 PK는 `BigInt`다.
- `BigInt`는 JSON으로 바로 응답하기 어렵기 때문에 API 응답에서는 문자열로 바꿔 내려준다.
- `SeatReview`는 이미 존재하거나 다음 단계에서 본격적으로 확장된다.
- 이 단계는 리뷰 본문 CRUD보다 리뷰가 참조할 기준 데이터를 먼저 안정화하는 단계다.

---

## 1. 개념 먼저 정리하기

구현 전에 아래 개념을 확실히 나누는 것이 중요하다.

| 개념 | 뜻 | 예시 |
| --- | --- | --- |
| `Theater` | 공연이 실제로 열리는 장소 | 샤롯데씨어터, 블루스퀘어 |
| `Musical` | 작품 자체 | 하데스타운, 물랑루즈 |
| `Performance` | 특정 작품과 특정 극장의 조합 | 하데스타운 + 블루스퀘어 |
| `Seat metadata` | 좌석 위치를 설명하는 구조화된 값 | 1F, CENTER, F열, 18번 |

처음 보면 `Musical`과 `Performance`가 헷갈릴 수 있다.

차이는 단순하다.

- `Musical`은 작품 자체다.
- `Performance`는 그 작품이 어떤 극장에서 공연되는지 나타내는 조합 정보다.

예를 들어 `하데스타운`은 `Musical`이다.
하지만 `하데스타운이 블루스퀘어에서 공연 중이다`라는 정보는 `Performance`다.

리뷰는 단순히 작품만 알면 되는 경우도 있지만,
대부분은 어떤 극장에서 본 공연인지까지 알아야 좌석 리뷰로서 의미가 생긴다.

그래서 이 프로젝트에서는 아래 값을 분리해서 들고 간다.

- 작품 기준 검색을 위한 `musicalId`
- 극장 기준 필터를 위한 `theaterId`
- 특정 극장-작품 조합을 위한 `performanceId`

좌석 위치도 마찬가지다.

좌석 위치를 `"1층 중앙 F열 18번"` 같은 하나의 문자열로 저장할 수도 있다.
하지만 그렇게 하면 나중에 필터링이나 검색이 어려워진다.

예를 들어 아래 요구사항을 처리하기 힘들어진다.

- `1F` 좌석만 보기
- `CENTER` 구역만 보기
- `F`열 근처 리뷰만 보기
- `18번` 근처 좌석 후기 묶기

그래서 좌석 위치는 처음부터 아래 4개 필드로 쪼개서 저장한다.

- `seatFloor`
- `seatSection`
- `seatRow`
- `seatNumber`

---

## 2. 전체 구현 흐름

이 문서를 따라 구현하면 흐름은 아래처럼 간다.

```text
Prisma 스키마 정리
  -> Theater / Musical / Performance 모델 확인
  -> SeatReview가 FK와 좌석 필드를 가지는지 확인

DB 반영
  -> migrate 또는 db push 실행
  -> Prisma Client generate

seed 데이터 입력
  -> 극장 / 작품 / 공연 조합 기본 데이터 넣기

NestJS metadata API 작성
  -> GET /theaters
  -> GET /musicals
  -> GET /performances

PowerShell로 API 확인
  -> 백엔드가 정상 응답하는지 먼저 확인

React 화면 연결
  -> 극장 목록 불러오기
  -> 작품 목록 불러오기
  -> 선택값에 맞는 공연 목록 불러오기
  -> 좌석 위치 입력 필드 구성
```

이 단계에서는 아직 리뷰 저장 POST API를 완성하지 않아도 된다.
핵심은 다음 단계의 리뷰 CRUD가 의존할 기본 구조를 먼저 고정하는 것이다.

---

## 3. 구현 범위

이번 단계에서 할 일:

- 극장 모델 확인
- 작품 모델 확인
- 공연 모델 확인
- 좌석 위치 필드 기준 정하기
- seed 데이터 넣기
- metadata 조회 API 만들기
- React에서 metadata를 받아 리뷰 작성 폼에 연결하기

이번 단계에서 아직 하지 않아도 되는 일:

- 공연 날짜와 회차 모델링
- 좌석 배치도 시각화
- 좌석 점유 상태
- 관리자용 극장/작품/공연 관리 UI
- 대규모 검색 최적화
- 리뷰 본문 저장 API 완성

즉 지금은 "리뷰가 어디에 대한 리뷰인지 정확히 표현할 수 있는 최소 구조"를 만드는 단계다.

---

## 4. Prisma 스키마 기준

파일:

- `apps/nest-api/prisma/schema.prisma`

현재 프로젝트 기준으로 핵심 모델은 아래와 같은 형태가 된다.

### 4.1 `Theater`

`Theater`는 공연장을 저장한다.

```prisma
model Theater {
  id         BigInt       @id @default(autoincrement())
  name       String       @unique
  createdAt  DateTime     @default(now()) @map("created_at")
  updatedAt  DateTime     @updatedAt @map("updated_at")

  performances Performance[]
  seatReviews  SeatReview[]

  @@map("theaters")
}
```

중요한 점은 `name`에 `@unique`가 있다는 것이다.
같은 공연장이 중복으로 들어가면 나중에 필터와 seed 데이터가 꼬일 수 있다.

### 4.2 `Musical`

`Musical`은 작품 자체를 저장한다.

```prisma
model Musical {
  id         BigInt       @id @default(autoincrement())
  title      String
  createdAt  DateTime     @default(now()) @map("created_at")
  updatedAt  DateTime     @updatedAt @map("updated_at")

  performances Performance[]
  seatReviews  SeatReview[]

  @@map("musicals")
}
```

DB 컬럼 이름은 `title`이지만,
프론트에서 선택 옵션으로 내려줄 때는 `{ id, name }` 형태로 바꿔도 된다.

이 문서의 Nest 서비스 예시는 `musical.title`을 API 응답에서 `name`으로 바꿔 내려준다.

### 4.3 `Performance`

`Performance`는 작품과 공연장을 연결하는 모델이다.

```prisma
model Performance {
  id         BigInt      @id @default(autoincrement())
  musicalId  BigInt      @map("musical_id")
  theaterId  BigInt      @map("theater_id")
  createdAt  DateTime    @default(now()) @map("created_at")
  updatedAt  DateTime    @updatedAt @map("updated_at")

  musical    Musical     @relation(fields: [musicalId], references: [id])
  theater    Theater     @relation(fields: [theaterId], references: [id])
  seatReviews SeatReview[]

  @@unique([musicalId, theaterId])
  @@map("performances")
}
```

`@@unique([musicalId, theaterId])`는 같은 작품-극장 조합이 중복으로 들어가지 않게 막는다.

현재 단계에서는 날짜와 회차를 따로 다루지 않는다.
그래서 "하나의 작품이 하나의 극장에서 공연된다"는 조합 단위만 `Performance`로 본다.

나중에 날짜, 회차, 캐스팅까지 분리하고 싶어지면 `PerformanceSchedule` 같은 모델을 추가하면 된다.
지금은 과하게 확장하지 않는 것이 좋다.

### 4.4 `SeatReview`

이 문서의 주인공은 `SeatReview` 전체가 아니라,
그 안에서 메타데이터와 연결되는 필드들이다.

리뷰 모델에서는 아래 필드들이 중요하다.

```prisma
model SeatReview {
  id                    BigInt      @id @default(autoincrement())
  authorId              BigInt      @map("author_id")
  theaterId             BigInt      @map("theater_id")
  musicalId             BigInt      @map("musical_id")
  performanceId         BigInt?     @map("performance_id")
  seatFloor             String      @map("seat_floor")
  seatSection           String      @map("seat_section")
  seatRow               String      @map("seat_row")
  seatNumber            String      @map("seat_number")
  viewRating            Int         @map("view_rating")
  soundRating           Int         @map("sound_rating")
  comfortRating         Int         @map("comfort_rating")
  expressionRating      Int         @map("expression_rating")
  stageVisibilityRating Int         @map("stage_visibility_rating")
  content               String
  createdAt             DateTime    @default(now()) @map("created_at")
  updatedAt             DateTime    @updatedAt @map("updated_at")

  author                User        @relation(fields: [authorId], references: [id])
  theater               Theater     @relation(fields: [theaterId], references: [id])
  musical               Musical     @relation(fields: [musicalId], references: [id])
  performance           Performance? @relation(fields: [performanceId], references: [id])

  @@map("seat_reviews")
}
```

`performanceId`가 optional인 이유는 "작품과 극장은 알지만 정확한 공연 조합은 아직 고르지 못한 리뷰"를 임시로 허용할 수 있기 때문이다.

다만 실제 리뷰 작성 화면에서는 가능하면 `performanceId`까지 받는 것을 추천한다.
그래야 나중에 필터와 검색이 더 명확해진다.

---

## 5. 좌석 위치 필드는 왜 문자열 4개인가

좌석 위치는 숫자로 보이는 값이 많아서 처음에는 `Int`로 저장하고 싶어진다.
하지만 실제 공연장 좌석 표기는 숫자만으로 끝나지 않는다.

예시:

- `1F`
- `2F`
- `B1`
- `CENTER`
- `LEFT`
- `VIP`
- `A`
- `AA`
- `18`
- `18-1`

그래서 이 프로젝트에서는 좌석 위치를 모두 `String`으로 처리하는 쪽이 안전하다.

| 필드 | 예시 | 타입 | 이유 |
| --- | --- | --- | --- |
| `seatFloor` | `1F`, `2F`, `B1` | `String` | 숫자형이 아닐 수 있다 |
| `seatSection` | `CENTER`, `LEFT`, `VIP` | `String` | 극장마다 구역 표기가 다르다 |
| `seatRow` | `A`, `B`, `AA` | `String` | 문자 기반 표기가 많다 |
| `seatNumber` | `18`, `18-1` | `String` | 단순 정수가 아닐 수 있다 |

저장 전에는 아래 정도의 정규화만 해도 충분하다.

```ts
export function normalizeSeatText(value: string) {
  return value.trim();
}

export function normalizeSeatToken(value: string) {
  return value.trim().toUpperCase();
}
```

사용 예시:

```ts
const seatFloor = normalizeSeatToken(input.seatFloor);
const seatSection = normalizeSeatToken(input.seatSection);
const seatRow = normalizeSeatToken(input.seatRow);
const seatNumber = normalizeSeatText(input.seatNumber);
```

이렇게 하면 `1f`, ` 1F ` 같은 흔들리는 입력을 어느 정도 줄일 수 있다.

---

## 6. DB 반영과 seed 데이터

스키마를 고쳤다면 DB에 반영해야 한다.

루트에서 DB를 먼저 켠다.

```powershell
npm run db:up
```

이미 `agentic-postgres` 컨테이너가 있는데 멈춰 있다면 아래처럼 켠다.

```powershell
docker start agentic-postgres
```

Nest API 의존성이 없다면 설치한다.

```powershell
npm run nest:install
```

그다음 `apps/nest-api`로 들어가 Prisma 명령을 실행한다.

```powershell
cd apps/nest-api
npx prisma migrate dev --name add-theater-performance-seat-metadata
npx prisma generate
```

seed 데이터를 넣는다.

```powershell
npm run db:seed
```

이 단계가 끝나면 최소한 아래 데이터가 들어가 있어야 한다.

- 극장 2개 이상
- 작품 2개 이상
- 극장과 작품을 연결하는 공연 조합 2개 이상

DB 상태를 눈으로 보고 싶으면 Prisma Studio를 켠다.

```powershell
npx prisma studio
```

---

## 7. NestJS metadata API 만들기

프론트에서 리뷰 작성 폼을 채우려면 먼저 조회 API가 필요하다.

추천 엔드포인트는 아래 3개다.

| 메서드 | 경로 | 용도 |
| --- | --- | --- |
| `GET` | `/theaters` | 공연장 목록 조회 |
| `GET` | `/musicals` | 작품 목록 조회 |
| `GET` | `/performances` | 공연 조합 목록 조회 |

`/performances`는 필터를 받을 수 있게 만든다.

예시:

- `/performances`
- `/performances?theaterId=1`
- `/performances?musicalId=1`
- `/performances?theaterId=1&musicalId=1`

### 7.1 폴더 구조

```text
apps/nest-api/src
  metadata/
    metadata.controller.ts
    metadata.module.ts
    metadata.service.ts
    dto/
      performance-query.dto.ts
```

### 7.2 `metadata.module.ts`

파일:

- `apps/nest-api/src/metadata/metadata.module.ts`

```ts
import { Module } from "@nestjs/common";
import { DatabaseModule } from "src/database/database.module";
import { MetadataController } from "./metadata.controller";
import { MetadataService } from "./metadata.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}
```

코드 설명:

`MetadataModule`은 metadata 기능을 Nest에 등록하는 조립 파일이다.
컨트롤러와 서비스를 하나의 기능 단위로 묶는다.

### 7.3 `performance-query.dto.ts`

파일:

- `apps/nest-api/src/metadata/dto/performance-query.dto.ts`

```ts
import { IsOptional, IsString } from "class-validator";

export class PerformanceQueryDto {
  @IsOptional()
  @IsString()
  theaterId?: string;

  @IsOptional()
  @IsString()
  musicalId?: string;
}
```

코드 설명:

`theaterId`와 `musicalId`는 필터 조건이다.
그래서 요청에 없어도 된다.

예를 들어 `/performances`는 전체 공연 목록을 가져오고,
`/performances?theaterId=1`은 특정 공연장의 공연만 가져온다.

쿼리스트링 값은 문자열로 들어온다.
서비스에서 Prisma 조건으로 쓸 때 `BigInt(...)`로 바꾼다.

### 7.4 `metadata.service.ts`

파일:

- `apps/nest-api/src/metadata/metadata.service.ts`

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { PerformanceQueryDto } from "./dto/performance-query.dto";

@Injectable()
export class MetadataService {
  constructor(private readonly prisma: PrismaService) {}

  async getTheaters() {
    const theaters = await this.prisma.theater.findMany({
      orderBy: { name: "asc" },
    });

    return theaters.map((theater) => ({
      id: theater.id.toString(),
      name: theater.name,
    }));
  }

  async getMusicals() {
    const musicals = await this.prisma.musical.findMany({
      orderBy: { title: "asc" },
    });

    return musicals.map((musical) => ({
      id: musical.id.toString(),
      name: musical.title,
    }));
  }

  async getPerformances(query: PerformanceQueryDto) {
    const where = {
      ...(query.theaterId ? { theaterId: BigInt(query.theaterId) } : {}),
      ...(query.musicalId ? { musicalId: BigInt(query.musicalId) } : {}),
    };

    const performances = await this.prisma.performance.findMany({
      where,
      include: {
        theater: true,
        musical: true,
      },
      orderBy: [{ theater: { name: "asc" } }, { musical: { title: "asc" } }],
    });

    return performances.map((performance) => ({
      id: performance.id.toString(),
      theaterId: performance.theaterId.toString(),
      theaterName: performance.theater.name,
      musicalId: performance.musicalId.toString(),
      musicalTitle: performance.musical.title,
    }));
  }
}
```

코드 설명:

`getTheaters()`는 공연장 목록을 이름순으로 가져온다.
응답에서는 `id`를 문자열로 바꾼다.

`getMusicals()`는 작품 목록을 제목순으로 가져온다.
DB 필드는 `title`이지만 프론트에서 공통 select 옵션으로 쓰기 쉽게 `name`으로 내려준다.

`getPerformances()`는 쿼리 조건에 따라 공연 조합을 가져온다.

```ts
const where = {
  ...(query.theaterId ? { theaterId: BigInt(query.theaterId) } : {}),
  ...(query.musicalId ? { musicalId: BigInt(query.musicalId) } : {}),
};
```

이 코드는 값이 있을 때만 조건을 붙인다.

예를 들어:

```ts
// query 없음
where = {}

// theaterId만 있음
where = { theaterId: 1n }

// musicalId만 있음
where = { musicalId: 2n }

// 둘 다 있음
where = { theaterId: 1n, musicalId: 2n }
```

`include`는 연결된 `theater`, `musical` 정보를 같이 가져오기 위해 쓴다.
그래야 응답에서 `theaterName`, `musicalTitle`을 바로 내려줄 수 있다.

### 7.5 `metadata.controller.ts`

파일:

- `apps/nest-api/src/metadata/metadata.controller.ts`

```ts
import { Controller, Get, Query } from "@nestjs/common";
import { MetadataService } from "./metadata.service";
import { PerformanceQueryDto } from "./dto/performance-query.dto";

@Controller()
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get("theaters")
  getTheaters() {
    return this.metadataService.getTheaters();
  }

  @Get("musicals")
  getMusicals() {
    return this.metadataService.getMusicals();
  }

  @Get("performances")
  getPerformances(@Query() query: PerformanceQueryDto) {
    return this.metadataService.getPerformances(query);
  }
}
```

코드 설명:

컨트롤러는 HTTP 요청을 받는 입구다.
직접 DB를 조회하지 않고 서비스에 일을 맡긴다.

요청 흐름은 아래와 같다.

```text
GET /theaters
  -> MetadataController.getTheaters()
  -> MetadataService.getTheaters()
  -> Prisma theater.findMany()
```

### 7.6 `app.module.ts`에 등록

파일:

- `apps/nest-api/src/app.module.ts`

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { MetadataModule } from "./metadata/metadata.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    MetadataModule,
  ],
})
export class AppModule {}
```

`MetadataModule`을 `imports`에 넣어야 `/theaters`, `/musicals`, `/performances` 라우트가 등록된다.

---

## 8. PowerShell로 API 확인하기

백엔드를 실행한다.

```powershell
npm run nest:start
```

다른 터미널에서 아래를 호출한다.

```powershell
Invoke-RestMethod http://localhost:3000/theaters
```

기대 결과 예시:

```json
[
  {
    "id": "1",
    "name": "샤롯데씨어터"
  },
  {
    "id": "2",
    "name": "두산아트센터"
  }
]
```

작품 목록:

```powershell
Invoke-RestMethod http://localhost:3000/musicals
```

공연 조합 목록:

```powershell
Invoke-RestMethod "http://localhost:3000/performances"
```

특정 공연장 기준 필터:

```powershell
Invoke-RestMethod "http://localhost:3000/performances?theaterId=1"
```

공연장과 작품을 함께 조건으로 거는 경우:

```powershell
Invoke-RestMethod "http://localhost:3000/performances?theaterId=1&musicalId=1"
```

확인할 것:

- 응답의 `id`가 숫자가 아니라 문자열인가
- `/musicals` 응답이 `{ id, name }` 형태인가
- `/performances` 응답에 `theaterName`, `musicalTitle`이 있는가
- 필터를 걸었을 때 목록이 줄어드는가
- 빈 배열이어도 서버 에러 없이 정상 응답하는가

---

## 9. 자주 만나는 백엔드 문제

### 9.1 `/theaters`가 500을 반환하는 경우

먼저 DB가 켜져 있는지 확인한다.

```powershell
docker start agentic-postgres
```

또는 compose로 실행한다.

```powershell
npm run db:up
```

Prisma가 `ECONNREFUSED`를 내면 Nest 코드 문제가 아니라 DB 연결 문제일 가능성이 크다.

### 9.2 `/performances`가 빈 배열인 경우

API는 정상인데 seed 데이터가 부족할 수 있다.
`performances` 테이블에 극장-작품 조합 데이터가 들어가 있는지 확인한다.

```powershell
cd apps/nest-api
npx prisma studio
```

### 9.3 `BigInt` 관련 JSON 에러가 나는 경우

응답으로 `BigInt`를 그대로 반환하면 JSON 변환에서 문제가 생길 수 있다.
API 응답에서는 항상 `.toString()`으로 바꿔 내려준다.

---

## 10. React에서 메타데이터를 실제 화면에 붙이기

여기서부터는 React 쪽이다. 이전 단계까지는 백엔드에서 `/theaters`, `/musicals`, `/performances`를 만들었다.

처음 배우는 단계에서는 모든 코드를 `ReviewCreatePage.tsx` 한 파일에 몰아넣어도 동작은 한다. 하지만 그 방식은 React의 장점을 잘 살린 구조라고 보기는 어렵다.

한 파일에 모든 것을 넣으면 아래 문제가 생긴다.

- API 호출 코드와 화면 코드가 섞인다.
- select UI가 늘어날수록 JSX가 길어진다.
- 좌석 입력 필드를 다른 화면에서 재사용하기 어렵다.
- 로딩, 에러, 선택값 초기화 로직을 테스트하거나 수정하기 어렵다.
- `ReviewCreatePage`가 너무 많은 책임을 갖게 된다.

그래서 이 문서에서는 React 코드를 아래처럼 나눈다.

```text
apps/web-react/src
  shared/
    api.ts
  features/
    reviews/
      api.ts
      types.ts
      hooks/
        useReviewMetadata.ts
      components/
        MetadataSelects.tsx
        SeatLocationFields.tsx
        DraftPayloadPreview.tsx
      ReviewCreatePage.tsx
  App.tsx
```

각 파일의 책임은 이렇다.

| 파일 | 책임 |
| --- | --- |
| `shared/api.ts` | `fetch` 공통 처리 |
| `features/reviews/types.ts` | API 응답과 폼 데이터 타입 정의 |
| `features/reviews/api.ts` | metadata API 경로를 함수로 감싸기 |
| `features/reviews/hooks/useReviewMetadata.ts` | 극장/작품/공연 목록 로딩과 로딩/에러 상태 관리 |
| `features/reviews/components/MetadataSelects.tsx` | 극장, 작품, 공연 select UI |
| `features/reviews/components/SeatLocationFields.tsx` | 좌석 위치 입력 UI |
| `features/reviews/components/DraftPayloadPreview.tsx` | 제출 전에 만들어진 payload 확인 UI |
| `features/reviews/ReviewCreatePage.tsx` | 페이지 조립과 제출 처리 |

핵심 기준은 단순하다.

```text
데이터를 가져오는 로직은 hook으로 뺀다.
반복되거나 의미 있는 UI 묶음은 component로 뺀다.
페이지 파일은 전체 흐름을 조립하는 역할만 맡긴다.
```

실행 전제는 아래와 같다.

```powershell
# 1. DB 실행
npm run db:up

# 이미 컨테이너가 있는데 멈춰 있다면
# docker start agentic-postgres

# 2. Nest API 실행
npm run nest:start

# 3. React 실행
npm run web:dev
```

브라우저는 보통 아래 주소로 연다.

```text
http://localhost:5173
```

Nest의 CORS 설정이 `http://localhost:5173`만 허용하고 있으므로, Vite가 다른 포트로 뜨면 `apps/nest-api/src/main.ts`의 CORS origin도 같이 맞춰야 한다.

### 10.1 API 호출 함수 만들기

파일:

- `apps/web-react/src/shared/api.ts`

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type ApiErrorResponse = {
  message?: string | string[];
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as ApiErrorResponse | T | null;

  if (!response.ok) {
    const errorMessage = (data as ApiErrorResponse | null)?.message;
    const message = Array.isArray(errorMessage) ? errorMessage.join(", ") : errorMessage;

    throw new Error(message ?? "API request failed.");
  }

  return data as T;
}
```

코드 설명:

`apiRequest()`는 React 앱 전체에서 공통으로 쓰는 요청 함수다.

```ts
apiRequest<TheaterOption[]>("/theaters");
```

이렇게 쓰면 `http://localhost:3000/theaters`로 요청을 보내고, 응답을 `TheaterOption[]` 타입으로 받겠다는 뜻이다.

`response`는 서버에서 받은 HTTP 응답 전체다. `response.json()`을 호출해야 응답 body를 JavaScript 객체나 배열로 꺼낼 수 있다.

`response.ok`가 false이면 400, 401, 404, 500 같은 실패 응답이다. 이때 백엔드가 내려준 `message`를 꺼내 `Error`로 던진다.


### 10.2 API 응답 타입 만들기

파일:

- `apps/web-react/src/features/reviews/types.ts`

```ts
export type TheaterOption = {
  id: string;
  name: string;
};

export type MusicalOption = {
  id: string;
  name: string;
};

export type PerformanceOption = {
  id: string;
  theaterId: string;
  theaterName: string;
  musicalId: string;
  musicalTitle: string;
};

export type SeatLocationDraft = {
  seatFloor: string;
  seatSection: string;
  seatRow: string;
  seatNumber: string;
};

export type ReviewDraftPayload = {
  theaterId: string;
  musicalId: string;
  performanceId: string;
} & SeatLocationDraft;
```

코드 설명:

이 파일은 실행 로직이 아니라 타입 약속을 모아두는 파일이다.

`TheaterOption`은 `/theaters` 응답 한 개의 모양이다.

```ts
{
  id: "1",
  name: "샤롯데씨어터"
}
```

`MusicalOption`도 `name`을 쓴다. DB에서는 작품명이 `title`이지만, 현재 백엔드 API는 프론트가 select 옵션으로 쓰기 쉽게 `{ id, name }` 형태로 내려준다.

`PerformanceOption`은 공연 조합 select에 들어갈 데이터다.

`SeatLocationDraft`는 좌석 위치 입력값만 따로 묶은 타입이다. 이렇게 분리하면 나중에 좌석 입력 컴포넌트의 props 타입으로 재사용할 수 있다.

`ReviewDraftPayload`는 다음 단계에서 리뷰 저장 API로 보내게 될 값의 기본 형태다.

`id`들이 모두 `string`인 이유는 백엔드에서 Prisma `BigInt` 값을 `.toString()`으로 바꿔 내려주기 때문이다.

### 10.3 metadata API 함수 분리하기

파일:

- `apps/web-react/src/features/reviews/api.ts`

```ts
import { apiRequest } from "../../shared/api";
import type { MusicalOption, PerformanceOption, TheaterOption } from "./types";

export function getTheaters() {
  return apiRequest<TheaterOption[]>("/theaters");
}

export function getMusicals() {
  return apiRequest<MusicalOption[]>("/musicals");
}

type GetPerformancesParams = {
  theaterId?: string;
  musicalId?: string;
};

export function getPerformances(params: GetPerformancesParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.theaterId) {
    searchParams.set("theaterId", params.theaterId);
  }

  if (params.musicalId) {
    searchParams.set("musicalId", params.musicalId);
  }

  const queryString = searchParams.toString();
  const path = queryString ? `/performances?${queryString}` : "/performances";

  return apiRequest<PerformanceOption[]>(path);
}
```

코드 설명:

이 파일은 API 경로를 직접 문자열로 흩뿌리지 않기 위해 만든다.

컴포넌트에서 매번 아래처럼 쓰면:

```ts
apiRequest<PerformanceOption[]>(`/performances?theaterId=${theaterId}`);
```

쿼리스트링 만드는 방식이 여러 곳에 퍼진다.

그래서 API 경로 조립은 `getPerformances()` 안에 숨긴다. 화면 컴포넌트는 그냥 이렇게 호출하면 된다.

```ts
getPerformances({ theaterId: selectedTheaterId, musicalId: selectedMusicalId });
```

`URLSearchParams`는 쿼리스트링을 안전하게 만들기 위해 쓴다.

선택값에 따라 아래 요청이 자동으로 만들어진다.

```text
/performances
/performances?theaterId=1
/performances?musicalId=2
/performances?theaterId=1&musicalId=2
```

### 10.4 metadata 로딩 hook 만들기

파일:

- `apps/web-react/src/features/reviews/hooks/useReviewMetadata.ts`

```ts
import { useEffect, useState } from "react";
import { getMusicals, getPerformances, getTheaters } from "../api";
import type { MusicalOption, PerformanceOption, TheaterOption } from "../types";

export function useReviewMetadata(selectedTheaterId: string, selectedMusicalId: string) {
  const [theaters, setTheaters] = useState<TheaterOption[]>([]);
  const [musicals, setMusicals] = useState<MusicalOption[]>([]);
  const [performances, setPerformances] = useState<PerformanceOption[]>([]);

  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isLoadingPerformances, setIsLoadingPerformances] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMetadata() {
      try {
        setError("");
        setIsLoadingMetadata(true);

        const [theaterData, musicalData] = await Promise.all([getTheaters(), getMusicals()]);

        setTheaters(theaterData);
        setMusicals(musicalData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "메타데이터를 불러오지 못했습니다.");
      } finally {
        setIsLoadingMetadata(false);
      }
    }

    void loadMetadata();
  }, []);

  useEffect(() => {
    async function loadPerformances() {
      try {
        setError("");
        setIsLoadingPerformances(true);

        const performanceData = await getPerformances({
          theaterId: selectedTheaterId,
          musicalId: selectedMusicalId,
        });

        setPerformances(performanceData);
      } catch (err) {
        setPerformances([]);
        setError(err instanceof Error ? err.message : "공연 목록을 불러오지 못했습니다.");
      } finally {
        setIsLoadingPerformances(false);
      }
    }

    void loadPerformances();
  }, [selectedTheaterId, selectedMusicalId]);

  return {
    theaters,
    musicals,
    performances,
    isLoadingMetadata,
    isLoadingPerformances,
    error,
  };
}
```

코드 설명:

이 hook은 서버에서 메타데이터를 가져오는 책임만 가진다.

`ReviewCreatePage` 안에 API 로딩 로직을 모두 넣으면 페이지가 너무 길어진다. 그래서 `useReviewMetadata()`로 분리한다.

첫 번째 `useEffect`는 처음 렌더링될 때 한 번만 실행된다.

```ts
const [theaterData, musicalData] = await Promise.all([getTheaters(), getMusicals()]);
```

공연장 목록과 작품 목록은 서로 의존하지 않으므로 동시에 불러온다.

두 번째 `useEffect`는 `selectedTheaterId`, `selectedMusicalId`가 바뀔 때마다 실행된다.

```ts
}, [selectedTheaterId, selectedMusicalId]);
```

즉 사용자가 공연장이나 작품을 바꾸면 공연 조합 목록을 다시 불러온다.

이 hook은 `selectedPerformanceId`를 직접 초기화하지 않는다. 그 선택값은 페이지의 폼 상태이므로 페이지 컴포넌트에서 초기화하는 편이 더 명확하다.

### 10.5 극장/작품/공연 select 컴포넌트 만들기

파일:

- `apps/web-react/src/features/reviews/components/MetadataSelects.tsx`

```tsx
import type { MusicalOption, PerformanceOption, TheaterOption } from "../types";

type MetadataSelectsProps = {
  theaters: TheaterOption[];
  musicals: MusicalOption[];
  performances: PerformanceOption[];
  selectedTheaterId: string;
  selectedMusicalId: string;
  selectedPerformanceId: string;
  isLoadingPerformances: boolean;
  onChangeTheaterId: (value: string) => void;
  onChangeMusicalId: (value: string) => void;
  onChangePerformanceId: (value: string) => void;
};

export default function MetadataSelects({
  theaters,
  musicals,
  performances,
  selectedTheaterId,
  selectedMusicalId,
  selectedPerformanceId,
  isLoadingPerformances,
  onChangeTheaterId,
  onChangeMusicalId,
  onChangePerformanceId,
}: MetadataSelectsProps) {
  return (
    <section>
      <label>
        공연장
        <select value={selectedTheaterId} onChange={(event) => onChangeTheaterId(event.target.value)}>
          <option value="">공연장을 선택하세요</option>
          {theaters.map((theater) => (
            <option key={theater.id} value={theater.id}>
              {theater.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        작품
        <select value={selectedMusicalId} onChange={(event) => onChangeMusicalId(event.target.value)}>
          <option value="">작품을 선택하세요</option>
          {musicals.map((musical) => (
            <option key={musical.id} value={musical.id}>
              {musical.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        공연 조합
        <select value={selectedPerformanceId} onChange={(event) => onChangePerformanceId(event.target.value)}>
          <option value="">공연 조합을 선택하세요</option>
          {performances.map((performance) => (
            <option key={performance.id} value={performance.id}>
              {performance.theaterName} / {performance.musicalTitle}
            </option>
          ))}
        </select>
      </label>

      {isLoadingPerformances ? <p>공연 목록을 불러오는 중입니다.</p> : null}
    </section>
  );
}
```

코드 설명:

이 컴포넌트는 select UI만 담당한다.

중요한 점은 이 컴포넌트가 직접 API를 호출하지 않는다는 것이다. 데이터는 props로 받고, 사용자가 선택을 바꾸면 `onChange...` 콜백으로 부모에게 알려준다.

이런 컴포넌트를 controlled component라고 볼 수 있다.

```tsx
<select value={selectedTheaterId} onChange={(event) => onChangeTheaterId(event.target.value)}>
```

현재 선택값은 부모가 들고 있고, 변경 이벤트도 부모가 처리한다. 그래서 페이지 전체의 상태 흐름을 추적하기 쉽다.

### 10.6 좌석 위치 입력 컴포넌트 만들기

파일:

- `apps/web-react/src/features/reviews/components/SeatLocationFields.tsx`

```tsx
import type { SeatLocationDraft } from "../types";

type SeatLocationFieldsProps = {
  value: SeatLocationDraft;
  onChange: (value: SeatLocationDraft) => void;
};

export default function SeatLocationFields({ value, onChange }: SeatLocationFieldsProps) {
  return (
    <section>
      <label>
        층
        <input
          value={value.seatFloor}
          onChange={(event) => onChange({ ...value, seatFloor: event.target.value })}
          placeholder="1F"
        />
      </label>

      <label>
        구역
        <input
          value={value.seatSection}
          onChange={(event) => onChange({ ...value, seatSection: event.target.value })}
          placeholder="CENTER"
        />
      </label>

      <label>
        열
        <input
          value={value.seatRow}
          onChange={(event) => onChange({ ...value, seatRow: event.target.value })}
          placeholder="F"
        />
      </label>

      <label>
        번호
        <input
          value={value.seatNumber}
          onChange={(event) => onChange({ ...value, seatNumber: event.target.value })}
          placeholder="18"
        />
      </label>
    </section>
  );
}
```

코드 설명:

좌석 위치는 4개 필드가 한 묶음이다. 그래서 `seatFloor`, `seatSection`, `seatRow`, `seatNumber`를 각각 따로 props로 넘기기보다 `value` 하나로 묶어 넘긴다.

```ts
value: SeatLocationDraft;
```

값이 바뀔 때는 기존 값을 복사하고 바뀐 필드만 덮어쓴다.

```tsx
onChange({ ...value, seatFloor: event.target.value })
```

이렇게 하면 나머지 좌석 입력값은 유지되고 `seatFloor`만 바뀐다.

### 10.7 payload 미리보기 컴포넌트 만들기

파일:

- `apps/web-react/src/features/reviews/components/DraftPayloadPreview.tsx`

```tsx
import type { ReviewDraftPayload } from "../types";

type DraftPayloadPreviewProps = {
  payload: ReviewDraftPayload | null;
};

export default function DraftPayloadPreview({ payload }: DraftPayloadPreviewProps) {
  if (!payload) {
    return null;
  }

  return (
    <section>
      <h2>나중에 저장 API로 보낼 값</h2>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </section>
  );
}
```

코드 설명:

이 컴포넌트는 제출 결과 미리보기만 담당한다.

`payload`가 없으면 아무것도 렌더링하지 않는다.

```tsx
if (!payload) {
  return null;
}
```

`JSON.stringify(payload, null, 2)`는 객체를 보기 좋은 JSON 문자열로 바꾼다.

### 10.8 페이지 컴포넌트 조립하기

파일:

- `apps/web-react/src/features/reviews/ReviewCreatePage.tsx`

```tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import DraftPayloadPreview from "./components/DraftPayloadPreview";
import MetadataSelects from "./components/MetadataSelects";
import SeatLocationFields from "./components/SeatLocationFields";
import { useReviewMetadata } from "./hooks/useReviewMetadata";
import type { ReviewDraftPayload, SeatLocationDraft } from "./types";

function normalizeSeatText(value: string) {
  return value.trim();
}

function normalizeSeatToken(value: string) {
  return value.trim().toUpperCase();
}

const initialSeatLocation: SeatLocationDraft = {
  seatFloor: "",
  seatSection: "",
  seatRow: "",
  seatNumber: "",
};

export default function ReviewCreatePage() {
  const [selectedTheaterId, setSelectedTheaterId] = useState("");
  const [selectedMusicalId, setSelectedMusicalId] = useState("");
  const [selectedPerformanceId, setSelectedPerformanceId] = useState("");
  const [seatLocation, setSeatLocation] = useState<SeatLocationDraft>(initialSeatLocation);
  const [previewPayload, setPreviewPayload] = useState<ReviewDraftPayload | null>(null);

  const {
    theaters,
    musicals,
    performances,
    isLoadingMetadata,
    isLoadingPerformances,
    error,
  } = useReviewMetadata(selectedTheaterId, selectedMusicalId);

  useEffect(() => {
    setSelectedPerformanceId("");
  }, [selectedTheaterId, selectedMusicalId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: ReviewDraftPayload = {
      theaterId: selectedTheaterId,
      musicalId: selectedMusicalId,
      performanceId: selectedPerformanceId,
      seatFloor: normalizeSeatToken(seatLocation.seatFloor),
      seatSection: normalizeSeatToken(seatLocation.seatSection),
      seatRow: normalizeSeatToken(seatLocation.seatRow),
      seatNumber: normalizeSeatText(seatLocation.seatNumber),
    };

    setPreviewPayload(payload);
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>좌석 리뷰 작성</h1>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {isLoadingMetadata ? <p>공연장과 작품 목록을 불러오는 중입니다.</p> : null}

      <form onSubmit={handleSubmit}>
        <MetadataSelects
          theaters={theaters}
          musicals={musicals}
          performances={performances}
          selectedTheaterId={selectedTheaterId}
          selectedMusicalId={selectedMusicalId}
          selectedPerformanceId={selectedPerformanceId}
          isLoadingPerformances={isLoadingPerformances}
          onChangeTheaterId={setSelectedTheaterId}
          onChangeMusicalId={setSelectedMusicalId}
          onChangePerformanceId={setSelectedPerformanceId}
        />

        <SeatLocationFields value={seatLocation} onChange={setSeatLocation} />

        <button type="submit">작성 값 확인</button>
      </form>

      <DraftPayloadPreview payload={previewPayload} />
    </main>
  );
}
```

코드 설명:

이제 `ReviewCreatePage`는 모든 UI를 직접 들고 있지 않는다. 대신 필요한 컴포넌트들을 조립한다.

```tsx
<MetadataSelects ... />
<SeatLocationFields ... />
<DraftPayloadPreview ... />
```

서버 데이터 로딩도 직접 하지 않는다.

```ts
const { theaters, musicals, performances } = useReviewMetadata(selectedTheaterId, selectedMusicalId);
```

`useReviewMetadata()` hook이 API 호출과 로딩 상태를 담당한다.

공연장이나 작품이 바뀌면 이전 공연 선택값을 지운다.

```ts
useEffect(() => {
  setSelectedPerformanceId("");
}, [selectedTheaterId, selectedMusicalId]);
```

이 로직은 페이지에 남겨두는 편이 자연스럽다. `selectedPerformanceId`는 API 데이터가 아니라 폼 선택 상태이기 때문이다.

`handleSubmit()`에서는 흩어진 상태들을 모아서 다음 단계의 리뷰 저장 API가 받을 payload를 만든다.

```ts
const payload: ReviewDraftPayload = {
  theaterId: selectedTheaterId,
  musicalId: selectedMusicalId,
  performanceId: selectedPerformanceId,
  seatFloor: normalizeSeatToken(seatLocation.seatFloor),
  seatSection: normalizeSeatToken(seatLocation.seatSection),
  seatRow: normalizeSeatToken(seatLocation.seatRow),
  seatNumber: normalizeSeatText(seatLocation.seatNumber),
};
```

이 정도는 페이지 컴포넌트에 있어도 괜찮다. 제출 시 어떤 payload를 만들지 결정하는 것은 페이지의 책임에 가깝기 때문이다.

### 10.9 `App.tsx`에 화면 연결하기

여기까지 만들면 `ReviewCreatePage` 파일은 존재하지만, 아직 React 앱의 URL 흐름에는 연결되지 않았다.

처음 확인만 할 때는 `App.tsx`에서 `AuthPage` 대신 `ReviewCreatePage`를 바로 렌더링해도 된다. 하지만 그 방식은 임시 확인용이다.

정식으로 연결하려면 라우터를 둔다.

이 단계에서는 아직 후기 CRUD를 만들지 않았다. 그래도 연결할 수 있다. 현재 `ReviewCreatePage`는 실제 후기를 저장하는 화면이라기보다, 후기 작성에 필요한 메타데이터를 고르고 다음 단계의 `POST /seat-reviews`가 받을 payload를 미리 만들어보는 화면이기 때문이다.

즉 지금 가능한 범위는 아래와 같다.

- `/theaters` 조회
- `/musicals` 조회
- `/performances` 조회
- 극장, 작품, 공연 선택
- 좌석 위치 입력
- 제출 payload 미리보기

아직 하지 않는 범위는 아래다.

- `POST /seat-reviews`로 실제 후기 저장
- `GET /seat-reviews`로 후기 목록 조회
- `PATCH /seat-reviews/:id`로 후기 수정
- `DELETE /seat-reviews/:id`로 후기 삭제

그래서 이 단계의 URL은 `리뷰 저장 화면`이라기보다 `리뷰 작성 초안 화면`으로 이해하면 된다.

권장 경로는 아래처럼 둔다.

```text
/              -> 로그인 / 회원가입 화면
/reviews/new   -> 리뷰 작성 초안 화면
```

먼저 라우터 패키지를 설치한다.

```powershell
cd apps/web-react
npm install react-router-dom
```

파일:

- `apps/web-react/src/App.tsx`

기존에는 인증 화면만 렌더링하고 있을 수 있다.

```tsx
import AuthPage from "./features/auth/AuthPage";

export default function App() {
  return <AuthPage />;
}
```

임시 확인용으로는 아래처럼 바꿀 수 있다.

```tsx
import ReviewCreatePage from "./features/reviews/ReviewCreatePage";

export default function App() {
  return <ReviewCreatePage />;
}
```

하지만 정식 연결은 아래처럼 라우터로 처리한다.

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./features/auth/AuthPage";
import ReviewCreatePage from "./features/reviews/ReviewCreatePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/reviews/new" element={<ReviewCreatePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

이렇게 하면 브라우저에서 아래 주소로 리뷰 작성 초안 화면을 열 수 있다.

```text
http://localhost:5173/reviews/new
```

파일만 만들어두고 `App.tsx`에 연결하지 않으면 브라우저에서는 결과물이 보이지 않는다.

이 단계에서는 아직 로그인 여부에 따라 `/reviews/new` 접근을 막지 않는다. 보호 라우트는 후기 CRUD와 인증 상태 공유 구조를 붙일 때 추가한다.

나중에는 흐름을 아래처럼 바꿀 수 있다.

```text
로그인 성공 -> /reviews/new 이동
비로그인 상태에서 /reviews/new 접근 -> / 로 이동
```

하지만 지금은 메타데이터 API 연결 확인이 목적이므로, 먼저 `/reviews/new`가 열리고 select 목록이 채워지는지 확인한다.

### 10.10 화면에서 확인할 것

React 개발 서버를 켠다.

```powershell
npm run web:dev
```

브라우저에서 아래를 연다.

```text
http://localhost:5173
```

정식 라우터 연결까지 했다면 리뷰 작성 초안 화면은 아래 주소로 연다.

```text
http://localhost:5173/reviews/new
```

정상이라면 다음 흐름이 보여야 한다.

1. 공연장 select에 `/theaters` 응답이 들어온다.
2. 작품 select에 `/musicals` 응답이 들어온다.
3. 공연장이나 작품을 고르면 `/performances?...`가 다시 호출된다.
4. 공연 조합 select에 `공연장 / 작품` 형태의 옵션이 들어온다.
5. 좌석 위치를 입력하고 `작성 값 확인`을 누르면 아래에 JSON이 보인다.

예상 JSON은 이런 형태다.

```json
{
  "theaterId": "1",
  "musicalId": "1",
  "performanceId": "1",
  "seatFloor": "1F",
  "seatSection": "CENTER",
  "seatRow": "F",
  "seatNumber": "18"
}
```

### 10.11 React에서 자주 막히는 지점

`/theaters`가 500이면 React 문제가 아니라 백엔드나 DB 문제일 가능성이 높다. 먼저 아래가 되는지 확인한다.

```powershell
Invoke-RestMethod http://localhost:3000/theaters
```

여기서 `ECONNREFUSED` 계열 문제가 나면 Postgres가 꺼져 있을 수 있다.

```powershell
docker start agentic-postgres
```

React 화면에서 `Failed to fetch`가 나오면 CORS나 백엔드 실행 상태를 확인한다. Nest가 `localhost:3000`에서 켜져 있어야 하고, Vite는 CORS에 허용된 `localhost:5173`으로 접속해야 한다.

작품 이름이 안 보이면 타입과 응답 필드명이 안 맞는 것이다. 현재 백엔드는 뮤지컬을 아래처럼 내려준다.

```json
{
  "id": "1",
  "name": "Hadestown"
}
```

그러므로 React에서는 `musical.title`이 아니라 `musical.name`을 써야 한다.

공연 조합 select가 비어 있으면 `/performances` 응답을 먼저 확인한다.

```powershell
Invoke-RestMethod "http://localhost:3000/performances"
```

응답이 빈 배열이면 DB에 `performances` seed 데이터가 없는 것이다. 이 경우 `apps/nest-api/prisma/seed.ts`나 추가 seed 스크립트를 실행해서 공연장-작품 조합 데이터를 넣어야 한다.

### 10.12 이 정도로 나누는 이유

무조건 파일을 많이 나누는 것이 좋은 것은 아니다. 하지만 여기서는 나누는 편이 좋다.

이유는 책임이 실제로 다르기 때문이다.

- `shared/api.ts`: HTTP 요청 공통 처리
- `features/reviews/api.ts`: metadata API 경로 조립
- `features/reviews/hooks/useReviewMetadata.ts`: 서버 데이터 로딩과 로딩/에러 상태
- `features/reviews/components/MetadataSelects.tsx`: select UI
- `features/reviews/components/SeatLocationFields.tsx`: 좌석 입력 UI
- `features/reviews/ReviewCreatePage.tsx`: 페이지 흐름과 제출 처리

반대로 아래처럼 너무 작게 나누는 것은 아직 과하다.

- `TheaterSelect.tsx`
- `MusicalSelect.tsx`
- `PerformanceSelect.tsx`
- `SeatFloorInput.tsx`
- `SeatSectionInput.tsx`
- `SeatRowInput.tsx`
- `SeatNumberInput.tsx`

지금 단계에서는 `MetadataSelects`, `SeatLocationFields` 정도의 묶음이 적당하다. 의미 있는 단위로 나누되, 파일 수만 늘리지는 않는 균형이 좋다.

---
## 11. 나중에 리뷰 저장 API로 보내게 될 값

이번 단계에서는 아직 리뷰 저장 API를 완성하지 않아도 된다.
하지만 다음 단계에서 어떤 값을 보내게 될지는 미리 알아두는 것이 좋다.

리뷰 작성 요청 body는 대략 아래 형태가 된다.

```json
{
  "theaterId": "1",
  "musicalId": "1",
  "performanceId": "1",
  "seatFloor": "1F",
  "seatSection": "CENTER",
  "seatRow": "F",
  "seatNumber": "18",
  "viewRating": 5,
  "soundRating": 5,
  "comfortRating": 4,
  "expressionRating": 5,
  "stageVisibilityRating": 5,
  "content": "무대 전체가 잘 보이고 배우 표정도 잘 보였어요."
}
```

즉 이번 단계의 메타데이터는 나중에 리뷰 본문과 함께 저장될 요청 body의 기반이다.

메타데이터 구조가 흔들리면 이후 CRUD도 흔들린다.
반대로 메타데이터가 단단하면 다음 단계에서는 DTO, Guard, Service, Controller를 이어 붙이기 훨씬 쉽다.

---

## 12. 자주 하는 실수

| 실수 | 문제 | 해결 |
| --- | --- | --- |
| 공연장 이름을 리뷰 본문에 문자열로 저장 | 중복과 오타가 생긴다 | `theaterId` FK 사용 |
| 작품 이름을 문자열로 직접 입력받음 | 검색과 필터가 흔들린다 | `musicalId` FK 사용 |
| `Performance` 없이 리뷰 저장 | 극장-작품 조합 검색이 어려워진다 | `performanceId` 사용 |
| 좌석 위치를 하나의 문자열로 저장 | 필터링이 어렵다 | 4개 필드로 분리 |
| 좌석 번호를 `Int`로 저장 | `18-1`, `A1` 같은 값을 잃는다 | `String` 사용 |
| `BigInt`를 그대로 JSON 응답 | 직렬화 에러가 난다 | `.toString()` 사용 |
| 극장/작품 변경 후 공연 선택 유지 | 잘못된 조합이 저장된다 | 선택 조건 변경 시 `selectedPerformanceId` 초기화 |
| React에서 `musical.title` 사용 | 화면에 작품명이 안 보인다 | 현재 API 기준 `musical.name` 사용 |

---

## 13. 체크리스트

- [ ] `schema.prisma`에 `Theater`, `Musical`, `Performance` 구조가 있다.
- [ ] `SeatReview`에 `theaterId`, `musicalId`, `performanceId`, `seatFloor`, `seatSection`, `seatRow`, `seatNumber`가 있다.
- [ ] `Performance`에 `@@unique([musicalId, theaterId])`가 있다.
- [ ] DB 마이그레이션 또는 동기화가 끝났다.
- [ ] seed 실행 후 극장, 작품, 공연 조합 데이터가 들어갔다.
- [ ] `GET /theaters`가 동작한다.
- [ ] `GET /musicals`가 동작한다.
- [ ] `GET /performances`가 동작한다.
- [ ] `GET /performances?theaterId=...&musicalId=...` 필터가 동작한다.
- [ ] API 응답의 `id`가 문자열로 내려온다.
- [ ] React에서 극장/작품/공연 선택 상태를 분리해 관리한다.
- [ ] React에서 좌석 위치 입력 필드를 4개로 나눈다.
- [ ] React에서 공연장/작품 변경 시 기존 공연 선택값을 초기화한다.

---

## 14. 완료 기준

아래 질문에 모두 "그렇다"라고 답할 수 있으면 이번 단계는 끝난 것이다.

1. 리뷰 한 건이 어떤 극장, 어떤 작품, 어떤 공연 조합에 대한 것인지 FK로 표현할 수 있는가.
2. 좌석 위치가 문자열 기반 4개 필드로 일관되게 저장되는가.
3. 프론트가 select를 채울 수 있도록 극장/작품/공연 조회 API가 준비되어 있는가.
4. PowerShell에서 `/theaters`, `/musicals`, `/performances`를 직접 호출했을 때 정상 응답하는가.
5. React에서 metadata를 불러와 사용자가 선택할 수 있는 화면을 만들 수 있는가.
6. 다음 단계에서 리뷰 CRUD를 만들 때 메타데이터 구조를 다시 고민하지 않아도 되는가.

이 기준을 만족하면 이제 [004_seat_review_crud.md](./004_seat_review_crud.md)로 넘어가서 실제 리뷰 생성, 조회, 수정, 삭제를 붙이면 된다.
