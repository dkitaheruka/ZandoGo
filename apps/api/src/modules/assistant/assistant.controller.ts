import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssistantService } from './assistant.service';
import {
  AnalyzeDisputeDto,
  AssistantChatDto,
  GenerateProductDescriptionDto,
  SmartSearchDto,
  SuggestReplyDto,
  TranslateChatMessageDto,
  UpdateAiSettingsDto,
} from './dto/assistant.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('status')
  getStatus(@Query('preferredModel') preferredModel?: string) {
    return this.assistant.getStatus(preferredModel);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('settings')
  getAiSettings() {
    return this.assistant.getAiSettings();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Put('settings')
  updateAiSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAiSettingsDto) {
    return this.assistant.updateAiSettings(user.id, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Post('chat')
  chat(@Body() dto: AssistantChatDto, @CurrentUser() user?: AuthenticatedUser | null) {
    return this.assistant.chat(dto, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('roleContext') roleContext?: string,
  ) {
    return this.assistant.getHistory(user.id, roleContext);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('history')
  clearHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('roleContext') roleContext?: string,
  ) {
    return this.assistant.clearHistory(user.id, roleContext);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Get('message-logs')
  getMessageLogs(
    @Query('scenario') scenario?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assistant.getMessageLogs({
      scenario,
      channel,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @Post('smart-search')
  smartSearch(@Body() dto: SmartSearchDto) {
    return this.assistant.smartSearch(dto);
  }

  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('suggest-reply')
  suggestReply(@Body() dto: SuggestReplyDto) {
    return this.assistant.suggestReply(dto);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('translate')
  translateChatMessage(@Body() dto: TranslateChatMessageDto) {
    return this.assistant.translateChatMessage(dto);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('product-description')
  generateProductDescription(@Body() dto: GenerateProductDescriptionDto) {
    return this.assistant.generateProductDescription(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN, RoleName.SUPER_ADMIN)
  @Post('disputes/:id/analyze')
  analyzeDispute(@Param('id') id: string, @Body() dto: AnalyzeDisputeDto) {
    return this.assistant.analyzeDispute(id, dto?.preferredModel);
  }
}
