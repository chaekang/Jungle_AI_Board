import type { SubmitEvent } from "react"
import "../../styles/components/auth/auth-panel.css"
import "../../styles/components/auth/signup-panel.css"

type SignupPanelProps = {
  email: string
  name: string
  onChangeEmail: (value: string) => void
  onChangeName: (value: string) => void
  onChangePassword: (value: string) => void
  onChangePasswordConfirm: (value: string) => void
  onCheckDuplicate: () => void
  onShowLogin: () => void
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void | Promise<void>
  password: string
  passwordConfirm: string
}

export default function SignupPanel({
  email,
  name,
  onChangeEmail,
  onChangeName,
  onChangePassword,
  onChangePasswordConfirm,
  onCheckDuplicate,
  onShowLogin,
  onSubmit,
  password,
  passwordConfirm,
}: SignupPanelProps) {
  return (
    <section className="auth-card signup-card">
      <div className="auth-card-head">
        <p className="auth-kicker">CREATE ACCOUNT</p>
        <h1 className="auth-title">SIGN UP</h1>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-field">
          <span>NAME</span>
          <input
            type="text"
            placeholder="nickname"
            autoComplete="nickname"
            value={name}
            onChange={(event) => onChangeName(event.target.value)}
          />
        </label>

        <div className="signup-id-row">
          <label className="auth-field">
            <span>ID</span>
            <input
              type="email"
              placeholder="email"
              autoComplete="email"
              value={email}
              onChange={(event) => onChangeEmail(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="auth-button mini secondary signup-check-button"
            onClick={onCheckDuplicate}
          >
            CHECK ID
          </button>
        </div>

        <label className="auth-field">
          <span>PW</span>
          <input
            type="password"
            placeholder="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => onChangePassword(event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>RE-PW</span>
          <input
            type="password"
            placeholder="password confirm"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(event) => onChangePasswordConfirm(event.target.value)}
          />
        </label>

        <div className="auth-actions stacked">
          <button type="submit" className="auth-button primary">
            SUBMIT
          </button>
          <button type="button" className="auth-link-button" onClick={onShowLogin}>
            Back to LOGIN
          </button>
        </div>
      </form>
    </section>
  )
}
