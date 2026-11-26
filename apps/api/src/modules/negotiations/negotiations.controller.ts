import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateNegotiationDto, UpdateNegotiationDto } from './dto/negotiation.dto';
import { NegotiationsService } from './negotiations.service';

@Controller('negotiations')
@UseGuards(JwtAuthGuard)
export class NegotiationsController {
  constructor(private readonly negotiationsService: NegotiationsService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.negotiationsService.listMine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNegotiationDto) {
    return this.negotiationsService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNegotiationDto,
  ) {
    return this.negotiationsService.update(user, id, dto);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.negotiationsService.acceptByBuyer(user, id);
  }
}
