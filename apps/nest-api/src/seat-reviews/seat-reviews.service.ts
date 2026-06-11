import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthenticatedUser } from "src/common/interfaces/authenticated-user.interface";
import { PrismaService } from "src/database/prisma.service";
import { CreateSeatReviewDto } from "./dto/create-seat-review.dto";
import { SeatReviewQueryDto } from "./dto/seat-review-query.dto";
import { UpdateSeatReviewDto } from "./dto/update-seat-review.dto";

// 리뷰 조회 시 같이 가져올 관계 정의
const seatReviewInclude = {
    author: true,
    theater: true,
    musical: true,
    performance: true
} satisfies Prisma.SeatReviewInclude;

type SeatReviewWithRelations = Prisma.SeatReviewGetPayload<{include: typeof seatReviewInclude;}>;

@Injectable()
export class SeatReviewsService {
    constructor(private readonly prisma: PrismaService) {}

    // 좌석 리뷰 생성
    async create(user: AuthenticatedUser, dto: CreateSeatReviewDto) {
        const authorId = this.parseId(user.id, "userId");
        const theaterId = this.parseId(dto.theaterId, "theaterId");
        const musicalId = this.parseId(dto.musicalId, "musicalId");
        const performanceId = this.parseId(dto.performanceId, "performanceId");

        await this.assertPerformanceMatches({
            performanceId,
            theaterId,
            musicalId
        });

        const review = await this.prisma.seatReview.create({
            data: {
                authorId,
                theaterId,
                musicalId,
                performanceId,
                seatFloor: dto.seatFloor.trim(),
                seatSection: this.normalizeOptionalText(dto.seatSection),
                seatRow: dto.seatRow.trim().toUpperCase(),
                seatNumber: dto.seatNumber.trim(),
                viewRating: dto.viewRating,
                soundRating: dto.soundRating,
                comfortRating: dto.comfortRating,
                expressionRating: dto.expressionRating,
                stageVisibilityRating: dto.stageVisibilityRating,
                content: dto.content.trim()
            },
            include: seatReviewInclude
        });

        return this.toPublicReview(review);
    }

    // 좌석 리뷰 목록 조회
    async findAll(query: SeatReviewQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: Prisma.SeatReviewWhereInput = {
            ...(query.theaterId ? {theaterId: this.parseId(query.theaterId, "theaterId")} : {}),
            ...(query.musicalId ? {musicalId: this.parseId(query.musicalId, "musicalId")} : {}),
            ...(query.performanceId ? {performanceId: this.parseId(query.performanceId, "performanceId")}: {})
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.seatReview.findMany({
                where,
                include: seatReviewInclude,
                orderBy: {createdAt : "desc"},
                skip,
                take: limit
            }),
            this.prisma.seatReview.count({where})
        ]);

        return {
            items: items.map((review) => this.toPublicReview(review)),
            total,
            page,
            limit
        }
    }

    // 상세 조회
    async findOne(id: string) {
        const review = await this.prisma.seatReview.findUnique({
            where: {id: this.parseId(id, "id")},
            include: seatReviewInclude
        });

        if (!review) {
            throw new NotFoundException("Seat review not found");
        }

        return this.toPublicReview(review);
    }

    // 좌석 리뷰 수정
    async update(id: string, user: AuthenticatedUser, dto: UpdateSeatReviewDto) {
        const reviewId = this.parseId(id, "id");
        const existingReview = await this.prisma.seatReview.findUnique({
            where: {id: reviewId}
        })

        if (!existingReview) {
            throw new NotFoundException("Seat review not found");
        }

        this.assertAuthor(existingReview.authorId, user.id);

        const updateReview = await this.prisma.seatReview.update({
            where: {id: reviewId},
            data: {
                ...(dto.seatFloor !== undefined ? { seatFloor: dto.seatFloor.trim() } : {}),
                ...(dto.seatSection !== undefined
                ? { seatSection: this.normalizeOptionalText(dto.seatSection) }
                : {}),
                ...(dto.seatRow !== undefined ? { seatRow: dto.seatRow.trim().toUpperCase() } : {}),
                ...(dto.seatNumber !== undefined ? { seatNumber: dto.seatNumber.trim() } : {}),
                ...(dto.viewRating !== undefined ? { viewRating: dto.viewRating } : {}),
                ...(dto.soundRating !== undefined ? { soundRating: dto.soundRating } : {}),
                ...(dto.comfortRating !== undefined ? { comfortRating: dto.comfortRating } : {}),
                ...(dto.expressionRating !== undefined
                ? { expressionRating: dto.expressionRating }
                : {}),
                ...(dto.stageVisibilityRating !== undefined
                ? { stageVisibilityRating: dto.stageVisibilityRating }
                : {}),
                ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
            },
            include: seatReviewInclude,
        });

        return this.toPublicReview(updateReview);
    }

    // 좌석 리뷰 삭제
    async remove(id: string, user: AuthenticatedUser) {
        const reviewId = this.parseId(id, "id");
        const existingReview = await this.prisma.seatReview.findUnique({
            where: {id: reviewId}
        });

        if (!existingReview) {
            throw new NotFoundException("Seat review not found");
        }

        this.assertAuthor(existingReview.authorId, user.id);

        await this.prisma.$transaction([
            this.prisma.seatReviewTag.deleteMany({where: {seatReviewId: reviewId}}),
            this.prisma.comment.deleteMany({where : {seatReviewId: reviewId}}),
            this.prisma.seatReview.delete({where: {id: reviewId}})
        ]);

        return {delete: true};
    }

    // 문자열 ID를 `bigint`로 변환
    private parseId(value: string, fieldName: string) {
        try {
            const parsed = BigInt(value);

            if (parsed <= 0n) {
                throw new Error("ID must be positive");
            }

            return parsed;
        }
        catch {
            throw new BadRequestException(`${fieldName} must be a positive integer string`);
        }
    }

    // 사용자가 보낸 `performanceId`, `theaterId`, `musicalId`가 맞는 조합인지 확인
    private async assertPerformanceMatches(input: {
        performanceId: bigint;
        theaterId: bigint;
        musicalId: bigint;
    }) {
        const performance = await this.prisma.performance.findUnique({
            where: {id : input.performanceId}
        });

        if (!performance) {
            throw new BadRequestException("Performance not found");
        }

        if (performance.theaterId !== input.theaterId || performance.musicalId !== input.musicalId) {
            throw new BadRequestException("Performance does not match theaterId or muscialId");
        }
    }

    // 로그인 유저가 리뷰 작성자인지 확인
    private assertAuthor(authorId: bigint, currentUserId: string) {
        if (authorId !== this.parseId(currentUserId, "userId")) {
            throw new ForbiddenException("You can only modify your own review");
        }
    }

    // 선택 입력 문자열 정리
    private normalizeOptionalText(value?: string) {
        const normalized = value?.trim();
        return normalized ? normalized : null;
    }

    // DB에서 가져온 Prisma 리뷰 객체를 API 응답용 객체로 변환
    private toPublicReview(review: SeatReviewWithRelations) {
        return {
            id : review.id.toString(),
            author: {
                id: review.author.id.toString(),
                nickname: review.author.nickname
            },
            theater: {
                id: review.theater.id.toString(),
                name: review.theater.name
            },
            musical: {
                id: review.musical.id.toString(),
                title: review.musical.title
            },
            performance: review.performance ? {
                id: review.performance.id.toString(),
                seasonLabel: review.performance.seasonLabel
            } : null,
            seat: {
                floor: review.seatFloor,
                section: review.seatSection,
                row: review.seatRow,
                number: review.seatNumber
            },
            ratings: {
                view: review.viewRating,
                sound: review.soundRating,
                comfort: review.comfortRating,
                expression: review.expressionRating,
                stageVisibility: review.stageVisibilityRating
            },
            content: review.content,
            createdAt: review.createdAt.toISOString(),
            updatedAt: review.updatedAt.toISOString()
        };
    }
}
