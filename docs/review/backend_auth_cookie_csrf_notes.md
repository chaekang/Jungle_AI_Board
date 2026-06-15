# 백엔드 인증 쿠키와 CSRF 판단 메모

## 현재 인증 방식

백엔드는 브라우저 인증에 httpOnly cookie를 사용한다.

- `jungle_access_token`: protected API에서 사용하는 짧은 수명의 JWT cookie
- `jungle_refresh_token`: `/auth/refresh`, `/auth/logout`에서만 사용하는 `sessionId.secret` 형태의 opaque cookie
- refresh secret 원문은 저장하지 않는다. `auth_sessions` 테이블에는 bcrypt hash만 저장한다.
- refresh 시 session의 secret hash를 회전한다.
- logout은 서버의 auth session을 revoke하고 두 cookie를 모두 지운다.

프론트엔드는 access token을 `localStorage`에 저장하지 않는다. 모든 API 요청은 공통 `apiRequest`를 통해 `credentials: "include"`로 보낸다.

## CORS

쿠키 인증은 credentialed CORS가 필요하다. Nest API는 다음 정책을 사용한다.

- `credentials: true`
- `CORS_ORIGINS` 기반 명시적 origin allowlist
- local 기본값: `http://localhost:5173`, `http://127.0.0.1:5173`

credentialed cookie 요청에서 `origin: "*"`는 사용하면 안 된다.

## CSRF 판단

현재 기본 판단은 별도 CSRF token flow를 아직 추가하지 않는 것이다.

전제는 다음과 같다.

- cookie 기본값은 `SameSite=Lax`
- API 요청은 JSON 기반
- credentialed CORS는 프론트 origin allowlist에만 허용
- 운영에서 HTTPS를 쓰면 `AUTH_COOKIE_SECURE=true` 사용

이 조건에서는 현재 개발/동일 사이트 배포 형태에 대해 방어선이 충분하다고 본다.

다만 production에서 프론트와 API가 cross-site cookie 구성이 되고 `AUTH_COOKIE_SAME_SITE=none`을 사용해야 한다면, 배포 전에 CSRF token flow를 추가해야 한다.

추가할 때의 권장 흐름은 다음과 같다.

1. API가 읽을 수 있는 CSRF token을 발급한다.
2. 프론트가 mutation 요청에 `X-CSRF-Token` 같은 custom header를 붙인다.
3. 서버가 session/cookie와 CSRF header를 함께 검증한다.
4. Origin 또는 Referer 검증을 보조 방어선으로 둔다.

## 관련 환경 변수

- `CORS_ORIGINS`: 쉼표로 구분한 프론트 origin 목록
- `AUTH_COOKIE_SECURE`: HTTPS production에서는 `true`
- `AUTH_COOKIE_SAME_SITE`: `lax`, `strict`, `none`
- `AUTH_COOKIE_DOMAIN`: 필요한 경우 공유 cookie domain
- `AUTH_ACCESS_COOKIE_MAX_AGE_MS`: access cookie 수명
- `AUTH_REFRESH_TOKEN_TTL_DAYS`: refresh session 수명
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`: password reset token 수명

## 확인된 테스트

관련 테스트는 다음 파일에서 확인한다.

- `apps/nest-api/src/auth/auth-cookie.utils.spec.ts`
- `apps/nest-api/src/auth/auth.controller.spec.ts`
- `apps/nest-api/src/auth/auth.service.spec.ts`
- `apps/nest-api/src/common/cors-options.spec.ts`
- `apps/web-react/src/shared/api.test.ts`
- `apps/web-react/src/e2e/auth-report-admin-flow.test.ts`
