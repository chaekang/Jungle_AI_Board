import { OpenAiRagClient } from './openai-rag.client';
import type { RagSource } from './rag.types';

const source: RagSource = {
  id: '1',
  score: 1,
  theater: { id: '1', name: '블루스퀘어 신한카드홀' },
  musical: { id: '1', title: '웃는 남자' },
  performance: null,
  seat: { floor: '3층', section: 'B', row: '4', number: '23' },
  ratings: {
    view: 4,
    sound: 4,
    comfort: 3,
    expression: 2,
    stageVisibility: 5,
  },
  tags: ['전체무대'],
  content: '전체 무대는 잘 보이고 배우 표정은 오글이 필요해요.',
};

describe('OpenAiRagClient', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalChatModel = process.env.OPENAI_CHAT_MODEL;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_CHAT_MODEL = originalChatModel;
  });

  it('uses a Responses API payload supported by gpt-4o-mini', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_CHAT_MODEL = 'gpt-4o-mini';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ output_text: '전체 무대를 보기에는 괜찮아요.' }),
    } as Response);
    const client = new OpenAiRagClient();

    const answer = await client.createAnswer({
      question: '3층 4열 중블 괜찮아?',
      filters: {
        intent: 'view',
        seatFloor: '3층',
        seatRow: '4',
        side: 'center',
      },
      sources: [source],
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    if (typeof request.body !== 'string') {
      throw new Error('OpenAI request body must be a JSON string');
    }
    const body = JSON.parse(request.body) as Record<string, unknown>;
    expect(answer).toBe('전체 무대를 보기에는 괜찮아요.');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body).not.toHaveProperty('reasoning');
    expect(JSON.stringify(body.input)).toContain(
      '조사 과정을 설명하지 말고 바로 결론',
    );
  });
});
