import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom"
import AuthPage from "./features/auth/AuthPage"
import ReviewCreatePage from "./features/reviews/ReviewCreatePage"


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage/>}/>
        <Route path="/reviews/new" element={<ReviewCreatePage/>}/>
        <Route path="*" element={<Navigate to ="/" replace/>}/>
      </Routes>
    </BrowserRouter>
  )
}
