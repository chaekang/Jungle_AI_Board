const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000" // 백엔드 주소

type ApiErrorResponse = {
  message?: string | string[]
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  // `API_BASE_URL + path`로 실제 URL 만들기
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    // JSON 요청 헤더 붙이기
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => null)) as ApiErrorResponse | T | null // 응답을 JSON으로 바꿔서 data에 넣기. 파싱 실패 시 null 넣기

  // 응답 실패 시 에러 메시지 보내기
  if (!response.ok) {
    const errorMessage = (data as ApiErrorResponse | null)?.message
    const message = Array.isArray(errorMessage) ? errorMessage.join(", ") : errorMessage

    throw new Error(message ?? "API request failed.")
  }

  return data as T
}
