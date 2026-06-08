# 007_search_filter_sort_pagination

## 목적

이 문서는 [implementation_order.md](../implementation_order.md)의
`8. 검색 / 필터 / 정렬 / 페이징`을 구현하기 위한 가이드다.

좌석 후기 서비스는 검색 품질이 곧 사용성이다.
이 단계가 안정적이어야 사용자가 원하는 좌석 경험을 직접 찾을 수 있다.

관련 개념 문서:

- [docs/concept/007_search_filter_sort_pagination.md](../concept/007_search_filter_sort_pagination.md)

## 이 단계가 끝나면 되는 것

- 후기 목록 페이징이 된다
- 극장 / 작품 / 좌석 위치 검색이 된다
- 태그 / 시야 방해 / 음향 / 편의성 필터가 된다
- 정렬 옵션이 붙는다

## 권장 쿼리 구조

예시:

```http
GET /seat-reviews?page=1&limit=10
GET /seat-reviews/search?theater=블루스퀘어&floor=2&row=3
GET /seat-reviews/search?tag=배우잘보임&hasObstruction=false
GET /seat-reviews/search?musical=어쩌면해피엔딩&character=올리버&side=left
```

## 권장 구현 순서

1. 기본 목록 페이징
2. 극장 / 작품명 검색
3. 좌석 위치 검색
4. 태그 검색
5. 평가값 필터
6. 정렬 옵션
7. 응답 메타데이터 정리

## 설계 포인트

### 1. 검색과 필터를 분리해서 생각한다

- 검색: 키워드 또는 부분 일치
- 필터: 정확한 조건 제한

예:

- 검색: `theater=블루`
- 필터: `hasObstruction=false`

### 2. 목록 응답 메타데이터를 표준화한다

권장 포함값:

- `items`
- `page`
- `limit`
- `total`
- `hasNext`

### 3. 정렬 기준은 너무 많이 열지 않는다

초기 권장:

- 최신순
- 인기순
- 평점순

## 인덱스 검토 포인트

- `theater_id`
- `musical_id`
- `seat_floor`
- `seat_section`
- `has_obstruction`
- 정렬에 자주 쓰는 `created_at`

태그 검색이 많다면 조인 테이블 인덱스도 같이 본다.

## 체크리스트

- [ ] 목록 페이징 구현
- [ ] 극장명 / 작품명 검색 구현
- [ ] 좌석 위치 검색 구현
- [ ] 태그 검색 구현
- [ ] 평가 필터 구현
- [ ] 정렬 옵션 구현
- [ ] 응답 메타데이터 통일
- [ ] 자주 쓰는 조건 인덱스 검토

## 완료 기준

- 사용자가 AI 없이도 원하는 좌석 후기를 꽤 잘 찾을 수 있다
- 이후 RAG에서 검색 전처리용 필터로 재사용할 수 있다

