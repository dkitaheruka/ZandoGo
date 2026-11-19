import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { StartConversationDto } from './dto/start-conversation.dto';

class SendChatMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7_000_000)
  attachmentUrl?: string;

  @IsOptional()
  @IsIn(['fr', 'ln', 'sw', 'en'])
  senderLanguage?: string;

  @IsOptional()
  @IsIn(['fr', 'ln', 'sw', 'en'])
  targetLanguage?: string;

  @IsOptional()
  @IsBoolean()
  autoTranslate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredModel?: string;
}

class TranslateChatMessageBodyDto {
  @IsIn(['fr', 'ln', 'sw', 'en'])
  targetLanguage: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredModel?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(user);
  }

  @Post('conversations')
  startConversation(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.chat.listMessages(user, id);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SendChatMessageDto,
  ) {
    const msg = await this.chat.sendMessage(user, id, body.content, body.attachmentUrl, {
      senderLanguage: body.senderLanguage,
      targetLanguage: body.targetLanguage,
      autoTranslate: body.autoTranslate,
      preferredModel: body.preferredModel,
    });
    this.gateway.emitMessage(id, msg);
    return msg;
  }

  @Post('messages/:messageId/translate')
  translateMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
    @Body() body: TranslateChatMessageBodyDto,
  ) {
    return this.chat.translateMessage(user, messageId, body.targetLanguage, body.preferredModel);
  }
}
