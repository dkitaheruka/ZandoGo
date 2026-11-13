import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Currency, RoleName } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { SetExchangeRateDto } from './dto/set-exchange-rate.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { FinanceService } from './finance.service';

class ExchangeRateQuery {
  @IsEnum(Currency)
  from: Currency;

  @IsEnum(Currency)
  to: Currency;
}

@Controller('platform')
export class PlatformPricingController {
  constructor(private readonly finance: FinanceService) {}

  @Get('pricing')
  getPricing() {
    return this.finance.getPlatformPricing();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Put('pricing')
  updatePricing(@CurrentUser() admin: AuthenticatedUser, @Body() dto: UpdatePricingDto) {
    return this.finance.updatePlatformPricing(admin, dto);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('pricing')
  getPricing() {
    return this.finance.getPlatformPricing();
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Put('pricing')
  updatePricing(@CurrentUser() admin: AuthenticatedUser, @Body() dto: UpdatePricingDto) {
    return this.finance.updatePlatformPricing(admin, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('exchange-rates/history')
  history(@Query() query: ExchangeRateQuery) {
    return this.finance.getExchangeRateHistory(query.from, query.to);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('exchange-rates')
  latest(@Query() query: ExchangeRateQuery) {
    return this.finance.getExchangeRateHistory(query.from, query.to).then((rates) => rates[0] ?? null);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Post('exchange-rates')
  set(@CurrentUser() admin: AuthenticatedUser, @Body() dto: SetExchangeRateDto) {
    return this.finance.setExchangeRate(admin, dto);
  }
}
