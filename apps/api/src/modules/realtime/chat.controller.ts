import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { StartConversationDto } from './dto/start-conversation.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

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
}
