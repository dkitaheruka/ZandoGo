import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StartConversationDto } from './dto/start-conversation.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async startConversation(user: AuthenticatedUser, dto: StartConversationDto) {
    if (user.id === dto.otherUserId) {
      throw new BadRequestException('Une conversation ne peut pas être ouverte avec soi-même');
    }

    const recipient = await this.prisma.user.findUnique({ where: { id: dto.otherUserId } });
    if (!recipient || recipient.status === 'BANNED' || recipient.status === 'SUSPENDED') {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: dto.type,
        orderId: dto.orderId ?? null,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: dto.otherUserId } } },
        ],
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: dto.type,
        orderId: dto.orderId,
        participants: {
          create: [{ userId: user.id }, { userId: dto.otherUserId }],
        },
      },
    });
  }

  async listConversations(user: AuthenticatedUser) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        participants: true,
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
    });
  }

  async assertParticipant(userId: string, conversationId: string): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!participant) throw new NotFoundException('Conversation introuvable');
  }

  async listMessages(user: AuthenticatedUser, conversationId: string) {
    await this.assertParticipant(user.id, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
      take: 200,
    });
  }

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    content: string,
    attachmentUrl?: string,
  ) {
    await this.assertParticipant(user.id, conversationId);
    const normalizedContent = content.trim();
    if (!normalizedContent && !attachmentUrl) {
      throw new BadRequestException('Un message ou une pièce jointe est requis');
    }
    if (normalizedContent.length > 4000) {
      throw new BadRequestException('Le message ne peut pas dépasser 4000 caractères');
    }

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: normalizedContent,
        attachmentUrl,
      },
    });
  }

  async markRead(user: AuthenticatedUser, conversationId: string) {
    await this.assertParticipant(user.id, conversationId);
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
