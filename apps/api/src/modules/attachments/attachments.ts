import { Controller, Get, Inject, Injectable, Module, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { PermissionCode } from '@pharmodry/types';
import type { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { memoryStorage } from 'multer';
import { loadConfig } from '../../config/env';
import { AuthPrincipal, CurrentUser, Public } from '../../common/auth-user';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LocalStorageProvider, STORAGE, StorageProvider } from '../../infrastructure/storage/storage.provider';
import { AuditService } from '../audit/audit.service';

/** Entity types that accept evidence attachments, and the permission needed to view/attach. */
const ENTITY_PERMS: Record<string, { view: PermissionCode; attach: PermissionCode; model: string }> = {
  Deviation: { view: 'deviation.view', attach: 'deviation.create', model: 'deviation' },
  Capa: { view: 'capa.view', attach: 'capa.manage', model: 'capa' },
  OosInvestigation: { view: 'oos.view', attach: 'oos.investigate', model: 'oosInvestigation' },
  Batch: { view: 'batch.view', attach: 'batch.execute', model: 'batch' },
  GoodsReceipt: { view: 'inventory.view', attach: 'inventory.receive', model: 'goodsReceipt' },
  Supplier: { view: 'supplier.view', attach: 'supplier.manage', model: 'supplier' },
};

const ALLOWED: Record<string, { mimes: string[]; magic?: number[] }> = {
  '.pdf': { mimes: ['application/pdf'], magic: [0x25, 0x50, 0x44, 0x46] },
  '.png': { mimes: ['image/png'], magic: [0x89, 0x50, 0x4e, 0x47] },
  '.jpg': { mimes: ['image/jpeg'], magic: [0xff, 0xd8, 0xff] },
  '.jpeg': { mimes: ['image/jpeg'], magic: [0xff, 0xd8, 0xff] },
  '.xlsx': { mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], magic: [0x50, 0x4b, 0x03, 0x04] },
  '.docx': { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: [0x50, 0x4b, 0x03, 0x04] },
  '.csv': { mimes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'] },
  '.txt': { mimes: ['text/plain'] },
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}

  private async assertEntity(user: AuthPrincipal, entityType: string, entityId: string, mode: 'view' | 'attach') {
    const cfg = ENTITY_PERMS[entityType];
    if (!cfg) throw new ValidationError(`Attachments are not supported for ${entityType}`);
    if (!user.has(cfg[mode])) throw new ForbiddenError(`Missing permission ${cfg[mode]}`);
    const delegate = (this.prisma.db as unknown as Record<string, { findFirst: (a: unknown) => Promise<unknown> }>)[cfg.model];
    if (!(await delegate.findFirst({ where: { id: entityId } }))) throw new NotFoundError(entityType, entityId);
  }

  async list(user: AuthPrincipal, entityType: string, entityId: string) {
    await this.assertEntity(user, entityType, entityId, 'view');
    return this.prisma.db.attachment.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'desc' } });
  }

  /** Validates extension, declared MIME type, magic bytes and size; stores immutably with SHA-256. */
  async upload(user: AuthPrincipal, entityType: string, entityId: string, file?: Express.Multer.File) {
    await this.assertEntity(user, entityType, entityId, 'attach');
    if (!file) throw new ValidationError('No file uploaded');
    const ext = extname(file.originalname).toLowerCase();
    const rule = ALLOWED[ext];
    if (!rule || !rule.mimes.includes(file.mimetype)) throw new ValidationError(`File type not allowed (${ext || 'none'}, ${file.mimetype}). Allowed: ${Object.keys(ALLOWED).join(', ')}`);
    if (rule.magic && !rule.magic.every((b, i) => file.buffer[i] === b)) throw new ValidationError('File content does not match its extension');
    if (file.size === 0) throw new ValidationError('File is empty');
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const key = `${user.tenantId}/${entityType}/${entityId}/${randomUUID()}${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    return this.prisma.transaction(async (tx) => {
      const a = await tx.attachment.create({
        data: { tenantId: user.tenantId, entityType, entityId, fileName: file.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 200), mimeType: file.mimetype, sizeBytes: file.size, storageKey: key, sha256, uploadedById: user.id },
      });
      await this.audit.record(tx, { entityType, entityId, action: 'UPDATE', next: { attachment: a.fileName, sha256 }, reason: 'Evidence attached' });
      return a;
    });
  }

  async download(user: AuthPrincipal, id: string) {
    const a = await this.prisma.db.attachment.findFirst({ where: { id } });
    if (!a) throw new NotFoundError('Attachment', id);
    await this.assertEntity(user, a.entityType, a.entityId, 'view');
    return { meta: a, data: await this.storage.get(a.storageKey) };
  }
}

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  // Declared before ':entityType/:entityId' so 'file/<id>' is not captured as entityType 'file'.
  @Get('file/:id')
  async download(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { meta, data } = await this.svc.download(u, id);
    res.setHeader('content-type', meta.mimeType);
    res.setHeader('content-disposition', `attachment; filename="${meta.fileName}"`);
    res.setHeader('x-content-type-options', 'nosniff');
    res.send(data);
  }

  @Get(':entityType/:entityId')
  list(@CurrentUser() u: AuthPrincipal, @Param('entityType') t: string, @Param('entityId', ParseUUIDPipe) id: string) {
    return this.svc.list(u, t, id);
  }

  @Post(':entityType/:entityId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: loadConfig().maxUploadBytes, files: 1 } }))
  upload(@CurrentUser() u: AuthPrincipal, @Param('entityType') t: string, @Param('entityId', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.svc.upload(u, t, id, file);
  }
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.base.$queryRaw`SELECT 1`;
    return { status: 'ok', time: new Date() };
  }
}

@Module({
  controllers: [AttachmentsController, HealthController],
  providers: [AttachmentsService, { provide: STORAGE, useClass: LocalStorageProvider }],
})
export class AttachmentsModule {}
