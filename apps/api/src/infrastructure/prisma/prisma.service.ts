import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import type { RequestStore } from '../../common/context';
import { tenantScopeExtension } from './tenant-scope.extension';

export type Tx = Prisma.TransactionClient;

/**
 * Owns the Prisma client. `db` is the tenant-scoped client every service must use.
 * The extension only adds query middleware (no result-type changes), so it keeps the PrismaClient type.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly base: PrismaClient;
  readonly db: PrismaClient;

  constructor(private readonly cls: ClsService<RequestStore>) {
    this.base = new PrismaClient({ log: [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }] });
    this.db = this.base.$extends(tenantScopeExtension(() => this.currentTenant())) as unknown as PrismaClient;
  }

  private currentTenant(): string | undefined {
    return this.cls.isActive() ? this.cls.get('tenantId') : undefined;
  }

  /** Runs a regulated workflow in a single transaction. */
  transaction<T>(fn: (tx: Tx) => Promise<T>, opts?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }) {
    return this.db.$transaction(fn, { timeout: opts?.timeout ?? 20_000, maxWait: 10_000, isolationLevel: opts?.isolationLevel });
  }

  async onModuleInit() {
    await this.base.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.base.$disconnect();
  }
}
