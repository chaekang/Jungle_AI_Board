import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { createCorsOptions } from './common/cors-options';
import { createRequestLoggingMiddleware } from './common/request-logging.middleware';
import { parseTrustProxyHops } from './common/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const trustProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);

  if (trustProxyHops !== undefined) {
    app.set('trust proxy', trustProxyHops);
  }

  app.enableCors(createCorsOptions(process.env.CORS_ORIGINS));
  app.use(createRequestLoggingMiddleware());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
