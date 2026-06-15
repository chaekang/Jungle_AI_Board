# 프론트엔드 개념 리뷰: 현재 React 코드 기준

이 문서는 현재 `apps/web-react` 코드를 기준으로 프론트엔드 핵심 개념을 정리한 문서다. 초보자는 "이게 무엇인지"를 먼저 이해하고, 경험자는 "이 프로젝트가 그 개념을 어느 정도로 적용하고 있는지"를 빠르게 판단할 수 있도록 썼다.

## 현재 프론트엔드 구조 요약

현재 프론트엔드는 React + Vite 기반의 CSR 앱이다.

- 진입점: `apps/web-react/src/main.tsx`
- 라우팅: `apps/web-react/src/App.tsx`
- 공통 API 요청: `apps/web-react/src/shared/api.ts`
- 인증 화면과 API: `apps/web-react/src/features/auth/`
- 후기 게시판, 작성, 극장별 페이지: `apps/web-react/src/features/reviews/`
- 댓글: `apps/web-react/src/features/comments/`
- 태그: `apps/web-react/src/features/tags/`
- 관리자 화면: `apps/web-react/src/features/admin/`
- 좌석 추천과 Agent 패널: `apps/web-react/src/features/agent/`

라우팅 흐름은 다음과 같다.

```text
main.tsx
  -> App.tsx
    -> BrowserRouter
      -> /
      -> /theaters/:theaterId
      -> /auth
      -> /admin
      -> /reviews/new
      -> /reviews/:reviewId/edit
```

## 1. 상태관리

### 상태란 무엇인가

프론트엔드에서 상태는 "화면이 기억하고 있어야 하는 값"이다.

예를 들면 다음 값들이 상태다.

- 검색창에 입력한 글자
- 현재 선택한 극장, 태그, 좌석 필터
- 현재 로그인한 사용자
- 후기 목록, 댓글 목록
- 로딩 중인지 여부
- 에러 메시지
- 상세 모달이 열려 있는지 여부
- 현재 페이지 번호
- 관리자 화면에서 보고 있는 신고 상태

React는 상태가 바뀌면 관련 화면을 다시 렌더링한다. 즉 상태는 "화면이 바뀌는 원인"이라고 보면 된다.

### 상태관리 툴이란 무엇인가

상태관리 툴은 여러 컴포넌트가 함께 사용해야 하는 데이터를 한 곳에서 관리하고, 데이터가 바뀌었을 때 필요한 컴포넌트들이 최신 상태를 반영하도록 도와주는 도구다.

대표적인 도구는 다음과 같다.

- Redux: 전역 상태와 변경 흐름을 엄격하게 관리한다.
- Zustand: Redux보다 가볍게 전역 store를 만들 수 있다.
- Recoil/Jotai: 작은 단위의 상태를 조합하는 방식에 가깝다.
- React Query/SWR: 서버에서 가져온 데이터, 로딩, 캐시, 재요청, 에러 처리를 다룬다.
- Context API: React 내장 기능이다. 테마나 인증 사용자처럼 넓은 범위에 필요한 값을 전달할 때 쓴다.

중요한 점은 "상태관리 툴은 무조건 넣어야 하는 것"이 아니라는 점이다. 상태가 특정 페이지 안에서만 쓰이고 구조가 단순하면 `useState`, `useEffect`, custom hook만으로도 충분하다.

### 이 프로젝트의 현재 상태관리 방식

현재 프로젝트는 별도 전역 상태관리 라이브러리를 쓰지 않는다.

`apps/web-react/package.json` 기준 핵심 의존성은 다음 정도다.

- `react`
- `react-dom`
- `react-router-dom`

Redux, Zustand, React Query 같은 상태관리 도구는 없다.

현재 상태관리는 주로 다음 방식으로 되어 있다.

- 컴포넌트 내부 상태: `useState`
- 서버 데이터 로딩: `useEffect`
- 파생 값 계산: `useMemo`
- 반복되는 데이터 로딩 로직: custom hook
- 라우트 이동: `react-router-dom`의 `useNavigate`, `Navigate`
- 인증 요청: httpOnly cookie 기반 세션을 사용하고, 프론트 요청은 `credentials: "include"`를 붙인다.

예시는 다음 파일에서 볼 수 있다.

- `ReviewBoardPage.tsx`: 검색어, 필터, 정렬, 페이지, 선택된 후기, 로그인 사용자, 신고/삭제 에러 등을 관리한다.
- `TheaterReviewsPage.tsx`: 특정 극장 페이지의 검색어, 태그 검색어, 좌석 필터, 평점 필터, 보기 모드, 선택된 후기를 관리한다.
- `ReviewCreatePage.tsx`: 후기 작성/수정 폼의 입력 상태를 관리한다.
- `ReviewComments.tsx`: 댓글, 답글, 수정 중인 댓글, 좋아요, 신고 에러를 관리한다.
- `AdminPage.tsx`: 신고 목록, 감사 로그, 선택한 신고 상태, 처리 중 상태를 관리한다.
- `hooks/useSeatReviews.ts`: 후기 목록, total, page, loading, error를 묶어서 관리한다.
- `hooks/useReviewMetadata.ts`: 극장/공연 메타데이터 로딩 상태를 관리한다.

이전에는 로그인 토큰을 `localStorage`에 저장하는 구조였지만, 현재는 브라우저가 httpOnly cookie를 자동으로 보내는 방식이다. 그래서 프론트 상태에는 access token 자체가 없다.

### 현재 상태관리 평가

현재 방식은 "페이지 로컬 상태 + custom hook" 중심이다. 초기 서비스나 학습 프로젝트 단계에서는 합리적인 선택이다.

장점은 다음과 같다.

- 새 상태관리 라이브러리 학습 비용이 없다.
- 데이터 위치가 비교적 직접적이다.
- 기능을 빠르게 만들 수 있다.
- 빌드 크기와 설정 복잡도가 늘지 않는다.

주의할 점도 있다.

- `ReviewBoardPage.tsx`, `ReviewCreatePage.tsx`, `AdminPage.tsx`처럼 페이지 컴포넌트가 커지면 읽기 어려워질 수 있다.
- 서버 데이터 캐시가 없어서 같은 데이터를 여러 번 요청할 수 있다.
- 로그인 사용자 로딩이 여러 화면에 필요해지면 `useAuthUser` 같은 hook이나 Context로 묶는 편이 좋다.
- 관리자, 댓글, 후기 목록처럼 서버 상태가 많아지면 React Query 도입을 검토할 만하다.

지금 당장 Redux나 Zustand를 넣을 필요는 크지 않다. 서버 데이터가 더 많아지고 캐싱, 재시도, invalidation이 중요해지는 시점에는 React Query가 가장 먼저 검토할 만하다.

## 2. 테스트

### 테스트란 무엇인가

테스트는 코드가 의도한 대로 동작하는지 자동으로 확인하는 장치다.

자동 테스트가 있으면 다음 장점이 있다.

- 수정 후 기존 기능이 깨졌는지 빠르게 알 수 있다.
- 복잡한 조건을 반복해서 검증할 수 있다.
- 코드의 의도를 문서처럼 남길 수 있다.
- 리팩터링할 때 안전망이 된다.

### 프론트엔드 테스트 종류

프론트엔드 테스트는 보통 여러 층으로 나뉜다.

단위 테스트는 작은 함수 하나가 맞게 동작하는지 본다.

예:

- 검색 조건을 URL query로 바꾸는 함수
- 좌석 번호 정렬 함수
- 페이지네이션 계산 함수

컴포넌트 테스트는 React 컴포넌트가 특정 props와 상태에서 맞게 렌더링되는지 본다.

예:

- 버튼을 누르면 콜백이 호출되는지
- 로딩 상태에서 올바른 문구가 보이는지
- 빈 목록일 때 empty state가 보이는지

통합 테스트는 여러 함수, 컴포넌트, API mock을 묶어서 사용자 흐름을 본다.

예:

- 로그인 확인 요청에 쿠키 credentials가 붙는지
- 신고 요청 후 관리자 목록 API를 호출하는지
- 댓글 답글 작성 후 목록 상태가 갱신되는지

E2E 테스트는 실제 브라우저에서 사용자가 하는 것처럼 클릭하고 입력하면서 전체 흐름을 검증한다.

예:

- 로그인 -> 후기 작성 -> 게시판에서 확인
- 극장별 페이지 진입 -> 필터 변경 -> 후기 상세 열기
- 관리자 페이지 진입 -> 신고 처리 -> 감사 로그 확인

### 현재 프로젝트에서 진행 중인 테스트

현재 `apps/web-react/package.json`에는 `test` script가 있다.

```json
{
  "test": "node --experimental-strip-types src/shared/api.test.ts && node --experimental-strip-types src/e2e/auth-report-admin-flow.test.ts && node --experimental-strip-types src/features/comments/comment-api-paths.test.ts && node --experimental-strip-types src/features/reviews/review-search-query.test.ts"
}
```

공식적으로 실행하는 프론트 테스트는 다음이다.

- `src/shared/api.test.ts`: 모든 API 요청에 `credentials: "include"`가 붙는지 확인한다.
- `src/e2e/auth-report-admin-flow.test.ts`: 로그인, 후기 신고, 댓글 신고, 관리자 신고 목록, 숨김 처리 API 흐름을 mock fetch로 확인한다.
- `src/features/comments/comment-api-paths.test.ts`: 댓글 목록 API 경로 생성이 맞는지 확인한다.
- `src/features/reviews/review-search-query.test.ts`: 후기 검색 조건이 API query로 맞게 변환되는지 확인한다.

또한 `src` 안에는 다른 `.test.ts` 파일도 있다.

- `features/tags/tag-api-paths.test.ts`
- `features/reviews/review-board-filters.test.ts`
- `features/reviews/review-board-tag-filters.test.ts`
- `features/reviews/review-create-seat-layout.test.ts`
- `features/reviews/review-pagination.test.ts`
- `features/reviews/seat-layout-options.test.ts`
- `features/reviews/seat-map-position.test.ts`

다만 일부 오래된 테스트 파일은 현재 test script에 직접 연결되어 있지 않다. 운영 검증 기준으로 보려면 test script에 포함하거나 Vitest 같은 테스트 러너로 정리하는 것이 좋다.

### 현재 테스트 평가

현재 테스트는 UI 렌더링보다 "깨지면 치명적인 순수 로직과 API 흐름"에 집중되어 있다.

좋은 점은 다음과 같다.

- 인증 쿠키 요청 방식이 `credentials: "include"`로 유지되는지 확인한다.
- 신고와 관리자 API 흐름을 mock fetch로 확인한다.
- 후기 검색 query와 댓글 API path처럼 사용자 경험에 직접 영향을 주는 로직을 검증한다.
- 별도 테스트 라이브러리 추가 없이 Node로 빠르게 실행된다.

한계도 있다.

- React 컴포넌트 렌더링 테스트는 아직 없다.
- 실제 브라우저 기반 Playwright/Cypress E2E는 아직 없다.
- 오래된 `.test.ts` 파일 일부가 공식 test script에 포함되어 있지 않다.
- mock fetch 기반 흐름 테스트는 실제 DOM 클릭이나 브라우저 동작까지 보지는 않는다.

다음 단계로는 Vitest + React Testing Library를 도입해 `ReviewComments`, `SeatReviewCard`, `AdminPage`의 핵심 상호작용을 테스트하고, 가장 중요한 사용자 흐름만 Playwright로 추가하는 것이 좋다.

## 3. 컴포넌트 설계

### 컴포넌트 설계란 무엇인가

컴포넌트는 화면을 구성하는 독립적인 조각이다.

예를 들어 후기 게시판 화면은 다음 조각으로 나눌 수 있다.

- 검색 영역
- 필터 영역
- 후기 카드
- 페이지네이션
- 후기 상세 모달
- 댓글 영역
- 좌석 배치도

컴포넌트 설계는 "화면을 어떤 단위로 나누고, 각 단위가 무엇을 책임질지 정하는 것"이다.

좋은 컴포넌트는 보통 다음 특징을 가진다.

- 책임이 명확하다.
- props가 지나치게 많지 않다.
- 내부 상태와 외부 입력이 구분된다.
- API 호출과 UI 렌더링이 과하게 섞이지 않는다.
- 재사용 가능한 UI가 작은 컴포넌트로 분리되어 있다.
- 페이지 전체 흐름은 page component가 관리한다.
- 반복되는 비즈니스 로직은 hook이나 순수 함수로 빠져 있다.

### 이 프로젝트의 컴포넌트 구조

페이지 컴포넌트:

- `ReviewBoardPage.tsx`: 전체 후기 게시판
- `TheaterReviewsPage.tsx`: 극장별 후기 페이지
- `ReviewCreatePage.tsx`: 후기 작성/수정 페이지
- `AdminPage.tsx`: 신고 처리와 감사 로그를 보는 관리자 페이지
- `AuthPage.tsx`: 로그인/회원가입 화면

재사용 컴포넌트:

- `components/SeatReviewCard.tsx`: 후기 카드
- `components/TheaterSeatMap.tsx`: 좌석 배치도
- `components/MetadataSelects.tsx`: 후기 작성 폼의 메타데이터 선택 UI
- `components/SeatLocationFields.tsx`: 좌석 위치 입력 UI
- `components/DraftPayloadPreview.tsx`: 작성 payload 미리보기
- `comments/components/ReviewComments.tsx`: 후기 댓글, 답글, 좋아요, 신고 UI
- `tags/components/TagSelector.tsx`: 태그 선택 UI

로직 hook:

- `hooks/useSeatReviews.ts`: 후기 목록 로딩
- `hooks/useReviewMetadata.ts`: 극장/공연 메타데이터 로딩

순수 로직:

- `review-search-query.ts`: 검색 상태를 API query로 변환
- `review-board-filters.ts`: 후기 필터링과 좌석 옵션 추출
- `review-pagination.ts`: 페이지네이션 계산
- `seat-layout-options.ts`: 좌석 옵션 구성
- `seat-map-position.ts`: 좌석 위치 계산

### 지금 설계가 어느 정도 되어 있는가

현재 설계는 "기능별 폴더 구조가 있고, 일부 재사용 컴포넌트와 hook이 분리되어 있지만, 큰 페이지 컴포넌트도 아직 남아 있는 상태"다.

잘 되어 있는 부분:

- `features/` 기준으로 도메인을 나누고 있다.
- 후기, 댓글, 태그, 인증, 관리자 기능이 분리되어 있다.
- API 호출 함수가 feature별 `api.ts`와 공통 `shared/api.ts`로 모여 있다.
- 서버 응답 타입이 `types.ts`에 정리되어 있다.
- 후기 카드, 댓글, 좌석 배치도 같은 UI 조각이 컴포넌트화되어 있다.
- 검색 query, 필터, 좌석 계산처럼 테스트하기 좋은 로직이 순수 함수로 분리되어 있다.

개선할 수 있는 부분:

- `ReviewBoardPage.tsx`가 검색, 필터, 인증 사용자, 삭제, 신고, 상세 모달, 좌석 배치 전환까지 많은 책임을 가진다.
- `ReviewCreatePage.tsx`도 폼 상태와 API 흐름이 많다.
- `AdminPage.tsx`는 아직 신고 목록과 감사 로그, 처리 액션이 한 파일에 모여 있다.
- 공통 로딩/에러/빈 상태 UI가 페이지마다 조금씩 반복된다.
- 인증 사용자 로딩 로직은 `useAuthUser` hook으로 분리하면 더 깔끔하다.

지금 구조는 초기 서비스로는 충분히 이해 가능하다. 기능이 더 커지면 페이지를 더 작은 섹션 컴포넌트와 hook으로 나누는 리팩터링이 필요하다.

## 4. 이벤트

### 이벤트란 무엇인가

이벤트는 사용자가 화면에서 어떤 행동을 했거나 브라우저/시스템에서 어떤 일이 일어났다는 신호다.

대표적인 이벤트는 다음과 같다.

- 클릭: `onClick`
- 입력값 변경: `onChange`
- 키보드 입력: `onKeyDown`
- 폼 제출: `onSubmit`
- 마우스 다운: `onMouseDown`
- 브라우저 키 이벤트: `window.addEventListener("keydown", ...)`

React에서는 이벤트를 JSX props로 연결한다.

```tsx
<button onClick={handleClick}>저장</button>
<input value={searchText} onChange={(event) => setSearchText(event.target.value)} />
```

이벤트는 보통 상태를 바꾸거나, API를 호출하거나, 라우트를 이동시키는 계기가 된다.

### 이 프로젝트에서 이벤트가 사용되는 곳

후기 게시판에서는 다음 이벤트가 중요하다.

- 검색창 입력: `onChange`
- 필터 버튼 클릭: `onClick`
- 정렬 메뉴 열기/닫기: `onClick`
- 후기 카드 클릭: `onClick`
- 키보드 Enter/Space로 카드 선택: `onKeyDown`
- 상세 모달 배경 클릭: `onMouseDown`
- ESC 키로 모달 닫기: `window.addEventListener("keydown", ...)`
- 페이지네이션 이전/다음 클릭: `onClick`
- 후기 작성 버튼 클릭: `useNavigate`로 라우트 이동
- 후기 신고 버튼 클릭: `reportSeatReview` 호출
- 후기 삭제 버튼 클릭: `deleteSeatReview` 호출

댓글에서는 다음 이벤트가 중요하다.

- 댓글 입력: `onChange`
- 댓글 작성: `createComment`
- 답글 작성: `createComment`에 `parentId` 전달
- 댓글 수정: `updateComment`
- 댓글 삭제: `deleteComment`
- 좋아요/좋아요 취소: `likeComment`, `unlikeComment`
- 댓글 신고: `reportComment`

관리자 화면에서는 다음 이벤트가 중요하다.

- 신고 상태 필터 변경
- 신고 대상 숨김 처리
- 신고 대상 복구
- 신고 대상 강제 삭제
- 감사 로그 로딩

카드 내부 버튼은 이벤트 전파를 막는다. 예를 들어 `SeatReviewCard`에서 Report/Edit/Delete 버튼을 누를 때 부모 카드의 상세 열기 이벤트까지 같이 실행되면 안 된다. 그래서 `event.stopPropagation()`을 사용한다.

### 이벤트 설계 평가

현재 이벤트 처리는 React 기본 패턴을 따른다.

좋은 점:

- 사용자 입력은 state로 연결되어 있다.
- API 호출 성공 후 로컬 목록 상태를 즉시 갱신한다.
- 카드 내부 버튼이 부모 카드 클릭으로 번지지 않도록 처리한다.
- 인증이 필요한 액션은 비로그인 상태에서 막고 메시지를 보여준다.

개선할 점:

- `window.prompt`, `window.confirm`을 쓰는 신고/삭제 흐름은 빠르게 구현하기 좋지만, 나중에는 모달 UI로 바꾸는 편이 좋다.
- 페이지 컴포넌트에 이벤트 핸들러가 많아지고 있으므로 기능별 hook으로 분리하면 읽기 쉬워진다.
- 신고 완료 같은 성공 피드백은 현재 약하다. toast나 inline success state가 있으면 사용자가 더 명확히 알 수 있다.

## 5. 라우팅

### 라우팅이란 무엇인가

라우팅은 URL에 따라 어떤 화면을 보여줄지 결정하는 구조다.

예:

```text
/                 -> 전체 후기 게시판
/auth             -> 로그인/회원가입
/admin            -> 관리자 신고/감사 로그 화면
/reviews/new      -> 후기 작성
/reviews/123/edit -> 후기 수정
/theaters/abc     -> 특정 극장 후기 페이지
```

React SPA에서는 브라우저가 HTML을 매번 새로 받는 대신, 프론트 앱 안에서 URL을 보고 컴포넌트를 바꿔 렌더링한다.

### 이 프로젝트의 라우팅 방식

현재 라우팅은 `react-router-dom`을 사용한다. 핵심 파일은 `apps/web-react/src/App.tsx`다.

현재 구조는 다음과 같다.

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<ReviewBoardPage />} />
    <Route path="/theaters/:theaterId" element={<TheaterReviewsPage />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/admin" element={<RequireAuth>...</RequireAuth>} />
    <Route path="/reviews/new" element={<RequireAuth>...</RequireAuth>} />
    <Route path="/reviews/:reviewId/edit" element={<RequireAuth>...</RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

각 라우트의 의미는 다음과 같다.

- `/`: 공개 후기 게시판
- `/theaters/:theaterId`: 특정 극장 후기 검색 페이지
- `/auth`: 로그인/회원가입
- `/admin`: 로그인 필요, 관리자 기능 화면
- `/reviews/new`: 로그인 필요, 후기 작성
- `/reviews/:reviewId/edit`: 로그인 필요, 후기 수정
- `*`: 정의되지 않은 URL은 `/`로 이동

### 인증 라우팅

작성, 수정, 관리자 화면은 `RequireAuth`로 보호된다.

현재 `RequireAuth`는 `localStorage` 토큰을 확인하지 않는다. 대신 `/auth/me`를 호출해 서버의 httpOnly cookie 세션이 유효한지 확인한다.

흐름은 다음과 같다.

```text
보호 라우트 진입
  -> GET /auth/me
  -> 성공: 화면 표시
  -> 실패: /auth로 이동, redirectTo 저장
```

프론트는 쿠키 내용을 읽을 수 없다. 이것이 httpOnly cookie의 목적이다. 대신 요청에 `credentials: "include"`를 붙이면 브라우저가 쿠키를 자동으로 보낸다.

주의할 점은 `/admin` 라우트의 프론트 보호는 로그인 여부만 확인한다는 점이다. 실제 관리자 권한 검증은 백엔드의 `AdminGuard`가 한다. 프론트 라우팅은 사용자 경험을 위한 1차 장치이고, 진짜 보안은 서버가 책임진다.

### lazy loading과 Suspense

일부 페이지는 lazy loading된다.

```tsx
const ReviewCreatePage = lazy(() => import("./features/reviews/ReviewCreatePage"))
const TheaterReviewsPage = lazy(() => import("./features/reviews/TheaterReviewsPage"))
const AdminPage = lazy(() => import("./features/admin/AdminPage"))
```

lazy loading은 처음 진입할 때 모든 페이지 코드를 한 번에 받지 않고, 해당 페이지가 필요해질 때 나중에 받는 방식이다. `Suspense`는 코드가 로딩되는 동안 fallback UI를 보여준다.

현재 방식은 CSR 앱에서 초기 로딩 비용을 줄이는 데 적절하다.

### 현재 라우팅 평가

좋은 점:

- 공개 페이지와 인증 필요 페이지가 구분되어 있다.
- 존재하지 않는 경로는 `/`로 보낸다.
- 작성/수정/극장별/관리자 페이지가 lazy loading된다.
- 극장별 페이지처럼 공유 가능한 URL이 있다.

개선할 점:

- 공개 후기 상세 URL인 `/reviews/:reviewId`가 아직 없다. 현재 상세는 게시판/극장 페이지 안의 모달 흐름에 가깝다.
- SEO가 중요해지면 SSR/SSG를 검토할 수 있다.
- 관리자 화면은 서버에서 권한을 막지만, 프론트에서도 현재 사용자가 관리자임을 표시하거나 접근 전 안내를 줄 수 있다.
- route 설정이 더 많아지면 별도 route config 파일로 분리할 수 있다.

## 6. 상태와 Props

### State와 Props의 차이

React에서 state와 props는 화면을 그리는 데이터라는 점은 같지만 역할이 다르다.

State는 컴포넌트가 직접 관리하는 값이다.

```tsx
const [searchText, setSearchText] = useState("")
```

이 값은 컴포넌트 내부에서 바뀐다. 검색창 입력, 버튼 클릭, API 응답 같은 이벤트로 변경된다.

Props는 부모 컴포넌트가 자식 컴포넌트에게 전달하는 값이다.

```tsx
<SeatReviewCard review={review} onSelect={setSelectedReview} />
```

`SeatReviewCard`는 `review` 데이터를 직접 가져오지 않는다. 부모가 넘겨준 `review` props를 받아 화면에 표시한다.

정리하면 다음과 같다.

```text
State: 내가 들고 있는 값
Props: 부모에게 받은 값
```

### 왜 구분이 중요한가

state와 props를 구분하지 못하면 컴포넌트 구조가 빠르게 복잡해진다.

좋은 원칙은 다음과 같다.

- 여러 자식이 함께 써야 하는 값은 공통 부모가 state로 가진다.
- 자식은 필요한 값과 이벤트 핸들러를 props로 받는다.
- 자식은 가능한 한 API 호출이나 라우팅 세부사항을 직접 알지 않는다.
- 같은 값을 여러 곳에서 따로 state로 들고 있으면 동기화 버그가 생길 수 있다.

### 이 프로젝트에서 State가 쓰이는 방식

`ReviewBoardPage.tsx`는 게시판 화면의 주요 state를 가진다.

- `searchText`
- `activeFilterMode`
- `filterSearchText`
- `selectedFilter`
- `sortKey`
- `seatFilter`
- `reviewPage`
- `viewMode`
- `selectedReview`
- `currentUser`
- `actionError`

`TheaterReviewsPage.tsx`는 극장별 페이지의 state를 가진다.

- `searchText`
- `tagText`
- `sortKey`
- `seatFilter`
- `ratingFilters`
- `reviewPage`
- `viewMode`
- `selectedReview`

`ReviewCreatePage.tsx`는 후기 작성/수정 폼 state를 가진다.

- 선택한 극장
- 선택한 공연
- 좌석 위치
- 평점
- 후기 본문
- 태그
- 제출 중인지 여부

`ReviewComments.tsx`는 댓글 영역의 state를 가진다.

- 댓글 목록
- 새 댓글 입력값
- 답글 대상
- 답글 입력값
- 수정 중인 댓글
- 로딩/제출/에러 상태

`AdminPage.tsx`는 관리자 화면 state를 가진다.

- 신고 목록
- 감사 로그
- 현재 신고 상태 필터
- 로딩/처리/에러 상태

### 이 프로젝트에서 Props가 쓰이는 방식

`SeatReviewCard`는 props 기반 컴포넌트다.

주요 props:

- `review`: 표시할 후기 데이터
- `onSelect`: 카드 선택 시 실행할 함수
- `onTheaterSelect`: 극장명 클릭 시 실행할 함수
- `onEdit`: 수정 버튼 클릭 시 실행할 함수
- `onDelete`: 삭제 버튼 클릭 시 실행할 함수
- `onReport`: 신고 버튼 클릭 시 실행할 함수
- `variant`: 기본 카드인지 상세 카드인지
- `canManage`: 수정/삭제 버튼 표시 여부

`ReviewComments`는 다음 props를 받는다.

- `reviewId`: 어떤 후기의 댓글인지
- `isAuthenticated`: 로그인 상태인지
- `currentUserId`: 현재 사용자 id

이전처럼 `authToken`을 props로 받지 않는다. 인증은 쿠키 세션으로 처리되며, API 요청에는 공통 `apiRequest`가 `credentials: "include"`를 붙인다.

`TheaterSeatMap`은 좌석 배치도 표시와 액션에 필요한 값을 props로 받는다.

- `reviews`
- `theaterName`
- `currentUserId`
- `onEditReview`
- `onDeleteReview`

### State와 Props 흐름 예시

후기 카드 클릭 흐름은 다음과 같다.

```text
ReviewBoardPage
  state: selectedReview
  -> SeatReviewCard에 onSelect 전달
  -> 사용자가 카드 클릭
  -> SeatReviewCard가 onSelect(review) 호출
  -> ReviewBoardPage의 selectedReview 변경
  -> selectedReview가 있으므로 상세 모달 렌더링
```

댓글 좋아요 흐름은 다음과 같다.

```text
ReviewComments
  state: comments
  -> 사용자가 Like 클릭
  -> likeComment 또는 unlikeComment API 호출
  -> 성공하면 comments 트리에서 해당 댓글의 likedByMe, likeCount 갱신
```

이처럼 데이터는 부모에서 자식으로 내려가고, 이벤트는 자식에서 부모 또는 내부 핸들러로 올라간다.

## 전체 평가

현재 프론트엔드는 React 기본기를 중심으로 구성되어 있다.

- 상태관리: 별도 전역 상태관리 도구 없이 `useState`, `useEffect`, custom hook 중심
- 테스트: 공식 `test` script가 생겼고, 쿠키 인증 요청과 신고/관리자 API 흐름을 검증한다.
- 컴포넌트 설계: 기능별 폴더와 재사용 컴포넌트가 있으나, 일부 페이지 컴포넌트는 아직 크다.
- 이벤트: React 이벤트 핸들러와 API 호출, 상태 갱신을 적절히 사용한다.
- 라우팅: React Router 기반 CSR 라우팅이며, `/admin`과 작성/수정 화면은 `RequireAuth`로 보호한다.
- 상태/Props: 부모가 state를 갖고 자식에게 props와 callback을 넘기는 기본 흐름을 따른다.
- 인증: 프론트 저장소에 access token을 두지 않고, httpOnly cookie 세션을 사용한다.

지금 단계에서는 Tailwind, Bootstrap, Redux, SSR을 무리하게 넣기보다 현재 구조를 정리하면서 필요한 곳만 점진적으로 보강하는 편이 좋다.

우선순위는 다음과 같다.

1. `useAuthUser` hook으로 인증 사용자 로딩 통일
2. `ReviewBoardPage`, `AdminPage`를 작은 섹션 컴포넌트로 분리
3. Vitest + React Testing Library로 주요 컴포넌트 테스트 추가
4. 가장 중요한 사용자 흐름만 Playwright E2E로 추가
5. 서버 데이터 캐싱이 중요해지는 시점에 React Query 검토
