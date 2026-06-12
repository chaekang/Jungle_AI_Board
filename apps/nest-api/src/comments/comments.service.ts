import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from 'src/common/interfaces/authenticated-user.interface';
import { PrismaService } from 'src/database/prisma.service';
import { CommentQueryDto } from './dto/comment-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

const commentInclude = {
  author: true,
} satisfies Prisma.CommentInclude;

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    reviewId: string,
    user: AuthenticatedUser,
    dto: CreateCommentDto,
  ) {
    const seatReviewId = this.parseId(reviewId, 'reviewId');
    const authorId = this.parseId(user.id, 'userId');
    const content = this.normalizeContent(dto.content);

    await this.assertSeatReviewExists(seatReviewId);

    const comment = await this.prisma.comment.create({
      data: {
        seatReviewId,
        authorId,
        content,
      },
      include: commentInclude,
    });

    return this.toPublicComment(comment);
  }

  async findBySeatReview(reviewId: string, query: CommentQueryDto) {
    const seatReviewId = this.parseId(reviewId, 'reviewId');
    const sort = query.sort ?? 'oldest';

    await this.assertSeatReviewExists(seatReviewId);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where: { seatReviewId },
        include: commentInclude,
        orderBy: { createdAt: sort === 'latest' ? 'desc' : 'asc' },
      }),
      this.prisma.comment.count({ where: { seatReviewId } }),
    ]);

    return {
      items: items.map((comment) => this.toPublicComment(comment)),
      total,
      sort,
    };
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateCommentDto) {
    const commentId = this.parseId(id, 'id');
    const existingComment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      throw new NotFoundException('Comment not found');
    }

    this.assertAuthor(existingComment.authorId, user.id);

    const updatedComment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: this.normalizeContent(dto.content) },
      include: commentInclude,
    });

    return this.toPublicComment(updatedComment);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const commentId = this.parseId(id, 'id');
    const existingComment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existingComment) {
      throw new NotFoundException('Comment not found');
    }

    this.assertAuthor(existingComment.authorId, user.id);

    await this.prisma.comment.delete({ where: { id: commentId } });

    return { deleted: true };
  }

  private async assertSeatReviewExists(seatReviewId: bigint) {
    const review = await this.prisma.seatReview.findUnique({
      where: { id: seatReviewId },
      select: { id: true },
    });

    if (!review) {
      throw new NotFoundException('Seat review not found');
    }
  }

  private assertAuthor(authorId: bigint, currentUserId: string) {
    if (authorId !== this.parseId(currentUserId, 'userId')) {
      throw new ForbiddenException('You can only modify your own comment');
    }
  }

  private normalizeContent(value: string) {
    const content = value.trim();

    if (!content) {
      throw new BadRequestException('content must not be empty');
    }

    return content;
  }

  private parseId(value: string, fieldName: string) {
    try {
      const parsed = BigInt(value);

      if (parsed <= 0n) {
        throw new Error('ID must be positive');
      }

      return parsed;
    } catch {
      throw new BadRequestException(
        `${fieldName} must be a positive integer string`,
      );
    }
  }

  private toPublicComment(comment: CommentWithAuthor) {
    return {
      id: comment.id.toString(),
      seatReviewId: comment.seatReviewId.toString(),
      author: {
        id: comment.author.id.toString(),
        nickname: comment.author.nickname,
      },
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }
}
