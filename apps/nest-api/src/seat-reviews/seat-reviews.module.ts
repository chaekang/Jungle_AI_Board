import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { SeatReviewsController } from './seat-reviews.controller';
import { SeatReviewsService } from './seat-reviews.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeatReviewsController],
  providers: [SeatReviewsService],
})
export class SeatReviewsModule {}
