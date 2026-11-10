import { Injectable, UseGuards } from '@nestjs/common';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WsJwtGuard } from '../../common/realtime/ws-jwt.guard';

interface PushNotificationParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  // JSON sérialisable uniquement : vérifié à la compilation chez chaque appelant
  data?: Prisma.InputJsonObject;
}

@Injectable()
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  async handleConnection(client: Socket) {
    if (!(await this.wsJwtGuard.authenticate(client))) {
      client.disconnect();
      return;
    }

    const user = client.data?.user as { id: string } | undefined;
    if (!user) {
      client.disconnect();
      return;
    }
    // Room personnelle : chaque utilisateur ne reçoit que ses propres notifications
    client.join(`user:${user.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('notification:mark_read')
  async markAsRead(client: Socket, notificationId: string) {
    const user = client.data.user as { id: string };
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true },
    });
  }

  /**
   * Point d'entrée unique utilisé par TOUS les autres modules (vendors,
   * kyc, disputes, delivery...) pour notifier un utilisateur. Centralise
   * la double écriture : persistance en base (pour l'historique et le
   * cas où l'utilisateur est hors-ligne) + diffusion temps réel immédiate.
   */
  async notifyUser(params: PushNotificationParams) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data,
      },
    });

    this.server.to(`user:${params.userId}`).emit('notification:new', notification);

    return notification;
  }
}
