import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as jwt from '@nestjs/jwt';
import jwtConfig from '../../config/jwt.config';
import type { ActiveUserData } from '../../interfaces/active-user-data.interface';
import type { AuthedRequest } from '../../interfaces/authed-request.interface';

/**
 * Guard d'accès qui lit l'access token depuis le **cookie httpOnly**
 * `access_token` (et non depuis l'en-tête `Authorization` comme dans
 * la doc NestJS) puis le vérifie via `JwtService`.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: jwt.JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.cookies?.['access_token'];

    if (!token) {
      throw new UnauthorizedException('Access token manquant');
    }

    try {
      const payload = await this.jwtService.verifyAsync<ActiveUserData>(token, {
        secret: this.jwtConfiguration.secret,
      });
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Access token invalide ou expiré');
    }
    return true;
  }
}
