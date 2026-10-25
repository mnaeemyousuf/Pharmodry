import { Injectable } from '@nestjs/common';
import { formatNumber, mergeSettings, sequenceScope, TenantSettings } from '@pharmodry/types';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, tx?: Tx): Promise<TenantSettings> {
    const t = await (tx ?? this.prisma.db).tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true } });
    return mergeSettings(t.settings);
  }
}

/** Generates human-readable document numbers from configurable patterns (tenant settings). */
@Injectable()
export class NumberingService {
  constructor(private readonly settings: SettingsService) {}

  async next(tx: Tx, tenantId: string, kind: keyof TenantSettings['numbering'] | string, opts: { prefix?: string; site?: string } = {}) {
    const settings = await this.settings.get(tenantId, tx);
    const pattern = settings.numbering[String(kind)] ?? `${String(kind)}-{YYYY}-{SEQ:5}`;
    const date = new Date();
    const scope = sequenceScope(String(kind), pattern, { ...opts, date });
    const rows = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO number_sequences ("tenantId", scope, value, "updatedAt")
      VALUES (${tenantId}::uuid, ${scope}, 1, now())
      ON CONFLICT ("tenantId", scope) DO UPDATE SET value = number_sequences.value + 1, "updatedAt" = now()
      RETURNING value`;
    return formatNumber(pattern, Number(rows[0].value), { ...opts, date });
  }
}

/** Resolves user ids → display names for regulated records that store plain user references. */
@Injectable()
export class UserDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async names(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (unique.length === 0) return {};
    const users = await this.prisma.db.user.findMany({ where: { id: { in: unique } }, select: { id: true, fullName: true } });
    return Object.fromEntries(users.map((u) => [u.id, u.fullName]));
  }

  /** Adds `<field>Name` for each `<field>Id` key present on the rows. */
  async decorate<T extends Record<string, unknown>>(rows: T[], fields: string[]): Promise<(T & Record<string, string | null>)[]> {
    const ids = rows.flatMap((r) => fields.map((f) => r[f] as string | null | undefined));
    const map = await this.names(ids);
    return rows.map((r) => {
      const extra: Record<string, string | null> = {};
      for (const f of fields) {
        const id = r[f] as string | null | undefined;
        extra[f.replace(/Id$/, 'Name')] = id ? (map[id] ?? null) : null;
      }
      return { ...r, ...extra };
    });
  }

  async decorateOne<T extends Record<string, unknown>>(row: T, fields: string[]) {
    return (await this.decorate([row], fields))[0];
  }
}
