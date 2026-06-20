import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { AskRagQuestionDto } from './dto/ask-rag-question.dto';
import { RagQuestionRateLimitGuard } from './rag-question-rate-limit.guard';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('questions')
  @UseGuards(RagQuestionRateLimitGuard)
  ask(@Body() dto: AskRagQuestionDto) {
    return this.ragService.ask(dto.question, dto.limit);
  }

  @Post('index/:reviewId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  indexOne(@Param('reviewId') reviewId: string) {
    return this.ragService.upsertReviewEmbedding(BigInt(reviewId));
  }

  @Post('index')
  @UseGuards(JwtAuthGuard, AdminGuard)
  indexAll() {
    return this.ragService.reindexAll();
  }
}
