import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loginSchema,
  registerSchema,
  type LoginDto,
  type RegisterDto,
} from '@org/schemas';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type {
  AuthUser,
  AuthUserWithRefresh,
} from '../../common/types/auth.types';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const tokens = await this.auth.register(dto);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { id: tokens.userId, email: tokens.email, role: tokens.role };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const tokens = await this.auth.login(dto);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { id: tokens.userId, email: tokens.email, role: tokens.role };
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @CurrentUser() user: AuthUserWithRefresh,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const tokens = await this.auth.refresh(user.id, user.refreshToken);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.auth.logout(user.id);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(200)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  private setAuthCookies(
    res: FastifyReply,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };

    res.setCookie('access_token', accessToken, {
      ...base,
      path: '/',
      maxAge: 15 * 60, // 15 min en secondes
    });

    res.setCookie('refresh_token', refreshToken, {
      ...base,
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, // 7 jours en secondes
    });
  }
}
