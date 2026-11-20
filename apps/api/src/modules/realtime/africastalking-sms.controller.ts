import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AfricasTalkingSmsService } from './africastalking-sms.service';
import { SendBulkSmsDto } from './dto/send-bulk-sms.dto';

@Controller('sms')
export class AfricasTalkingSmsController {
  constructor(private readonly smsService: AfricasTalkingSmsService) {}

  private assertWebhookAuthorized(queryToken?: string, headerToken?: string) {
    const provided = headerToken || queryToken;
    if (!this.smsService.verifyCallbackToken(provided)) {
      throw new UnauthorizedException('Jeton de callback SMS invalide.');
    }
  }

  // ---------------------------------------------------------------------------
  // Callbacks officiels Africa's Talking (application/x-www-form-urlencoded)
  // ---------------------------------------------------------------------------

  @SkipThrottle()
  @Post('callbacks/delivery-reports')
  @HttpCode(200)
  handleDeliveryReport(
    @Body() payload: Record<string, any>,
    @Query('token') queryToken?: string,
    @Headers('x-africastalking-token') headerToken?: string,
  ) {
    this.assertWebhookAuthorized(queryToken, headerToken);
    return this.smsService.handleDeliveryReport(payload || {});
  }

  @SkipThrottle()
  @Post('callbacks/incoming-messages')
  @HttpCode(200)
  handleIncomingMessage(
    @Body() payload: Record<string, any>,
    @Query('token') queryToken?: string,
    @Headers('x-africastalking-token') headerToken?: string,
  ) {
    this.assertWebhookAuthorized(queryToken, headerToken);
    return this.smsService.handleIncomingMessage(payload || {});
  }

  @SkipThrottle()
  @Post('callbacks/opt-out')
  @HttpCode(200)
  handleBulkOptOut(
    @Body() payload: Record<string, any>,
    @Query('token') queryToken?: string,
    @Headers('x-africastalking-token') headerToken?: string,
  ) {
    this.assertWebhookAuthorized(queryToken, headerToken);
    return this.smsService.handleBulkOptOut(payload || {});
  }

  @SkipThrottle()
  @Post('callbacks/subscriptions')
  @HttpCode(200)
  handleSubscriptionNotification(
    @Body() payload: Record<string, any>,
    @Query('token') queryToken?: string,
    @Headers('x-africastalking-token') headerToken?: string,
  ) {
    this.assertWebhookAuthorized(queryToken, headerToken);
    return this.smsService.handleSubscriptionNotification(payload || {});
  }

  // ---------------------------------------------------------------------------
  // Endpoints Admin : Bulk SMS, Fetch Inbox, Opt-Outs & Journaux DLR
  // ---------------------------------------------------------------------------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('bulk')
  sendBulkSms(@Body() dto: SendBulkSmsDto) {
    return this.smsService.sendBulkSms(dto.phoneNumbers, dto.message, {
      enqueue: dto.enqueue,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('inbox')
  fetchInbox(@Query('lastReceivedId') lastReceivedId?: string) {
    return this.smsService.fetchMessages(lastReceivedId || '0');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('opt-outs')
  listOptOuts() {
    return this.smsService.getOptOutNumbers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('callbacks/logs')
  listSmsCallbackLogs(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 50;
    return this.smsService.getRecentSmsActivity(Number.isFinite(parsedLimit) ? parsedLimit : 50);
  }
}
