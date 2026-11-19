import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateSubOrderStatusDto } from './dto/update-suborder-status.dto';
import { OrdersService } from './orders.service';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user, dto);
  }

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.getMyOrders(user);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.getOrder(user, id);
  }

  @UseGuards(RolesGuard)
  @Roles(RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF)
  @Patch('sub-orders/:id/status')
  updateSubOrderStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubOrderStatusDto,
  ) {
    return this.orders.updateSubOrderStatus(user, id, dto);
  }
}
