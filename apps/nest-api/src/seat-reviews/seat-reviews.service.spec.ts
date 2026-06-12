import type { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { SeatReviewsService } from './seat-reviews.service';

describe('SeatReviewsService tags', () => {
  const now = new Date('2026-06-12T00:00:00.000Z');
  const user: AuthenticatedUser = { id: '7', email: 'user@example.com' };

  const makePrisma = () => ({
    performance: {
      findUnique: jest.fn(),
    },
    tag: {
      count: jest.fn(),
    },
    seatReview: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    seatReviewTag: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const reviewWithRelations = {
    id: 11n,
    authorId: 7n,
    theaterId: 3n,
    musicalId: 5n,
    performanceId: 9n,
    seatFloor: '1F',
    seatSection: null,
    seatRow: 'A',
    seatNumber: '12',
    viewRating: 5,
    soundRating: 4,
    comfortRating: 3,
    expressionRating: 5,
    stageVisibilityRating: 4,
    content: 'Great view from this seat.',
    createdAt: now,
    updatedAt: now,
    author: {
      id: 7n,
      nickname: 'musical-fan',
    },
    theater: {
      id: 3n,
      name: 'Dream Theater',
    },
    musical: {
      id: 5n,
      title: 'Great Musical',
    },
    performance: {
      id: 9n,
      seasonLabel: '2026 Seoul',
    },
    seatReviewTags: [
      {
        tag: {
          id: 2n,
          name: 'great_view',
          type: 'seat_feature',
        },
      },
      {
        tag: {
          id: 4n,
          name: 'first_timer',
          type: 'purpose',
        },
      },
    ],
  };

  const createDto = {
    theaterId: '3',
    musicalId: '5',
    performanceId: '9',
    seatFloor: ' 1F ',
    seatRow: ' a ',
    seatNumber: ' 12 ',
    viewRating: 5,
    soundRating: 4,
    comfortRating: 3,
    expressionRating: 5,
    stageVisibilityRating: 4,
    content: ' Great view from this seat. ',
    tagIds: ['2', '4', '2'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a review and connects unique tag ids', async () => {
    const prisma = makePrisma();
    prisma.performance.findUnique.mockResolvedValue({
      id: 9n,
      theaterId: 3n,
      musicalId: 5n,
    });
    prisma.tag.count.mockResolvedValue(2);
    prisma.seatReview.create.mockResolvedValue(reviewWithRelations);

    const service = new SeatReviewsService(prisma as never);

    await expect(service.create(user, createDto)).resolves.toMatchObject({
      id: '11',
      tags: [
        { id: '2', name: 'great_view', type: 'seat_feature' },
        { id: '4', name: 'first_timer', type: 'purpose' },
      ],
    });

    expect(prisma.seatReview.create).toHaveBeenCalledWith({
      data: {
        authorId: 7n,
        theaterId: 3n,
        musicalId: 5n,
        performanceId: 9n,
        seatFloor: '1F',
        seatSection: null,
        seatRow: 'A',
        seatNumber: '12',
        viewRating: 5,
        soundRating: 4,
        comfortRating: 3,
        expressionRating: 5,
        stageVisibilityRating: 4,
        content: 'Great view from this seat.',
        seatReviewTags: {
          createMany: {
            data: [{ tagId: 2n }, { tagId: 4n }],
            skipDuplicates: true,
          },
        },
      },
      include: {
        author: true,
        theater: true,
        musical: true,
        performance: true,
        seatReviewTags: {
          include: {
            tag: true,
          },
        },
      },
    });
  });

  it('replaces review tags when updating with tag ids', async () => {
    const prisma = makePrisma();
    prisma.seatReview.findUnique.mockResolvedValue({
      id: 11n,
      authorId: 7n,
    });
    prisma.tag.count.mockResolvedValue(1);
    prisma.seatReview.update.mockResolvedValue({
      ...reviewWithRelations,
      seatReviewTags: [reviewWithRelations.seatReviewTags[0]],
    });

    const service = new SeatReviewsService(prisma as never);

    await expect(
      service.update('11', user, { tagIds: ['2', '2'] }),
    ).resolves.toMatchObject({
      tags: [{ id: '2', name: 'great_view', type: 'seat_feature' }],
    });

    expect(prisma.seatReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 11n },
        data: {
          seatReviewTags: {
            deleteMany: {},
            createMany: {
              data: [{ tagId: 2n }],
              skipDuplicates: true,
            },
          },
        },
      }),
    );
  });

  it('includes tags when reading a review detail', async () => {
    const prisma = makePrisma();
    prisma.seatReview.findUnique.mockResolvedValue(reviewWithRelations);

    const service = new SeatReviewsService(prisma as never);

    await expect(service.findOne('11')).resolves.toMatchObject({
      id: '11',
      tags: [
        { id: '2', name: 'great_view', type: 'seat_feature' },
        { id: '4', name: 'first_timer', type: 'purpose' },
      ],
    });
  });
});
