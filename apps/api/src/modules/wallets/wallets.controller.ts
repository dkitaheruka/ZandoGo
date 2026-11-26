import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { WalletsService } from './wallets.service';

class AdminUpdatePayoutStatusDto {
  @IsIn(['APPROVED', 'PAID', 'REJECTED'])
  status: 'APPROVED' | 'PAID' | 'REJECTED';
}

@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get('mine')
  getMine(@CurrentUser() user: AuthenticatedUser, @Query('storeId') storeId?: string) {
    return this.wallets.getMyWallets(user, storeId);
  }

  @Get(':walletId/ledger')
  getLedger(@CurrentUser() user: AuthenticatedUser, @Param('walletId') walletId: string) {
    return this.wallets.getWalletLedger(user, walletId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('payouts')
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.wallets.requestPayout(user, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('payout')
  requestPayoutAlias(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.wallets.requestPayout(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Get('admin/payouts')
  listAllPayouts() {
    return this.wallets.listAllPayoutsForAdmin();
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Patch('admin/payouts/:id/status')
  updatePayoutStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdatePayoutStatusDto,
  ) {
    return this.wallets.updatePayoutStatusByAdmin(admin, id, dto.status);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Post('admin/store/:storeId/unlock-funds')
  unlockStoreFunds(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.wallets.unlockStoreFundsImmediately(admin, storeId);
  }
}
