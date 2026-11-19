import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_LANGUAGE_LABELS,
  AiMessageTone,
  SupportedAiLanguage,
  buildLanguageInstruction,
  buildToneInstruction,
  extractProtectedTokens,
  isValidContextualMessage,
  isValidTranslationOutput,
  normalizeAiLanguage,
} from '../../common/commerce-rules';
import { FinanceService } from '../finance/finance.service';
import {
  AssistantChatDto,
  GenerateProductDescriptionDto,
  SmartSearchDto,
  SuggestReplyDto,
  TranslateChatMessageDto,
  UpdateAiSettingsDto,
} from './dto/assistant.dto';

export type ActiveAiEngine = 'ollama' | 'gemini' | 'none';

export type ContextualMessageScenario =
  | 'ORDER_PAID_DIGITAL'
  | 'ORDER_PAID_PHYSICAL'
  | 'ORDER_CASH_CONFIRMED'
  | 'DELIVERY_COMPLETED'
  | 'STORE_CREATED_OR_SERVICE'
  | 'VENDOR_PAYOUT_STATUS'
  | 'DISPUTE_UPDATE'
  | 'KYC_REVIEWED';

export interface ComposeContextualMessageParams {
  scenario: ContextualMessageScenario;
  channel: 'inapp' | 'sms';
  recipientRole: 'CLIENT' | 'VENDOR' | 'DELIVERY';
  recipientName?: string;
  facts: Record<string, string | number | boolean | undefined>;
  requiredTokens?: string[];
  fallbackText: string;
}

export interface AssistantEngineStatus {
  available: boolean;
  mode: 'auto' | 'local' | 'cloud';
  activeEngine: ActiveAiEngine;
  activeModel: string | null;
  ollamaReachable: boolean;
  ollamaModels: string[];
  cloudConfigured: boolean;
  cloudModel: string;
}

const CLOUD_MODEL = 'gemini-4-hydrogen';

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly aiClient: GoogleGenAI | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {
    const geminiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    this.aiClient = geminiKey
      ? new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        })
      : null;
  }

  private get aiMode(): 'auto' | 'local' | 'cloud' {
    const raw = (this.config.get<string>('AI_MODE') || 'auto').toLowerCase();
    if (raw === 'local' || raw === 'cloud') return raw;
    return 'auto';
  }

  private get ollamaBaseUrl(): string {
    return (this.config.get<string>('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  }

  private pickPreferredOllamaModel(models: string[], requestedModel?: string): string | null {
    if (!models.length) return null;
    if (requestedModel && models.includes(requestedModel)) {
      return requestedModel;
    }
    const envModel = this.config.get<string>('OLLAMA_MODEL')?.trim();
    if (envModel && models.includes(envModel)) {
      return envModel;
    }
    const preferredPatterns = ['qwen2.5', 'llama3', 'mistral', 'gemma', 'deepseek', 'phi'];
    for (const pattern of preferredPatterns) {
      const match = models.find((m) => m.toLowerCase().includes(pattern));
      if (match) return match;
    }
    return models[0];
  }

  private async probeOllamaModels(): Promise<{ reachable: boolean; models: string[] }> {
    if (this.aiMode === 'cloud') {
      return { reachable: false, models: [] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const res = await fetch(`${this.ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        return { reachable: false, models: [] };
      }
      const data = (await res.json()) as { models?: { name?: string; model?: string }[] };
      const allModels = (data.models || [])
        .map((m) => m.name || m.model || '')
        .filter((name) => Boolean(name) && !/embed|nomic|bge|minilm/i.test(name));
      return { reachable: true, models: allModels };
    } catch {
      return { reachable: false, models: [] };
    } finally {
      clearTimeout(timer);
    }
  }

  async getStatus(preferredModel?: string): Promise<AssistantEngineStatus> {
    const mode = this.aiMode;
    const cloudConfigured = Boolean(this.aiClient);
    const probe = await this.probeOllamaModels();
    const chosenLocal = this.pickPreferredOllamaModel(probe.models, preferredModel);

    if (mode !== 'cloud' && chosenLocal) {
      return {
        available: true,
        mode,
        activeEngine: 'ollama',
        activeModel: chosenLocal,
        ollamaReachable: true,
        ollamaModels: probe.models,
        cloudConfigured,
        cloudModel: CLOUD_MODEL,
      };
    }

    if (mode !== 'local' && cloudConfigured) {
      return {
        available: true,
        mode,
        activeEngine: 'gemini',
        activeModel: CLOUD_MODEL,
        ollamaReachable: probe.reachable,
        ollamaModels: probe.models,
        cloudConfigured: true,
        cloudModel: CLOUD_MODEL,
      };
    }

    return {
      available: false,
      mode,
      activeEngine: 'none',
      activeModel: null,
      ollamaReachable: probe.reachable,
      ollamaModels: probe.models,
      cloudConfigured,
      cloudModel: CLOUD_MODEL,
    };
  }

  private async runOllamaChat(
    model: string,
    systemInstruction: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemInstruction },
            ...messages,
          ],
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Ollama HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }
      const data = (await res.json()) as { message?: { content?: string }; response?: string };
      const text = (data.message?.content || data.response || '').trim();
      if (!text) {
        throw new Error('Réponse vide retournée par le modèle local Ollama.');
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  private async runGeminiText(
    systemInstruction: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    if (!this.aiClient) {
      throw new ServiceUnavailableException(
        "Aucun moteur IA en ligne n'est configuré (vérifiez la clé serveur ou démarrez Ollama en local).",
      );
    }

    const transcript =
      messages.length === 1
        ? messages[0].content
        : messages
            .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${m.content}`)
            .join('\n\n');

    try {
      const response = await this.aiClient.models.generateContent({
        model: CLOUD_MODEL,
        contents: transcript,
        config: {
          systemInstruction,
        },
      });
      const text = (response.text || '').trim();
      if (!text) {
        throw new BadGatewayException("Le modèle en ligne n'a retourné aucun texte.");
      }
      return text;
    } catch (err: any) {
      this.logger.warn(`Erreur Gemini API: ${err?.message || err}`);
      if (err?.status === 403 || err?.status === 400) {
        throw new ServiceUnavailableException(
          'La clé du service IA en ligne est invalide ou non autorisée. Vérifiez Settings > Secrets.',
        );
      }
      if (err?.status === 429) {
        throw new ServiceUnavailableException(
          'Quota du modèle IA en ligne momentanément atteint. Réessayez dans un instant.',
        );
      }
      throw new BadGatewayException("Erreur lors de la communication avec l'assistant IA en ligne.");
    }
  }

  private async executeHybridText(
    systemInstruction: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    preferredModel?: string,
  ): Promise<{ reply: string; engine: ActiveAiEngine; model: string }> {
    const status = await this.getStatus(preferredModel);

    if (!status.available || !status.activeModel) {
      throw new ServiceUnavailableException(
        "Aucun modèle IA détecté : démarrez Ollama en local (ex: 'ollama run qwen2.5:7b') ou configurez la clé cloud serveur.",
      );
    }

    if (status.activeEngine === 'ollama') {
      try {
        const reply = await this.runOllamaChat(status.activeModel, systemInstruction, messages);
        return { reply, engine: 'ollama', model: status.activeModel };
      } catch (err: any) {
        this.logger.warn(`Ollama local indisponible pendant la requête (${err?.message}).`);
        if (status.mode === 'auto' && status.cloudConfigured) {
          const reply = await this.runGeminiText(systemInstruction, messages);
          return { reply, engine: 'gemini', model: CLOUD_MODEL };
        }
        throw new BadGatewayException(
          `Erreur du modèle local Ollama (${status.activeModel}). Vérifiez qu'Ollama répond sur ${this.ollamaBaseUrl}.`,
        );
      }
    }

    const reply = await this.runGeminiText(systemInstruction, messages);
    return { reply, engine: 'gemini', model: CLOUD_MODEL };
  }

  private async buildMarketplaceContext(): Promise<string> {
    const [pricing, categories, products, activeStores, transportSettings] = await Promise.all([
      this.finance.getPlatformPricing(),
      this.prisma.category.findMany({ take: 25, orderBy: { name: 'asc' } }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        take: 14,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        select: {
          title: true,
          basePriceUsd: true,
          store: { select: { storeName: true, isCertified: true } },
          category: { select: { name: true } },
        },
      }),
      this.prisma.vendorStore.findMany({
        where: { status: 'ACTIVE' },
        take: 25,
        select: { id: true, storeName: true },
      }),
      this.prisma.platformSetting.findMany({
        where: { key: { startsWith: 'store_transport:' } },
        take: 10,
      }),
    ]);

    const storeNameById = new Map(activeStores.map((s) => [s.id, s.storeName]));
    const catList = categories.map((c) => c.name).join(', ');
    const prodList = products
      .map(
        (p) =>
          `- ${p.title} ($${Number(p.basePriceUsd).toFixed(2)}, boutique ${p.store.storeName}${p.store.isCertified ? ' [Certifiée]' : ''}, catégorie ${p.category?.name || 'Générale'})`,
      )
      .join('\n');

    const routesList = transportSettings
      .map((setting) => {
        const val = (setting.value as any) ?? {};
        if (!val.isTransportAgency) return '';
        const storeId = setting.key.replace('store_transport:', '');
        const storeName = storeNameById.get(storeId) || 'Agence Transport RDC';
        const routes = Array.isArray(val.transportDestinations) ? (val.transportDestinations as any[]) : [];
        const formatted = routes
          .slice(0, 4)
          .map((r) => `${r.originCity} -> ${r.destinationCity} (${r.vehicleMode || 'Fret'}, $${r.basePriceUsd ?? 0})`)
          .join(' | ');
        return `- ${storeName}: ${formatted || 'Trajets nationaux sur devis'}`;
      })
      .filter(Boolean)
      .join('\n');

    return [
      `Plateforme : ZandoGo (siège à Goma, Nord-Kivu — opérationnelle dans toute la RDC et environs).`,
      `Paiements acceptés : Vodacom M-Pesa, Airtel Money, Orange Money, MTN MoMo, Carte Visa/Mastercard et paiement à la livraison.`,
      `Frais de transaction paiement : ${pricing.paymentTransactionFeePercent}% affichés exactement avant paiement ; frais de retrait vendeur côté plateforme : 0%.`,
      `Règles financières : compte à rebours séquestre 48h démarrant dès le paiement (ou retrait immédiat si autorisé par le Super Admin). Les livres PDF envoient le lien de téléchargement immédiatement après paiement. Les services de transport sont facturés au km ou par trajet.`,
      `Tarifs vendeurs actuels : boutique ${pricing.storeCreationFeeUsd}$, module physique ${pricing.servicePhysicalFeeUsd}$, module livre PDF ${pricing.serviceDigitalFeeUsd}$, module service/transport ${pricing.servicePrestationFeeUsd}$, certification ${pricing.certificationMonthlyFeeUsd}$/mois, pub carrousel ${pricing.adProCarouselMonthlyFeeUsd}$/mois.`,
      `Catégories actives : ${catList || 'Électronique, Mode, Livres PDF, Transport & Fret'}.`,
      prodList ? `Exemples d'offres en catalogue :\n${prodList}` : '',
      routesList ? `Agences de transport enregistrées :\n${routesList}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async chat(dto: AssistantChatDto, userId?: string) {
    const context = await this.buildMarketplaceContext();
    const roleContext = dto.roleContext || 'CLIENT';
    const roleHint =
      roleContext === 'ADMIN'
        ? "L'utilisateur est un Administrateur / Super Admin ZandoGo : réponds de manière synthétique, opérationnelle et orientée contrôle (tarifs, litiges, séquestre, retraits)."
        : roleContext === 'VENDOR'
        ? "L'utilisateur est un Vendeur / Agence de Transport ZandoGo : aide-le à vendre plus (fiches produits, variantes, paliers de prix, livraison, retraits 48h/immédiats)."
        : "L'utilisateur est un Client / Visiteur : aide-le à trouver des produits, livres PDF ou agences de transport en RDC, et explique clairement le paiement Mobile Money / Carte et la protection acheteur.";

    const languageDirective = buildLanguageInstruction(dto.language);
    const systemInstruction = [
      'Tu es l’Assistant officiel de ZandoGo (place de marché de Goma, Nord-Kivu, et de toute la RDC).',
      `${languageDirective} (maximum 180 mots sauf demande de détail).`,
      'RÈGLE STRICTE : Ne mentionne JAMAIS de noms techniques internes d’agrégateur tiers ; cite uniquement Airtel Money, Vodacom M-Pesa, Orange Money, MTN MoMo et Visa/Mastercard.',
      'Ne valide jamais un paiement ni un déblocage de fonds : indique seulement la procédure réelle dans l’application.',
      roleHint,
      `Contexte temps réel de la plateforme :\n${context}`,
    ].join('\n\n');

    let history = (dto.history || []).slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let sessionId: string | null = null;
    if (userId) {
      try {
        let session = await this.prisma.assistantSession.findFirst({
          where: { userId, roleContext },
          orderBy: { updatedAt: 'desc' },
        });
        if (!session) {
          session = await this.prisma.assistantSession.create({
            data: {
              userId,
              roleContext,
              title: dto.message.trim().slice(0, 80),
            },
          });
        }
        sessionId = session.id;
        if (history.length === 0) {
          const savedMsgs = await this.prisma.assistantMessage.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: 'desc' },
            take: 8,
          });
          history = savedMsgs
            .reverse()
            .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
        }
      } catch (err: any) {
        this.logger.warn(`Chargement session assistant ignoré: ${err?.message || err}`);
      }
    }

    const result = await this.executeHybridText(
      systemInstruction,
      [...history, { role: 'user', content: dto.message }],
      dto.preferredModel,
    );

    if (userId && sessionId) {
      try {
        await this.prisma.$transaction([
          this.prisma.assistantMessage.createMany({
            data: [
              {
                sessionId,
                role: 'user',
                content: dto.message.trim(),
              },
              {
                sessionId,
                role: 'assistant',
                content: result.reply,
                engine: result.engine,
                model: result.model,
              },
            ],
          }),
          this.prisma.assistantSession.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
          }),
        ]);
      } catch (err: any) {
        this.logger.warn(`Sauvegarde message assistant ignorée: ${err?.message || err}`);
      }
    }

    return {
      reply: result.reply,
      engine: result.engine,
      model: result.model,
      persisted: Boolean(userId && sessionId),
    };
  }

  async getHistory(userId: string, roleContext = 'CLIENT') {
    const normalizedRole = ['CLIENT', 'VENDOR', 'ADMIN'].includes(roleContext) ? roleContext : 'CLIENT';
    const session = await this.prisma.assistantSession.findFirst({
      where: { userId, roleContext: normalizedRole },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 60,
        },
      },
    });

    if (!session) {
      return { sessionId: null, roleContext: normalizedRole, messages: [] };
    }

    return {
      sessionId: session.id,
      roleContext: normalizedRole,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
        engine: m.engine || undefined,
        model: m.model || undefined,
        createdAt: m.createdAt,
      })),
    };
  }

  async clearHistory(userId: string, roleContext = 'CLIENT') {
    const normalizedRole = ['CLIENT', 'VENDOR', 'ADMIN'].includes(roleContext) ? roleContext : 'CLIENT';
    await this.prisma.assistantSession.deleteMany({
      where: { userId, roleContext: normalizedRole },
    });
    return { cleared: true, roleContext: normalizedRole };
  }

  async generateProductDescription(dto: GenerateProductDescriptionDto) {
    const typeLabel =
      dto.productType === 'DIGITAL'
        ? 'Livre ou Document Numérique PDF (téléchargement instantané après paiement)'
        : dto.productType === 'SERVICE'
        ? 'Prestation de service ou Transport / Fret national en RDC (tarification au km ou trajet)'
        : 'Produit physique livré en RDC et environs';

    const systemInstruction = [
      'Tu es un expert e-commerce spécialisé sur le marché congolais (RDC : Goma, Kinshasa, Lubumbashi, Bukavu, Kisangani).',
      'Rédige une description commerciale claire, rassurante et structurée en français (80 à 140 mots, avec 3 à 4 points forts à puces).',
      'Ne mets pas de balises HTML, pas de promesses mensongères, et retourne uniquement le texte prêt à coller dans la fiche produit.',
    ].join(' ');

    const prompt = [
      `Rédige la description commerciale pour cette offre ZandoGo :`,
      `- Titre : ${dto.title}`,
      `- Type : ${typeLabel}`,
      dto.categoryName ? `- Catégorie : ${dto.categoryName}` : '',
      dto.audience ? `- Public cible : ${dto.audience}` : '',
      dto.pricingUnit ? `- Unité de vente : ${dto.pricingUnit}` : '',
      dto.basePriceUsd ? `- Prix indicatif : $${dto.basePriceUsd} USD` : '',
      dto.city ? `- Ville d'origine : ${dto.city}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await this.executeHybridText(
      systemInstruction,
      [{ role: 'user', content: prompt }],
      dto.preferredModel,
    );

    return {
      description: result.reply,
      engine: result.engine,
      model: result.model,
    };
  }

  async analyzeDispute(disputeId: string, preferredModel?: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        raisedBy: { select: { fullName: true, email: true } },
        order: {
          include: {
            subOrders: {
              include: {
                store: { select: { storeName: true, payoutBlocked: true } },
              },
            },
          },
        },
        messages: { orderBy: { sentAt: 'asc' }, take: 15 },
      },
    });
    if (!dispute) {
      throw new NotFoundException('Litige introuvable');
    }

    const storeNames = dispute.order.subOrders.map((s) => s.store.storeName).join(', ');
    const messagesText = dispute.messages.map((m) => `- ${m.content}`).join('\n') || 'Aucun message complémentaire.';

    const status = await this.getStatus(preferredModel);
    if (!status.available || !status.activeModel) {
      throw new ServiceUnavailableException(
        "Aucun modèle IA détecté (Ollama local ou clé cloud) pour analyser ce litige.",
      );
    }

    const dossierPrompt = [
      `Analyse ce litige ZandoGo pour aider le Super Admin à rendre sa décision finale (l'humain tranche toujours) :`,
      `- Commande : ${dispute.order.orderNumber}`,
      `- Montant sous séquestre : ${dispute.order.total} ${dispute.order.currency}`,
      `- Acheteur : ${dispute.raisedBy.fullName}`,
      `- Boutique(s) : ${storeNames || 'Boutique vendeur'}`,
      `- Catégorie : ${dispute.reasonCategory} | Sévérité : ${dispute.severity} | Retraits gelés : ${dispute.payoutFrozen ? 'OUI' : 'NON'}`,
      `- Description : ${dispute.description}`,
      `- Échanges :\n${messagesText}`,
    ].join('\n');

    if (status.activeEngine === 'gemini' && this.aiClient) {
      try {
        const res = await this.aiClient.models.generateContent({
          model: CLOUD_MODEL,
          contents: dossierPrompt,
          config: {
            systemInstruction:
              "Tu es conseiller d'arbitrage neutre pour ZandoGo. Fournis un résumé objectif, une recommandation parmi RESOLVED_REFUND, RESOLVED_RELEASE ou RESOLVED_PARTIAL, et un projet de note officielle en français.",
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                recommendedDecision: {
                  type: Type.STRING,
                  enum: ['RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_PARTIAL'],
                },
                recommendedFreezePayout: { type: Type.BOOLEAN },
                draftResolutionNote: { type: Type.STRING },
              },
              required: [
                'summary',
                'recommendedDecision',
                'recommendedFreezePayout',
                'draftResolutionNote',
              ],
            },
          },
        });
        const parsed = JSON.parse((res.text || '{}').trim());
        return {
          ...parsed,
          engine: 'gemini' as ActiveAiEngine,
          model: CLOUD_MODEL,
        };
      } catch (err: any) {
        this.logger.warn(`Analyse litige Gemini échouée: ${err?.message}`);
        throw new BadGatewayException("Impossible d'analyser ce litige avec le modèle en ligne.");
      }
    }

    const systemInstruction =
      "Tu es conseiller d'arbitrage neutre. Réponds STRICTEMENT en JSON valide avec les clés: summary (string), recommendedDecision ('RESOLVED_REFUND' | 'RESOLVED_RELEASE' | 'RESOLVED_PARTIAL'), recommendedFreezePayout (boolean), draftResolutionNote (string en français).";
    const localOut = await this.executeHybridText(
      systemInstruction,
      [{ role: 'user', content: dossierPrompt }],
      preferredModel,
    );

    const jsonMatch = localOut.reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: String(parsed.summary || localOut.reply),
          recommendedDecision: ['RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_PARTIAL'].includes(
            parsed.recommendedDecision,
          )
            ? parsed.recommendedDecision
            : 'RESOLVED_PARTIAL',
          recommendedFreezePayout: Boolean(parsed.recommendedFreezePayout),
          draftResolutionNote: String(parsed.draftResolutionNote || parsed.summary || localOut.reply),
          engine: localOut.engine,
          model: localOut.model,
        };
      } catch {
        // fallback cleanly to structured wrapping of real model output
      }
    }

    return {
      summary: localOut.reply,
      recommendedDecision: dispute.severity === 'HIGH' ? 'RESOLVED_REFUND' : 'RESOLVED_PARTIAL',
      recommendedFreezePayout: dispute.severity === 'HIGH',
      draftResolutionNote: localOut.reply.slice(0, 280),
      engine: localOut.engine,
      model: localOut.model,
    };
  }

  async smartSearch(dto: SmartSearchDto) {
    const [categories, products] = await Promise.all([
      this.prisma.category.findMany({
        take: 30,
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.product.findMany({
        where: { status: 'ACTIVE' },
        take: 25,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        select: { title: true, basePriceUsd: true, categoryId: true },
      }),
    ]);

    const status = await this.getStatus(dto.preferredModel);
    if (!status.available || !status.activeModel) {
      throw new ServiceUnavailableException(
        "Aucun modèle IA détecté : démarrez Ollama en local ou configurez la clé cloud serveur.",
      );
    }

    const validCategoryIds = new Set(categories.map((c) => c.id));
    const catCatalog = categories.map((c) => `${c.id} => ${c.name}`).join('\n');
    const prodCatalog = products
      .map((p) => `- ${p.title} ($${Number(p.basePriceUsd).toFixed(2)})`)
      .join('\n');

    const prompt = [
      `Requête visiteur en langage naturel : "${dto.query}"`,
      `Catégories disponibles (ID => Nom) :\n${catCatalog || 'Aucune'}`,
      `Exemples d'offres :\n${prodCatalog || 'Catalogue général'}`,
      `Extrais les filtres adaptés pour ZandoGo.`,
      `Règles : searchQuery doit contenir uniquement 0 à 3 mots-clés essentiels pour le filtre texte (ou "" si le filtre par type/catégorie/prix suffit) ; maxPriceUsd est un nombre positif si un budget maximum est mentionné, sinon null ; transportOnly = true uniquement si la recherche porte sur un transporteur, déménagement, colis ou trajet.`,
    ].join('\n\n');

    const sanitize = (raw: any, engine: ActiveAiEngine, model: string) => {
      const productType = ['ALL', 'PHYSICAL', 'DIGITAL', 'SERVICE'].includes(raw?.productType)
        ? raw.productType
        : 'ALL';
      const audience = ['ALL', 'WOMEN', 'MEN', 'PRO'].includes(raw?.audience) ? raw.audience : 'ALL';
      const rawCat = typeof raw?.categoryId === 'string' ? raw.categoryId : 'ALL';
      const categoryId = rawCat !== 'ALL' && validCategoryIds.has(rawCat) ? rawCat : 'ALL';
      const maxPriceNum =
        raw?.maxPriceUsd !== null && raw?.maxPriceUsd !== undefined && Number(raw.maxPriceUsd) > 0
          ? Number(raw.maxPriceUsd)
          : null;
      return {
        searchQuery: typeof raw?.searchQuery === 'string' ? raw.searchQuery.trim().slice(0, 80) : '',
        productType,
        audience,
        maxPriceUsd: maxPriceNum,
        transportOnly: Boolean(raw?.transportOnly),
        categoryId,
        explanation:
          typeof raw?.explanation === 'string' && raw.explanation.trim()
            ? raw.explanation.trim()
            : 'Filtres intelligents appliqués à votre recherche.',
        engine,
        model,
      };
    };

    if (status.activeEngine === 'gemini' && this.aiClient) {
      try {
        const res = await this.aiClient.models.generateContent({
          model: CLOUD_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Tu es le moteur de recherche sémantique ZandoGo. Convertis la requête en filtres catalogue JSON précis et rédige une courte explication en français.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                searchQuery: { type: Type.STRING },
                productType: { type: Type.STRING, enum: ['ALL', 'PHYSICAL', 'DIGITAL', 'SERVICE'] },
                audience: { type: Type.STRING, enum: ['ALL', 'WOMEN', 'MEN', 'PRO'] },
                maxPriceUsd: { type: Type.NUMBER, nullable: true },
                transportOnly: { type: Type.BOOLEAN },
                categoryId: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: [
                'searchQuery',
                'productType',
                'audience',
                'transportOnly',
                'categoryId',
                'explanation',
              ],
            },
          },
        });
        const parsed = JSON.parse((res.text || '{}').trim());
        return sanitize(parsed, 'gemini', CLOUD_MODEL);
      } catch (err: any) {
        this.logger.warn(`Smart search Gemini échouée: ${err?.message}`);
        throw new BadGatewayException("Impossible d'interpréter cette recherche avec le modèle en ligne.");
      }
    }

    const localSys =
      "Tu es le moteur de recherche ZandoGo. Réponds STRICTEMENT en JSON valide sans texte autour avec les clés: searchQuery (string, 0-3 mots), productType ('ALL'|'PHYSICAL'|'DIGITAL'|'SERVICE'), audience ('ALL'|'WOMEN'|'MEN'|'PRO'), maxPriceUsd (number ou null), transportOnly (boolean), categoryId (un ID exact de la liste ou 'ALL'), explanation (courte phrase en français).";
    const localOut = await this.executeHybridText(
      localSys,
      [{ role: 'user', content: prompt }],
      dto.preferredModel,
    );

    const match = localOut.reply.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return sanitize(parsed, localOut.engine, localOut.model);
      } catch {
        // fallback cleanly below
      }
    }

    return sanitize(
      {
        searchQuery: dto.query.trim().split(/\s+/).slice(0, 3).join(' '),
        productType: /pdf|livre|manuel|guide/i.test(dto.query)
          ? 'DIGITAL'
          : /transport|fret|colis|service/i.test(dto.query)
          ? 'SERVICE'
          : 'ALL',
        audience: 'ALL',
        maxPriceUsd: null,
        transportOnly: /transport|agence|fret|livreur/i.test(dto.query),
        categoryId: 'ALL',
        explanation: 'Recherche textuelle appliquée au catalogue ZandoGo.',
      },
      localOut.engine,
      localOut.model,
    );
  }

  async suggestReply(dto: SuggestReplyDto) {
    const historyLines = (dto.messages || [])
      .slice(-6)
      .map((m) => `- ${m.sender} : ${m.content}`)
      .join('\n');

    const isDelivery = dto.conversationType === 'CUSTOMER_DELIVERY';
    const languageDirective = buildLanguageInstruction(dto.language);
    const systemInstruction = [
      'Tu es un assistant de messagerie commerciale pour ZandoGo (Goma & RDC).',
      `${languageDirective} Rédige une suggestion de réponse courte, polie, naturelle et prête à envoyer (1 à 3 phrases max).`,
      'Ne mets pas de guillemets autour de la réponse, pas de crochets [Nom], et reste pragmatique sur les prix, délais ou points de repère Google Maps.',
    ].join(' ');

    const prompt = [
      `Contexte de la discussion : ${isDelivery ? 'Négociation course / livraison avec coursier' : 'Discussion devis / négociation prix avec vendeur'}`,
      dto.conversationTitle ? `- Interlocuteur : ${dto.conversationTitle}` : '',
      dto.productTitle ? `- Produit / Service : ${dto.productTitle}` : '',
      dto.productPriceUsd ? `- Prix affiché : $${dto.productPriceUsd} USD` : '',
      dto.distanceKm ? `- Distance GPS calculée : ${dto.distanceKm} km` : '',
      isDelivery ? `- Localisation Google Maps partagée : ${dto.hasClientLocation ? 'Oui' : 'Pas encore'}` : '',
      dto.deliveryProposedFeeUsd ? `- Tarif course en discussion : $${dto.deliveryProposedFeeUsd} USD` : '',
      `Derniers messages :\n${historyLines || 'Aucun message précédent.'}`,
      `Propose un message court à envoyer par l'utilisateur.`,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await this.executeHybridText(
      systemInstruction,
      [{ role: 'user', content: prompt }],
      dto.preferredModel,
    );

    const cleaned = result.reply.replace(/^["«\s]+|["»\s]+$/g, '').trim();
    return {
      suggestion: cleaned || result.reply,
      engine: result.engine,
      model: result.model,
    };
  }

  async translateChatMessage(dto: TranslateChatMessageDto): Promise<{
    originalText: string;
    translatedText: string;
    detectedLanguage: SupportedAiLanguage;
    targetLanguage: SupportedAiLanguage;
    engine: ActiveAiEngine;
    model: string | null;
  }> {
    const rawText = dto.text.trim();
    const targetLanguage = normalizeAiLanguage(dto.targetLanguage);
    const explicitSource =
      dto.sourceLanguage && dto.sourceLanguage !== 'auto'
        ? normalizeAiLanguage(dto.sourceLanguage)
        : null;

    if (explicitSource && explicitSource === targetLanguage) {
      return {
        originalText: rawText,
        translatedText: rawText,
        detectedLanguage: explicitSource,
        targetLanguage,
        engine: 'none',
        model: null,
      };
    }

    const status = await this.getStatus(dto.preferredModel);
    if (!status.available || !status.activeModel) {
      throw new ServiceUnavailableException(
        "Aucun moteur IA détecté pour la traduction automatique : démarrez Ollama en local ou configurez la clé cloud serveur.",
      );
    }

    const targetLabel = AI_LANGUAGE_LABELS[targetLanguage];
    const protectedTokens = extractProtectedTokens(rawText);
    const sourceHint = explicitSource
      ? `Langue source déclarée : ${AI_LANGUAGE_LABELS[explicitSource]} (${explicitSource}).`
      : `Détecte automatiquement la langue source parmi : fr (Français), ln (Lingala de RDC), sw (Kiswahili de RDC), en (English).`;

    const prompt = [
      `Traduis fidèlement ce message de discussion commerciale ZandoGo (RDC) vers ${targetLabel} (${targetLanguage}).`,
      sourceHint,
      protectedTokens.length > 0
        ? `RÈGLE STRICTE : Conserve EXACTEMENT sans aucune modification ces montants/références/liens : ${protectedTokens.join(' | ')}`
        : '',
      `Si le message est déjà rédigé en ${targetLabel}, conserve le sens et corrige juste minimalement ou renvoie-le tel quel avec detectedLanguage="${targetLanguage}".`,
      `Message à traduire :\n"""${rawText}"""`,
    ]
      .filter(Boolean)
      .join('\n\n');

    if (status.activeEngine === 'gemini' && this.aiClient) {
      try {
        const res = await this.aiClient.models.generateContent({
          model: CLOUD_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              `Tu es un traducteur commercial expert pour la RDC (Français ↔ Lingala ya Kinshasa/RDC ↔ Kiswahili ya Kongo ↔ English). Sois naturel, poli et fidèle aux prix, quantités et repères.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedLanguage: { type: Type.STRING, enum: ['fr', 'ln', 'sw', 'en'] },
                translatedText: { type: Type.STRING },
              },
              required: ['detectedLanguage', 'translatedText'],
            },
          },
        });
        const parsed = JSON.parse((res.text || '{}').trim());
        const detectedLanguage = normalizeAiLanguage(parsed.detectedLanguage || explicitSource);
        const translatedText = String(parsed.translatedText || '').trim();
        if (!translatedText || !isValidTranslationOutput(translatedText, rawText)) {
          throw new BadGatewayException('La traduction générée n’a pas préservé les données du message.');
        }
        return {
          originalText: rawText,
          translatedText,
          detectedLanguage,
          targetLanguage,
          engine: 'gemini',
          model: CLOUD_MODEL,
        };
      } catch (err: any) {
        if (err instanceof BadGatewayException) throw err;
        this.logger.warn(`Traduction Gemini échouée: ${err?.message || err}`);
        throw new BadGatewayException("Erreur lors de la traduction avec le modèle IA en ligne.");
      }
    }

    const localSys =
      "Tu es un traducteur commercial RDC (Français, Lingala, Kiswahili, English). Réponds STRICTEMENT en JSON valide sans texte autour avec les clés exactes: detectedLanguage ('fr'|'ln'|'sw'|'en') et translatedText (string). Conserve strictement tous les prix, montants, devises, références et URLs.";
    const localOut = await this.executeHybridText(
      localSys,
      [{ role: 'user', content: prompt }],
      dto.preferredModel,
    );

    const jsonMatch = localOut.reply.match(/\{[\s\S]*\}/);
    let detectedLanguage: SupportedAiLanguage = explicitSource || 'fr';
    let translatedText = localOut.reply.replace(/^["«\s]+|["»\s]+$/g, '').trim();

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.detectedLanguage) {
          detectedLanguage = normalizeAiLanguage(parsed.detectedLanguage);
        }
        if (typeof parsed.translatedText === 'string' && parsed.translatedText.trim()) {
          translatedText = parsed.translatedText.trim();
        }
      } catch {
        // use plain text reply cleanly
      }
    }

    if (!isValidTranslationOutput(translatedText, rawText)) {
      throw new BadGatewayException(
        'Le modèle local n’a pas retourné une traduction valide préservant les montants et liens.',
      );
    }

    return {
      originalText: rawText,
      translatedText,
      detectedLanguage,
      targetLanguage,
      engine: localOut.engine,
      model: localOut.model,
    };
  }

  async getAiSettings(): Promise<{
    autoMessagesEnabled: boolean;
    autoMessagesTone: AiMessageTone;
    updatedAt: string;
  }> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: 'ai_settings' },
    });
    const raw = (setting?.value as { autoMessagesEnabled?: boolean; autoMessagesTone?: AiMessageTone } | null) ?? {};
    const tone: AiMessageTone =
      raw.autoMessagesTone === 'FORMAL' || raw.autoMessagesTone === 'CONCISE' ? raw.autoMessagesTone : 'WARM';
    return {
      autoMessagesEnabled: raw.autoMessagesEnabled !== false,
      autoMessagesTone: tone,
      updatedAt: setting?.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async updateAiSettings(adminId: string, dto: UpdateAiSettingsDto) {
    const current = await this.getAiSettings();
    const nextValue = {
      autoMessagesEnabled:
        dto.autoMessagesEnabled !== undefined ? Boolean(dto.autoMessagesEnabled) : current.autoMessagesEnabled,
      autoMessagesTone: dto.autoMessagesTone ?? current.autoMessagesTone,
    };
    const saved = await this.prisma.platformSetting.upsert({
      where: { key: 'ai_settings' },
      update: { value: nextValue as any, updatedBy: adminId },
      create: { key: 'ai_settings', value: nextValue as any, updatedBy: adminId },
    });
    return {
      ...nextValue,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  /**
   * Rédige un message automatique personnalisé (notification in-app ou SMS court)
   * avec le ton configuré par le Super Admin, limité aux scénarios ciblés, tout en
   * verrouillant les données critiques (montants, références, liens) et avec
   * repli déterministe instantané si l'IA est en pause, lente ou indisponible.
   */
  async composeContextualMessage(params: ComposeContextualMessageParams): Promise<{
    text: string;
    personalized: boolean;
    engine: ActiveAiEngine;
    model: string | null;
  }> {
    const startedAt = Date.now();
    const maxChars = params.channel === 'sms' ? 155 : 260;
    const requiredTokens = (params.requiredTokens || [])
      .map((t) => String(t || '').trim())
      .filter(Boolean);

    const recordLog = (out: {
      text: string;
      personalized: boolean;
      engine: ActiveAiEngine;
      model: string | null;
    }) => {
      const latencyMs = Math.max(1, Date.now() - startedAt);
      void this.prisma.aiMessageLog
        .create({
          data: {
            scenario: params.scenario,
            channel: params.channel,
            recipientRole: params.recipientRole,
            recipientName: params.recipientName || null,
            personalized: out.personalized,
            engine: out.engine,
            model: out.model,
            finalText: out.text,
            latencyMs,
          },
        })
        .catch(() => {});
      return out;
    };

    try {
      const aiSettings = await this.getAiSettings().catch(() => ({
        autoMessagesEnabled: true,
        autoMessagesTone: 'WARM' as AiMessageTone,
      }));
      if (!aiSettings.autoMessagesEnabled) {
        return recordLog({ text: params.fallbackText, personalized: false, engine: 'none', model: null });
      }

      const status = await this.getStatus();
      if (!status.available || !status.activeModel) {
        return recordLog({ text: params.fallbackText, personalized: false, engine: 'none', model: null });
      }

      const roleLabel =
        params.recipientRole === 'VENDOR'
          ? 'Vendeur / Agence partenaire'
          : params.recipientRole === 'DELIVERY'
          ? 'Coursier / Livreur'
          : 'Client';

      const factLines = Object.entries(params.facts)
        .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
        .map(([k, v]) => `- ${k} : ${v}`)
        .join('\n');

      const systemInstruction = [
        'Tu rédiges des messages automatiques pour ZandoGo (Goma & RDC).',
        buildToneInstruction(aiSettings.autoMessagesTone),
        params.channel === 'sms'
          ? `Format SMS STRICT : MAXIMUM ${maxChars} caractères, une seule phrase directe, sans emojis ni sauts de ligne.`
          : `Format notification : MAXIMUM ${maxChars} caractères, 1 à 2 phrases claires et bienveillantes.`,
        'RÈGLE STRICTE : Recopie EXACTEMENT mot pour mot chaque valeur obligatoire listée ci-dessous sans modifier les montants, références, numéros de commande ou liens. N’invente jamais d’autres chiffres.',
        'RÈGLE STRICTE : Ne mentionne jamais aucun nom technique d’agrégateur tiers.',
      ].join(' ');

      const prompt = [
        `Scénario : ${params.scenario}`,
        `Destinataire : ${roleLabel}${params.recipientName ? ` (${params.recipientName})` : ''}`,
        `Faits vérifiés :\n${factLines}`,
        requiredTokens.length > 0
          ? `Valeurs OBLIGATOIRES à conserver à l'identique dans le texte : ${requiredTokens.join(' | ')}`
          : '',
        `Exemple de référence : ${params.fallbackText}`,
        `Retourne uniquement le message final prêt à envoyer, sans guillemets.`,
      ]
        .filter(Boolean)
        .join('\n');

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2600));
      const aiPromise = this.executeHybridText(systemInstruction, [{ role: 'user', content: prompt }]).catch(
        () => null,
      );

      const res = await Promise.race([aiPromise, timeoutPromise]);
      if (!res) {
        return recordLog({ text: params.fallbackText, personalized: false, engine: 'none', model: null });
      }

      const cleaned = res.reply
        .replace(/^["«\s]+|["»\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (isValidContextualMessage(cleaned, params.channel, requiredTokens)) {
        return recordLog({ text: cleaned, personalized: true, engine: res.engine, model: res.model });
      }
    } catch {
      // Fall back cleanly to deterministic warm template
    }

    return recordLog({ text: params.fallbackText, personalized: false, engine: 'none', model: null });
  }

  async getMessageLogs(filters?: { scenario?: string; channel?: string; limit?: number }) {
    const where: { scenario?: string; channel?: string } = {};
    if (filters?.scenario && filters.scenario !== 'ALL') {
      where.scenario = filters.scenario;
    }
    if (filters?.channel && filters.channel !== 'ALL') {
      where.channel = filters.channel;
    }

    const take = Math.min(Math.max(filters?.limit || 80, 10), 200);
    const [items, total, personalizedCount, avgAgg] = await Promise.all([
      this.prisma.aiMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.aiMessageLog.count({ where }),
      this.prisma.aiMessageLog.count({ where: { ...where, personalized: true } }),
      this.prisma.aiMessageLog.aggregate({
        where,
        _avg: { latencyMs: true },
      }),
    ]);

    return {
      items,
      stats: {
        total,
        personalizedCount,
        fallbackCount: Math.max(0, total - personalizedCount),
        personalizationRate: total > 0 ? Math.round((personalizedCount / total) * 100) : 0,
        avgLatencyMs: Math.round(avgAgg._avg.latencyMs || 0),
      },
    };
  }
}
