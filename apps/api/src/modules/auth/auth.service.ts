import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LoginAttemptTracker } from '../../common/security-rules';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;

function expirationSeconds(value: string | undefined, fallback: string): number {
  const duration = value ?? fallback;
  const match = /^(\d+)(s|m|h|d)$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid JWT expiration duration: ${duration}`);
  }

  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * units[match[2]];
}

@Injectable()
export class AuthService {
  private readonly loginTracker = new LoginAttemptTracker(5, 15 * 60 * 1000, 15 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Inscription client par défaut. Les rôles VENDOR_OWNER / DELIVERY_AGENT
   * sont attribués ensuite via un processus de demande + validation KYC
   * par un ADMIN (jamais auto-attribués à l'inscription).
   */
  async register(dto: RegisterDto, ip?: string) {
    const email = dto.email?.trim().toLowerCase() || undefined;
    const phone = dto.phone?.trim() || undefined;

    if (!email && !phone) {
      throw new ConflictException('Un email ou un numéro de téléphone est requis');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email ou ce numéro');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        fullName: dto.fullName.trim(),
        preferredCurrency: dto.preferredCurrency ?? 'USD',
        status: 'PENDING_VERIFICATION',
        roles: {
          create: [{ role: RoleName.CUSTOMER }],
        },
      },
      include: { roles: true },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'user.register',
      entityType: 'User',
      entityId: user.id,
      afterState: { email: user.email, phone: user.phone },
      ipAddress: ip,
    });

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto, ip?: string) {
    const email = dto.email?.trim().toLowerCase() || undefined;
    const phone = dto.phone?.trim() || undefined;
    const identifier = email || phone || '';

    if (!identifier) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const lockState = this.loginTracker.isLocked(identifier);
    if (lockState.locked) {
      await this.audit.log({
        action: 'user.login_blocked_lockout',
        entityType: 'Auth',
        entityId: identifier,
        afterState: { retryAfterSeconds: lockState.retryAfterSeconds },
        ipAddress: ip,
      });
      throw new HttpException(
        `Trop de tentatives échouées. Réessayez dans ${Math.ceil(lockState.retryAfterSeconds / 60)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email: { equals: email, mode: 'insensitive' } } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!user) {
      this.loginTracker.recordFailure(identifier);
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const failure = this.loginTracker.recordFailure(identifier);
      await this.audit.log({
        actorUserId: user.id,
        action: failure.locked ? 'user.login_locked' : 'user.login_failed',
        entityType: 'User',
        entityId: user.id,
        afterState: { attemptsRemaining: failure.attemptsRemaining },
        ipAddress: ip,
      });
      if (failure.locked) {
        throw new HttpException(
          'Trop de tentatives échouées. Compte temporairement verrouillé pendant 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Ce compte est suspendu. Contactez le support.');
    }

    this.loginTracker.recordSuccess(identifier);
    await this.audit.log({
      actorUserId: user.id,
      action: 'user.login_success',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return this.issueTokens(user.id);
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Session invalide');
    }
    return this.issueTokens(user.id);
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, type: 'access' },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: expirationSeconds(this.config.get<string>('JWT_ACCESS_EXPIRES_IN'), '15m'),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: expirationSeconds(this.config.get<string>('JWT_REFRESH_EXPIRES_IN'), '7d'),
      },
    );

    return { accessToken, refreshToken };
  }
}
