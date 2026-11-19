import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers?: { authorization?: string } }>();
    const authHeader = req?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return true;
    }
    return super.canActivate(context);
  }

  override handleRequest<TUser = any>(_err: unknown, user: TUser): TUser | null {
    return user || null;
  }
}
