import { Test, TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    return request(server)
      .get('/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          status?: unknown;
          database?: unknown;
        };

        expect(body.status).toBe('ok');
        expect(body.database).toBe('connected');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
