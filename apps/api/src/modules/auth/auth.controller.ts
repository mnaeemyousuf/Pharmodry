import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { loadConfig } from '../../config/env';
import { AuthPrincipal, CurrentUser, Public } from '../../common/auth-user';
import { UnauthorizedError } from '../../common/errors';
import { AuthService, IssuedTokens } from './auth.service';

class LoginDto {
  @ApiProperty({ example: 'qa.manager@novacure.pk' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty() @IsString() @MinLength(10) newPassword: string;
}

const REFRESH_COOKIE = 'pmd_rt';
/** Cookie name used before the Pharmodry rebrand; still read so existing sessions survive the upgrade, then cleared. */
const LEGACY_REFRESH_COOKIE = 'p360_rt';
/** Anti-CSRF header values. The pre-rebrand value stays accepted for existing API clients. */
const CSRF_HEADER_VALUES = new Set(['pharmodry', 'pharma360']);

/**
 * Access tokens are returned in the body and kept in memory by the SPA.
 * The refresh token lives in an httpOnly, SameSite=Strict cookie scoped to /api/v1/auth.
 * Refresh/logout additionally require the X-Requested-With header (CSRF defence).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cfg = loadConfig();
  constructor(private readonly auth: AuthService) {}

  private setCookie(res: Response, t: IssuedTokens) {
    res.cookie(REFRESH_COOKIE, t.refreshToken, {
      httpOnly: true,
      secure: this.cfg.cookieSecure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      expires: t.refreshExpiresAt,
    });
    res.clearCookie(LEGACY_REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  private requireCsrfHeader(req: Request) {
    if (!CSRF_HEADER_VALUES.has(String(req.headers['x-requested-with'] ?? ''))) throw new UnauthorizedError('Missing anti-CSRF header');
  }

  @Public()
  @Throttle({ default: { limit: Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE ?? 10), ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = await this.auth.login(dto.email, dto.password, { ip: req.ip, userAgent: req.headers['user-agent'] });
    this.setCookie(res, t);
    return { accessToken: t.accessToken, expiresIn: t.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: Number(process.env.REFRESH_RATE_LIMIT_PER_MINUTE ?? 300), ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.requireCsrfHeader(req);
    const cookies = req.cookies as Record<string, string> | undefined;
    const raw = cookies?.[REFRESH_COOKIE] ?? cookies?.[LEGACY_REFRESH_COOKIE] ?? (req.headers['x-refresh-token'] as string | undefined);
    try {
      const t = await this.auth.refresh(raw, { ip: req.ip, userAgent: req.headers['user-agent'] });
      this.setCookie(res, t);
      return { accessToken: t.accessToken, expiresIn: t.expiresIn };
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.clearCookie(LEGACY_REFRESH_COOKIE, { path: '/api/v1/auth' });
      throw e;
    }
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthPrincipal, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.requireCsrfHeader(req);
    await this.auth.logout(user);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.clearCookie(LEGACY_REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@CurrentUser() user: AuthPrincipal) {
    return this.auth.sessions(user);
  }

  @ApiBearerAuth()
  @Delete('sessions/:familyId')
  async revoke(@CurrentUser() user: AuthPrincipal, @Param('familyId', ParseUUIDPipe) familyId: string) {
    await this.auth.revokeSession(user, familyId);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthPrincipal, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }
}
