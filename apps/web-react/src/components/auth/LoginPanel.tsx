import type { SubmitEvent } from "react"
import "../../styles/components/auth/auth-panel.css"
import "../../styles/components/auth/login-panel.css"

// 부모 컴포넌트로부터 어떤 값을 받아야 하는지 정해둔 타입
type LoginPanelProps = {
  email: string  // 이메일 입력값 문자열로 받음
  onChangeEmail: (value: string) => void  // 이메일 입력값이 바뀌었을 때 실행할 함수
  onChangePassword: (value: string) => void  // 비밀먼호 입력값이 바뀌었을 때 실행할 함수
  onShowSignup: () => void  // 회원가입 화면으로 바꿀 때 실행할 함수, 인자를 받지 않고, 실행만 하는 함수
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>  // 로그인 form이 제출됐을 때 실행할 함수, 동기 함수일수도 비동기 함수일수도 있음
  password: string  // 비밀번호 입력값 문자열로 받음
}

export default function LoginPanel({
  email,
  onChangeEmail,
  onChangePassword,
  onShowSignup,
  onSubmit,
  password,
}: LoginPanelProps) {
  return (
    <section className="auth-card login-card">
      <div className="auth-card-head">
        <p className="auth-kicker">WELCOME BACK</p>
        <h1 className="auth-title">LOGIN</h1>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-field">
          <span>ID</span>
          <input
            type="email"
            placeholder="email"
            autoComplete="email"
            value={email}
            // event.target.value: 이벤트가 발생한 입력창의 현재 값
            onChange={(event) => onChangeEmail(event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>PW</span>
          <input
            type="password"
            placeholder="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onChangePassword(event.target.value)}
          />
        </label>

        <div className="auth-actions stacked">
          <button type="submit" className="auth-button primary">
            LOGIN
          </button>
          <button type="button" className="auth-button secondary" onClick={onShowSignup}>
            SIGN UP
          </button>
        </div>
      </form>
    </section>
  )
}
