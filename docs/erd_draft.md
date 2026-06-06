# 뮤지컬 좌석 후기 게시판 ERD Draft

## 1. 문서 목적

이 문서는 뮤지컬 좌석 후기 게시판 서비스의 초기 ERD 초안을 정리한 문서다.

핵심 목표는 좌석 후기를 구조적으로 저장할 수 있는 기본 스키마를 먼저 설계하고,
이후 RAG, MCP, Agent 기능까지 자연스럽게 확장될 수 있도록
검색용 문서와 임베딩 구조까지 함께 고려하는 것이다.

## 2. 설계 방향

- 일반 게시글 중심 구조가 아니라 `좌석 후기` 중심 구조로 설계한다.
- 극장, 작품, 공연, 좌석 위치를 분리해 좌석 후기를 구조적으로 검색할 수 있어야 한다.
- 시야, 음향, 좌석 편의성, 배우 표정, 무대 체감 같은 평가 항목을 컬럼으로 저장할 수 있어야 한다.
- 특정 배역이나 배우를 더 잘 보기 좋은 방향을 묻는 질문에 대응할 수 있어야 한다.
- 사용자가 작품명을 포함했는지 여부에 따라 검색 범위를 다르게 가져갈 수 있어야 한다.
- 초기 MVP는 단순하게 시작하되, RAG와 Agent가 붙었을 때 구조를 크게 뒤엎지 않도록 한다.

## 3. 핵심 엔터티

- `users`
- `theaters`
- `musicals`
- `performances`
- `characters`
- `actors`
- `performance_casts`
- `seat_reviews`
- `seat_review_focuses`
- `comments`
- `tags`
- `seat_review_tags`
- `documents`
- `embeddings`

## 4. 테이블 설명

### 4.1 users

사용자 계정 정보를 저장하는 테이블이다.

주요 역할:
- 회원가입 / 로그인
- 후기 작성자 식별
- 댓글 작성자 식별
- 수정 / 삭제 권한 체크

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| email | varchar | 로그인 이메일, unique |
| password_hash | varchar | 비밀번호 해시 |
| nickname | varchar | 사용자 닉네임 |
| role | varchar | 권한 구분, 예: user, admin |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

### 4.2 theaters

극장 기본 정보를 저장하는 테이블이다.

주요 역할:
- 극장명 관리
- 외부 좌석 배치도 및 MCP 연동 기준
- 좌석 후기의 상위 분류 기준

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| name | varchar | 극장명, unique 권장 |
| venue_company | varchar | 운영사 또는 공연장 그룹, nullable |
| region | varchar | 지역 정보, nullable |
| address | varchar | 주소, nullable |
| seat_map_source_url | varchar | 외부 좌석 배치도 URL, nullable |
| metadata_json | jsonb | 극장 구조 메타데이터, nullable |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

### 4.3 musicals

작품 정보를 저장하는 테이블이다.

주요 역할:
- 작품명 기준 후기 검색
- 작품별 질문과 일반 좌석 질문을 구분하는 기준

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| title | varchar | 작품명 |
| original_title | varchar | 원제, nullable |
| description | text | 작품 설명, nullable |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

권장 제약:
- `title` index

### 4.4 performances

특정 작품이 특정 극장에서 올라간 공연 단위를 저장하는 테이블이다.

주요 역할:
- 같은 작품이라도 극장이나 시즌이 다를 때 구분
- 작품명 포함 질문에서 검색 범위를 좁히는 기준

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| musical_id | bigint | musicals.id FK |
| theater_id | bigint | theaters.id FK |
| season_label | varchar | 시즌 또는 프로덕션명, nullable |
| start_date | date | 공연 시작일, nullable |
| end_date | date | 공연 종료일, nullable |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

### 4.5 characters

작품 속 배역 또는 캐릭터 정보를 저장하는 테이블이다.

주요 역할:
- "올리버가 잘 보이는 쪽" 같은 질문 대응
- 특정 배역 기준 좌우 추천 검색

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| musical_id | bigint | musicals.id FK |
| name | varchar | 배역명 |
| created_at | timestamp | 생성일 |

권장 제약:
- `(musical_id, name)` unique

### 4.6 actors

배우 정보를 저장하는 테이블이다.

주요 역할:
- 배우별 후기 검색
- 같은 배역이어도 배우가 다른 경우 구분

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| name | varchar | 배우명 |
| created_at | timestamp | 생성일 |

권장 제약:
- `name` unique 또는 index

### 4.7 performance_casts

공연 단위에서 어떤 배우가 어떤 배역을 맡는지 저장하는 매핑 테이블이다.

주요 역할:
- 공연별 캐스팅 정보 관리
- 배우명 / 배역명 질문에서 작품 범위를 더 정확하게 좁히는 기준

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| performance_id | bigint | performances.id FK |
| character_id | bigint | characters.id FK |
| actor_id | bigint | actors.id FK |
| created_at | timestamp | 생성일 |

권장 제약:
- `(performance_id, character_id, actor_id)` unique

### 4.8 seat_reviews

서비스의 핵심인 좌석 후기 본문과 평가 데이터를 저장하는 테이블이다.

주요 역할:
- 좌석 후기 CRUD
- 좌석 위치 기반 검색
- 시야 / 음향 / 편의성 / 표정 / 무대 체감 구조화
- RAG 검색의 핵심 소스

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| author_id | bigint | users.id FK |
| theater_id | bigint | theaters.id FK |
| musical_id | bigint | musicals.id FK, nullable |
| performance_id | bigint | performances.id FK, nullable |
| seat_floor | varchar | 층 |
| seat_section | varchar | 구역 또는 블록 |
| seat_row | varchar | 열 |
| seat_number | varchar | 번호 |
| view_rating | smallint | 시야 평가 |
| sound_rating | smallint | 음향 평가 |
| comfort_rating | smallint | 좌석 편의성 평가 |
| expression_rating | smallint | 배우 표정 체감 평가 |
| stage_visibility_rating | smallint | 무대 전체 체감 평가 |
| side_preference | varchar | left, right, center, none |
| has_obstruction | boolean | 시야 방해 여부 |
| obstruction_note | text | 시야 방해 상세 메모, nullable |
| comfort_note | text | 장시간 착석감 메모, nullable |
| content | text | 후기 본문 |
| visit_date | date | 관람일, nullable |
| revisit_intent | boolean | 재관람 의사, nullable |
| view_count | int | 조회수, 기본값 0 |
| is_deleted | boolean | 소프트 삭제 여부 |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

설명:
- `musical_id`와 `performance_id`는 질문이 작품을 포함할 때 검색 범위를 좁히는 기준이 된다.
- `comfort_rating`과 `comfort_note`는 "좌석 편하냐" 같은 질문 대응에 중요하다.
- `side_preference`는 왼쪽 / 오른쪽 / 중앙 추천 결과를 빠르게 분류하는 보조 필드다.

### 4.9 seat_review_focuses

좌석 후기가 특정 배역, 배우, 동선, 좌우 방향에 대해 어떤 체감을 남겼는지 저장하는 보조 테이블이다.

주요 역할:
- 특정 배역 / 배우 관련 질문 정밀 검색
- "올리버 보기에는 왼쪽이 낫다" 같은 정보를 구조화
- 후기 본문만으로 찾기 어려운 포인트를 메타데이터화

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| seat_review_id | bigint | seat_reviews.id FK |
| character_id | bigint | characters.id FK, nullable |
| actor_id | bigint | actors.id FK, nullable |
| focus_type | varchar | character, actor, blocking, side, comfort |
| recommended_side | varchar | left, right, center, mixed, nullable |
| note | text | 예: 올리버 동선은 왼쪽에서 잘 보임 |
| created_at | timestamp | 생성일 |

설명:
- 하나의 후기에서 여러 배역이나 여러 배우를 언급할 수 있으므로 별도 테이블로 분리하는 편이 낫다.
- `focus_type='comfort'`처럼 편의성 코멘트를 별도 구조로 저장하는 것도 가능하다.

### 4.10 comments

후기에 달린 댓글을 저장하는 테이블이다.

주요 역할:
- 추가 질문과 답변
- 후기 보충 설명
- RAG 검색 대상 확장

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| seat_review_id | bigint | seat_reviews.id FK |
| author_id | bigint | users.id FK |
| parent_comment_id | bigint | self FK, 초기에는 nullable |
| content | text | 댓글 본문 |
| is_deleted | boolean | 소프트 삭제 여부 |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

### 4.11 tags

검색 및 분류용 태그를 저장하는 테이블이다.

예상 태그 예시:
- 시야좋음
- 음향좋음
- 배우잘보임
- 난간주의
- 가성비
- 표정위주
- 전체무대위주
- 첫관람추천
- 회전추천

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| name | varchar | 태그명 |
| type | varchar | seat_feature, viewing_purpose, theater, musical 등 |
| created_at | timestamp | 생성일 |

권장 제약:
- `(name, type)` unique

### 4.12 seat_review_tags

좌석 후기와 태그의 N:M 관계를 연결하는 중간 테이블이다.

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| seat_review_id | bigint | seat_reviews.id FK |
| tag_id | bigint | tags.id FK |
| created_at | timestamp | 생성일 |

권장 제약:
- `(seat_review_id, tag_id)` unique

### 4.13 documents

RAG 기능을 위해 후기와 댓글을 검색 가능한 문서 단위로 분리 저장하는 테이블이다.

주요 역할:
- AI 검색용 원문 관리
- seat_reviews, comments를 AI용 파이프라인으로 분리
- 작품명 / 배역명 / 방향 / 편의성 메타데이터를 문서 수준에서 유지

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| source_type | varchar | seat_review, comment |
| source_id | bigint | 원본 엔터티 ID |
| theater_id | bigint | theaters.id FK, nullable |
| musical_id | bigint | musicals.id FK, nullable |
| performance_id | bigint | performances.id FK, nullable |
| title | varchar | 문서 제목 또는 요약 제목 |
| content | text | 임베딩 대상 본문 |
| metadata_json | jsonb | 배역명, 배우명, 좌우 방향, 편의성 등 |
| version | int | 문서 버전 |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

설명:
- `metadata_json` 안에 `seat_floor`, `seat_section`, `side_preference`, `character_names`, `actor_names`, `comfort_rating` 등을 넣을 수 있다.

### 4.14 embeddings

문서 임베딩 벡터를 저장하는 테이블이다.

PostgreSQL + pgvector 기준으로 설계할 수 있다.

예상 컬럼:

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint | PK |
| document_id | bigint | documents.id FK |
| embedding | vector | pgvector 컬럼 |
| model_name | varchar | 임베딩 모델명 |
| chunk_index | int | 문서 청크 순서 |
| chunk_text | text | 실제 청크 텍스트 |
| created_at | timestamp | 생성일 |

설명:
- 문서 전체를 한 번에 넣지 않고 청크 단위로 쪼개 저장하는 구조를 권장한다.

## 5. 테이블 관계

### 5.1 기본 관계

- users 1 : N seat_reviews
- users 1 : N comments
- theaters 1 : N performances
- theaters 1 : N seat_reviews
- musicals 1 : N performances
- musicals 1 : N characters
- musicals 1 : N seat_reviews
- performances 1 : N performance_casts
- performances 1 : N seat_reviews
- characters 1 : N performance_casts
- actors 1 : N performance_casts
- seat_reviews 1 : N comments
- seat_reviews 1 : N seat_review_focuses
- seat_reviews N : M tags
- seat_reviews 1 : N documents
- comments 1 : N documents
- documents 1 : N embeddings

### 5.2 관계 설명

- 한 명의 사용자는 여러 좌석 후기를 작성할 수 있다.
- 하나의 좌석 후기는 하나의 극장에 속하고, 필요하면 작품과 공연 단위까지 연결될 수 있다.
- 하나의 공연에는 여러 캐스팅 정보가 연결될 수 있다.
- 하나의 좌석 후기에는 여러 배역 / 배우 관람 포인트가 연결될 수 있다.
- 하나의 좌석 후기는 여러 태그를 가질 수 있고, 태그도 여러 후기에 재사용될 수 있다.
- RAG 단계에서는 후기와 댓글을 문서로 변환한 뒤 여러 임베딩 청크로 저장할 수 있다.

## 6. ERD 텍스트 초안

```text
users
  └─< seat_reviews
  └─< comments

theaters
  └─< performances
  └─< seat_reviews

musicals
  └─< performances
  └─< characters
  └─< seat_reviews

performances
  └─< performance_casts
  └─< seat_reviews

characters
  └─< performance_casts
  └─< seat_review_focuses

actors
  └─< performance_casts
  └─< seat_review_focuses

seat_reviews
  └─< comments
  └─< seat_review_focuses
  └─< seat_review_tags >─┐
                         └─ tags
  └─< documents

comments
  └─< documents

documents
  └─< embeddings
```

## 7. 검색 관련 고려사항

초기 검색은 아래 조건부터 시작하는 것이 좋다.

- 극장명
- 작품명
- 층 / 구역 / 열 / 번호
- 태그
- 시야 방해 여부
- 음향 평가
- 좌석 편의성 평가

추후 확장:
- 배역명 검색
- 배우명 검색
- 왼쪽 / 오른쪽 / 중앙 추천 검색
- PostgreSQL full-text search 도입
- AI 검색과 일반 검색 분리

## 8. RAG 확장 관련 고려사항

RAG를 붙일 때는 아래 포인트를 고려하는 것이 좋다.

- 작품명을 포함한 질문인지 여부
- 배역 또는 배우가 포함된 질문인지 여부
- 좌석 편안함 질문인지 여부
- 댓글까지 임베딩 대상으로 넣을지 여부
- 후기 수정 시 문서 / 임베딩 재생성 방식
- AI 답변의 출처 추적 가능 여부

권장 전략:
- 처음에는 `seat_reviews` 중심으로 documents 생성
- 이후 댓글까지 documents 범위를 확장
- `documents.metadata_json`에 작품, 좌석 위치, 편의성, 좌우 방향 정보를 함께 저장
- 배역 / 배우 언급은 `seat_review_focuses`와 `metadata_json`을 함께 활용

## 9. MCP / Agent 확장 시 추가 가능 테이블

나중에 기능이 커지면 아래 테이블을 추가로 고려할 수 있다.

- `ai_questions`
  - 사용자 질문 로그
- `ai_answers`
  - 생성 답변과 출처 저장
- `agent_recommendations`
  - Agent 추천 결과 저장
- `theater_sync_logs`
  - 외부 극장 정보 동기화 이력
- `seat_map_snapshots`
  - 좌석 배치도 버전 저장

이 테이블들은 초기 MVP에서는 없어도 되며,
기본 좌석 후기 구조와 RAG 구조가 안정된 뒤 추가하는 것이 좋다.

## 10. MVP 기준 최소 테이블

MVP 기준으로는 아래 테이블부터 시작하면 충분하다.

- `users`
- `theaters`
- `musicals`
- `seat_reviews`
- `comments`
- `tags`
- `seat_review_tags`

작품별 검색과 좌석 구조 검색을 더 정확하게 하려면 아래 테이블을 빠르게 추가하는 것이 좋다.

- `performances`
- `characters`
- `actors`
- `seat_review_focuses`

RAG를 붙이기 시작하는 시점에 아래 2개를 추가하면 된다.

- `documents`
- `embeddings`

## 11. 한 줄 정리

이 ERD 초안의 핵심은 `좌석 후기`를 중심에 두고,
극장 / 작품 / 공연 / 배역 / 배우 / 좌우 방향 / 좌석 편의성 정보를 구조화해서
검색, RAG, MCP, Agent 기능이 자연스럽게 확장될 수 있도록 준비하는 것이다.
