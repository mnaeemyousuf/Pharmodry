import { Injectable, Logger } from '@nestjs/common';
import type { NotificationEvent, NotificationSeverity, PermissionCode } from '@pharmodry/types';
import { PrismaService, Tx } from '../../infrastructure/prisma/prisma.service';

export interface NotifyInput {
  tenantId: string;
  event: NotificationEvent;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  /** Explicit recipients and/or everyone holding a permission (optionally at a site). */
  userIds?: string[];
  permission?: PermissionCode;
  siteId?: string | null;
  /** Prevents duplicates for recurring scans, e.g. `expiry30:<lotId>`. */
  dedupeKey?: string;
}

/** Delivery channel abstraction. In-app is persisted; email is architecture-ready (logs only). */
export interface NotificationChannel {
  name: string;
  deliver(n: { userId: string; title: string; body: string; link?: string }): Promise<void>;
}

@Injectable()
export class EmailChannel implements NotificationChannel {
  name = 'email';
  private readonly logger = new Logger('EmailChannel');
  async deliver(n: { userId: string; title: string; body: string; link?: string }) {
    // SMTP / Azure Communication Services adapter plugs in here (post-MVP).
    this.logger.debug(`email queued for ${n.userId}: ${n.title}`);
  }
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailChannel,
  ) {}

  async recipients(tx: Tx, tenantId: string, permission: PermissionCode, siteId?: string | null): Promise<string[]> {
    const rows = await tx.userRole.findMany({
      where: {
        tenantId,
        user: { status: 'ACTIVE' },
        role: { permissions: { some: { permission: { code: permission } } } },
        ...(siteId ? { OR: [{ siteId: null }, { siteId }] } : {}),
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  async notify(tx: Tx, n: NotifyInput) {
    const ids = new Set(n.userIds ?? []);
    if (n.permission) (await this.recipients(tx, n.tenantId, n.permission, n.siteId)).forEach((id) => ids.add(id));
    if (ids.size === 0) return 0;
    const prefs = await tx.notificationPreference.findMany({ where: { tenantId: n.tenantId, event: n.event, userId: { in: [...ids] } } });
    const muted = new Set(prefs.filter((p) => !p.inApp).map((p) => p.userId));
    const emailUsers = new Set(prefs.filter((p) => p.email).map((p) => p.userId));
    const targets = [...ids].filter((id) => !muted.has(id));
    const res = await tx.notification.createMany({
      data: targets.map((userId) => ({
        tenantId: n.tenantId,
        userId,
        event: n.event,
        severity: n.severity ?? 'INFO',
        title: n.title,
        body: n.body,
        entityType: n.entityType,
        entityId: n.entityId,
        link: n.link,
        dedupeKey: n.dedupeKey,
      })),
      skipDuplicates: true,
    });
    for (const userId of emailUsers) await this.email.deliver({ userId, title: n.title, body: n.body, link: n.link });
    return res.count;
  }

  list(userId: string, unreadOnly: boolean, take = 50) {
    return this.prisma.db.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.db.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids: string[] | 'all') {
    const res = await this.prisma.db.notification.updateMany({
      where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  preferences(userId: string) {
    return this.prisma.db.notificationPreference.findMany({ where: { userId } });
  }

  async setPreference(tenantId: string, userId: string, event: string, inApp: boolean, email: boolean) {
    return this.prisma.db.notificationPreference.upsert({
      where: { userId_event: { userId, event } },
      create: { tenantId, userId, event, inApp, email },
      update: { inApp, email },
    });
  }
}
