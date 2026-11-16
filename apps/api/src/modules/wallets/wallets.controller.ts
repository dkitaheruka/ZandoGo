import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { WalletsService } from './wallets.service';

@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get('mine')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.getMyWallets(user);
  }

  @Get(':walletId/ledger')
  getLedger(@CurrentUser() user: AuthenticatedUser, @Param('walletId') walletId: string) {
    return this.wallets.getWalletLedger(user, walletId);
  }

  @Post('payouts')
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.wallets.requestPayout(user, dto);
  }

  @Post('payout')
  requestPayoutAlias(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.wallets.requestPayout(user, dto);
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
