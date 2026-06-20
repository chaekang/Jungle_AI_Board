import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

@Injectable()
export class RagQuestionRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
    }>();
    const now = Date.now();
    const key = request.ip ?? request.socket?.remoteAddress ?? 'unknown-ip';
    const current = this.buckets.get(key);
    const windowMs = this.getPositiveNumber(
      'RAG_QUESTION_RATE_LIMIT_WINDOW_MS',
      DEFAULT_WINDOW_MS,
    );
    const maxRequests = this.getPositiveNumber(
      'RAG_QUESTION_RATE_LIMIT_MAX_REQUESTS',
      DEFAULT_MAX_REQUESTS,
    );

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (current.count >= maxRequests) {
      throw new HttpException(
        'Too many RAG question requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  private getPositiveNumber(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
