import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdCampaignStatus, RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CinetPayService } from '../payments/cinetpay.service';
import { StripeService } from '../payments/stripe.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { PayCampaignDto } from './dto/pay-campaign.dto';

// Barème simple, à externaliser en configuration commerciale plus tard
const CPC_RATE_USD = 0.05;
const CPM_RATE_USD = 2; // pour 1000 impressions

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly cinetpay: CinetPayService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Le module est actif dans l'architecture dès le départ (schéma, calculs,
   * API) mais désactivable via cette variable d'environnement — pour
   * n'activer la monétisation publicitaire que lorsque vous serez prêt
   * commercialement, sans refonte technique.
   */
  private assertAdsEnabled() {
    const enabled = this.config.get<string>('ADS_ENABLED') === 'true';
    if (!enabled) {
      throw new BadRequestException("La régie publicitaire n'est pas encore activée sur la plateforme");
    }
  }

  async createCampaign(user: AuthenticatedUser, dto: CreateCampaignDto) {
    this.assertAdsEnabled();

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: { store: true },
      });
      if (!product) throw new NotFoundException('Produit introuvable');
      if (product.store.ownerId !== user.id) {
        throw new ForbiddenException("Vous ne pouvez promouvoir que vos propres produits");
      }
    }

    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('La date de fin doit être postérieure à la date de début');
    }

    const campaign = await this.prisma.adCampaign.create({
      data: {
        advertiserId: user.id,
        productId: dto.productId,
        type: dto.type,
        costModel: dto.costModel,
        budgetAmount: dto.budgetAmount,
        currency: dto.currency,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: AdCampaignStatus.DRAFT,
      },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'ad_campaign.create',
      entityType: 'AdCampaign',
      entityId: campaign.id,
      afterState: { type: dto.type, budgetAmount: dto.budgetAmount },
    });

    return campaign;
  }

  async getMyCampaigns(user: AuthenticatedUser) {
    return this.prisma.adCampaign.findMany({
      where: { advertiserId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Paiement de la campagne. La publicité ne se paie jamais en cash à la
   * livraison — ça n'aurait pas de sens pour un service immatériel. Une
   * fois le paiement confirmé (webhook), la campagne passe ACTIVE et, si
   * elle cible un produit, active le boost sur le catalogue (isFeatured /
   * boostedUntil, déjà utilisés par le tri du module catalog).
   */
  async payCampaign(user: AuthenticatedUser, campaignId: string, dto: PayCampaignDto) {
    this.assertAdsEnabled();

    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campagne introuvable');
    if (campaign.advertiserId !== user.id) {
      throw new ForbiddenException("Cette campagne ne vous appartient pas");
    }
    if (campaign.status !== AdCampaignStatus.DRAFT) {
      throw new BadRequestException('Cette campagne a déjà été payée ou traitée');
    }

    await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status: AdCampaignStatus.PENDING_PAYMENT },
    });

    const appUrl = this.config.get<string>('APP_URL');

    if (dto.methodCode === 'CARD_STRIPE') {
      const intent = await this.stripe.createPaymentIntent({
        amount: Number(campaign.budgetAmount),
        currency: 'usd',
        orderId: `ad-campaign:${campaignId}`, // réutilise le champ metadata, pas une vraie commande
      });
      return { method: 'card_stripe', clientSecret: intent.client_secret, campaignId };
    }

    // Mobile Money
    if (!dto.phoneNumber) {
      throw new BadRequestException('Le numéro de téléphone Mobile Money est requis');
    }
    const result = await this.cinetpay.initiatePayment({
      transactionId: `ad-${campaignId}`,
      amount: Number(campaign.budgetAmount),
      currency: campaign.currency as 'USD' | 'CDF',
      description: `Campagne publicitaire ${campaign.type}`,
      customerPhone: dto.phoneNumber,
      returnUrl: `${appUrl}/ads/${campaignId}`,
      notifyUrl: `${appUrl}/api/ads/webhooks/cinetpay`,
    });

    return { method: dto.methodCode, paymentUrl: result.data?.payment_url, campaignId };
  }

  /**
   * Confirmation de paiement (webhook CinetPay/Stripe dédié, ou appel direct
   * pour ce squelette — à brancher sur les webhooks réels comme pour le
   * module payments, avec la même contre-vérification systématique).
   */
  async activateCampaign(campaignId: string, providerReference: string) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campagne introuvable');

    await this.prisma.$transaction(async (tx) => {
      await tx.adCampaign.update({
        where: { id: campaignId },
        data: { status: AdCampaignStatus.ACTIVE },
      });

      await tx.adInvoice.create({
        data: {
          campaignId,
          amount: campaign.budgetAmount,
          currency: campaign.currency,
          paymentTransactionId: providerReference,
        },
      });

      if (campaign.productId) {
        await tx.product.update({
          where: { id: campaign.productId },
          data: { isFeatured: true, boostedUntil: campaign.endAt },
        });
      }
    });

    await this.audit.log({
      action: 'ad_campaign.activate',
      entityType: 'AdCampaign',
      entityId: campaignId,
      afterState: { providerReference },
    });
  }

  /**
   * Impressions/clics : suivi anonyme possible (viewerUserId optionnel).
   * Sur un modèle CPC/CPM, la campagne se met en pause automatiquement dès
   * que le budget calculé est atteint — jamais de dépassement silencieux.
   */
  async recordImpression(campaignId: string, viewerUserId: string | undefined, pageContext?: string) {
    const campaign = await this.getActiveCampaignOrNull(campaignId);
    if (!campaign) return { recorded: false };

    await this.prisma.adImpression.create({ data: { campaignId, viewerUserId, pageContext } });

    if (campaign.costModel === 'CPM') {
      await this.pauseIfBudgetExceeded(campaign.id);
    }

    return { recorded: true };
  }

  async recordClick(campaignId: string, viewerUserId: string | undefined) {
    const campaign = await this.getActiveCampaignOrNull(campaignId);
    if (!campaign) return { recorded: false };

    await this.prisma.adClick.create({ data: { campaignId, viewerUserId } });

    if (campaign.costModel === 'CPC') {
      await this.pauseIfBudgetExceeded(campaign.id);
    }

    return { recorded: true };
  }

  private async getActiveCampaignOrNull(campaignId: string) {
    const now = new Date();
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign || campaign.status !== 'ACTIVE') return null;
    if (now < campaign.startAt || now > campaign.endAt) return null;
    return campaign;
  }

  private async pauseIfBudgetExceeded(campaignId: string) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const [impressions, clicks] = await Promise.all([
      this.prisma.adImpression.count({ where: { campaignId } }),
      this.prisma.adClick.count({ where: { campaignId } }),
    ]);

    const spent =
      campaign.costModel === 'CPM'
        ? (impressions / 1000) * CPM_RATE_USD
        : campaign.costModel === 'CPC'
          ? clicks * CPC_RATE_USD
          : 0;

    if (spent >= Number(campaign.budgetAmount)) {
      await this.prisma.adCampaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } });
      if (campaign.productId) {
        await this.prisma.product.update({
          where: { id: campaign.productId },
          data: { isFeatured: false, boostedUntil: null },
        });
      }
    }
  }

  /**
   * À invoquer par un job planifié (même mécanisme que
   * WalletsService.releaseMaturedFunds) : clôture les campagnes dont la
   * date de fin est dépassée et retire le boost du produit associé.
   */
  async expireEndedCampaigns() {
    const now = new Date();
    const ended = await this.prisma.adCampaign.findMany({
      where: { status: 'ACTIVE', endAt: { lte: now } },
    });

    for (const campaign of ended) {
      await this.prisma.adCampaign.update({ where: { id: campaign.id }, data: { status: 'COMPLETED' } });
      if (campaign.productId) {
        await this.prisma.product.update({
          where: { id: campaign.productId },
          data: { isFeatured: false, boostedUntil: null },
        });
      }
    }

    return { expired: ended.length };
  }

  /** Tableau de bord ROI pour un annonceur, sur sa propre campagne */
  async getCampaignStats(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.prisma.adCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campagne introuvable');

    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    if (campaign.advertiserId !== user.id && !isAdmin) {
      throw new ForbiddenException("Cette campagne ne vous appartient pas");
    }

    const [impressions, clicks] = await Promise.all([
      this.prisma.adImpression.count({ where: { campaignId } }),
      this.prisma.adClick.count({ where: { campaignId } }),
    ]);

    return {
      campaign,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    };
  }
}
