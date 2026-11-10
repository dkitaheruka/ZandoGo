import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // L'API tourne derrière Caddy (voir docker-compose.yml) : sans ceci, req.ip serait toujours
  // l'adresse du proxy et la limitation de débit partagerait un seul compteur entre TOUS les
  // utilisateurs. "1" = un seul proxy de confiance devant l'API ; à porter à 2 si un autre
  // proxy (ex: Cloudflare) est placé devant Caddy.
  app.set('trust proxy', 1);

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis(redisUrl);
    app.useWebSocketAdapter(redisIoAdapter);
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL must be configured in production');
  } else {
    // The default Socket.IO adapter works for a single local API instance.
    console.warn('REDIS_URL is not set; using the in-process Socket.IO adapter.');
  }
  app.enableShutdownHooks();

  app.use(cookieParser());
  app.setGlobalPrefix('api');

  // Validation stricte de tous les DTOs entrants (defense in depth)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // rejette les champs non déclarés dans les DTOs
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true, // nécessaire pour le cookie httpOnly du refresh token
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API démarrée sur http://localhost:${port}/api`);
}

bootstrap();
