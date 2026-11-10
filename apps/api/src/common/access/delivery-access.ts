import { NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AccessUser {
  id: string;
  roles: { role: string; scopeId: string | null }[];
}

/**
 * Qui peut consulter une livraison (trajet GPS, suivi en direct) :
 *  - un admin,
 *  - le client à qui la commande est destinée,
 *  - le vendeur propriétaire de la boutique de CETTE sous-commande (pas celui
 *    d'une autre sous-commande de la même commande),
 *  - le livreur assigné.
 *
 * Règle unique, utilisée par l'API REST et par la passerelle temps réel : si
 * elles avaient chacune leur propre version, elles finiraient par diverger.
 *
 * Un refus lève NotFound plutôt que Forbidden : on ne confirme pas à un tiers
 * qu'une livraison portant cet identifiant existe.
 */
export async function assertCanViewDelivery(
  prisma: PrismaService,
  user: AccessUser,
  deliveryId: string,
) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { agent: true, subOrder: { include: { order: true } } },
  });

  const isAdmin = user.roles.some(
    (r) => r.role === RoleName.ADMIN || r.role === RoleName.SUPER_ADMIN,
  );
  const allowed =
    !!delivery &&
    (isAdmin ||
      delivery.subOrder.order.customerId === user.id ||
      delivery.agent?.userId === user.id ||
      user.roles.some(
        (r) => r.role === RoleName.VENDOR_OWNER && r.scopeId === delivery.subOrder.storeId,
      ));

  if (!delivery || !allowed) {
    throw new NotFoundException('Livraison introuvable');
  }
  return delivery;
}
