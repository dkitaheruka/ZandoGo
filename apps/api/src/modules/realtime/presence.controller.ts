import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LeavePresenceDto, PresenceHeartbeatDto } from './dto/presence-heartbeat.dto';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';

@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presence: PresenceService,
    private readonly gateway: PresenceGateway,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post('heartbeat')
  async heartbeat(
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: PresenceHeartbeatDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    const result = await this.presence.recordHeartbeat({
      user,
      visitorId: dto.visitorId,
      currentPath: dto.currentPath,
      userAgent,
    });
    this.gateway.emitUserStatusChanged(result);
    return {
      ok: true,
      isOnline: result.isOnline,
      lastSeenAt: result.lastSeenAt,
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('leave')
  leave(
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: LeavePresenceDto,
  ) {
    const change = this.presence.recordLeave({
      userId: user?.id,
      visitorId: dto?.visitorId,
    });
    this.gateway.emitUserStatusChanged(change);
    return { ok: true };
  }

  @Get('users')
  getUsersPresence(@Query('ids') ids?: string) {
    const idList = typeof ids === 'string'
      ? ids.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    return {
      users: this.presence.getUsersPresence(idList),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('admin/live')
  getAdminLiveSnapshot() {
    return this.presence.getAdminLiveSnapshot();
  }
}
