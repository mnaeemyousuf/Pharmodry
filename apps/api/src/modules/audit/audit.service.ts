import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditAction } from '@pharmodry/types';
import { createHash } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import type { RequestStore } from '../../common/context';
import { ListQueryDto, pageArgs, toPage } from '../../common/pagination';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';
import { serialize } from '../../common/http';

export interface AuditInput {
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  action: AuditAction;
  previous?: unknown;
  next?: unknown;
  reason?: string | null;
  signatureId?: string | null;
  /** Needed only when there is no authenticated request context (login, jobs). */
  tenantId?: string | null;
  actor?: { id?: string | null; email?: string | null; name?: string | null };
}

const IGNORED_DIFF_FIELDS = new Set(['updatedAt', 'version', 'passwordHash']);

/** Returns only changed fields: [previous, next]. */
export function diff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  if (!before) return [null, after ? serialize(after) : null] as const;
  if (!after) return [serialize(before), null] as const;
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  const b = serialize(before) as Record<string, unknown>;
  const a = serialize(after) as Record<string, unknown>;
  for (const k of Object.keys(a)) {
    if (IGNORED_DIFF_FIELDS.has(k)) continue;
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
      prev[k] = b[k] ?? null;
      next[k] = a[k] ?? null;
    }
  }
  return [prev, next] as const;
}

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as object)
        .sort()
        .reduce<Record<string, unknown>>((o, key) => ((o[key] = (val as Record<string, unknown>)[key]), o), {});
    }
    return val;
  });
}

export function hashAuditEvent(prevHash: string | null, e: Record<string, unknown>): string {
  return createHash('sha256')
    .update(prevHash ?? 'GENESIS')
    .update(canonical(e))
    .digest('hex');
}

/**
 * Central, append-only audit trail. Always call inside the business transaction so the
 * audit event commits or rolls back together with the change it describes.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<RequestStore>,
  ) {}

  async record(tx: Tx, input: AuditInput) {
    const ctx = this.cls.isActive() ? this.cls.get() : ({} as RequestStore);
    const tenantId = input.tenantId ?? ctx.tenantId ?? null;
    // Serialise chain per tenant so each event links to its predecessor.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId ?? 'platform'}))`;
    const last = await tx.auditEvent.findFirst({
      where: { tenantId },
      orderBy: { seq: 'desc' },
      select: { hash: true },
    });
    const occurredAt = new Date();
    const body = {
      tenantId,
      userId: input.actor?.id ?? ctx.userId ?? null,
      userEmail: input.actor?.email ?? ctx.userEmail ?? null,
      userName: input.actor?.name ?? ctx.userName ?? null,
      occurredAt: occurredAt.toISOString(),
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      previousValue: input.previous === undefined ? null : serialize(input.previous),
      newValue: input.next === undefined ? null : serialize(input.next),
      reason: input.reason ?? null,
      signatureId: input.signatureId ?? null,
    };
    const prevHash = last?.hash ?? null;
    const hash = hashAuditEvent(prevHash, body);
    return tx.auditEvent.create({
      data: {
        ...body,
        tenantId,
        occurredAt,
        previousValue: (body.previousValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
        newValue: (body.newValue ?? Prisma.DbNull) as Prisma.InputJsonValue,
        entityLabel: input.entityLabel ?? null,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        correlationId: this.cls.isActive() ? this.cls.getId() : null,
        prevHash,
        hash,
      },
    });
  }

  /** Records an event in its own transaction (login, export, failed signature). */
  recordStandalone(input: AuditInput) {
    return this.prisma.transaction((tx) => this.record(tx, input));
  }

  async list(q: ListQueryDto & { entityType?: string; entityId?: string; action?: string; userId?: string; from?: string; to?: string }) {
    const where: Prisma.AuditEventWhereInput = {
      entityType: q.entityType || undefined,
      entityId: q.entityId || undefined,
      action: q.action || undefined,
      userId: q.userId || undefined,
      occurredAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
      OR: q.q
        ? [
            { entityLabel: { contains: q.q, mode: 'insensitive' } },
            { reason: { contains: q.q, mode: 'insensitive' } },
            { userEmail: { contains: q.q, mode: 'insensitive' } },
            { entityType: { contains: q.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.auditEvent.findMany({ where, orderBy: { seq: 'desc' }, ...pageArgs(q) }),
      this.prisma.db.auditEvent.count({ where }),
    ]);
    return toPage(rows, total, q);
  }

  /** Recomputes the hash chain for the current tenant. */
  async verifyChain(tenantId: string) {
    let prevHash: string | null = null;
    let checked = 0;
    let cursor: bigint | undefined;
    for (;;) {
      const batch: Awaited<ReturnType<typeof this.prisma.db.auditEvent.findMany>> = await this.prisma.db.auditEvent.findMany({
        where: { tenantId, ...(cursor !== undefined ? { seq: { gt: cursor } } : {}) },
        orderBy: { seq: 'asc' },
        take: 1000,
      });
      if (batch.length === 0) break;
      for (const e of batch) {
        const body = {
          tenantId: e.tenantId,
          userId: e.userId,
          userEmail: e.userEmail,
          userName: e.userName,
          occurredAt: e.occurredAt.toISOString(),
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          previousValue: e.previousValue ?? null,
          newValue: e.newValue ?? null,
          reason: e.reason,
          signatureId: e.signatureId,
        };
        const expected = hashAuditEvent(prevHash, body);
        if (e.prevHash !== prevHash || e.hash !== expected) {
          return { valid: false, checked, brokenAt: { id: e.id, seq: e.seq.toString(), occurredAt: e.occurredAt } };
        }
        prevHash = e.hash;
        checked++;
        cursor = e.seq;
      }
    }
    return { valid: true, checked };
  }
}
