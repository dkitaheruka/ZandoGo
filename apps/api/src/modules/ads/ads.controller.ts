import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AdsService } from './ads.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { PayCampaignDto } from './dto/pay-campaign.dto';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('campaigns')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    return this.adsService.createCampaign(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/mine')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.adsService.getMyCampaigns(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/pay')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayCampaignDto,
  ) {
    return this.adsService.payCampaign(user, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/stats')
  getStats(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adsService.getCampaignStats(user, id);
  }

  /** Suivi public — appelé par le frontend à chaque affichage/clic d'une annonce */
  @Post('campaigns/:id/impressions')
  trackImpression(
    @Param('id') id: string,
    @Query('viewerUserId') viewerUserId?: string,
    @Query('page') page?: string,
  ) {
    return this.adsService.recordImpression(id, viewerUserId, page);
  }

  @Post('campaigns/:id/clicks')
  trackClick(@Param('id') id: string, @Query('viewerUserId') viewerUserId?: string) {
    return this.adsService.recordClick(id, viewerUserId);
  }
}
