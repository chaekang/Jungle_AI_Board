const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

type ApiErrorResponse = {
  message?: string | string[]
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
