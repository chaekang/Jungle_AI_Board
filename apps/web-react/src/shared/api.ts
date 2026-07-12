const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
export const API_BASE_URL = metaEnv?.VITE_API_BASE_URL ?? "http://localhost:3000"

type ApiErrorResponse = {
  message?: string | string[]
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(createApiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => null)) as ApiErrorResponse | T | null

  if (!response.ok) {
    const errorMessage = (data as ApiErrorResponse | null)?.message
    const message = Array.isArray(errorMessage) ? errorMessage.join(", ") : errorMessage

    throw new Error(message ?? "API request failed.")
  }

  return data as T
}

export function createApiUrl(path: string) {
  if (API_BASE_URL.startsWith("/")) {
    return `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
  }

  return new URL(path, API_BASE_URL).toString()
}
