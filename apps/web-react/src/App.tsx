import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom"
import { lazy, Suspense } from "react"
import type { ReactNode } from "react"
import AuthPage from "./features/auth/AuthPage"
import { TOKEN_KEY } from "./features/auth/constants"
import ReviewBoardPage from "./features/reviews/ReviewBoardPage"

const ReviewCreatePage = lazy(() => import("./features/reviews/ReviewCreatePage"))

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()

  return localStorage.getItem(TOKEN_KEY) ? (
    children
  ) : (
    <Navigate
      to="/auth"
      replace
      state={{ redirectTo: `${location.pathname}${location.search}` }}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReviewBoardPage/>}/>
        <Route path="/auth" element={<AuthPage/>}/>
        <Route
          path="/reviews/new"
          element={
            <RequireAuth>
              <Suspense fallback={<main>후기 작성 화면을 불러오는 중입니다.</main>}>
                <ReviewCreatePage/>
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/reviews/:reviewId/edit"
          element={
            <RequireAuth>
              <Suspense fallback={<main>후기 수정 화면을 불러오는 중입니다.</main>}>
                <ReviewCreatePage/>
              </Suspense>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to ="/" replace/>}/>
      </Routes>
    </BrowserRouter>
  )
}
