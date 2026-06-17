# AI 좌석 추천 응답 흐름

이 문서는 사용자가 AI 좌석 도우미에 질문을 입력했을 때, 프론트엔드에서 시작해 FastAPI, NestJS, RAG, OpenAI 호출을 거쳐 다시 화면에 답변이 표시되기까지의 전체 흐름을 정리한다.

현재 구조는 OpenAI에 질문을 그대로 던지는 방식이 아니다. FastAPI가 질문을 구조화하고, NestJS에서 실제 좌석 후기와 RAG 근거를 가져오며, 필요할 때만 OpenAI가 후기 기반 답변 문장을 생성하는 하이브리드 구조다.

## 전체 흐름 요약

```text
React SeatAssistantPanel
  -> POST http://localhost:8000/agent/seat-recommendations
  -> FastAPI agent router
  -> seat_agent_service.recommend_seat()
  -> NestJS metadata / seat review / RAG APIs
  -> optional OpenAI Responses API
  -> FastAPI response assembly
  -> React chat message rendering
```

역할을 나누면 다음과 같다.

- React: 사용자의 질문 입력, API 요청, 최종 답변 표시
- FastAPI: Agent 오케스트레이션, 질문 필터 추출, 리뷰 점수화, 최종 응답 조립
- NestJS: 극장/작품 메타데이터, 좌석 후기 검색, RAG 검색과 답변 생성
- PostgreSQL/Prisma: 후기, 극장, 작품, RAG embedding, RAG query log 저장
- OpenAI: RAG source가 있을 때 후기 기반 자연어 답변 생성

## 핵심 함수 뜯어보기

아래 함수들이 실제 질문 처리의 중심이다. 큰 흐름은 단순하지만, 답변이 만들어지는 기준은 여러 함수에 나뉘어 있다.

```text
submitQuestion()
  -> askSeatRecommendation()
  -> agentApiRequest()
  -> seat_recommendations()
  -> recommend_seat()
      -> _extract_filters()
      -> _resolve_external_musical_production()
      -> get_seat_layout()
      -> _extract_seat_candidates()
      -> _compare_seat_candidates() or _load_review_scope()
      -> NestClient.get_json("/seat-reviews/search")
      -> NestClient.post_json("/rag/questions")
      -> _score_review()
      -> _build_answer()
      -> SeatRecommendationResponse
```

### `submitQuestion()`

위치: [SeatAssistantPanel.tsx](../../apps/web-react/src/features/agent/components/SeatAssistantPanel.tsx#L42)

프론트 채팅창에서 사용자가 질문을 보냈을 때 제일 먼저 실행되는 함수다.

입력:

- `question: string`
- 사용자가 textarea에 입력한 원문 문자열

하는 일:

1. `question.trim()`으로 앞뒤 공백을 제거한다.
2. 빈 문자열이면 아무 요청도 보내지 않는다.
3. 이미 `isLoading`이면 중복 요청을 막는다.
4. 사용자 메시지를 `messages` 상태에 추가한다.
5. 입력창과 기존 에러 메시지를 비운다.
6. `isLoading`을 `true`로 바꾼다.
7. `askSeatRecommendation()`으로 FastAPI에 요청한다.
8. 성공하면 서버 응답의 `recommendation`만 assistant 메시지로 추가한다.
9. 실패하면 에러 메시지를 `error` 상태에 넣는다.
10. 성공/실패와 관계없이 마지막에 `isLoading`을 `false`로 돌린다.

핵심 포인트:

- 이 함수는 AI 답변을 만들지 않는다.
- 화면 상태를 관리하고 API 요청을 시작하는 역할만 한다.
- 서버 응답 중 화면에 실제로 표시하는 값은 `recommendation` 하나다.

### `formatAssistantText()`

위치: [SeatAssistantPanel.tsx](../../apps/web-react/src/features/agent/components/SeatAssistantPanel.tsx#L17)

서버 응답에서 채팅창에 보여줄 텍스트만 꺼낸다.

```ts
function formatAssistantText(result: SeatRecommendation) {
  return result.recommendation
}
```

핵심 포인트:

- 서버 응답에는 `reasons`, `cautions`, `evidenceReviews`, `mcpStatus`, `ragStatus`도 들어온다.
- 하지만 현재 UI는 그중 `recommendation`만 보여준다.

### `askSeatRecommendation()`

위치: [api.ts](../../apps/web-react/src/features/agent/api.ts#L4)

AI 좌석 추천 API를 호출하는 프론트 전용 wrapper 함수다.

입력:

- `SeatRecommendationInput`

하는 일:

1. API path를 `/agent/seat-recommendations`로 고정한다.
2. HTTP method를 `POST`로 지정한다.
3. 입력 객체를 `JSON.stringify()` 해서 request body에 넣는다.
4. 실제 fetch 처리는 `agentApiRequest()`에 맡긴다.

핵심 포인트:

- 이 함수는 API 주소와 요청 방식만 정한다.
- 에러 처리, base URL, JSON 파싱은 `agentApiRequest()`가 담당한다.

### `agentApiRequest()`

위치: [agent-api.ts](../../apps/web-react/src/shared/agent-api.ts#L8)

FastAPI Agent 서버와 통신하는 공통 fetch 함수다.

입력:

- `path`: API path
- `options`: fetch 옵션

하는 일:

1. `VITE_AGENT_API_BASE_URL`이 있으면 그 값을 사용한다.
2. 없으면 기본값 `http://localhost:8000`을 사용한다.
3. `Content-Type: application/json` 헤더를 붙인다.
4. fetch를 실행한다.
5. 응답 JSON 파싱을 시도한다.
6. `response.ok`가 아니면 서버 에러 메시지를 뽑아 `Error`를 던진다.
7. 성공이면 JSON을 타입 `T`로 반환한다.

핵심 포인트:

- 프론트에서 FastAPI 주소를 직접 알고 있는 곳은 이 함수다.
- FastAPI가 422 validation error를 반환하면 여기서 에러 메시지로 바뀐다.

### `seat_recommendations()`

위치: [routers/agent.py](../../apps/fastapi-api/app/routers/agent.py#L9)

FastAPI에서 실제 HTTP 요청을 받는 엔드포인트 함수다.

입력:

- `request: SeatRecommendationRequest`

하는 일:

1. FastAPI/Pydantic이 요청 body를 `SeatRecommendationRequest`로 검증한다.
2. 검증이 통과하면 `recommend_seat(request)`를 호출한다.
3. 반환값을 `SeatRecommendationResponse` 형태로 직렬화해 응답한다.

핵심 포인트:

- 이 함수는 얇은 controller 역할만 한다.
- 실제 추천 로직은 전부 `recommend_seat()` 안에 있다.
- `response_model=SeatRecommendationResponse` 때문에 응답 형태가 스키마 기준으로 정리된다.

### `recommend_seat()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L111)

AI 좌석 추천의 중심 함수다. FastAPI Agent의 오케스트레이터라고 보면 된다.

입력:

- `SeatRecommendationRequest`

출력:

- `SeatRecommendationResponse`

내부 처리 순서:

1. `NestClient()`를 만든다.
2. `_extract_filters()`로 질문에서 극장, 작품, 좌석, 우선순위 조건을 뽑는다.
3. `_resolve_external_musical_production()`으로 질문에 나온 작품의 현재/최근 공연장 정보를 보조적으로 찾는다.
4. 외부 공연 메타데이터로 공연장을 찾았고 사용자가 극장명을 직접 주지 않았다면, 해당 극장명과 작품명을 필터에 채운다.
5. 외부 공연 메타데이터를 쓴 경우에는 해당 작품 후기만 고집하지 않고, 같은 극장의 다른 뮤지컬 후기까지 참고할 수 있도록 검색용 필터에서는 `musical_title`을 비운다.
6. `_detect_intent()`로 질문 의도를 분류한다.
7. `_extract_focus_subject()`로 특정 배우/배역 같은 집중 대상을 찾는다.
8. 기본 상태값을 세팅한다.
   - `mcp_status = "not_requested"`
   - `rag_status = "skipped"`
   - `rag_answer = None`
9. 극장명이 있으면 `get_seat_layout()`으로 좌석 레이아웃 상태를 확인한다.
10. `_extract_seat_candidates()`로 비교 후보 좌석이 2개 이상 있는지 본다.
11. 후보가 2개 이상이면 `_compare_seat_candidates()`로 바로 비교 답변을 반환한다.
12. 비교 질문이 아니면 `_load_review_scope()`로 근거 리뷰 범위를 불러온다.
13. `use_rag`가 true이고 외부 공연 메타데이터 fallback이 아닌 경우 NestJS의 `/rag/questions`를 호출한다.
14. 리뷰들을 `_score_review()`로 점수화한다.
15. 상위 리뷰를 `_to_evidence()`로 응답용 근거 형태로 바꾼다.
16. `_select_official_section()`으로 공식 구역(데이터에 실제로 찍혀 있는 좌석 구역명)을 고른다.
17. `_select_descriptive_block()`으로 왼쪽/중앙/오른쪽/사이드 설명 블록(사용자에게 설명하기 좋은 방향 분류)을 고른다.
18. `_build_reasons()`와 `_build_cautions()`로 이유와 주의사항을 만든다.
19. `_build_answer()`로 FastAPI 로컬 답변을 만든다.
20. RAG 답변과 로컬 답변 중 최종 `recommendation`을 선택한다.
21. 외부 공연 메타데이터를 사용했다면 “해당 작품 후기가 없어 같은 극장의 다른 뮤지컬 후기를 참고한다”는 안내를 앞에 붙인다.
22. `SeatRecommendationResponse`를 반환한다.

최종 답변 선택 로직:

```py
recommendation = (
    local_answer
    if intent in {"obstruction_range", "op_assessment"} or focus_subject
    else rag_answer or local_answer
)
```

의미:

- 시야방해 범위 질문은 로컬 답변 우선
- OP석 평가 질문은 로컬 답변 우선
- 특정 배우/배역 중심 질문은 로컬 답변 우선
- 그 외 일반 질문은 RAG 답변이 있으면 RAG 답변 우선
- RAG가 실패하거나 비어 있으면 로컬 답변으로 fallback

핵심 포인트:

- 이 함수 하나가 MCP, 리뷰 검색, RAG, 점수화, 응답 조립을 모두 연결한다.
- OpenAI를 직접 호출하지 않고 NestJS RAG API를 통해 간접 호출한다.
- RAG가 실패해도 전체 응답은 가능하도록 설계되어 있다.
- 외부 공연 메타데이터 fallback은 “비슷한 다른 극장”을 찾는 기능이 아니라, 작품의 현재/최근 공연장이 확인될 때 같은 극장 후기만 참고하는 기능이다.

### `_extract_filters()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L191)

자연어 질문을 검색 가능한 구조화 조건으로 바꾸는 함수다.

입력:

- `SeatRecommendationRequest`
- `NestClient`

하는 일:

1. NestJS에서 `/theaters`를 조회한다.
2. NestJS에서 `/musicals`를 조회한다.
3. 요청에 명시된 `theaterName`이 있으면 우선 사용한다.
4. 없으면 질문 문자열에서 극장명을 찾는다.
5. 요청에 명시된 `musicalTitle`이 있으면 우선 사용한다.
6. 없으면 질문 문자열에서 작품명을 찾는다.
7. 시즌, 층, 구역, 열, 번호, 방향, 통로 기준, 중중블 기준, 예산을 정규식과 키워드로 추출한다.
8. `사블통-1`, `좌블통-2`처럼 통로 기준 표현이 있으면 `aisleBlock`, `aisleOffset`을 채운다.
9. `중중블`, `중앙중블`, `중블중앙`처럼 중앙블록 안쪽을 뜻하는 표현이 있으면 `centerCore=true`, `side="center"`로 채운다.
10. 우선순위가 없으면 `view`를 기본 우선순위로 넣는다.
11. `AgentFilters`를 반환한다.

반환 예시:

```json
{
  "theaterName": "블루스퀘어 신한카드홀",
  "musicalTitle": null,
  "seatFloor": "2층",
  "seatSection": "B",
  "seatRow": "7",
  "side": "center",
  "centerCore": false,
  "aisleBlock": null,
  "aisleOffset": null,
  "priorities": ["view"]
}
```

핵심 포인트:

- 이 함수는 LLM을 쓰지 않는다.
- DB 메타데이터와 정규식/키워드 기반으로 조건을 추출한다.
- 이 결과가 이후 리뷰 검색 조건의 기반이 된다.
- `centerCore`, `aisleBlock`, `aisleOffset`은 NestJS 검색 query에 그대로 다 보내는 값이라기보다, FastAPI가 검색 결과를 다시 좁히거나 fallback 범위를 정할 때 주로 사용한다.

### `get_seat_layout()`

위치: [seat_metadata_service.py](../../apps/fastapi-api/app/services/seat_metadata_service.py#L145)

극장 좌석 레이아웃 메타데이터를 가져오는 함수다.

입력:

- `theater_name`
- `simulate_failure`

하는 일:

1. 극장명을 정규화한다.
2. 캐시 키를 만든다.
3. 캐시에 값이 있으면 `cached=True`로 반환한다.
4. 실패 시뮬레이션이면 예외를 발생시킨다.
5. `_find_layout()`으로 내부 레이아웃 목록에서 극장을 찾는다.
6. 찾으면 `status="ok"`, `isFallback=False` 응답을 만든다.
7. 못 찾거나 실패하면 `FALLBACK_LAYOUT`으로 응답을 만든다.
8. 결과를 캐시에 저장하고 반환한다.

핵심 포인트:

- 외부 MCP 서버를 직접 호출하는 구조가 아니라 내부 레이아웃 정의를 사용한다.
- 실패해도 API 전체가 죽지 않도록 fallback 레이아웃을 반환한다.
- `mcpStatus`는 이 함수의 `status`에서 온다.

### `_extract_seat_candidates()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L233)

질문 안에서 비교 대상 좌석들을 뽑는다.

입력:

- `question: str`

하는 일:

1. `1층 A구역 5열` 같은 좌석 표현을 정규식으로 찾는다.
2. `5열 중앙`, `7열 사이드` 같은 표현도 찾는다.
3. 층만 비교하는 질문인지 확인한다.
4. 좌블/중블/우블/극싸 같은 방향만 비교하는 질문인지 확인한다.
5. `중중블` 후보는 `side="center"`이면서 `center_core=True`인 후보로 표시한다.
6. `극싸`, `극사이드`, `완전 사이드`는 `side="side"`로 표시하되 후보 라벨은 `극싸`로 살린다.
7. 찾은 후보들을 `SeatCandidate` 목록으로 반환한다.

핵심 포인트:

- 후보가 2개 이상이면 일반 추천이 아니라 비교 추천으로 분기한다.
- 비교 질문에서는 RAG를 건너뛰고 FastAPI 자체 비교 로직을 쓴다.

### `_compare_seat_candidates()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L446)

여러 좌석 후보를 비교해 하나를 고르는 함수다.

입력:

- `NestClient`
- 원본 request
- 기본 filters
- intent
- mcp_status
- candidates

하는 일:

1. 후보를 최대 3개까지만 평가한다.
2. 각 후보마다 `_evaluate_seat_candidate()`를 실행한다.
3. 평가 점수가 가장 높은 후보를 `winner`로 정한다.
4. winner 기준으로 공식 구역과 설명 블록을 고른다.
5. 후보별 근거 리뷰를 합친다.
6. 층 비교면 `_build_floor_comparison_answer()`로 답한다.
7. 일반 후보 비교면 `_build_candidate_comparison_answer()`로 답한다.
8. `SeatRecommendationResponse`를 반환한다.

핵심 포인트:

- 이 흐름에서는 `ragStatus="skipped"`가 된다.
- “둘 중 뭐가 나아?” 질문은 RAG가 아니라 점수화 비교로 답한다.

### `_load_review_scope()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L790)

질문 조건에 맞는 리뷰를 어느 범위까지 가져올지 결정한다.

입력:

- `NestClient`
- `AgentFilters`
- `limit`
- `intent`

하는 일:

1. 시야방해 범위 질문이면 `_search_obstruction_range_reviews()`를 사용한다.
2. 일반 질문이면 `_search_reviews()`로 정확 조건 검색을 한다.
3. 정확 리뷰가 충분하면 그대로 반환한다.
4. 특정 열 리뷰가 부족하면 열/좌석번호 조건을 빼고 더 넓게 검색한다.
5. `centerCore` 질문이면 중앙블록 리뷰 중 좌석번호 중앙 6개 정도에 해당하는 리뷰를 우선 남긴다.
6. 통로 기준 질문이면 같은 통로 offset의 리뷰만 본다.
7. 정확한 통로 offset 리뷰가 없으면 좌우 번호가 아니라 같은 offset의 앞뒤 열 리뷰를 찾는다.
8. 열 기준 질문이면 가까운 열 리뷰를 찾는다.
9. 그래도 없으면 같은 범위 리뷰를 반환한다.

반환값:

- `ReviewSearchScope`
  - `reviews`
  - `label`
  - `exact_count`

핵심 포인트:

- 정확히 같은 좌석 리뷰가 적을 때도 답변할 수 있도록 검색 범위를 단계적으로 넓힌다.
- `label`은 정확 검색인지, 근처 열 검색인지 같은 검색 성격을 나타낸다.

### `_search_reviews()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L851)

NestJS 좌석 후기 검색 API를 호출한다.

입력:

- `NestClient`
- `AgentFilters`
- `limit`

하는 일:

1. `_to_search_params()`로 query parameter를 만든다.
2. NestJS `GET /seat-reviews/search`를 호출한다.
3. 응답이 dict면 `items`를 반환한다.
4. 실패하면 빈 배열을 반환한다.

핵심 포인트:

- NestJS 장애가 있어도 FastAPI 함수가 예외로 터지지 않게 빈 결과로 fallback한다.

### `_score_review()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L974)

검색된 리뷰 하나가 질문 조건에 얼마나 잘 맞는지 점수를 매긴다.

입력:

- 리뷰 dict
- `AgentFilters`
- `focus_subject`

점수 기준:

1. priority에 해당하는 평점을 가중치로 더한다.
2. 특정 배우/배역이 언급되면 가산한다.
3. focus 질문에서 시야방해가 있으면 감점한다.
4. `lowObstruction` 우선순위인데 시야방해/사이드 태그가 있으면 감점한다.
5. 질문의 방향과 리뷰 좌석 방향이 맞으면 가산한다.
6. 질문한 열과 리뷰 열이 같거나 가까우면 가산한다.
7. 후기 본문이나 태그에 `하느님석`, `하느님`, `하나님석`, `하나님`, `창조주석`, `창조주`가 있으면 멀어서 표정/디테일이 약한 좌석으로 보고 감점한다.
8. 표정/배우/배역 중심 질문이거나 focus subject가 있으면 위 거리 리스크 감점을 더 크게 적용한다.

반환값:

- `CandidateScore(review=review, score=score)`

핵심 포인트:

- RAG 답변을 쓰는 경우에도 `evidenceReviews`, `officialSection`, `descriptiveBlock` 계산에는 이 점수화 결과가 쓰인다.

### `_build_answer()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L1126)

FastAPI 자체 로컬 답변 문장을 만드는 함수다.

입력:

- intent
- filters
- evidence
- official_section
- block
- search_scope
- question

분기:

```py
if intent == "obstruction_range":
    return _build_obstruction_range(...)
if intent == "op_assessment":
    return _build_op_seat_assessment(...)
if intent == "assessment":
    return _build_assessment(...)
return _build_recommendation(...)
```

핵심 포인트:

- RAG 없이도 답변을 만들 수 있는 fallback 답변 생성기다.
- 특정 질문 유형은 RAG보다 이 로컬 답변이 우선된다.

### `_to_evidence()`

위치: [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py#L1540)

NestJS에서 받은 리뷰 dict를 FastAPI 응답 스키마의 `EvidenceReview`로 바꾼다.

하는 일:

1. 리뷰의 좌석 정보를 사람이 읽는 문자열로 합친다.
2. 태그 이름만 추출한다.
3. 공연 시즌 정보를 꺼낸다.
4. 후기 본문은 앞 220자까지만 넣는다.
5. `EvidenceReview`를 반환한다.

핵심 포인트:

- 클라이언트에 원본 리뷰 전체를 다 보내지 않고, 추천 근거로 필요한 요약 정보만 보낸다.

### `NestClient`

위치: [nest_client.py](../../apps/fastapi-api/app/services/nest_client.py#L13)

FastAPI에서 NestJS API를 호출하기 위한 작은 HTTP client다.

주요 함수:

- `get_json(path, params)`
- `post_json(path, body)`
- `_request(method, path, body)`

하는 일:

1. `NEST_API_BASE_URL`을 기준으로 URL을 만든다.
2. GET이면 query string을 붙인다.
3. POST면 body를 JSON으로 인코딩한다.
4. `urlopen()`으로 요청한다.
5. 응답 JSON을 파싱해 반환한다.
6. 실패하면 `NestClientError`로 감싼다.

핵심 포인트:

- FastAPI 서비스가 NestJS 내부 구현을 직접 알지 않게 해주는 어댑터다.
- 호출 실패는 `NestClientError`가 되고, 상위 함수들이 이를 fallback 처리한다.

### `SeatReviewsController.search()`

위치: [seat-reviews.controller.ts](../../apps/nest-api/src/seat-reviews/seat-reviews.controller.ts#L34)

NestJS에서 좌석 후기 검색 요청을 받는 엔드포인트다.

하는 일:

1. query string을 `SeatReviewQueryDto`로 받는다.
2. `seatReviewsService.findAll(query)`를 호출한다.

핵심 포인트:

- `/seat-reviews`와 `/seat-reviews/search`가 둘 다 `findAll()`을 사용한다.
- FastAPI Agent는 `/seat-reviews/search`를 사용한다.

### `SeatReviewsService.findAll()`

위치: [seat-reviews.service.ts](../../apps/nest-api/src/seat-reviews/seat-reviews.service.ts#L95)

DB에서 좌석 후기를 검색하는 함수다.

입력:

- `SeatReviewQueryDto`

하는 일:

1. page, limit, skip 값을 계산한다.
2. `buildFindAllWhere()`로 Prisma where 조건을 만든다.
3. `seatReview.findMany()`로 실제 리뷰 목록을 가져온다.
4. `seatReview.count()`로 전체 개수를 구한다.
5. 각 리뷰를 `toPublicReview()`로 공개 응답 형태로 바꾼다.
6. `items`, `total`, `page`, `limit`, `hasNext`를 반환한다.

핵심 포인트:

- FastAPI가 쓰는 근거 리뷰는 이 함수가 DB에서 가져온 결과다.
- 공개 상태와 삭제 여부 같은 안전 조건도 여기서 적용된다.

### `RagController.ask()`

위치: [rag.controller.ts](../../apps/nest-api/src/rag/rag.controller.ts#L9)

NestJS RAG 질문 엔드포인트다.

하는 일:

1. body를 `AskRagQuestionDto`로 받는다.
2. `ragService.ask(dto.question, dto.limit)`를 호출한다.

핵심 포인트:

- FastAPI가 `POST /rag/questions`로 호출하는 입구다.
- 실제 RAG 로직은 `RagService.ask()`에 있다.

### `RagService.ask()`

위치: [rag.service.ts](../../apps/nest-api/src/rag/rag.service.ts#L56)

NestJS RAG의 중심 함수다.

입력:

- `question`
- `limit`

하는 일:

1. 시작 시간을 기록한다.
2. 질문을 trim한다.
3. 2글자 미만이면 `BadRequestException`을 던진다.
4. `queryParser.parse()`로 질문 필터를 추출한다.
5. 좌석 후기 질문이 아니면 OpenAI 호출 없이 안내 답변을 반환한다.
6. `findRelevantSources()`로 관련 후기 source를 찾는다.
7. source가 없으면 OpenAI 호출 없이 안전 답변을 반환한다.
8. 범위 질문 답변이 가능하면 직접 계산 답변을 반환한다.
9. 그 외에는 `openAi.createAnswer()`로 OpenAI 답변을 만든다.
10. `logQuery()`로 질문 로그를 남긴다.
11. `RagAnswer`를 반환한다.

핵심 포인트:

- RAG도 항상 OpenAI를 호출하지 않는다.
- source가 없거나 좌석 후기 질문이 아니거나 범위 질문이면 자체 답변으로 끝난다.

### `RagQueryParser.parse()`

위치: [rag-query-parser.ts](../../apps/nest-api/src/rag/rag-query-parser.ts#L48)

NestJS RAG 내부에서 질문을 구조화하는 함수다.

하는 일:

1. DB에서 극장 목록을 가져온다.
2. DB에서 작품 목록을 가져온다.
3. 질문과 가장 잘 맞는 극장/작품 이름을 찾는다.
4. 좌석 정보를 추출한다.
5. 좌우/중앙 방향을 추출한다.
6. 시야방해 태그를 추출한다.
7. 범위 질문 여부를 추출한다.
8. 질문 의도를 추출한다.
9. `RagQuestionFilters`를 반환한다.

핵심 포인트:

- FastAPI의 `_extract_filters()`와 비슷하지만 RAG용으로 NestJS 내부에서 다시 파싱한다.
- RAG source 검색 조건은 이 함수 결과를 기반으로 한다.

### `findRelevantSources()`

위치: [rag.service.ts](../../apps/nest-api/src/rag/rag.service.ts#L275)

RAG 답변에 넣을 근거 후기를 찾는 함수다.

하는 일:

1. 정확 조건으로 직접 SQL 검색을 한다.
2. 열 조건이 있고 결과가 부족하면 근처 열 검색을 추가한다.
3. 그래도 부족하면 같은 범위 검색을 추가한다.
4. embedding 테이블에 데이터가 있으면 질문 임베딩을 생성한다.
5. pgvector 유사도 검색을 추가한다.
6. source 중복을 제거한다.
7. 제한 개수만큼 잘라 반환한다.

핵심 포인트:

- RAG source는 직접 조건 검색과 벡터 검색을 합쳐 만든다.
- embedding이 없으면 벡터 검색 없이 동작한다.

### `OpenAiRagClient.createAnswer()`

위치: [openai-rag.client.ts](../../apps/nest-api/src/rag/openai-rag.client.ts#L57)

OpenAI Responses API를 호출해 자연어 답변을 만드는 함수다.

입력:

- 사용자 질문
- RAG 필터
- RAG source 목록

하는 일:

1. `OPENAI_API_KEY`가 있는지 확인한다.
2. OpenAI `/v1/responses`로 POST 요청을 보낸다.
3. model은 `OPENAI_CHAT_MODEL` 또는 기본값을 사용한다.
4. developer message에 답변 규칙을 넣는다.
5. user message에 질문, 필터, source 내용을 넣는다.
6. 응답에서 `output_text` 또는 `output[].content[].text`를 추출한다.
7. 텍스트가 없으면 예외를 던진다.
8. 답변 문자열을 반환한다.

핵심 포인트:

- OpenAI는 DB를 직접 보지 않는다.
- NestJS가 골라준 source 안에서만 답하도록 프롬프트를 구성한다.
- 이 함수가 실패하면 FastAPI 쪽에서는 `ragStatus="fallback"`으로 처리될 수 있다.

## 1. 사용자가 프론트에서 질문 입력

시작점은 [SeatAssistantPanel.tsx](../../apps/web-react/src/features/agent/components/SeatAssistantPanel.tsx)다.

사용자가 채팅창에 질문을 쓰고 전송하면 `submitQuestion()`이 실행된다.

전송 조건은 다음과 같다.

- `question.trim()` 결과가 비어 있으면 요청하지 않는다.
- 이미 `isLoading` 상태면 중복 요청하지 않는다.
- Enter 단독 입력 또는 전송 버튼으로 제출할 수 있다.

요청 전에 프론트는 사용자 메시지를 먼저 채팅 로그에 추가하고, 입력창을 비우고, 로딩 상태를 켠다.

현재 프론트가 보내는 요청 payload는 다음과 같다.

```ts
{
  question: trimmedQuestion,
  limit: 5,
  useRag: true,
}
```

## 2. 프론트 공통 API 함수가 FastAPI로 요청

[api.ts](../../apps/web-react/src/features/agent/api.ts)의 `askSeatRecommendation()`은 `agentApiRequest()`를 호출한다.

[agent-api.ts](../../apps/web-react/src/shared/agent-api.ts)는 API 기본 주소를 다음처럼 정한다.

```ts
const AGENT_API_BASE_URL =
  import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://localhost:8000"
```

실제 요청은 다음 엔드포인트로 나간다.

```http
POST /agent/seat-recommendations
Content-Type: application/json
```

응답이 성공이면 JSON을 그대로 반환한다. 응답이 실패면 `detail` 또는 `message`를 읽어 에러 메시지로 던진다.

## 3. FastAPI 앱이 agent router를 연결

실제 FastAPI 앱은 [app/main.py](../../apps/fastapi-api/app/main.py)다.

여기서 다음 라우터들이 연결된다.

```py
app.include_router(demo_router)
app.include_router(mcp_router)
app.include_router(agent_router)
```

AI 좌석 추천은 `agent_router`가 담당한다.

주의할 점은 [fastapi-api/main.py](../../apps/fastapi-api/main.py)는 단순 `Hello FastAPI!` 앱이라는 것이다. 좌석 추천 라우터가 붙은 앱은 [app/main.py](../../apps/fastapi-api/app/main.py)다.

## 4. FastAPI `/agent/seat-recommendations` 진입

[routers/agent.py](../../apps/fastapi-api/app/routers/agent.py)에는 다음 라우터가 있다.

```py
@router.post("/seat-recommendations", response_model=SeatRecommendationResponse)
def seat_recommendations(request: SeatRecommendationRequest):
    return recommend_seat(request)
```

라우터 자체는 얇다. 요청 검증 후 실제 처리는 `recommend_seat()`로 위임한다.

## 5. 요청 JSON이 Pydantic 스키마로 검증됨

요청 스키마는 [schemas/agent.py](../../apps/fastapi-api/app/schemas/agent.py)의 `SeatRecommendationRequest`다.

주요 필드는 다음과 같다.

- `question`: 필수, 최소 2글자
- `theaterName`: 선택
- `musicalTitle`: 선택
- `seasonLabel`: 선택
- `priorities`: 선택
- `budget`: 선택
- `limit`: 기본 5, 최소 1, 최대 10
- `useRag`: 기본 `true`

프론트는 현재 `question`, `limit`, `useRag`만 보낸다.

## 6. `recommend_seat()` 시작

핵심 함수는 [seat_agent_service.py](../../apps/fastapi-api/app/services/seat_agent_service.py)의 `recommend_seat()`다.

초기화 흐름은 다음과 같다.

```py
client = NestClient()
filters = _extract_filters(request, client)
external_production = _resolve_external_musical_production(request, filters)
intent = _detect_intent(request.question)
focus_subject = _extract_focus_subject(request.question)
mcp_status = "not_requested"
rag_status = "skipped"
rag_answer = None
```

`NestClient`는 [nest_client.py](../../apps/fastapi-api/app/services/nest_client.py)에 있으며, 기본 NestJS API 주소는 다음과 같다.

```py
NEST_API_BASE_URL ?? "http://localhost:3000"
```

필터 추출 직후에는 외부 공연 메타데이터도 확인한다. 사용자가 작품명만 말했고 내부 후기 데이터에 해당 작품이 부족한 경우, 현재/최근 공연장 정보를 찾아 같은 극장의 다른 뮤지컬 후기까지 참고할 수 있게 하기 위한 단계다. 이 기능은 비슷한 규모의 다른 극장을 추론하는 기능이 아니며, 확인된 공연장이 있을 때만 같은 극장 범위에서 동작한다.

## 7. 질문에서 필터 추출

`_extract_filters()`는 질문과 NestJS 메타데이터를 이용해 검색 조건을 만든다.

처리 내용은 다음과 같다.

1. NestJS에서 극장 목록 조회: `GET /theaters`
2. NestJS에서 작품 목록 조회: `GET /musicals`
3. 질문 안에서 극장명 찾기
4. 질문 안에서 작품명 찾기
5. 시즌명 추출
6. 시야, 음향, 편안함, 표정, 전체무대, 시야방해 적음 같은 우선순위 추출
7. 층, 구역, 열, 좌석 번호 추출
8. 왼쪽, 중앙, 오른쪽, 사이드 방향 추출
9. `중중블`, `중앙중블`, `중블중앙`이면 `centerCore=true`, `side="center"` 추출
10. 통로 기준 좌석이면 `aisleBlock`, `aisleOffset` 추출
11. 예산 표현 추출
12. 우선순위가 없으면 기본값으로 `["view"]` 사용

NestJS 조회가 실패해도 `_safe_get()`이 빈 배열을 반환하므로 FastAPI 요청 전체가 바로 실패하지 않는다.

현재 코드상 주의할 점이 있다. NestJS의 `getMusicals()`는 `{ id, name }` 형태를 반환하지만, FastAPI의 `_find_name()`은 `"title"` 키를 찾는다. 그래서 FastAPI 필터 추출 단계에서는 작품명이 자동으로 잘 안 잡힐 수 있다. 다만 NestJS RAG 내부 파서는 별도로 작품명을 다시 찾는다.

좌석 은어 처리도 이 단계에서 일부 이뤄진다.

- `사블통-1`, `좌블통-2`: 해당 블록 통로에서 1칸/2칸 들어간 자리로 해석한다.
- `중중블`: 중앙블록 전체가 아니라 중앙블록 안에서도 물리적으로 중앙에 가까운 좌석 묶음으로 해석한다.
- `극싸`, `극사이드`, `완전 사이드`: 사이드 성격이 강한 좌석으로 해석한다.

## 8. MCP 좌석 레이아웃 확인

필터에서 `theater_name`이 잡히면 FastAPI는 `get_seat_layout(filters.theater_name)`을 호출한다.

이 함수는 [seat_metadata_service.py](../../apps/fastapi-api/app/services/seat_metadata_service.py)에 있다.

처리 내용은 다음과 같다.

1. 극장명 정규화
2. 캐시 확인
3. `SEAT_LAYOUTS`에서 극장 레이아웃 검색
4. 찾으면 `status="ok"`, `isFallback=False`
5. 못 찾거나 실패하면 `FALLBACK_LAYOUT`, `status="fallback"`, `isFallback=True`
6. 결과를 600초 캐시에 저장

여기서 말하는 MCP는 HTTP `/mcp/...`를 호출하는 것이 아니라 FastAPI 내부 함수를 직접 호출하는 것이다.

결과 상태는 최종 응답의 `mcpStatus`로 나간다.

## 9. 좌석 비교 질문인지 먼저 확인

다음으로 `_extract_seat_candidates()`가 질문에서 비교 후보 좌석을 찾는다.

예를 들어 다음과 같은 질문이 해당한다.

```text
1층 A구역 5열이랑 2층 중앙 3열 중 어디가 나아?
```

후보 좌석이 2개 이상이면 일반 RAG 흐름으로 가지 않고 비교 전용 흐름으로 빠진다.

```py
if len(seat_candidates) >= 2:
    return _compare_seat_candidates(...)
```

이 경우 최종 응답은 `ragStatus="skipped"`, `ragAnswer=None`이 된다.

## 10. 좌석 비교 질문이면 후보별 평가

비교 흐름은 `_compare_seat_candidates()`가 담당한다.

처리 순서는 다음과 같다.

1. 후보를 최대 3개까지만 평가한다.
2. 각 후보마다 필터를 별도로 만든다.
3. 후보별로 NestJS 좌석 후기를 검색한다.
4. 후보별 리뷰를 점수화한다.
5. 가장 점수가 높은 후보를 `winner`로 선택한다.
6. 후보들의 근거 리뷰를 합친다.
7. 비교형 답변 문장을 만든다.
8. `SeatRecommendationResponse`를 반환한다.

즉 “A와 B 중 무엇이 더 나아?”는 RAG보다 FastAPI 자체 비교 로직이 우선한다.

## 11. 일반 질문이면 리뷰 검색 범위 결정

비교 질문이 아니면 FastAPI는 `_load_review_scope()`로 리뷰 검색 범위를 정한다.

검색 방식은 다음과 같다.

1. 시야방해 범위 질문이면 별도 범위 검색을 한다.
2. 아니면 정확 조건으로 리뷰를 검색한다.
3. 정확 리뷰가 충분하면 그대로 사용한다.
4. 특정 열 질문인데 리뷰가 부족하면 열 조건을 제거하고 넓게 검색한다.
5. `centerCore` 질문이면 중앙블록 리뷰 중 좌석번호 중앙 6개 정도에 해당하는 리뷰를 먼저 남긴다.
6. 통로 기준 질문이면 같은 블록/같은 offset 리뷰만 남긴다.
7. 정확한 통로 offset 리뷰가 없으면 좌우 번호가 아니라 같은 offset의 앞뒤 열 리뷰를 찾는다.
8. 열 기준 질문이면 `±1열` 근처 리뷰를 찾는다.
9. 그래도 없으면 같은 범위 리뷰를 사용한다.

FastAPI가 NestJS로 보내는 리뷰 검색 요청은 다음 엔드포인트다.

```http
GET /seat-reviews/search
```

## 12. NestJS에서 좌석 후기 검색

NestJS 라우터는 [seat-reviews.controller.ts](../../apps/nest-api/src/seat-reviews/seat-reviews.controller.ts)다.

```ts
@Get("search")
search(@Query() query: SeatReviewQueryDto) {
  return this.seatReviewsService.findAll(query)
}
```

실제 검색은 [seat-reviews.service.ts](../../apps/nest-api/src/seat-reviews/seat-reviews.service.ts)의 `findAll()`이 담당한다.

Prisma로 다음 조건을 조합해 DB를 검색한다.

- 공개 상태 리뷰
- 삭제되지 않은 리뷰
- 극장명
- 작품명
- 시즌
- 층
- 구역
- 열
- 좌석 번호
- 태그
- 시야방해 여부
- 정렬 기준

응답 형태는 다음과 같다.

```ts
{
  items,
  total,
  page,
  limit,
  hasNext,
}
```

FastAPI는 여기서 `items`를 리뷰 목록으로 사용한다.

## 13. `useRag=true`이면 NestJS RAG도 호출

프론트는 현재 항상 `useRag: true`를 보내므로, 일반 질문에서는 FastAPI가 NestJS RAG도 호출한다.

```py
rag = client.post_json(
    "/rag/questions",
    {"question": request.question, "limit": 10},
)
```

결과 처리 방식은 다음과 같다.

- RAG 응답에 `answer`가 있으면 `ragStatus="ok"`
- 응답은 왔지만 `answer`가 없으면 `ragStatus="empty"`
- NestJS 호출이 실패하면 `ragStatus="fallback"`

RAG가 실패해도 FastAPI는 자체 리뷰 기반 답변을 계속 만들 수 있다.

## 14. NestJS RAG 라우터 진입

NestJS RAG 라우터는 [rag.controller.ts](../../apps/nest-api/src/rag/rag.controller.ts)다.

```ts
@Post("questions")
ask(@Body() dto: AskRagQuestionDto) {
  return this.ragService.ask(dto.question, dto.limit)
}
```

DTO는 [ask-rag-question.dto.ts](../../apps/nest-api/src/rag/dto/ask-rag-question.dto.ts)에서 검증된다.

- `question`: 문자열, 최소 2글자
- `limit`: 선택, 1~10

## 15. NestJS RAG가 질문을 파싱

핵심 함수는 [rag.service.ts](../../apps/nest-api/src/rag/rag.service.ts)의 `ask()`다.

먼저 질문을 trim하고 2글자 미만이면 400 에러를 낸다.

그 다음 [rag-query-parser.ts](../../apps/nest-api/src/rag/rag-query-parser.ts)의 `parse()`가 실행된다.

여기서 다음 정보를 추출한다.

- 극장명
- 작품명
- 층
- 구역
- 열
- 좌석 번호
- 좌우/중앙 방향
- 시야방해 태그
- 범위 질문 여부
- 질문 의도: `view`, `sound`, `comfort`, `expression`, `stageVisibility`, `general`

## 16. RAG가 좌석 후기 질문인지 판별

RAG는 먼저 질문이 좌석 후기 기반 질문인지 판단한다.

좌석 후기 질문이 아니면 OpenAI를 호출하지 않고, “좌석 후기 기준 질문에만 답할 수 있다”는 안내 답변을 바로 반환한다.

예를 들어 작품 줄거리, 작가, 일반 작품 설명 같은 질문은 이 단계에서 막힌다.

## 17. RAG 근거 source 검색

좌석 후기 질문이면 `findRelevantSources()`가 근거 후기를 찾는다.

검색 순서는 다음과 같다.

1. 정확 조건 직접 SQL 검색
2. 정확 결과가 부족하고 열 조건이 있으면 근처 열 검색
3. 그래도 부족하면 같은 범위 검색
4. `seat_review_embeddings`에 임베딩이 있으면 질문 임베딩 생성
5. pgvector 유사도 검색
6. 직접 검색 결과와 벡터 검색 결과를 중복 제거해 합침
7. limit만큼 source 반환

임베딩이 없으면 벡터 검색 없이 직접 검색만 사용한다.

## 18. RAG source가 없으면 OpenAI를 호출하지 않음

source가 하나도 없으면 RAG는 OpenAI 답변 생성으로 가지 않는다.

이 경우 “맞는 좌석 후기를 찾지 못했다”는 안전 답변을 반환한다.

## 19. 범위 질문이면 RAG도 직접 계산 답변

“시야방해 몇 열까지 있어?”처럼 범위를 묻는 질문이면 `buildTagRangeAnswer()`가 직접 답변을 만들 수 있다.

이 경우에도 OpenAI 답변 생성으로 가지 않는다.

## 20. 일반 RAG 답변이면 OpenAI 호출

일반 RAG 답변은 [openai-rag.client.ts](../../apps/nest-api/src/rag/openai-rag.client.ts)의 `createAnswer()`가 만든다.

OpenAI Responses API를 호출한다.

```http
POST https://api.openai.com/v1/responses
```

기본 모델은 다음 환경변수로 정한다.

```ts
process.env.OPENAI_CHAT_MODEL ?? "gpt-5.5"
```

프롬프트에는 다음 내용이 들어간다.

- 사용자 질문
- 추출된 필터
- 관련 좌석 후기 source
- 극장, 작품, 시즌, 좌석, 평점, 태그, 후기 내용
- 제공된 후기 안에서만 답하라는 지시
- 일반 작품 지식을 말하지 말라는 지시
- 자연스러운 한국어 1~3문단으로 답하라는 지시

## 21. RAG 쿼리 로그 저장

RAG는 답변을 만든 뒤 `rag_query_logs`에 로그를 저장한다.

저장하는 값은 다음과 같다.

- `question`
- `filters`
- `sourceIds`
- `answerPreview`
- `latencyMs`

로그 저장 실패는 전체 응답 실패로 만들지 않고 무시한다.

## 22. FastAPI 쪽에서 리뷰 점수화

RAG 호출과 별개로 FastAPI는 NestJS에서 가져온 리뷰들을 자체 점수화한다.

점수화 함수는 `_score_review()`다.

점수 기준은 다음과 같다.

- 사용자가 중요하게 본 priority 평점에 가중치 부여
- 특정 배우, 배역, focus subject가 있으면 해당 단어 포함 여부 가산
- focus 질문인데 시야방해가 있으면 감점
- `lowObstruction` 우선순위인데 시야방해/사이드 태그가 있으면 감점
- 왼쪽/중앙/오른쪽 조건과 리뷰 구역 방향이 맞으면 가산
- 질문한 열과 리뷰 열이 같거나 가까우면 가산
- 표정/배우/배역 중심 질문에서는 위 거리 리스크를 더 강하게 감점

점수가 높은 리뷰부터 정렬하고, 상위 `limit`개를 `evidenceReviews`로 변환한다.

## 23. 공식 구역과 설명용 블록 결정

FastAPI는 가장 좋은 리뷰를 기준으로 다음 값을 정한다.

- `officialSection`: 실제 구역, 예: A, B, C
- `descriptiveBlock`: `left`, `center`, `right`, `side`
- `direction`: 사용자에게 보여줄 방향 라벨

구역과 방향은 먼저 [seat_metadata_service.py](../../apps/fastapi-api/app/services/seat_metadata_service.py)의 극장별/층별 `sectionSidesByFloor` 매핑으로 판단한다. 그래서 같은 `D구역`이라도 극장과 층에 따라 왼쪽일 수도, 오른쪽일 수도 있다.

예를 들면 다음처럼 다르게 해석된다.

- TOM 1관 1층 D구역 -> right
- 세종문화회관 대극장 1층 D구역 -> left

극장별/층별 매핑이 없을 때만 다음 공통 fallback 매핑을 사용한다.

- A, D, G -> left
- B, E, H -> center
- C, F -> right

## 24. FastAPI 로컬 답변 생성

FastAPI는 `_build_answer()`로 `local_answer`를 만든다.

의도별 분기는 다음과 같다.

- `obstruction_range`: 시야방해 범위 답변
- `op_assessment`: OP석 평가 답변
- `assessment`: 특정 좌석 평가 답변
- 그 외: 추천 답변

즉 RAG가 없어도 FastAPI 자체적으로 답변 문장을 만들 수 있다.

## 25. 최종 `recommendation` 선택

최종 답변 선택 로직은 다음과 같다.

```py
recommendation = (
    local_answer
    if intent in {"obstruction_range", "op_assessment"} or focus_subject
    else rag_answer or local_answer
)
```

의미는 다음과 같다.

- 시야방해 범위 질문이면 무조건 FastAPI 로컬 답변
- OP석 평가 질문이면 무조건 FastAPI 로컬 답변
- 특정 배우/배역 중심 질문이면 무조건 FastAPI 로컬 답변
- 그 외 일반 질문이면 RAG 답변이 있으면 RAG 답변 사용
- RAG 답변이 없거나 실패하면 FastAPI 로컬 답변 사용

따라서 `fallback`은 여기서 중요한 안전망이다. RAG가 실패해도 `ragStatus="fallback"`만 찍히고, 최종 답변은 `local_answer`로 나갈 수 있다.

## 26. FastAPI 최종 응답 JSON

FastAPI 응답 스키마는 `SeatRecommendationResponse`다.

주요 필드는 다음과 같다.

- `recommendation`: 화면에 보여줄 최종 답변
- `officialSection`: 추천 또는 근거 구역
- `descriptiveBlock`: `left`, `center`, `right`, `side`
- `direction`: 표시용 방향 라벨
- `reasons`: 판단 이유
- `cautions`: 주의사항
- `evidenceReviews`: 근거로 쓴 후기들
- `filters`: 질문에서 추출한 조건들
- `mcpStatus`: 좌석 레이아웃 메타데이터 상태
- `ragStatus`: RAG 상태
- `ragAnswer`: RAG 원문 답변

`filters` 안에는 일반 좌석 조건 외에도 다음 보조 판단 값이 포함될 수 있다.

- `centerCore`: `중중블`처럼 중앙블록 안쪽을 뜻하는 질문인지 여부
- `aisleBlock`: 통로 기준 블록(`left`, `center`, `right`, `side`)
- `aisleOffset`: 통로에서 몇 칸 들어간 자리인지

## 27. 프론트가 받은 답변을 채팅창에 표시

프론트의 `formatAssistantText()`는 현재 다음처럼 되어 있다.

```ts
function formatAssistantText(result: SeatRecommendation) {
  return result.recommendation
}
```

즉 서버 응답에는 `reasons`, `cautions`, `evidenceReviews`, `mcpStatus`, `ragStatus`가 포함되지만, 현재 채팅 UI에는 `recommendation` 문자열만 표시된다.

## 상태값 정리

### `mcpStatus`

좌석 레이아웃 메타데이터 상태다.

- `not_requested`: 극장명이 추출되지 않아 MCP 레이아웃을 조회하지 않음
- `ok`: 내부 레이아웃 매칭 성공
- `fallback`: 내부 레이아웃 매칭 실패 또는 실패 시 기본 레이아웃 사용

### `ragStatus`

RAG 호출 상태다.

- `skipped`: RAG를 호출하지 않음
- `ok`: RAG 답변이 정상 생성됨
- `empty`: RAG 응답은 왔지만 answer가 없음
- `fallback`: RAG 호출 실패, FastAPI 로컬 답변으로 대체

## 핵심 결론

AI 좌석 추천은 다음 세 가지를 조합한다.

1. FastAPI의 규칙 기반 질문 해석과 리뷰 점수화
2. NestJS의 실제 좌석 후기 검색과 RAG source 검색
3. OpenAI의 후기 기반 자연어 답변 생성

따라서 현재 구조에서 FastAPI는 오케스트레이터, NestJS는 데이터와 RAG 제공자, OpenAI는 선택적 답변 생성기로 볼 수 있다.

사용자에게 최종적으로 보이는 문장은 항상 `SeatRecommendationResponse.recommendation`이다.
