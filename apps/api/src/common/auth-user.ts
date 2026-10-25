import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@pharmodry/types';
import { ForbiddenError } from './errors';

/** Authenticated principal attached to each request after JWT verification. */
export class AuthPrincipal {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly email: string,
    readonly fullName: string,
    readonly familyId: string,
    /** permission → site ids it applies to ('*' = all sites) */
    readonly grants: Map<string, Set<string>>,
  ) {}

  has(permission: PermissionCode | string, siteId?: string | null): boolean {
    const sites = this.grants.get(permission);
    if (!sites) return false;
    if (!siteId) return true;
    return sites.has('*') || sites.has(siteId);
  }

  require(permission: PermissionCode, siteId?: string | null) {
    if (!this.has(permission, siteId)) {
      throw new ForbiddenError(`Missing permission ${permission}${siteId ? ' for this site' : ''}`, { permission, siteId });
    }
  }

  /** Site ids this user may act on for a permission; `null` means all sites. */
  sitesFor(permission: string): string[] | null {
    const s = this.grants.get(permission);
    if (!s) return [];
    if (s.has('*')) return null;
    return [...s];
  }

  get permissions(): string[] {
    return [...this.grants.keys()].sort();
  }
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const PERMISSIONS_KEY = 'permissions';
/** Requires ALL listed permissions (at any site; services re-check site scope). */
export const RequirePermissions = (...p: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, p);

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthPrincipal => {
  return ctx.switchToHttp().getRequest().user as AuthPrincipal;
});
