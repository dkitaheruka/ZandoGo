import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/realtime/redis-io.adapter';
import { parseAllowedCorsOrigins, validateJwtSecretsConfig } from './common/security-rules';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  validateJwtSecretsConfig({
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    isProduction,
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Supprime l'en-tête Express X-Powered-By et impose les en-têtes de sécurité HTTP
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
  });

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
  } else if (isProduction) {
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

  const allowedOrigins = parseAllowedCorsOrigins(process.env.APP_URL, isProduction);
  app.enableCors({
    origin: (origin, callback) => {
      // Requêtes serveur-à-serveur ou webhooks sans en-tête Origin : gérés par HMAC/JWT
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalized)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origine CORS non autorisée'));
    },
    credentials: true, // nécessaire pour le cookie httpOnly du refresh token
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API démarrée sur http://localhost:${port}/api`);
}

bootstrap();
