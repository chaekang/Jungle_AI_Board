# 관측성과 테스트 신호

이 문서는 현재 구현된 request logging, 운영 신호, 테스트 명령을 정리한다.

## Request Logging

Nest API는 모든 응답에 `x-request-id` header를 붙인다.

클라이언트가 `x-request-id`를 보내면 서버는 그 값을 유지한다. 보내지 않으면 서버가 새 UUID를 생성한다.

요청이 끝나면 JSON 형태의 로그가 남는다.

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `ip`

이 값은 장애를 추적할 때 프론트 요청, 백엔드 로그, 관리자 액션, RAG 로그를 연결하는 기준점이 된다.

## 운영 신호

인증과 세션:

- `/auth/login`, `/auth/refresh`, `/auth/logout` status code
- `auth_sessions.revoked_at`
- refresh token rotation 실패
- password reset token 만료 또는 사용 여부

관리자와 신고:

- `review_reports`
- `comment_reports`
- `audit_logs`
- 숨김, 복구, 강제 삭제 액션
- actor id와 target id

RAG 품질:

- `rag_query_logs.question`
- `rag_query_logs.filters`
- `rag_query_logs.source_ids`
- `rag_query_logs.answer_preview`
- `rag_query_logs.latency_ms`
- `seat_review_embeddings.metadata`
- `seat_review_embeddings.document_version`

프론트 API 흐름:

- 모든 API 요청이 `credentials: "include"`를 포함하는지
- 후기 신고와 댓글 신고가 관리자 신고 목록으로 이어지는지
- 관리자 숨김/복구/강제 삭제 API path가 맞는지

## 검증 명령

백엔드 전체 테스트:

```bash
npm --prefix apps/nest-api test -- --runInBand
```

프론트 테스트:

```bash
npm --prefix apps/web-react run test
```

Nest 빌드:

```bash
npm run nest:build
```

웹 빌드:

```bash
npm run web:build
```

## 최근 확인된 결과

최근 구현 검증에서 다음이 통과했다.

- Nest 테스트: 13 suites, 50 tests
- 프론트 테스트: `shared/api`, `auth-report-admin-flow`, `comment-api-paths`, `review-search-query`
- Nest production build
- Vite production build

웹 빌드는 성공했지만 `seat-map-position` chunk가 500KB보다 크다는 Vite 경고가 남아 있다. 기능 실패는 아니지만, 나중에 코드 splitting이나 chunk 설정을 검토할 수 있다.

## 남은 관측성 개선점

- 에러 응답 body에 `requestId`를 표준 포함
- 관리자 액션 로그 검색/필터링 강화
- RAG 평가 질문별 성공/실패 라벨링
- 실제 브라우저 기반 Playwright E2E 추가
- 운영 로그 수집 도구와 연결
