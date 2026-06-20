import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RagQuestionRateLimitGuard } from './rag-question-rate-limit.guard';

function makeContext(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        socket: { remoteAddress: ip },
      }),
    }),
  } as ExecutionContext;
}

describe('RagQuestionRateLimitGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-20T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeGuard() {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'RAG_QUESTION_RATE_LIMIT_MAX_REQUESTS') {
          return '2';
        }
        if (key === 'RAG_QUESTION_RATE_LIMIT_WINDOW_MS') {
          return '60000';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    return new RagQuestionRateLimitGuard(configService);
  }

  it('blocks repeated RAG questions from the same client', () => {
    const guard = makeGuard();
    const context = makeContext('203.0.113.10');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);

    expect(() => guard.canActivate(context)).toThrow(
      new HttpException(
        'Too many RAG question requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it('allows requests again after the configured window expires', () => {
    const guard = makeGuard();
    const context = makeContext('203.0.113.10');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);

    jest.advanceTimersByTime(60_001);

    expect(guard.canActivate(context)).toBe(true);
  });
});
