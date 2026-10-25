import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import type { PermissionCode } from '@pharmodry/types';
import { AuthPrincipal, IS_PUBLIC, PERMISSIONS_KEY } from '../../common/auth-user';
import type { RequestStore } from '../../common/context';
import { ForbiddenError, UnauthorizedError } from '../../common/errors';
import { AuthService } from './auth.service';

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly cls: ClsService<RequestStore>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError();
    const principal = await this.auth.authenticate(header.slice(7));
    req.user = principal;
    this.cls.set('tenantId', principal.tenantId);
    this.cls.set('userId', principal.id);
    this.cls.set('userEmail', principal.email);
    this.cls.set('userName', principal.fullName);
    return true;
  }
}

/** Global guard: checks @RequirePermissions codes (at any site; services re-check site scope). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user;
    if (!user) throw new UnauthorizedError();
    const missing = required.filter((p) => !user.has(p));
    if (missing.length) throw new ForbiddenError(`Missing permission: ${missing.join(', ')}`, { missing });
    return true;
  }
}
