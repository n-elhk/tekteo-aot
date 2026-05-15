import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Levée quand un refresh token présenté ne correspond pas à celui en cache —
 * permet d'identifier les tentatives de réutilisation (potentiellement
 * du vol de token) côté `AuthenticationService`.
 */
export class InvalidatedRefreshTokenError extends Error {}

/**
 * Persistance Redis des identifiants de refresh token actifs.
 *
 * Pour chaque utilisateur on garde le `refreshTokenId` (UUID) du dernier
 * refresh token émis. Lors du `refresh`, on vérifie que l'ID présenté
 * correspond bien à celui stocké : sinon, le token a été révoqué ou réutilisé.
 */
@Injectable()
export class RefreshTokenIdsStorage
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private redisClient!: Redis;

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redisClient = new Redis(url);
  }

  onApplicationShutdown() {
    return this.redisClient.quit();
  }

  async insert(userId: string, tokenId: string): Promise<void> {
    await this.redisClient.set(this.getKey(userId), tokenId);
  }

  async validate(userId: string, tokenId: string): Promise<boolean> {
    const storedId = await this.redisClient.get(this.getKey(userId));
    if (storedId !== tokenId) {
      throw new InvalidatedRefreshTokenError();
    }
    return true;
  }

  async invalidate(userId: string): Promise<void> {
    await this.redisClient.del(this.getKey(userId));
  }

  private getKey(userId: string): string {
    return `user-${userId}`;
  }
}
