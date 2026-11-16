import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
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

  async listAddressesByEmail(user: AuthenticatedUser, email: string) {
    const normalized = email.trim().toLowerCase();
    const isAdmin = user.roles.some(
      (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
    );
    if (!isAdmin && (!user.email || user.email.toLowerCase() !== normalized)) {
      throw new ForbiddenException(
        'Vous ne pouvez récupérer que les adresses liées à votre adresse e-mail authentifiée.',
      );
    }

    const account = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: { id: true, email: true, fullName: true },
    });
    if (!account) {
      throw new NotFoundException('Aucun compte trouvé avec cette adresse e-mail');
    }

    const addresses = await this.prisma.address.findMany({
      where: { userId: account.id },
      orderBy: { isDefault: 'desc' },
    });

    return {
      email: account.email,
      fullName: account.fullName,
      addresses,
    };
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

  async updateAddress(user: AuthenticatedUser, id: string, dto: CreateAddressDto) {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Adresse introuvable');
    if (existing.userId !== user.id) {
      throw new ForbiddenException("Cette adresse ne vous appartient pas");
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.commune !== undefined ? { commune: dto.commune } : {}),
        ...(dto.quartier !== undefined ? { quartier: dto.quartier } : {}),
        ...(dto.ville !== undefined ? { ville: dto.ville } : {}),
        ...(dto.referencePoint !== undefined ? { referencePoint: dto.referencePoint } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async setDefaultAddress(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Adresse introuvable');
    if (existing.userId !== user.id) {
      throw new ForbiddenException("Cette adresse ne vous appartient pas");
    }

    await this.prisma.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
    return this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async deleteAddress(user: AuthenticatedUser, id: string) {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Adresse introuvable');
    if (existing.userId !== user.id) {
      throw new ForbiddenException("Cette adresse ne vous appartient pas");
    }
    await this.prisma.address.delete({ where: { id } });
    return { success: true };
  }
}
