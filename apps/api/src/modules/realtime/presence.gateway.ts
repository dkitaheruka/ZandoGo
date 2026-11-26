import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { RoleName } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../common/realtime/ws-jwt.guard';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PresenceService } from './presence.service';

@Injectable()
@WebSocketGateway({ namespace: '/presence' })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly presence: PresenceService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    const visitorId =
      typeof client.handshake.auth?.visitorId === 'string'
        ? client.handshake.auth.visitorId
        : undefined;
    const currentPath =
      typeof client.handshake.auth?.currentPath === 'string'
        ? client.handshake.auth.currentPath
        : undefined;

    let user: AuthenticatedUser | null = null;
    if (token) {
      const ok = await this.wsJwtGuard.authenticate(client);
      if (ok && client.data?.user) {
        user = client.data.user as AuthenticatedUser;
      }
    }

    const change = await this.presence.recordSocketConnect(
      client.id,
      user,
      visitorId,
      currentPath,
    );

    if (
      user?.roles?.some(
        (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
      )
    ) {
      client.join('admin:presence');
    }

    if (change) {
      this.server?.to(`watch:${change.userId}`).emit('presence:status_changed', change);
    }
    this.broadcastAdminSnapshot();
  }

  handleDisconnect(client: Socket) {
    const change = this.presence.recordSocketDisconnect(client.id);
    if (change) {
      this.server?.to(`watch:${change.userId}`).emit('presence:status_changed', change);
    }
    this.broadcastAdminSnapshot();
  }

  @SubscribeMessage('presence:watch')
  watchUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userIds?: string[] },
  ) {
    const ids = Array.isArray(payload?.userIds) ? payload.userIds.slice(0, 50) : [];
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) {
        client.join(`watch:${id.trim()}`);
      }
    }
    return { users: this.presence.getUsersPresence(ids) };
  }

  @SubscribeMessage('presence:ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { currentPath?: string },
  ) {
    this.presence.updateSocketPath(client.id, payload?.currentPath);
    this.broadcastAdminSnapshot();
    return { ok: true };
  }

  emitUserStatusChanged(change?: { userId?: string; isOnline: boolean; lastSeenAt: string } | null) {
    if (change?.userId) {
      this.server?.to(`watch:${change.userId}`).emit('presence:status_changed', {
        userId: change.userId,
        isOnline: change.isOnline,
        lastSeenAt: change.lastSeenAt,
      });
    }
    this.broadcastAdminSnapshot();
  }

  broadcastAdminSnapshot() {
    if (!this.server) return;
    this.server.to('admin:presence').emit('presence:admin_snapshot', this.presence.getAdminLiveSnapshot());
  }
}
