import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as jwt from '@nestjs/jwt';
import type { LoginDto, RegisterDto } from '@org/schemas';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { Role, User } from '../../../generated/prisma/client';
import jwtConfig from '../config/jwt.config';
import { HashingService } from '../hashing/hashing.service';
import type { ActiveUserData } from '../interfaces/active-user-data.interface';
import {
  InvalidatedRefreshTokenError,
  RefreshTokenIdsStorage,
} from './refresh-token-ids.storage';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: Role;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly jwtService: jwt.JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly refreshTokenIdsStorage: RefreshTokenIdsStorage,
  ) {}

  async signUp(dto: RegisterDto): Promise<IssuedTokens> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email déjà utilisé');
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: passwordHash,
      },
    });

    return this.generateTokens(user);
  }

  async signIn(dto: LoginDto): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const valid = await this.hashingService.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(presentedRefreshToken: string): Promise<IssuedTokens> {
    try {
      const { sub, refreshTokenId } = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'sub'> & { refreshTokenId: string }
      >(presentedRefreshToken, {
        secret: this.jwtConfiguration.refreshSecret,
      });
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: sub },
      });
      await this.refreshTokenIdsStorage.validate(user.id, refreshTokenId);
      await this.refreshTokenIdsStorage.invalidate(user.id);
      return this.generateTokens(user);
    } catch (err) {
      if (err instanceof InvalidatedRefreshTokenError) {
        // Token déjà consommé ou révoqué : potentiel vol de token côté client.
        throw new UnauthorizedException('Accès refusé');
      }
      throw new UnauthorizedException();
    }
  }

  async signOut(userId: string): Promise<void> {
    await this.refreshTokenIdsStorage.invalidate(userId);
  }

  private async generateTokens(user: User): Promise<IssuedTokens> {
    const refreshTokenId = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken<Pick<ActiveUserData, 'email' | 'role'>>(
        user.id,
        this.jwtConfiguration.accessTokenTtl,
        this.jwtConfiguration.secret,
        { email: user.email, role: user.role },
      ),
      this.signToken<{ refreshTokenId: string }>(
        user.id,
        this.jwtConfiguration.refreshTokenTtl,
        this.jwtConfiguration.refreshSecret,
        { refreshTokenId },
      ),
    ]);
    await this.refreshTokenIdsStorage.insert(user.id, refreshTokenId);
    return {
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private signToken<T extends object>(
    userId: string,
    expiresIn: string | undefined,
    secret: string | undefined,
    payload: T,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, ...payload },
      { secret, expiresIn: expiresIn as never },
    );
  }
}
