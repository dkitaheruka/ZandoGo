import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { DeliveryService } from './delivery.service';
import { ApplyAgentDto } from './dto/apply-agent.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { PingDto } from './dto/ping.dto';

class SetAvailabilityDto {
  @IsIn(['AVAILABLE', 'OFFLINE'])
  status: 'AVAILABLE' | 'OFFLINE';
}

@UseGuards(JwtAuthGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ---- Profil livreur ----

  @Post('agents/apply')
  apply(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyAgentDto) {
    return this.deliveryService.applyAsAgent(user, dto);
  }

  /** Profil du candidat/livreur connecté : 404 tant qu'il n'a pas candidaté */
  @Get('agents/me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.getMyProfile(user);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Get('agents/pending')
  listPendingAgents() {
    return this.deliveryService.listPendingAgents();
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.DELIVERY_AGENT)
  @Patch('agents/me/location')
  updateMyLocation(@CurrentUser() user: AuthenticatedUser, @Body() dto: PingDto) {
    return this.deliveryService.updateMyLocation(user, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.DELIVERY_AGENT)
  @Get('deliveries/mine')
  listMyDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.listMyDeliveries(user);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Patch('agents/:id/approve')
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.deliveryService.approveAgent(admin, id);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.DELIVERY_AGENT)
  @Patch('agents/me/availability')
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.deliveryService.setAvailability(user, dto.status);
  }

  // ---- Création / assignation (vendeur) ----

  @UseGuards(RolesGuard)
  @Roles(RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF)
  @Post('deliveries')
  createDelivery(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDeliveryDto) {
    return this.deliveryService.createDelivery(user, dto);
  }

  // ---- Actions du livreur ----

  @UseGuards(RolesGuard)
  @Roles(RoleName.DELIVERY_AGENT)
  @Patch('deliveries/:id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.updateStatus(user, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.DELIVERY_AGENT)
  @Post('deliveries/:id/ping')
  ping(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PingDto) {
    return this.deliveryService.recordPing(user, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.DELIVERY_AGENT)
  @Post('deliveries/:id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteDeliveryDto,
  ) {
    return this.deliveryService.completeDelivery(user, id, dto);
  }

  // ---- Suivi (client, vendeur, admin) ----

  @Get('by-order/:orderId')
  getDeliveryForOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.deliveryService.getDeliveryForOrder(user, orderId);
  }

  @Get('deliveries/:id/tracking')
  getTracking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.deliveryService.getTracking(user, id);
  }
}
