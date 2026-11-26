import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { normalizeAiLanguage, SupportedAiLanguage } from '../../common/commerce-rules';
import { haversineDistanceKm } from '../../common/geo/haversine';
import { isSafeChatAttachmentUrl } from '../../common/security-rules';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AssistantService } from '../assistant/assistant.service';
import { UploadsService } from '../uploads/uploads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StartConversationDto } from './dto/start-conversation.dto';
import { PresenceService } from './presence.service';

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
    private readonly presence: PresenceService,
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

  private async resolveRecipientId(user: AuthenticatedUser, dto: StartConversationDto): Promise<string> {
    if (dto.otherUserId && dto.otherUserId !== user.id) {
      const explicit = await this.prisma.user.findUnique({ where: { id: dto.otherUserId } });
      if (explicit && explicit.status !== 'BANNED' && explicit.status !== 'SUSPENDED') {
        return explicit.id;
      }
    }

    if (dto.storeId && dto.storeId !== 'store-logistics') {
      const store = await this.prisma.vendorStore.findUnique({ where: { id: dto.storeId } });
      if (store && store.ownerId !== user.id) return store.ownerId;
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: { store: { select: { ownerId: true } } },
      });
      if (product?.store?.ownerId && product.store.ownerId !== user.id) {
        return product.store.ownerId;
      }
    }

    if (dto.orderId && dto.type === 'CUSTOMER_DELIVERY') {
      const assigned = await this.prisma.delivery.findFirst({
        where: { subOrder: { orderId: dto.orderId }, agentId: { not: null } },
        include: { agent: true },
      });
      if (assigned?.agent?.userId && assigned.agent.userId !== user.id) {
        return assigned.agent.userId;
      }
      const anyAgent = await this.prisma.deliveryAgent.findFirst({
        where: { userId: { not: user.id } },
        orderBy: { id: 'asc' },
      });
      if (anyAgent) return anyAgent.userId;
    }

    if (dto.orderId) {
      const subOrder = await this.prisma.orderSubOrder.findFirst({
        where: { orderId: dto.orderId },
        include: { store: { select: { ownerId: true } } },
      });
      if (subOrder?.store?.ownerId && subOrder.store.ownerId !== user.id) {
        return subOrder.store.ownerId;
      }
    }

    const fallbackUser = await this.prisma.user.findFirst({
      where: {
        id: { not: user.id },
        status: 'ACTIVE',
        roles: { some: { role: { in: [RoleName.ADMIN, RoleName.SUPER_ADMIN, RoleName.DELIVERY_AGENT, RoleName.VENDOR_OWNER] } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!fallbackUser) {
      throw new NotFoundException('Aucun interlocuteur disponible pour démarrer la conversation');
    }
    return fallbackUser.id;
  }

  private formatConversation<T extends { metadata?: unknown; messages?: any[]; participants?: { userId: string }[] }>(
    conv: T,
    userId?: string,
  ) {
    const meta =
      conv.metadata && typeof conv.metadata === 'object'
        ? (conv.metadata as Record<string, any>)
        : {};
    const messages = conv.messages || [];
    const unreadCount = userId
      ? messages.filter((m) => m.senderId !== userId && !m.readAt).length
      : 0;
    const otherParticipant = userId
      ? (conv.participants || []).find((p) => p.userId !== userId)
      : undefined;
    const otherUserId = otherParticipant?.userId;
    const otherPresence = otherUserId ? this.presence.getUserStatus(otherUserId) : undefined;
    return {
      ...meta,
      ...conv,
      unreadCount,
      ...(otherUserId
        ? {
            otherUserId,
            otherUserOnline: otherPresence?.isOnline ?? false,
            otherUserLastSeenAt: otherPresence?.lastSeenAt ?? null,
          }
        : {}),
    };
  }

  async startConversation(user: AuthenticatedUser, dto: StartConversationDto) {
    const recipientId = await this.resolveRecipientId(user, dto);
    if (user.id === recipientId) {
      throw new BadRequestException('Une conversation ne peut pas être ouverte avec soi-même');
    }

    const recipient = await this.prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient || recipient.status === 'BANNED' || recipient.status === 'SUSPENDED') {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const meta = {
      ...(dto.orderNumber ? { orderNumber: dto.orderNumber } : {}),
      ...(dto.storeId ? { storeId: dto.storeId } : {}),
      ...(dto.storeName ? { storeName: dto.storeName } : {}),
      ...(dto.productId ? { productId: dto.productId } : {}),
      ...(dto.productTitle ? { productTitle: dto.productTitle } : {}),
      ...(dto.productImage ? { productImage: dto.productImage } : {}),
      ...(dto.productPriceUsd !== undefined ? { productPriceUsd: dto.productPriceUsd } : {}),
    };

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: dto.type,
        orderId: dto.orderId ?? null,
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: { participants: true, messages: { orderBy: { sentAt: 'asc' }, take: 50 } },
    });
    if (existing) {
      const nextMeta = {
        ...((existing.metadata as Record<string, any> | null) || {}),
        ...meta,
      };
      const updated = Object.keys(meta).length > 0
        ? await this.prisma.conversation.update({
            where: { id: existing.id },
            data: { metadata: nextMeta },
            include: { participants: true, messages: { orderBy: { sentAt: 'asc' }, take: 50 } },
          })
        : existing;
      return this.formatConversation(updated, user.id);
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: dto.type,
        orderId: dto.orderId,
        metadata: Object.keys(meta).length > 0 ? meta : undefined,
        participants: {
          create: [{ userId: user.id }, { userId: recipientId }],
        },
      },
      include: { participants: true, messages: { orderBy: { sentAt: 'asc' }, take: 50 } },
    });
    return this.formatConversation(created, user.id);
  }

  async listConversations(user: AuthenticatedUser) {
    const convs = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: user.id } } },
      include: {
        participants: true,
        messages: { orderBy: { sentAt: 'asc' }, take: 50 },
      },
      orderBy: { id: 'desc' },
    });
    return Promise.all(
      convs.map(async (conv) =>
        this.formatConversation(
          {
            ...conv,
            messages: await Promise.all(conv.messages.map((m) => this.hydrateAttachmentUrl(m))),
          },
          user.id,
        ),
      ),
    );
  }

  async shareLocation(
    user: AuthenticatedUser,
    conversationId: string,
    dto: { lat: number; lng: number; label?: string; googleMapsUrl?: string },
  ) {
    await this.assertParticipant(user.id, conversationId);
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');

    const googleMapsUrl =
      dto.googleMapsUrl && dto.googleMapsUrl.startsWith('http')
        ? dto.googleMapsUrl
        : `https://www.google.com/maps/search/?api=1&query=${dto.lat},${dto.lng}`;

    const distanceKm = Number(
      haversineDistanceKm(-1.6741, 29.2285, dto.lat, dto.lng).toFixed(1),
    );

    const location = {
      lat: dto.lat,
      lng: dto.lng,
      label: dto.label || 'Position partagée',
      googleMapsUrl,
    };

    const nextMeta = {
      ...((conv.metadata as Record<string, any> | null) || {}),
      clientLocation: location,
      distanceKm,
    };

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          content: `Position Google Maps partagée : ${location.label} (${distanceKm} km) — ${googleMapsUrl}`,
          sourceLanguage: 'fr',
          metadata: { kind: 'LOCATION', ...location, distanceKm },
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: nextMeta },
      }),
    ]);

    if (conv.orderId) {
      await this.prisma.delivery.updateMany({
        where: { subOrder: { orderId: conv.orderId } },
        data: {
          dropoffLat: dto.lat,
          dropoffLng: dto.lng,
          distanceKm,
          clientGoogleMapsUrl: googleMapsUrl,
        },
      });
    }

    return { location, distanceKm, message };
  }

  async sendDeliveryOffer(
    user: AuthenticatedUser,
    conversationId: string,
    dto: { action: 'PROPOSE' | 'ACCEPT' | 'COUNTER'; feeUsd: number },
  ) {
    await this.assertParticipant(user.id, conversationId);
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');

    const feeUsd = Math.max(0, Number(dto.feeUsd || 0));
    const status = dto.action === 'ACCEPT' ? 'AGREED' : 'PROPOSED';
    const deliveryNegotiation = { status, feeUsd };

    const nextMeta = {
      ...((conv.metadata as Record<string, any> | null) || {}),
      deliveryNegotiation,
    };

    const label =
      dto.action === 'ACCEPT'
        ? `Tarif de livraison accepté à $${feeUsd.toFixed(2)}.`
        : dto.action === 'COUNTER'
        ? `Contre-offre de livraison : $${feeUsd.toFixed(2)}.`
        : `Proposition de tarif livraison : $${feeUsd.toFixed(2)}.`;

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          content: label,
          sourceLanguage: 'fr',
          metadata: { kind: 'DELIVERY_OFFER', action: dto.action, feeUsd },
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: nextMeta },
      }),
    ]);

    let updatedOrder: { id: string; deliveryFee: number; total: number } | undefined;

    if (conv.orderId) {
      await this.prisma.delivery.updateMany({
        where: { subOrder: { orderId: conv.orderId } },
        data: {
          negotiatedFeeUsd: feeUsd,
          feeNegotiationStatus: dto.action === 'ACCEPT' ? 'AGREED' : 'PENDING_DRIVER',
          ...(dto.action === 'ACCEPT' ? { estimatedFee: feeUsd } : {}),
        },
      });

      if (dto.action === 'ACCEPT') {
        const order = await this.prisma.order.findUnique({ where: { id: conv.orderId } });
        if (order && order.status === 'PENDING_PAYMENT') {
          const nextTotal = Number((Number(order.subtotal) + feeUsd).toFixed(2));
          const saved = await this.prisma.order.update({
            where: { id: order.id },
            data: { shippingFee: feeUsd, total: nextTotal },
          });
          updatedOrder = {
            id: saved.id,
            deliveryFee: Number(saved.shippingFee),
            total: Number(saved.total),
          };
        }
      }
    }

    return {
      order: updatedOrder,
      deliveryNegotiation,
      message,
    };
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

