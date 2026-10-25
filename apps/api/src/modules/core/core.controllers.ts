import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { sendCsv, toCsv } from '../../common/csv';
import { ListQueryDto } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { SignatureService } from '../signatures/signature.service';

class AuditQueryDto extends ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() to?: string;
}

/** Read-only by design: there are no endpoints that modify audit events. */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @RequirePermissions('audit.view')
  list(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }

  @Get('verify')
  @RequirePermissions('audit.view')
  verify(@CurrentUser() user: AuthPrincipal) {
    return this.audit.verifyChain(user.tenantId);
  }

  @Get('export')
  @RequirePermissions('audit.export')
  async export(@Query() q: AuditQueryDto, @Res({ passthrough: true }) res: Response) {
    const page = await this.audit.list({ ...q, page: 1, pageSize: 5000 } as AuditQueryDto);
    await this.audit.recordStandalone({ entityType: 'AuditTrail', action: 'EXPORT', next: { filters: q, rows: page.data.length } });
    return sendCsv(
      res,
      `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(page.data, [
        { header: 'Seq', value: (r) => r.seq },
        { header: 'Timestamp (UTC)', value: (r) => r.occurredAt },
        { header: 'User', value: (r) => r.userName ?? r.userEmail },
        { header: 'Action', value: (r) => r.action },
        { header: 'Entity', value: (r) => r.entityType },
        { header: 'Record', value: (r) => r.entityLabel ?? r.entityId },
        { header: 'Previous value', value: (r) => r.previousValue },
        { header: 'New value', value: (r) => r.newValue },
        { header: 'Reason', value: (r) => r.reason },
        { header: 'Signature', value: (r) => r.signatureId },
        { header: 'IP', value: (r) => r.ip },
        { header: 'Correlation', value: (r) => r.correlationId },
        { header: 'Hash', value: (r) => r.hash },
      ]),
    );
  }
}

@ApiTags('signatures')
@ApiBearerAuth()
@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signatures: SignatureService) {}

  @Get(':entityType/:entityId')
  list(@Param('entityType') entityType: string, @Param('entityId', ParseUUIDPipe) entityId: string) {
    return this.signatures.forEntity(entityType, entityId);
  }
}

class MarkReadDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() ids?: string[];
}
class PreferenceDto {
  @IsString() event: string;
  @IsBoolean() inApp: boolean;
  @IsBoolean() email: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal, @Query('unread') unread?: string) {
    const [items, unreadCount] = await Promise.all([this.notifications.list(user.id, unread === 'true'), this.notifications.unreadCount(user.id)]);
    return { data: items, meta: { unread: unreadCount } };
  }

  @Post('read')
  @HttpCode(200)
  read(@CurrentUser() user: AuthPrincipal, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.id, dto.ids?.length ? dto.ids : 'all');
  }

  @Get('preferences')
  prefs(@CurrentUser() user: AuthPrincipal) {
    return this.notifications.preferences(user.id);
  }

  @Put('preferences')
  setPref(@CurrentUser() user: AuthPrincipal, @Body() dto: PreferenceDto) {
    return this.notifications.setPreference(user.tenantId, user.id, dto.event, dto.inApp, dto.email);
  }
}
