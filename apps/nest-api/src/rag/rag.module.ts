import { Module } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { DatabaseModule } from 'src/database/database.module';
import { OpenAiRagClient } from './openai-rag.client';
import { RagController } from './rag.controller';
import { RagQuestionRateLimitGuard } from './rag-question-rate-limit.guard';
import { RagQueryParser } from './rag-query-parser';
import { RagService } from './rag.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RagController],
  providers: [
    AdminGuard,
    OpenAiRagClient,
    RagQuestionRateLimitGuard,
    RagQueryParser,
    RagService,
  ],
  exports: [RagService],
})
export class RagModule {}
