import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RoleName } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  roles: { role: RoleName; scopeId: string | null }[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user,
);
