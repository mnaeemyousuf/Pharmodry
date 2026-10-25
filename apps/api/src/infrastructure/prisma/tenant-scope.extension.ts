import { Prisma } from '@prisma/client';
import { ForbiddenError } from '../../common/errors';

/**
 * Models that carry a tenantId column. Every top-level operation on them is scoped
 * to the tenant of the current request (defence in depth on top of explicit service filters).
 */
export const TENANT_SCOPED_MODELS = new Set<string>(
  Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === 'tenantId')).map((m) => m.name),
);

const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

type AnyArgs = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: Record<string, unknown> };

function scopeData(data: unknown, tenantId: string, model: string): unknown {
  if (Array.isArray(data)) return data.map((d) => scopeData(d, tenantId, model));
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.tenantId !== undefined && d.tenantId !== tenantId) {
      throw new ForbiddenError(`Cross-tenant write blocked on ${model}`);
    }
    return { ...d, tenantId };
  }
  return data;
}

type OpParams = { model?: string; operation: string; args: unknown; query: (args: unknown) => Promise<unknown> };

/** Query middleware: scopes every top-level operation on tenant-owned models to the current tenant. */
export function tenantScopeHandler(getTenantId: () => string | undefined) {
  return async function scoped({ model, operation, args, query }: OpParams) {
    const tenantId = getTenantId();
    if (!tenantId || !model || !TENANT_SCOPED_MODELS.has(model)) return query(args);
    const a = { ...(args as AnyArgs) };
    if (WHERE_OPS.has(operation)) {
      const where = (a.where ?? {}) as Record<string, unknown>;
      if (where.tenantId !== undefined && where.tenantId !== tenantId) {
        throw new ForbiddenError(`Cross-tenant access blocked on ${model}`);
      }
      a.where = { ...where, tenantId };
    } else if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
      a.data = scopeData(a.data, tenantId, model);
    } else if (operation === 'upsert') {
      a.where = { ...(a.where ?? {}), tenantId };
      a.create = scopeData(a.create, tenantId, model) as Record<string, unknown>;
    }
    return query(a as typeof args);
  };
}

export function tenantScopeExtension(getTenantId: () => string | undefined) {
  const handler = tenantScopeHandler(getTenantId);
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: { $allModels: { $allOperations: (p) => handler(p as OpParams) as never } },
  });
}
