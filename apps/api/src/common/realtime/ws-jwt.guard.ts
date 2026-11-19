import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Un socket ne peut pas envoyer de header "Authorization: Bearer ...".
 * Le frontend doit donc se connecter avec :
 *   io("/notifications", { auth: { token: accessToken } })
 * Ce guard vérifie ce token exactement comme JwtStrategy le fait pour les
 * routes HTTP classiques, et attache l'utilisateur authentifié au socket.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    return this.authenticate(client);
  }

  async authenticate(client: Socket): Promise<boolean> {
    if (client.data?.user) return true; // déjà authentifié lors du handshake

    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return false;

      const payload = await this.jwtService.verifyAsync<{ sub?: string; type?: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access' || !payload.sub) return false;

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { roles: true },
      });
      if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') return false;

      client.data.user = {
        id: user.id,
        roles: user.roles.map((r) => ({ role: r.role, scopeId: r.scopeId })),
      };
      return true;
    } catch (err) {
      this.logger.warn(`Connexion WebSocket refusée : ${(err as Error).message}`);
      return false;
    }
  }
}
