import { BadRequestException, Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { SetExchangeRateDto } from './dto/set-exchange-rate.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';

export interface PlatformPricingConfig {
  storeCreationFeeUsd: number;
  certificationMonthlyFeeUsd: number;
  certificationQuarterlyFeeUsd: number;
  adEssentialMonthlyFeeUsd: number;
  adProCarouselMonthlyFeeUsd: number;
  defaultCommissionPercent: number;
  updatedAt: string;
}

const DEFAULT_PRICING: Omit<PlatformPricingConfig, 'updatedAt'> = {
  storeCreationFeeUsd: 25,
  certificationMonthlyFeeUsd: 15,
  certificationQuarterlyFeeUsd: 39,
  adEssentialMonthlyFeeUsd: 29,
  adProCarouselMonthlyFeeUsd: 59,
  defaultCommissionPercent: 5,
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPlatformPricing(): Promise<PlatformPricingConfig> {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: 'vendor_pricing' },
    });
    const raw = (setting?.value as Partial<PlatformPricingConfig> | null) ?? {};
    return {
      storeCreationFeeUsd: Number(raw.storeCreationFeeUsd ?? DEFAULT_PRICING.storeCreationFeeUsd),
      certificationMonthlyFeeUsd: Number(
        raw.certificationMonthlyFeeUsd ?? DEFAULT_PRICING.certificationMonthlyFeeUsd,
      ),
      certificationQuarterlyFeeUsd: Number(
        raw.certificationQuarterlyFeeUsd ?? DEFAULT_PRICING.certificationQuarterlyFeeUsd,
      ),
      adEssentialMonthlyFeeUsd: Number(
        raw.adEssentialMonthlyFeeUsd ?? DEFAULT_PRICING.adEssentialMonthlyFeeUsd,
      ),
      adProCarouselMonthlyFeeUsd: Number(
        raw.adProCarouselMonthlyFeeUsd ?? DEFAULT_PRICING.adProCarouselMonthlyFeeUsd,
      ),
      defaultCommissionPercent: Number(
        raw.defaultCommissionPercent ?? DEFAULT_PRICING.defaultCommissionPercent,
      ),
      updatedAt: setting?.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async updatePlatformPricing(admin: AuthenticatedUser, dto: UpdatePricingDto): Promise<PlatformPricingConfig> {
    const current = await this.getPlatformPricing();
    const nextValue = {
      storeCreationFeeUsd: dto.storeCreationFeeUsd ?? current.storeCreationFeeUsd,
      certificationMonthlyFeeUsd: dto.certificationMonthlyFeeUsd ?? current.certificationMonthlyFeeUsd,
      certificationQuarterlyFeeUsd:
        dto.certificationQuarterlyFeeUsd ?? current.certificationQuarterlyFeeUsd,
      adEssentialMonthlyFeeUsd: dto.adEssentialMonthlyFeeUsd ?? current.adEssentialMonthlyFeeUsd,
      adProCarouselMonthlyFeeUsd: dto.adProCarouselMonthlyFeeUsd ?? current.adProCarouselMonthlyFeeUsd,
      defaultCommissionPercent: dto.defaultCommissionPercent ?? current.defaultCommissionPercent,
    };

    const saved = await this.prisma.platformSetting.upsert({
      where: { key: 'vendor_pricing' },
      update: { value: nextValue as any, updatedBy: admin.id },
      create: { key: 'vendor_pricing', value: nextValue as any, updatedBy: admin.id },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'platform_pricing.update',
      entityType: 'PlatformSetting',
      entityId: 'vendor_pricing',
      beforeState: current,
      afterState: nextValue,
    });

    return {
      ...nextValue,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async setExchangeRate(admin: AuthenticatedUser, dto: SetExchangeRateDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException('Les devises source et cible doivent être différentes');
    }
    if (!Number.isFinite(dto.rate) || dto.rate <= 0) {
      throw new BadRequestException('Le taux doit être un nombre positif');
    }

    const rate = await this.prisma.exchangeRate.create({
      data: {
        fromCurrency: dto.fromCurrency,
        toCurrency: dto.toCurrency,
        rate: dto.rate,
        setByAdminId: admin.id,
      },
    });

    await this.audit.log({
      actorUserId: admin.id,
      action: 'exchange_rate.set',
      entityType: 'ExchangeRate',
      entityId: rate.id,
      afterState: {
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        rate: rate.rate,
      },
    });

    return rate;
  }

  getExchangeRateHistory(from: Currency, to: Currency) {
    return this.prisma.exchangeRate.findMany({
      where: { fromCurrency: from, toCurrency: to },
      orderBy: { effectiveFrom: 'desc' },
      take: 100,
    });
  }
}
