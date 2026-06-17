import { RagService } from './rag.service';

describe('RagService', () => {
  const makeSourceRow = () => ({
    id: 1n,
    distance: 0,
    theater_id: 1n,
    theater_name: '블루스퀘어 신한카드홀',
    musical_id: 11n,
    musical_title: '웃는남자',
    performance_id: 21n,
    season_label: '2022',
    seat_floor: '1층',
    seat_section: 'A',
    seat_row: '5',
    seat_number: '12',
    view_rating: 5,
    sound_rating: 4,
    comfort_rating: 4,
    expression_rating: 5,
    stage_visibility_rating: 4,
    content: '시야가 좋고 배우 표정이 잘 보였어요.',
    tags: ['시야좋음'],
  });

  function makeService() {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([makeSourceRow()])
        .mockResolvedValueOnce([makeSourceRow()])
        .mockResolvedValueOnce([{ count: 0n }]),
      ragQueryLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const openAi = {
      createAnswer: jest.fn().mockResolvedValue('빅토르 위고의 소설을 원작으로 합니다.'),
      createEmbedding: jest.fn(),
    };
    const queryParser = {
      parse: jest.fn().mockResolvedValue({
        musicalId: '11',
        musicalTitle: '웃는남자',
        intent: 'general',
      }),
    };

    return {
      service: new RagService(prisma as never, openAi as never, queryParser as never),
      prisma,
      openAi,
      queryParser,
    };
  }

  it('does not answer general musical description questions from model knowledge', async () => {
    const { service, openAi } = makeService();

    const result = await service.ask('웃는남자에 대해서 설명해줘', 5);

    expect(openAi.createAnswer).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain('좌석 후기 기준');
    expect(result.answer).toContain('작품 줄거리');
  });
});
