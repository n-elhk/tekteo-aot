import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 15 * 1024 * 1024 }),
  );

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.setGlobalPrefix('api');

  const corsOrigin = process.env.CORS_ORIGIN ?? 'https://localhost:4200';
  app.enableCors({
    origin: corsOrigin.split(',').map((v) => v.trim()),
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 API is running on: http://localhost:${port}/api`);
}

bootstrap();
