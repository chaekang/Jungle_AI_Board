import { useEffect, useState } from "react"
import type { SubmitEvent } from "react"
import LoginPanel from "../components/auth/LoginPanel"
import SignupPanel from "../components/auth/SignupPanel"
import "../styles/pages/auth-page.css"
import type { LoginResponse, PublicUser } from "../types/auth"

const API_BASE = "http://localhost:3000"
const TOKEN_KEY = "jungle_ai_board_access_token"

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.message === "string" ? data.message : "Request failed."

    throw new Error(message)
  }

  return data as T
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")

  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      return
    }

    void loadMe(token)
  }, [token])

  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setError("")

    if (registerPassword !== registerPasswordConfirm) {
      setError("Passwords do not match.")
      return
    }

    try {
      const user = await apiRequest<PublicUser>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          nickname: registerName,
        }),
      })

      setMessage(`Account created for ${user.nickname}. Please log in.`)
      setLoginEmail(registerEmail)
      setRegisterName("")
      setRegisterEmail("")
      setRegisterPassword("")
      setRegisterPasswordConfirm("")
      setMode("login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.")
    }
  }

  async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setError("")

    try {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      })

      localStorage.setItem(TOKEN_KEY, result.accessToken)
      setToken(result.accessToken)
      setCurrentUser(result.user)
      setMessage(`Signed in as ${result.user.nickname}.`)
      setLoginPassword("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.")
    }
  }

  async function loadMe(tokenValue: string) {
    try {
      const user = await apiRequest<PublicUser>("/auth/me", { method: "GET" }, tokenValue)
      setCurrentUser(user)
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setCurrentUser(null)
      setError(err instanceof Error ? err.message : "Failed to load the current user.")
    }
  }

  function handleDuplicateCheck() {
    setMessage("")
    setError("")

    if (!registerEmail.trim()) {
      setError("Enter an email before checking availability.")
      return
    }

    setMessage("Availability check is a UI placeholder. The server still performs the final validation.")
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setCurrentUser(null)
    setMessage("Signed out.")
    setError("")
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <header className="auth-brand">
          <p className="brand-kicker">MUSICAL SEAT ARCHIVE</p>
          <h1>Agentic Board</h1>
          <p className="brand-copy">A simple sign-in flow for reviews, seat notes, and saved activity.</p>

          {currentUser ? (
            <div className="auth-current-user">
              <span>{currentUser.nickname} is signed in</span>
              <button type="button" className="auth-link-button logout-link" onClick={handleLogout}>
                LOG OUT
              </button>
            </div>
          ) : null}
        </header>

        <div className="auth-panel-area">
          {mode === "login" ? (
            <LoginPanel
              email={loginEmail}
              onChangeEmail={setLoginEmail}
              onChangePassword={setLoginPassword}
              onShowSignup={() => {
                setMessage("")
                setError("")
                setMode("signup")
              }}
              onSubmit={handleLogin}
              password={loginPassword}
            />
          ) : (
            <SignupPanel
              email={registerEmail}
              name={registerName}
              onChangeEmail={setRegisterEmail}
              onChangeName={setRegisterName}
              onChangePassword={setRegisterPassword}
              onChangePasswordConfirm={setRegisterPasswordConfirm}
              onCheckDuplicate={handleDuplicateCheck}
              onShowLogin={() => {
                setMessage("")
                setError("")
                setMode("login")
              }}
              onSubmit={handleRegister}
              password={registerPassword}
              passwordConfirm={registerPasswordConfirm}
            />
          )}

          {message ? <p className="feedback success-feedback">{message}</p> : null}
          {error ? <p className="feedback error-feedback">{error}</p> : null}
        </div>
      </div>
    </main>
  )
}
