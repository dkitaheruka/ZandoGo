import { Injectable, UseGuards } from '@nestjs/common';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { WsJwtGuard } from '../../common/realtime/ws-jwt.guard';
import { AccessUser, assertCanViewDelivery } from '../../common/access/delivery-access';

/**
 * Namespace dédié au suivi livreur. Le client (customer/vendeur/admin) qui
 * veut suivre une course rejoint la room `delivery:{deliveryId}` ; le
 * DeliveryService appelle emitLocationUpdate/emitStatusChange à chaque
 * écriture en base (voir delivery.service.ts) pour diffuser en direct
 * sans que le frontend ait besoin de faire du polling.
 */
@Injectable()
@WebSocketGateway({ namespace: '/tracking' })
export class TrackingGateway {
  @WebSocketServer()
  private server: Server;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rejoindre la room d'une livraison donne accès à la position du livreur en
   * continu : même règle d'accès que l'API REST (voir assertCanViewDelivery).
   * Sans ce contrôle, n'importe quel utilisateur connecté pouvait suivre
   * n'importe quelle livraison dont il connaissait l'identifiant.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('tracking:join')
  async joinDeliveryRoom(client: Socket, deliveryId: string) {
    const user = client.data.user as AccessUser;
    try {
      await assertCanViewDelivery(this.prisma, user, deliveryId);
    } catch {
      throw new WsException('Livraison introuvable');
    }
    client.join(`delivery:${deliveryId}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('tracking:leave')
  leaveDeliveryRoom(client: Socket, deliveryId: string) {
    client.leave(`delivery:${deliveryId}`);
  }

  emitLocationUpdate(deliveryId: string, lat: number, lng: number, recordedAt: Date) {
    this.server.to(`delivery:${deliveryId}`).emit('delivery:location_update', {
      deliveryId,
      lat,
      lng,
      recordedAt,
    });
  }

  emitStatusChange(deliveryId: string, status: string) {
    this.server.to(`delivery:${deliveryId}`).emit('delivery:status_change', { deliveryId, status });
  }
}
