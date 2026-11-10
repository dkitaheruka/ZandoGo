import { BadRequestException, Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { SetExchangeRateDto } from './dto/set-exchange-rate.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
