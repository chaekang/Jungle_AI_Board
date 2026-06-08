import { useEffect, useState } from "react"
import type { SubmitEvent } from "react"
import LoginPanel from "../components/auth/LoginPanel"
import SignupPanel from "../components/auth/SignupPanel"
import "../styles/pages/auth-page.css"
import type { CheckEmailResponse, LoginResponse, PublicUser } from "../types/auth"

const API_BASE = "http://localhost:3000"           // 백엔드 주소
const TOKEN_KEY = "jungle_ai_board_access_token"   // 브라우저 localStorage에 토큰 저장할 때 쓰는 이름

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  // `API_BASE + path`로 실제 URL 만들기
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    // JSON 요청 헤더 붙이기
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const data = await response.json().catch(() => null)  // 응답을 JSON으로 바꿔서 data에 넣기. 파싱 실패 시 null 넣기

  // 응답 실패 시 에러 메시지 보내기
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "Request failed."

    throw new Error(message)
  }

  return data as T
}

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login")

  // 회원가입 상태(회원가입 입력칸 저장)
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("")

  // 로그인 상태(로그인 입력칸 저장)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // 중복 확인
  const [checkedEmail, setCheckedEmail] = useState("")
  const [isEmailChecked, setIsEmailChecked] = useState(false)
  const [isEmailAvailable, setIsEmailAvailable] = useState(false)

  // 인증 결과
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY))   // 로그인 후 받은 JWT, 새로고침해도 저장한 토큰이 있으면 로그인 상태 복구
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null)    // 현재 로그인한 사용자 정보
  const [message, setMessage] = useState("")   // 성공 메시지
  const [error, setError] = useState("")       // 실패 메시지

  // 토큰이 바뀌면 실행(유효한 토큰인지 확인)
  useEffect(() => {
    if (!token) {
      setCurrentUser(null)
      return
    }

    void loadMe(token)
  }, [token])

  // 회원가입 처리
  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()   // 기본 form 제출 방지(브라우저가 원래 하던 기본 동작 막기, form의 경우 새로고침/다른 주소로 이동)
    setMessage("")
    setError("")

    // 비밀번호와 재확인 값이 같은지 검사
    if (registerPassword !== registerPasswordConfirm) {
      setError("Passwords do not match.")
      return
    }

    const normalizedEmail = registerEmail.trim()

    if (!isEmailChecked || checkedEmail !== normalizedEmail) {
      setError("Check email availability before signing up.")
      return
    }

    if (!isEmailAvailable) {
      setError("This email is already in use.")
      return
    }

    // 백엔드 회원가입 API 호출
    try {
      const user = await apiRequest<PublicUser>("/auth/register", {
        // 해당 JSON 내용으로 회원가입 진행
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
          password: registerPassword,
          nickname: registerName,
        }),
      })

      setMessage(`Account created for ${user.nickname}. Please log in.`)
      setLoginEmail(normalizedEmail)

      // 입력값 비우기
      setRegisterName("")
      setRegisterEmail("")
      setRegisterPassword("")
      setRegisterPasswordConfirm("")
      setCheckedEmail("")
      setIsEmailChecked(false)
      setIsEmailAvailable(false)

      // 로그인 화면으로 이동
      setMode("login")
    } 
    // 실패하면 error에 메시지 저장
    catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.")
    }
  }

  // 로그인
  async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()  // 페이지 새로고침 막기
    setMessage("")  // 이전 성공 메시지 비우기
    setError("")    // 이전 에러 메시지 비우기

    // 백엔드 로그인 API 호출
    try {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      })

      localStorage.setItem(TOKEN_KEY, result.accessToken)   // 브라우저에 accessToken 저장, 페이지 새로고침해도 사라지지 않음
      setToken(result.accessToken)  // react의 token state 바꿈, 화면 재렌더
      setCurrentUser(result.user)   // 현재 로그인한 유저 저장
      setMessage(`Signed in as ${result.user.nickname}.`)   // 메시지 저장
      setLoginPassword("")  // 비밀번호 비우기
    } 
    // error에 메시지 저장
    catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.")
    }
  }

  // 현재 사용자 조회
  async function loadMe(tokenValue: string) {
    try {
      const user = await apiRequest<PublicUser>("/auth/me", { method: "GET" }, tokenValue)
      setCurrentUser(user)  // 현재 유저 저장
    } 
    catch (err) {
      localStorage.removeItem(TOKEN_KEY)   // 브라우저에 저장된 토큰 삭제
      setToken(null)        // token을 null로 저장
      setCurrentUser(null)  // 현재 유저 null
      setError(err instanceof Error ? err.message : "Failed to load the current user.")  // 에러 메시지 저장
    }
  }

  // 이메일 중복 체크
  async function handleDuplicateCheck() {
    setMessage("")
    setError("")

    const email  = registerEmail.trim()

    if (!email) {
      setError("Enter an email before checking availability.")
      setCheckedEmail("")
      setIsEmailChecked(false)
      setIsEmailAvailable(false)
      return
    }

    try {
      const result = await apiRequest<CheckEmailResponse>(
        `/auth/check-email?email=${encodeURIComponent(email)}`,
        { method: "GET" },
      )

      setCheckedEmail(email)
      setIsEmailChecked(true)

      if (result.available) {
        setIsEmailAvailable(true)
        setMessage("This email is available")
      }
      else {
        setIsEmailAvailable(false)
        setError("This email is already in use")
      }
    }
    catch (err) {
      setCheckedEmail("")
      setIsEmailChecked(false)
      setIsEmailAvailable(false)
      setError(err instanceof Error ? err.message : "Email check failed.")
    }
  }

  function handleRegisterEmailChange(value: string) {
    setRegisterEmail(value)
    setCheckedEmail("")
    setIsEmailAvailable(false)
    setMessage("")
    setError("")
  }

  // 로그아웃
  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)  // 브라우저 토큰 삭제
    setToken(null)
    setCurrentUser(null)
    setMessage("Signed out.")
    setError("")
  }

  // 렌더링
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
              onChangeEmail={handleRegisterEmailChange}
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
