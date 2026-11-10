import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAddresses(user: AuthenticatedUser) {
    return this.prisma.address.findMany({
      where: { userId: user.id },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createAddress(user: AuthenticatedUser, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.create({
      data: { ...dto, userId: user.id },
    });
  }
}
