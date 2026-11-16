import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Roles(RoleName.VENDOR_OWNER, RoleName.VENDOR_STAFF, RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('vendor/:storeId')
  vendorAnalytics(@CurrentUser() user: AuthenticatedUser, @Param('storeId') storeId: string) {
    return this.analytics.getVendorAnalytics(user, storeId);
  }

  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('admin')
  adminAnalytics() {
    return this.analytics.getAdminAnalytics();
  }
}
