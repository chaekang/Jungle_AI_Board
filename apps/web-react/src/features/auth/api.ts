import { apiRequest } from "../../shared/api"
import type { CheckEmailResponse, LoginResponse, PublicUser } from "./types"

type RegisterInput = {
  email: string
  password: string
  nickname: string
}

type LoginInput = {
  email: string
  password: string
}

export function register(input: RegisterInput) {
  return apiRequest<PublicUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function login(input: LoginInput) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function getCurrentUser(token: string) {
  return apiRequest<PublicUser>("/auth/me", { method: "GET" }, token)
}

export function checkEmail(email: string) {
  return apiRequest<CheckEmailResponse>(
    `/auth/check-email?email=${encodeURIComponent(email)}`,
    { method: "GET" },
  )
}
