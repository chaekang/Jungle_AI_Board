import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetadataModule } from './metadata/metadata.module';
import { SeatReviewsModule } from './seat-reviews/seat-reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    MetadataModule,
    SeatReviewsModule,
    CommentsModule,
  ],
})
export class AppModule {}
