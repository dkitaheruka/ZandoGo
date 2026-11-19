import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeAiLanguage, SupportedAiLanguage } from '../../common/commerce-rules';
import { isSafeChatAttachmentUrl } from '../../common/security-rules';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AssistantService } from '../assistant/assistant.service';
import { UploadsService } from '../uploads/uploads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StartConversationDto } from './dto/start-conversation.dto';

export interface SendMessageOptions {
  senderLanguage?: string;
  targetLanguage?: string;
  autoTranslate?: boolean;
  preferredModel?: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assistant: AssistantService,
    private readonly uploads: UploadsService,
  ) {}

  private async hydrateAttachmentUrl<T extends { attachmentUrl?: string | null }>(msg: T): Promise<T> {
    if (msg.attachmentUrl && msg.attachmentUrl.startsWith('chat/')) {
      try {
        return {
          ...msg,
          attachmentUrl: await this.uploads.signedReadUrl(msg.attachmentUrl),
        };
      } catch {
        return msg;
      }
    }
    return msg;
  }

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
    const convs = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        participants: true,
        messages: { orderBy: { sentAt: 'asc' }, take: 50 },
      },
    });
    return Promise.all(
      convs.map(async (conv) => ({
        ...conv,
        messages: await Promise.all(conv.messages.map((m) => this.hydrateAttachmentUrl(m))),
      })),
    );
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
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
      take: 200,
    });
    return Promise.all(rows.map((m) => this.hydrateAttachmentUrl(m)));
  }

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    content?: string,
    attachmentUrl?: string,
    options?: SendMessageOptions,
  ) {
    await this.assertParticipant(user.id, conversationId);
    const normalizedContent = (content ?? '').trim();
    const trimmedAttachment = attachmentUrl?.trim() || undefined;
    if (!normalizedContent && !trimmedAttachment) {
      throw new BadRequestException('Un message ou une photo est requis');
    }
    if (normalizedContent.length > 4000) {
      throw new BadRequestException('Le message ne peut pas dépasser 4000 caractères');
    }
    if (trimmedAttachment) {
      if (!isSafeChatAttachmentUrl(trimmedAttachment)) {
        throw new BadRequestException('Pièce jointe photo invalide ou non autorisée');
      }
      if (trimmedAttachment.startsWith('chat/')) {
        this.uploads.assertOwnedKey(user, 'CHAT_IMAGE', trimmedAttachment);
      }
    }

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const participantUsers = await this.prisma.user.findMany({
      where: { id: { in: participants.map((p) => p.userId) } },
      select: { id: true, preferredLanguage: true },
    });

    const senderRecord = participantUsers.find((u) => u.id === user.id);
    let sourceLang: SupportedAiLanguage = normalizeAiLanguage(
      options?.senderLanguage || senderRecord?.preferredLanguage,
    );

    const recipientTargets = new Set<SupportedAiLanguage>();
    for (const u of participantUsers) {
      if (u.id !== user.id) {
        recipientTargets.add(normalizeAiLanguage(u.preferredLanguage));
      }
    }
    if (options?.targetLanguage && options.targetLanguage !== 'auto') {
      recipientTargets.add(normalizeAiLanguage(options.targetLanguage));
    }
    // Always ensure French is available when a client writes in Lingala/Kiswahili/English
    if (sourceLang !== 'fr') {
      recipientTargets.add('fr');
    }

    const translations: Record<string, string> = {};
    let translationEngine: string | undefined;
    let translationModel: string | undefined;

    if (options?.autoTranslate !== false && normalizedContent) {
      for (const targetLang of recipientTargets) {
        if (targetLang === sourceLang && options?.senderLanguage) continue;
        try {
          const translated = await Promise.race([
            this.assistant.translateChatMessage({
              text: normalizedContent,
              sourceLanguage: options?.senderLanguage ? sourceLang : 'auto',
              targetLanguage: targetLang,
              preferredModel: options?.preferredModel,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
          ]);
          if (translated && translated.translatedText) {
            sourceLang = translated.detectedLanguage;
            if (translated.detectedLanguage !== targetLang) {
              translations[targetLang] = translated.translatedText;
              translationEngine = translated.engine;
              translationModel = translated.model || undefined;
            }
          }
        } catch {
          // Never block message delivery if AI translation is temporarily offline
        }
      }
    }

    const created = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: normalizedContent,
        sourceLanguage: sourceLang,
        translations: Object.keys(translations).length > 0 ? translations : undefined,
        attachmentUrl: trimmedAttachment,
      },
    });

    const hydrated = await this.hydrateAttachmentUrl(created);

    return {
      ...hydrated,
      translationEngine,
      translationModel,
    };
  }

  async translateMessage(
    user: AuthenticatedUser,
    messageId: string,
    targetLanguageRaw: string,
    preferredModel?: string,
  ) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    await this.assertParticipant(user.id, message.conversationId);

    const targetLanguage = normalizeAiLanguage(targetLanguageRaw);
    const existingTranslations =
      (message.translations && typeof message.translations === 'object'
        ? (message.translations as Record<string, string>)
        : {}) || {};

    if (existingTranslations[targetLanguage]) {
      return {
        ...message,
        translatedText: existingTranslations[targetLanguage],
        targetLanguage,
        cached: true,
      };
    }

    const result = await this.assistant.translateChatMessage({
      text: message.content,
      sourceLanguage: 'auto',
      targetLanguage,
      preferredModel,
    });

    const nextTranslations: Record<string, string> = {
      ...existingTranslations,
      ...(result.detectedLanguage !== targetLanguage ? { [targetLanguage]: result.translatedText } : {}),
    };

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        sourceLanguage: result.detectedLanguage,
        translations: nextTranslations,
      },
    });

    return {
      ...updated,
      translatedText: result.translatedText,
      targetLanguage,
      translationEngine: result.engine,
      translationModel: result.model,
      cached: false,
    };
  }

  async markRead(user: AuthenticatedUser, conversationId: string) {
    await this.assertParticipant(user.id, conversationId);
    return this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

