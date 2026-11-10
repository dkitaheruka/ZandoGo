import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // ordre important : auth d'abord, rôle ensuite
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Accessible à tout utilisateur connecté, quel que soit son rôle */
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get('me/addresses')
  listAddresses(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listAddresses(user);
  }

  @Post('me/addresses')
  createAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.usersService.createAddress(user, dto);
  }

  /** Exemple de route réservée aux admins, pour valider le RBAC */
  @Get('admin/ping')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  adminPing() {
    return { message: 'Accès admin confirmé' };
  }
}
