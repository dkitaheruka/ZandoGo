import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateAddressDto } from './dto/create-address.dto';

class UpdateLanguageDto {
  @IsOptional()
  @IsIn(['fr', 'ln', 'sw', 'en'])
  preferredLanguage?: string;
}

class UpdateCurrencyDto {
  @IsIn(['USD', 'CDF'])
  currency: 'USD' | 'CDF';
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // ordre important : auth d'abord, rôle ensuite
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Accessible à tout utilisateur connecté, quel que soit son rôle */
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Patch('me/language')
  updateLanguage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateLanguageDto,
  ) {
    return this.usersService.updatePreferredLanguage(user.id, body?.preferredLanguage);
  }

  @Patch('me/currency')
  updateCurrency(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCurrencyDto,
  ) {
    return this.usersService.updatePreferredCurrency(user.id, body.currency);
  }

  @Get('me/addresses')
  listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listAddresses(user);
  }

  @Get('me/addresses/by-email')
  listAddressesByEmail(@CurrentUser() user: AuthenticatedUser, @Query('email') email: string) {
    return this.usersService.listAddressesByEmail(user, email || user.email || '');
  }

  @Post('me/addresses')
  createAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.usersService.createAddress(user, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.updateAddress(user, id, dto);
  }

  @Patch('me/addresses/:id/default')
  setDefaultAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.setDefaultAddress(user, id);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deleteAddress(user, id);
  }

  /** Exemple de route réservée aux admins, pour valider le RBAC */
  @Get('admin/ping')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  adminPing() {
    return { message: 'Accès admin confirmé' };
  }
}
