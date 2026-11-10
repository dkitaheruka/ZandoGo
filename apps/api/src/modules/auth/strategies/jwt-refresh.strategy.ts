import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

interface RefreshPayload {
  sub: string;
  type: 'refresh';
}

function refreshTokenFromCookie(request: Request): string | null {
  return request?.cookies?.refresh_token ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET must be configured');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([refreshTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(_request: Request, payload: RefreshPayload) {
    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Session invalide');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Session invalide');
    }

    return { id: user.id };
  }
}
