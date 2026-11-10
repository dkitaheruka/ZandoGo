import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
}
