import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenDisputeDto) {
    return this.disputesService.openDispute(user, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.disputesService.getDispute(user, id);
  }

  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddDisputeMessageDto,
  ) {
    return this.disputesService.addMessage(user, id, dto);
  }

  /** File d'attente triée par échéance SLA — réservée aux admins */
  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Get()
  listOpen() {
    return this.disputesService.listOpenDisputes();
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Patch(':id/payout-block')
  setPayoutBlock(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { blocked: boolean; reason?: string },
  ) {
    return this.disputesService.setStorePayoutFreeze(admin, id, Boolean(body.blocked), body.reason);
  }

  /** Résolution : réservée au SUPER_ADMIN (vérifié une seconde fois dans le service) */
  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN)
  @Patch(':id/resolve')
  resolve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolveDispute(admin, id, dto);
  }
}
