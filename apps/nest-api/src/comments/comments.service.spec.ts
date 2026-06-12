import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  const now = new Date('2026-06-12T00:00:00.000Z');
  const user: AuthenticatedUser = { id: '7', email: 'user@example.com' };

  const makePrisma = () => ({
    seatReview: {
      findUnique: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  });

  const commentWithAuthor = {
    id: 3n,
    seatReviewId: 11n,
    authorId: 7n,
    content: 'Good comment',
    createdAt: now,
    updatedAt: now,
    author: {
      id: 7n,
      nickname: 'musical-fan',
    },
  };

  it('creates a comment for an existing seat review', async () => {
    const prisma = makePrisma();
    prisma.seatReview.findUnique.mockResolvedValue({ id: 11n });
    prisma.comment.create.mockResolvedValue(commentWithAuthor);

    const service = new CommentsService(prisma as never);

    await expect(
      service.create('11', user, { content: '  Good comment  ' }),
    ).resolves.toEqual({
      id: '3',
      seatReviewId: '11',
      author: {
        id: '7',
        nickname: 'musical-fan',
      },
      content: 'Good comment',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        seatReviewId: 11n,
        authorId: 7n,
        content: 'Good comment',
      },
      include: { author: true },
    });
  });

  it('lists comments for a seat review from oldest to newest by default', async () => {
    const prisma = makePrisma();
    prisma.seatReview.findUnique.mockResolvedValue({ id: 11n });
    prisma.comment.findMany.mockResolvedValue([commentWithAuthor]);
    prisma.comment.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );

    const service = new CommentsService(prisma as never);

    await expect(service.findBySeatReview('11', {})).resolves.toEqual({
      items: [
        {
          id: '3',
          seatReviewId: '11',
          author: {
            id: '7',
            nickname: 'musical-fan',
          },
          content: 'Good comment',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      total: 1,
      sort: 'oldest',
    });

    expect(prisma.comment.findMany).toHaveBeenCalledWith({
      where: { seatReviewId: 11n },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('can list comments from newest to oldest', async () => {
    const prisma = makePrisma();
    prisma.seatReview.findUnique.mockResolvedValue({ id: 11n });
    prisma.comment.findMany.mockResolvedValue([commentWithAuthor]);
    prisma.comment.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );

    const service = new CommentsService(prisma as never);

    await service.findBySeatReview('11', { sort: 'latest' });

    expect(prisma.comment.findMany).toHaveBeenCalledWith({
      where: { seatReviewId: 11n },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('updates only comments written by the current user', async () => {
    const prisma = makePrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: 3n, authorId: 7n });
    prisma.comment.update.mockResolvedValue({
      ...commentWithAuthor,
      content: 'Updated comment',
    });

    const service = new CommentsService(prisma as never);

    await expect(
      service.update('3', user, { content: '  Updated comment  ' }),
    ).resolves.toMatchObject({
      id: '3',
      content: 'Updated comment',
    });

    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { content: 'Updated comment' },
      include: { author: true },
    });
  });

  it("blocks updating another user's comment", async () => {
    const prisma = makePrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: 3n, authorId: 99n });

    const service = new CommentsService(prisma as never);

    await expect(
      service.update('3', user, { content: 'Updated comment' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes only comments written by the current user', async () => {
    const prisma = makePrisma();
    prisma.comment.findUnique.mockResolvedValue({ id: 3n, authorId: 7n });
    prisma.comment.delete.mockResolvedValue({ id: 3n });

    const service = new CommentsService(prisma as never);

    await expect(service.remove('3', user)).resolves.toEqual({ deleted: true });
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 3n } });
  });
});
