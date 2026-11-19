import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
};

/**
 * Limitation de débit par adresse IP (ThrottlerGuard doit être déclaré ici : le décorateur
 * @Throttle seul ne limite rien). Les plafonds sont volontairement modérés : sur les réseaux
 * mobiles, de nombreux utilisateurs partagent la même IP publique, et un plafond trop strict
 * bloquerait des clients légitimes. Limite connue : une attaque répartie sur plusieurs IP
 * contre un seul compte n'est pas couverte par ce mécanisme (voir le verrouillage par compte).
 */
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 600_000 } }) // 10 créations / 10 min / IP
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.register(dto, ip);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 tentatives / min / IP
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(dto, ip);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  }

  // Appelé à chaque chargement de page par le frontend : plafond plus large
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req.user as { id: string }).id;
    const { accessToken, refreshToken } = await this.authService.refresh(userId);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
    return { success: true };
  }
}
