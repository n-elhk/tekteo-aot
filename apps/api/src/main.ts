import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const globalPrefix = 'api';

  app.setGlobalPrefix(globalPrefix);

  // Body parsers — limite augmentée pour supporter les attachments base64
  // (les uploads multipart sont gérés indépendamment par multer / FileInterceptor)
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN ?? 'https://localhost:4200';
  app.enableCors({
    origin: corsOrigin.split(',').map((value) => value.trim()),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(
    `🚀 API is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
