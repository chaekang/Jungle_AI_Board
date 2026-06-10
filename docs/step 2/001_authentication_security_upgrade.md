# 001_authentication_security_upgrade

## 현재 파일 경로 규칙

이 문서에서 코드를 추가하거나 예시 경로를 적을 때는 아래 규칙을 따른다.

- Nest 인증 코드는 `apps/nest-api/src/auth`, 사용자 조회는 `apps/nest-api/src/users`, 공통 사용자 타입은 `apps/nest-api/src/common`에 둔다.
- React 인증 코드는 `apps/web-react/src/features/auth`에 둔다.
- React 공통 HTTP 요청 함수는 `apps/web-react/src/shared/api.ts`에 둔다.
- React 화면, 컴포넌트, 스타일, 타입, 요청 코드는 기능 폴더 안에서 역할별로 나눈다.
- DTO는 Nest 도메인 폴더 아래 `dto`, 타입/인터페이스는 해당 기능 폴더의 `types.ts` 또는 `interfaces`에 둔다.

## 목적

이 문서는 2차 구현에서 인증 구조를
`localStorage + access token` 중심의 1차 버전에서
운영 가능한 보안 구조로 올리는 작업 가이드다.

관련 1차 문서:

- [docs/step 1/002_user_authentication.md](../step%201/002_user_authentication.md)
- [docs/step 1/concept/002_user_authentication.md](../step%201/concept/002_user_authentication.md)

## 이 단계가 끝나면 되는 것

- 인증 저장 방식이 `httpOnly cookie` 중심으로 바뀐다
- `Refresh Token` 기반 재발급 흐름이 동작한다
- 로그인 보안과 세션 관리가 1차보다 강해진다
- 소셜 로그인 확장 가능 구조가 잡힌다

## 이번 단계에서 구현하는 것

- `httpOnly cookie` 기반 인증 저장
- `Refresh Token` 발급 / 회전 / 폐기
- 로그아웃 시 쿠키 정리와 서버 측 무효화
- 기기별 세션 관리 또는 토큰 세션 테이블
- 이메일 인증 또는 비밀번호 재설정 메일 중 최소 1개

## 이번 단계에서 구현하지 않는 것

- 기업용 SSO
- 다중 조직 권한 모델
- WebAuthn / Passkey

## 권장 구현 순서

1. 토큰 저장 전략을 `cookie + refresh` 구조로 재설계
2. Prisma에 세션 또는 리프레시 토큰 테이블 추가
3. 로그인 / 재발급 / 로그아웃 API 분리
4. `apps/web-react/src/shared/api.ts`의 요청 옵션을 `credentials: 'include'` 기준으로 수정
5. 이메일 인증 또는 비밀번호 재설정 플로우 추가
6. 소셜 로그인 확장 포인트 설계

## 중요한 포인트

### 1. Access Token과 Refresh Token 책임을 분리한다

- `Access Token`: 짧은 수명, API 호출용
- `Refresh Token`: 긴 수명, 재발급 전용

둘을 같은 방식으로 저장하면 보안 의미가 줄어든다.

### 2. 쿠키 기반으로 바꾸면 CORS와 CSRF도 같이 본다

이번 단계에서는 아래를 함께 맞춘다.

- `credentials: true`
- `sameSite`, `secure`, `domain`, `path` 정책
- `CSRF` 방어 방식 결정

### 3. 토큰 세션을 서버에서 추적할 수 있어야 한다

2차 구현에서는 "발급만 하고 잊는 JWT"보다,
서버가 세션 상태를 어느 정도 추적할 수 있어야 운영이 쉬워진다.

예를 들면 아래 항목이 유용하다.

- 발급 시각
- 만료 시각
- 마지막 사용 시각
- 사용자 에이전트 / 기기 정보
- 폐기 여부

## 체크리스트

- [ ] `httpOnly cookie` 기반 인증으로 전환
- [ ] `Refresh Token` 재발급 API 구현
- [ ] 로그아웃 시 토큰 폐기 처리 구현
- [ ] 세션 추적용 테이블 추가
- [ ] 이메일 인증 또는 비밀번호 재설정 중 1개 구현
- [ ] 쿠키 환경별 옵션 정리

## 완료 기준

- 새로고침과 브라우저 재시작 후에도 인증 흐름이 안정적이다
- 로그아웃 시 재발급이 불가능하다
- 탈취된 `Access Token`만으로 장기 로그인 유지가 어렵다
- 운영 환경 배포 기준으로 보안 설정을 설명할 수 있다
