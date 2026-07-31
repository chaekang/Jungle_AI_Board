import { useEffect, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react"
import type { PublicSeatReview } from "../../reviews/types"
import { askSeatRecommendation } from "../api"
import { getComparisonSeatKey, getSeatLabel } from "../seat-comparison"
import {
  buildSeatAssistantRequest,
  getAssistantReply,
  SEAT_ASSISTANT_WELCOME,
} from "../seat-assistant-presentation"
import "./seat-assistant-panel.css"

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  text: string
}

type SeatAssistantPanelProps = {
  comparisonSeats?: PublicSeatReview[]
  comparisonMessage?: string
  onClearComparison?: () => void
  onEvidenceSelect?: (reviewId: string) => void
  onRelaxSearch?: (seat: PublicSeatReview) => void
  onRemoveComparisonSeat?: (review: PublicSeatReview) => void
  onWriteReview?: () => void
}

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function SeatAssistantPanel({
  comparisonSeats = [],
  comparisonMessage = "",
  onClearComparison,
  onRemoveComparisonSeat,
}: SeatAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: SEAT_ASSISTANT_WELCOME },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const chatRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      composerRef.current?.focus()
    }
  }, [isOpen, messages, isLoading])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (chatRef.current?.contains(target) || launcherRef.current?.contains(target)) return
      setIsOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setIsOpen(false)
      launcherRef.current?.focus()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  async function submitQuestion(question: string) {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) return

    setMessages((current) => [
      ...current,
      { id: makeMessageId(), role: "user", text: trimmedQuestion },
    ])
    setInput("")
    setError("")
    setIsLoading(true)

    try {
      const result = await askSeatRecommendation(
        buildSeatAssistantRequest(trimmedQuestion, comparisonSeats),
      )
      setMessages((current) => [
        ...current,
        { id: makeMessageId(), role: "assistant", text: getAssistantReply(result) },
      ])
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "답변을 불러오지 못했습니다. 잠시 후 다시 물어봐 주세요.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitQuestion(input)
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void submitQuestion(input)
    }
  }

  return (
    <>
      <button
        ref={launcherRef}
        className="seat-assistant-launcher"
        type="button"
        aria-label={isOpen ? "AI 좌석 도우미 닫기" : "AI 좌석 도우미 열기"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>AI</span>
        {comparisonSeats.length ? (
          <small aria-label={`참고 좌석 ${comparisonSeats.length}개`}>
            {comparisonSeats.length}
          </small>
        ) : null}
      </button>

      {!isOpen && comparisonSeats.length ? (
        <aside className="seat-comparison-tray" aria-label="선택한 비교 좌석" aria-live="polite">
          <div className="seat-comparison-tray-summary">
            <span aria-hidden="true">VS</span>
            <div>
              <small>좌석 비교 {comparisonSeats.length}/3</small>
              <strong>
                {comparisonSeats.length < 2
                  ? "비교할 좌석을 하나 더 골라주세요"
                  : "선택한 좌석을 AI에게 바로 물어보세요"}
              </strong>
            </div>
          </div>

          <div className="seat-comparison-tray-seats">
            {comparisonSeats.map((seat) => (
              <button
                key={getComparisonSeatKey(seat)}
                type="button"
                aria-label={`${getSeatLabel(seat)} 비교 선택 해제`}
                onClick={() => onRemoveComparisonSeat?.(seat)}
              >
                <span>{getSeatLabel(seat)}</span>
                <b aria-hidden="true">×</b>
              </button>
            ))}
          </div>

          {comparisonMessage ? <p role="status">{comparisonMessage}</p> : null}

          <div className="seat-comparison-tray-actions">
            <button type="button" onClick={onClearComparison}>초기화</button>
            <button
              className="seat-comparison-tray-start"
              type="button"
              disabled={comparisonSeats.length < 2}
              onClick={() => setIsOpen(true)}
            >
              {comparisonSeats.length < 2 ? "한 자리 더 선택" : "AI에게 비교 질문하기"}
            </button>
          </div>
        </aside>
      ) : null}

      {isOpen ? (
        <section ref={chatRef} className="seat-assistant-chat" aria-label="AI 좌석 도우미">
          <header className="seat-assistant-chat-header">
            <div>
              <p>AI 좌석 도우미</p>
              <h2>무엇이 궁금해?</h2>
            </div>
            <button
              type="button"
              aria-label="AI 좌석 도우미 닫기"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>

          {comparisonSeats.length ? (
            <section className="seat-assistant-context" aria-label="질문에 참고할 좌석">
              <header>
                <div>
                  <small>질문에 참고할 좌석</small>
                  <strong>{comparisonSeats.length}개 선택됨</strong>
                </div>
                <button type="button" onClick={onClearComparison}>모두 빼기</button>
              </header>
              <div className="seat-assistant-context-seats">
                {comparisonSeats.map((seat) => (
                  <button
                    key={getComparisonSeatKey(seat)}
                    type="button"
                    aria-label={`${getSeatLabel(seat)} 참고 좌석에서 빼기`}
                    onClick={() => onRemoveComparisonSeat?.(seat)}
                  >
                    <span>{getSeatLabel(seat)}</span>
                    <b aria-hidden="true">×</b>
                  </button>
                ))}
              </div>
              <p>아래에 평소처럼 질문하면 이 좌석들을 함께 고려해서 답해요.</p>
              {comparisonMessage ? <em>{comparisonMessage}</em> : null}
            </section>
          ) : null}

          <div className="seat-assistant-messages" role="log" aria-live="polite">
            {messages.map((message) => (
              <article
                className={`seat-assistant-message seat-assistant-message--${message.role}${
                  message.id === "welcome" ? " seat-assistant-message--welcome" : ""
                }`}
                key={message.id}
              >
                <p>{message.text}</p>
              </article>
            ))}

            {isLoading ? (
              <article className="seat-assistant-message seat-assistant-message--assistant">
                <div className="seat-assistant-typing" aria-label="답변 작성 중">
                  <span />
                  <span />
                  <span />
                </div>
              </article>
            ) : null}
            <div ref={messageEndRef} />
          </div>

          {error ? <div className="seat-assistant-error"><p>{error}</p></div> : null}

          <form className="seat-assistant-composer" onSubmit={handleSubmit}>
            <textarea
              ref={composerRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="예: 블루스퀘어 3층 4열 괜찮아?"
              aria-label="좌석 질문"
              rows={1}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>보내기</button>
          </form>
        </section>
      ) : null}
    </>
  )
}
