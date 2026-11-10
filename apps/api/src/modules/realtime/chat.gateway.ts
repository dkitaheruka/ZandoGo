import { Injectable, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../common/realtime/ws-jwt.guard';
import { ChatService } from './chat.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Injectable()
@WebSocketGateway({ namespace: '/chat' })
export class ChatGateway {
  @WebSocketServer()
  private server: Server;

  constructor(private readonly chatService: ChatService) {}

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:join')
  async joinConversation(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
    // Sans cette vérification, n'importe quel utilisateur connecté pouvait rejoindre
    // la room d'une conversation et lire les messages des autres en direct.
    const user = client.data.user as AuthenticatedUser;
    try {
      await this.chatService.assertParticipant(user.id, conversationId);
    } catch {
      throw new WsException('Conversation introuvable');
    }
    client.join(`conversation:${conversationId}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; content: string; attachmentUrl?: string },
  ) {
    const user = client.data.user as AuthenticatedUser;
    const message = await this.chatService.sendMessage(
      user,
      body.conversationId,
      body.content,
      body.attachmentUrl,
    );

    this.server.to(`conversation:${body.conversationId}`).emit('message:new', message);
    return message;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:read')
  async markRead(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
    const user = client.data.user as AuthenticatedUser;
    await this.chatService.markRead(user, conversationId);
    this.server.to(`conversation:${conversationId}`).emit('message:read', { conversationId, userId: user.id });
  }
}
