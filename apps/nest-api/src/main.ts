import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // React가 NestAPI를 호출할 수 있게 함
  app.enableCors({
    origin: 'http://localhost:5173'
  })

  // 이 앱 전체에 Pipe를 공통 적용
  app.useGlobalPipes(
    // ValidationPipe: NestJS가 요청 데이터를 자동으로 검사해주는 필터
    new ValidationPipe({
      whitelist: true,                  // DTO에 없는 필드는 자동 제거
      forbidNonWhitelisted: true,       // DTO에 없는 필드가 들어오면 에러
      transform: true,                  // 요청 값을 DTO 타입에 맞게 변환하려고 시도
    })
  )

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
