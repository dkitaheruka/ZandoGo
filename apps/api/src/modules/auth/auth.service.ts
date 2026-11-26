import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LoginAttemptTracker } from '../../common/security-rules';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-otp.dto';

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

    const otpCode = await this.createVerificationCode(user.id, 'VERIFY_ACCOUNT', phone ? 'SMS' : 'EMAIL');

    await this.audit.log({
      actorUserId: user.id,
      action: 'user.register',
      entityType: 'User',
      entityId: user.id,
      afterState: { email: user.email, phone: user.phone },
      ipAddress: ip,
    });

    const tokens = await this.issueTokens(user.id);
    return {
      ...tokens,
      verificationPending: true,
      ...(this.isDevPreviewAllowed() ? { devOtpPreview: otpCode } : {}),
    };
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

  private isDevPreviewAllowed(): boolean {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  private async findUserByIdentifier(dto: { identifier?: string; email?: string; phone?: string }) {
    const raw = (dto.identifier || dto.email || dto.phone || '').trim();
    if (!raw) return null;
    const isEmail = raw.includes('@');
    return this.prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: raw.toLowerCase(), mode: 'insensitive' } }
        : { OR: [{ phone: raw }, { email: { equals: raw.toLowerCase(), mode: 'insensitive' } }] },
    });
  }

  private async createVerificationCode(
    userId: string,
    purpose: 'VERIFY_ACCOUNT' | 'RESET_PASSWORD',
    channel: string,
  ): Promise<string> {
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.authVerificationCode.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await this.prisma.authVerificationCode.create({
      data: {
        userId,
        purpose,
        codeHash,
        channel,
        expiresAt,
      },
    });

    return code;
  }

  async forgotPassword(dto: ForgotPasswordDto, ip?: string) {
    const user = await this.findUserByIdentifier(dto);
    if (!user) {
      return {
        sent: true,
        message: 'Si un compte correspond à cet identifiant, un code de réinitialisation a été envoyé.',
      };
    }

    const code = await this.createVerificationCode(
      user.id,
      'RESET_PASSWORD',
      user.phone ? 'SMS' : 'EMAIL',
    );

    await this.audit.log({
      actorUserId: user.id,
      action: 'user.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      sent: true,
      message: 'Un code de réinitialisation à 6 chiffres valable 15 minutes a été généré.',
      ...(this.isDevPreviewAllowed() ? { devOtpPreview: code } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string) {
    const user = await this.findUserByIdentifier(dto);
    if (!user) {
      throw new BadRequestException('Code de réinitialisation invalide ou expiré');
    }

    const record = await this.prisma.authVerificationCode.findFirst({
      where: {
        userId: user.id,
        purpose: 'RESET_PASSWORD',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || !(await bcrypt.compare(dto.code.trim(), record.codeHash))) {
      throw new BadRequestException('Code de réinitialisation invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.authVerificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(user.status === 'PENDING_VERIFICATION' ? { status: 'ACTIVE' } : {}),
        },
      }),
    ]);

    this.loginTracker.recordSuccess(user.email || user.phone || user.id);
    await this.audit.log({
      actorUserId: user.id,
      action: 'user.password_reset_completed',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
    });

    return {
      success: true,
      message: 'Mot de passe mis à jour avec succès. Vous pouvez vous connecter.',
    };
  }

  async verifyAccountOtp(userId: string, code: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    if (user.status === 'ACTIVE') {
      return { verified: true, status: 'ACTIVE', message: 'Compte déjà vérifié.' };
    }

    const record = await this.prisma.authVerificationCode.findFirst({
      where: {
        userId,
        purpose: 'VERIFY_ACCOUNT',
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || !(await bcrypt.compare(code.trim(), record.codeHash))) {
      throw new BadRequestException('Code OTP invalide ou expiré');
    }

    await this.prisma.$transaction([
      this.prisma.authVerificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    await this.audit.log({
      actorUserId: userId,
      action: 'user.otp_verified',
      entityType: 'User',
      entityId: userId,
      ipAddress: ip,
    });

    return {
      verified: true,
      status: 'ACTIVE',
      message: 'Votre compte est désormais vérifié et actif.',
    };
  }

  async resendAccountOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    if (user.status === 'ACTIVE') {
      return { sent: false, status: 'ACTIVE', message: 'Compte déjà vérifié.' };
    }

    const code = await this.createVerificationCode(
      user.id,
      'VERIFY_ACCOUNT',
      user.phone ? 'SMS' : 'EMAIL',
    );

    return {
      sent: true,
      message: 'Un nouveau code OTP à 6 chiffres vient d’être généré (valable 15 minutes).',
      ...(this.isDevPreviewAllowed() ? { devOtpPreview: code } : {}),
    };
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
