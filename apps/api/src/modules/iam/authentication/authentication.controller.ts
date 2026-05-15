import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  loginSchema,
  registerSchema,
  type LoginDto,
  type RegisterDto,
} from '@org/schemas';
import type { CookieOptions, Response } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ActiveUser } from '../decorators/active-user.decorator';
import type { ActiveUserData } from '../interfaces/active-user-data.interface';
import type { AuthedRequest } from '../interfaces/authed-request.interface';
import { AuthenticationService } from './authentication.service';
import { Auth } from './decorators/auth.decorator';
import { AuthType } from './enums/auth-type.enum';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth/refresh';
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 min
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours

@Auth(AuthType.None)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signUp(dto);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { id: tokens.userId, email: tokens.email, role: tokens.role };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signIn(dto);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { id: tokens.userId, email: tokens.email, role: tokens.role };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (!presented) {
      throw new UnauthorizedException('Refresh token manquant');
    }
    const tokens = await this.authService.refreshTokens(presented);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }

  @Auth(AuthType.Cookie)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @ActiveUser() user: ActiveUserData,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.signOut(user.sub);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Auth(AuthType.Cookie)
  @Post('me')
  @HttpCode(200)
  me(@ActiveUser() user: ActiveUserData) {
    return { id: user.sub, email: user.email, role: user.role };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const baseOptions: CookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
    };

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...baseOptions,
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...baseOptions,
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}
