import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthUser } from '@pharmodry/types';
import { loadConfig } from '../../config/env';
import { AuthPrincipal } from '../../common/auth-user';
import { UnauthorizedError, ValidationError } from '../../common/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

interface AccessPayload {
  sub: string;
  tid: string;
  fid: string;
}

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  private readonly cfg = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    const genericFailure = new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    if (!user) {
      // Equalise timing for unknown accounts.
      await this.passwords.verify(password, 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
      throw genericFailure;
    }
    const actor = { id: user.id, email: user.email, name: user.fullName };
    if (user.status !== 'ACTIVE') {
      await this.audit.recordStandalone({ tenantId: user.tenantId, actor, entityType: 'User', entityId: user.id, entityLabel: user.email, action: 'LOGIN_FAILED', reason: 'Account inactive' });
      throw genericFailure;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.recordStandalone({ tenantId: user.tenantId, actor, entityType: 'User', entityId: user.id, entityLabel: user.email, action: 'LOGIN_FAILED', reason: 'Account locked' });
      throw new UnauthorizedError(`Account locked after repeated failed attempts. Try again after ${user.lockedUntil.toISOString()}`, 'ACCOUNT_LOCKED');
    }
    const ok = await this.passwords.verify(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED;
      await this.prisma.base.user.update({
        where: { id: user.id },
        data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined },
      });
      await this.audit.recordStandalone({
        tenantId: user.tenantId,
        actor,
        entityType: 'User',
        entityId: user.id,
        entityLabel: user.email,
        action: 'LOGIN_FAILED',
        reason: lock ? `Invalid password — account locked for ${LOCK_MINUTES} minutes` : `Invalid password (${failed}/${MAX_FAILED})`,
      });
      throw genericFailure;
    }
    await this.prisma.base.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const tokens = await this.issue(user.id, user.tenantId, randomUUID(), meta);
    await this.audit.recordStandalone({ tenantId: user.tenantId, actor, entityType: 'User', entityId: user.id, entityLabel: user.email, action: 'LOGIN', next: { ip: meta.ip ?? null } });
    return tokens;
  }

  private async issue(userId: string, tenantId: string, familyId: string, meta: { ip?: string; userAgent?: string }, replacing?: string): Promise<IssuedTokens> {
    const secret = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.cfg.refreshTtlDays * 86_400_000);
    const session = await this.prisma.base.session.create({
      data: { tenantId, userId, familyId, tokenHash: sha256(secret), ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300), expiresAt: refreshExpiresAt },
    });
    if (replacing) {
      await this.prisma.base.session.update({ where: { id: replacing }, data: { revokedAt: new Date(), revokeReason: 'ROTATED', replacedById: session.id } });
    }
    const payload: AccessPayload = { sub: userId, tid: tenantId, fid: familyId };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.cfg.jwtAccessTtlSeconds });
    return { accessToken, expiresIn: this.cfg.jwtAccessTtlSeconds, refreshToken: `${session.id}.${secret}`, refreshExpiresAt };
  }

  /** Refresh-token rotation with reuse detection: replaying a rotated token revokes the whole family. */
  async refresh(raw: string | undefined, meta: { ip?: string; userAgent?: string }) {
    if (!raw || !raw.includes('.')) throw new UnauthorizedError('Missing refresh token');
    const [sessionId, secret] = raw.split('.');
    if (!/^[0-9a-f-]{36}$/.test(sessionId)) throw new UnauthorizedError('Invalid refresh token');
    const session = await this.prisma.base.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.tokenHash !== sha256(secret)) throw new UnauthorizedError('Invalid refresh token');
    if (session.revokedAt) {
      if (session.revokeReason === 'ROTATED') {
        await this.prisma.base.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'REUSE_DETECTED' } });
        await this.audit.recordStandalone({
          tenantId: session.tenantId,
          actor: { id: session.userId, email: session.user.email, name: session.user.fullName },
          entityType: 'Session',
          entityId: session.familyId,
          action: 'LOGOUT',
          reason: 'Refresh token reuse detected — all sessions in family revoked',
        });
      }
      throw new UnauthorizedError('Session expired');
    }
    if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE') throw new UnauthorizedError('Session expired');
    return this.issue(session.userId, session.tenantId, session.familyId, meta, session.id);
  }

  async logout(principal: AuthPrincipal) {
    await this.prisma.base.session.updateMany({ where: { familyId: principal.familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'LOGOUT' } });
    await this.audit.recordStandalone({ entityType: 'User', entityId: principal.id, entityLabel: principal.email, action: 'LOGOUT' });
  }

  /** Verifies an access token and builds the principal (with effective permissions). */
  async authenticate(token: string): Promise<AuthPrincipal> {
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token', 'TOKEN_INVALID');
    }
    const [user, activeSession] = await Promise.all([
      this.prisma.base.user.findUnique({
        where: { id: payload.sub },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
      }),
      this.prisma.base.session.findFirst({ where: { familyId: payload.fid, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } }),
    ]);
    if (!user || user.tenantId !== payload.tid || user.status !== 'ACTIVE' || !activeSession) {
      throw new UnauthorizedError('Session is no longer valid', 'TOKEN_INVALID');
    }
    const grants = new Map<string, Set<string>>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        const set = grants.get(rp.permission.code) ?? new Set<string>();
        set.add(ur.siteId ?? '*');
        grants.set(rp.permission.code, set);
      }
    }
    return new AuthPrincipal(user.id, user.tenantId, user.email, user.fullName, payload.fid, grants);
  }

  async me(p: AuthPrincipal): Promise<AuthUser> {
    const [tenant, user, sites] = await Promise.all([
      this.prisma.db.tenant.findUniqueOrThrow({ where: { id: p.tenantId } }),
      this.prisma.db.user.findFirstOrThrow({ where: { id: p.id } }),
      this.prisma.db.site.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    ]);
    const sitePermissions: Record<string, string[]> = {};
    for (const [perm, s] of p.grants) sitePermissions[perm] = [...s];
    const anySiteGrant = [...p.grants.values()].some((s) => s.has('*'));
    const allowedSites = anySiteGrant ? sites : sites.filter((s) => [...p.grants.values()].some((g) => g.has(s.id)));
    return {
      id: p.id,
      tenantId: p.tenantId,
      tenantName: tenant.name,
      email: p.email,
      fullName: p.fullName,
      title: user.title,
      permissions: p.permissions,
      sitePermissions,
      sites: allowedSites.map((s) => ({ id: s.id, code: s.code, name: s.name })),
    };
  }

  sessions(p: AuthPrincipal) {
    return this.prisma.db.session.findMany({
      where: { userId: p.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, familyId: true, ip: true, userAgent: true, createdAt: true, lastUsedAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(p: AuthPrincipal, familyId: string) {
    await this.prisma.db.session.updateMany({ where: { userId: p.id, familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'USER_REVOKED' } });
  }

  async changePassword(p: AuthPrincipal, current: string, next: string) {
    const user = await this.prisma.db.user.findFirstOrThrow({ where: { id: p.id } });
    if (!(await this.passwords.verify(current, user.passwordHash))) throw new UnauthorizedError('Current password is incorrect');
    const policy = this.passwords.validatePolicy(next);
    if (policy) throw new ValidationError(policy);
    await this.prisma.transaction(async (tx) => {
      await tx.user.update({ where: { id: p.id }, data: { passwordHash: await this.passwords.hash(next), passwordChangedAt: new Date() } });
      // Sign out every other session; the session that changed the password stays valid.
      await tx.session.updateMany({ where: { userId: p.id, revokedAt: null, familyId: { not: p.familyId } }, data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' } });
      await this.audit.record(tx, { entityType: 'User', entityId: p.id, entityLabel: p.email, action: 'UPDATE', next: { password: 'changed' } });
    });
  }
}
