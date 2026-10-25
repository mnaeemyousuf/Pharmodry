import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthPrincipal, CurrentUser, RequirePermissions } from '../../common/auth-user';
import { LlmRegistry } from '../../infrastructure/llm/llm.provider';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SuppliersModule } from '../suppliers/suppliers';
import { AiService } from './ai.service';
import { CopilotTools } from './copilot.tools';

class AskDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) question: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() conversationId?: string;
}
class FeedbackDto {
  @ApiProperty({ enum: ['UP', 'DOWN'] }) @IsIn(['UP', 'DOWN']) rating: 'UP' | 'DOWN';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
class CapaDraftDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() deviationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() oosId?: string;
}

/**
 * AI endpoints. All are read-only with respect to regulated records: they never call
 * a mutating domain service. Suggestions must be accepted by a user through normal workflows.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return this.ai.status();
  }

  @Post('copilot/ask')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermissions('ai.copilot.use')
  ask(@CurrentUser() u: AuthPrincipal, @Body() dto: AskDto) {
    return this.ai.ask(u, dto.question, dto.conversationId);
  }

  @Get('copilot/conversations')
  @RequirePermissions('ai.copilot.use')
  conversations(@CurrentUser() u: AuthPrincipal) {
    return this.ai.conversations(u);
  }

  @Post('messages/:id/feedback')
  @HttpCode(200)
  feedback(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FeedbackDto) {
    return this.ai.feedback(u, id, dto.rating, dto.comment);
  }

  @Post('deviations/:id/assist')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('ai.assist.use')
  deviationAssist(@CurrentUser() u: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.ai.deviationAssist(u, id);
  }

  @Post('capa/draft')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('ai.assist.use')
  capaDraft(@CurrentUser() u: AuthPrincipal, @Body() dto: CapaDraftDto) {
    return this.ai.capaDraft(u, dto);
  }

  @Get('usage')
  @RequirePermissions('ai.admin')
  usage() {
    return this.ai.usage();
  }
}

@Module({ imports: [AnalyticsModule, SuppliersModule], controllers: [AiController], providers: [AiService, CopilotTools, LlmRegistry], exports: [LlmRegistry] })
export class AiModule {}
