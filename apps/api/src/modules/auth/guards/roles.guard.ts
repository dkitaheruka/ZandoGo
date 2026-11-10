import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * S'applique APRÈS JwtAuthGuard (l'ordre des guards compte).
 * Ne vérifie que la présence du rôle ; la vérification du "scope"
 * (ex: un VENDOR_STAFF n'agit que sur SA boutique) doit être faite
 * explicitement dans chaque service métier concerné — défense en profondeur,
 * on ne fait jamais confiance uniquement au guard global pour l'isolation
 * des données entre vendeurs.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route sans restriction de rôle explicite
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    const userRoleNames = user.roles.map((r) => r.role);
    const hasRequiredRole = requiredRoles.some((role) => userRoleNames.includes(role));

    if (!hasRequiredRole) {
      throw new ForbiddenException("Vous n'avez pas la permission d'accéder à cette ressource");
    }

    return true;
  }
}
