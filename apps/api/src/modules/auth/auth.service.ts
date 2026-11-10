import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
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
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Un email ou un numéro de téléphone est requis');
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email ou ce numéro');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
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

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Ce compte est suspendu. Contactez le support.');
    }

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
