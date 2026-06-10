# 001_authentication_security_upgrade_concepts

## 현재 파일 경로 규칙

이 문서에서 코드를 추가하거나 예시 경로를 적을 때는 아래 규칙을 따른다.

- Nest 인증 코드는 `apps/nest-api/src/auth`, 사용자 조회는 `apps/nest-api/src/users`, 공통 사용자 타입은 `apps/nest-api/src/common`에 둔다.
- React 인증 코드는 `apps/web-react/src/features/auth`에 둔다.
- React 공통 HTTP 요청 함수는 `apps/web-react/src/shared/api.ts`에 둔다.
- React 화면, 컴포넌트, 스타일, 타입, 요청 코드는 기능 폴더 안에서 역할별로 나눈다.
- DTO는 Nest 도메인 폴더 아래 `dto`, 타입/인터페이스는 해당 기능 폴더의 `types.ts` 또는 `interfaces`에 둔다.

## 이 문서의 역할

이 문서는 `001_authentication_security_upgrade` 단계에서 알아야 하는
인증 고도화 개념을 정리한 문서다.
1차에서 만든 `localStorage + access token` 구조를
왜 2차에서 `httpOnly cookie + refresh token + 세션 추적` 구조로 올리는지 이해하는 데 초점을 둔다.

실제 구현 순서는 [docs/step 2/001_authentication_security_upgrade.md](../001_authentication_security_upgrade.md)에서 따라가고,
이 문서는 "왜 이렇게 설계하는가", "언제 쓰는가", "어떤 문제가 있는가"를 설명하는 참고 문서다.

## 이 단계가 중요한 이유

1차 인증은 학습과 MVP 속도 면에서는 좋지만,
운영 관점에서는 아래 약점이 남는다.

- 토큰 탈취 시 방어 수단이 약하다
- 로그아웃과 세션 철회가 제한적이다
- 장기 로그인 유지 전략이 없다
- 브라우저 보안 속성과 실제 배포 환경 설정이 분리되어 있다

그래서 2차 인증은 단순히 "기능 추가"가 아니라
서비스를 운영 가능한 수준으로 올리는 보안 설계 단계라고 볼 수 있다.

## 핵심 개념

### `httpOnly cookie`

정의:

브라우저 JavaScript에서 직접 읽을 수 없도록 막은 쿠키다.
주로 인증 토큰, 세션 식별자 같은 민감한 값을 저장할 때 사용한다.

언제 쓰는가:

- 브라우저 기반 웹 서비스 인증
- XSS가 발생해도 토큰 노출 가능성을 줄이고 싶을 때
- 프론트가 토큰 문자열을 직접 다루지 않게 하고 싶을 때

어떻게 사용하는가:

- 서버가 `Set-Cookie` 헤더로 발급한다
- `httpOnly`, `secure`, `sameSite`, `path`, `maxAge` 같은 속성을 함께 준다
- 프론트는 `fetch`나 `axios`에서 `credentials: 'include'`로 요청한다

장점:

- XSS가 나도 브라우저 JS에서 토큰을 바로 읽기 어렵다
- 프론트 코드가 단순해질 수 있다
- 브라우저의 기본 쿠키 정책을 활용할 수 있다

문제 / 주의점:

- `CORS credentials` 설정을 잘못하면 요청이 막힌다
- `CSRF` 대응이 필요하다
- 모바일 앱이나 비브라우저 클라이언트와 정책을 통일하기 어려울 수 있다

면접 포인트:

"브라우저 기반 서비스에서는 토큰을 JS 메모리나 localStorage에 두는 것보다 httpOnly cookie가 XSS 방어 측면에서 유리합니다. 다만 cookie를 쓰는 순간 CSRF와 CORS를 같이 설계해야 해서 구현 난이도는 올라갑니다."

### `Refresh Token`

정의:

짧은 수명의 `Access Token`이 만료됐을 때,
사용자를 다시 로그인시키지 않고 새로운 Access Token을 발급하기 위한 장기 토큰이다.

언제 쓰는가:

- 로그인 유지가 필요한 서비스
- Access Token 수명을 짧게 가져가고 싶을 때
- 보안과 사용자 경험의 균형을 맞추고 싶을 때

어떻게 사용하는가:

- 로그인 시 `Access Token`과 `Refresh Token`을 함께 발급한다
- `Access Token`은 API 호출용, `Refresh Token`은 재발급 전용으로 분리한다
- 재발급 시 `Refresh Token`을 회전(rotation)시키고 이전 토큰은 폐기하는 구조가 안전하다

장점:

- Access Token을 짧게 유지해 탈취 피해를 줄일 수 있다
- 사용자 재로그인 빈도를 줄일 수 있다
- 세션 관리 정책을 더 유연하게 설계할 수 있다

문제 / 주의점:

- 구현이 복잡해진다
- 재발급 API가 새로운 공격 지점이 될 수 있다
- 토큰 저장 / 회전 / 폐기 / 만료 전략을 제대로 설계해야 한다

면접 포인트:

"Refresh Token은 로그인 편의성을 위한 기능이 아니라 Access Token을 짧게 가져가기 위한 보안 설계의 일부라고 보는 게 더 정확합니다."

### `Token Rotation`

정의:

Refresh Token을 사용할 때마다 새 Refresh Token을 다시 발급하고,
이전에 쓰던 토큰은 더 이상 못 쓰게 만드는 방식이다.

언제 쓰는가:

- Refresh Token 탈취 피해를 줄이고 싶을 때
- 세션 하이재킹 탐지 가능성을 높이고 싶을 때

어떻게 사용하는가:

- 재발급 요청이 오면 현재 Refresh Token의 유효성을 확인한다
- 새 Refresh Token을 발급하고 저장한다
- 이전 Refresh Token은 폐기 처리한다

장점:

- 재사용 공격 탐지 가능성이 높아진다
- 한 번 노출된 장기 토큰의 위험 기간을 줄일 수 있다

문제 / 주의점:

- 서버 저장소가 필요해지는 경우가 많다
- 멀티 디바이스 환경에서 처리 정책을 잘 정해야 한다

### `Session Tracking`

정의:

서버가 사용자의 로그인 세션 또는 Refresh Token 상태를
DB나 캐시에 저장하고 추적하는 구조다.

언제 쓰는가:

- 강제 로그아웃
- 기기별 로그인 관리
- 비정상 세션 탐지
- 운영자 세션 차단

어떻게 사용하는가:

- `user_id`, `refresh_token_hash`, `expires_at`, `revoked_at`, `device_info` 같은 컬럼을 둔다
- 로그아웃 시 세션을 폐기한다
- 비밀번호 변경 시 기존 세션 전체를 무효화할 수 있다

장점:

- 운영 제어력이 커진다
- 보안 사고 대응이 쉬워진다
- 다중 기기 세션 관리가 가능해진다

문제 / 주의점:

- JWT만 쓸 때보다 상태 관리 비용이 늘어난다
- 세션 정리 배치나 만료 정책이 필요하다

### `CSRF`

정의:

브라우저가 자동으로 쿠키를 포함해 요청을 보내는 특성을 악용해,
사용자 의도와 상관없는 요청을 보내게 만드는 공격이다.

언제 신경 써야 하는가:

- cookie 기반 인증을 사용할 때 거의 항상 고려해야 한다

어떻게 대응하는가:

- `sameSite` 정책
- `CSRF token`
- 민감 요청의 `origin` / `referer` 검증
- 상태 변경 API를 안전한 방식으로만 허용

장점:

- cookie 기반 인증을 보다 안전하게 운영할 수 있다

문제 / 주의점:

- XSS와 달리 눈에 잘 안 보인다
- 개발 단계에서는 문제 없어 보여도 운영에서 취약점이 남을 수 있다

## 면접에서 자주 묻는 연결 질문

- 왜 1차에서는 `localStorage`를 쓰고 2차에서 `httpOnly cookie`로 바꾸는가
- Refresh Token이 왜 필요한가
- 로그아웃을 JWT에서 어떻게 처리하는가
- cookie 기반 인증을 쓰면 어떤 보안 항목을 추가로 고려해야 하는가

## 한 줄 정리

2차 인증 고도화의 핵심은 "로그인 기능 추가"가 아니라
"브라우저 환경에서 운영 가능한 보안 구조로 바꾸는 것"이다.
