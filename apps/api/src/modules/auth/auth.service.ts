import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { StringValue } from 'ms';
import type { LoginDto, RegisterDto } from '@org/schemas';
import { PrismaService } from '../../common/prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

/**
 * SHA-256 hash a refresh token before storing it.
 * We do NOT use bcrypt here because:
 * 1. Refresh tokens are already cryptographically random (256+ bits of entropy)
 * 2. bcrypt has a 72-byte input limit — JWT tokens often exceed this and
 *    different tokens with identical first 72 bytes (same header) would
 *    compare as equal, which is a security flaw.
 */
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const safeCompareHash = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email déjà utilisé');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: passwordHash,
      },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(userId: string, presentedRefreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException();
    }

    const presentedHash = hashToken(presentedRefreshToken);
    if (!safeCompareHash(presentedHash, user.refreshToken)) {
      throw new UnauthorizedException();
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async issueTokens(userId: string, email: string, role: Role) {
    const payload = { sub: userId, email, role };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_TTL',
        '7d',
      ) as StringValue,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashToken(refreshToken) },
    });

    return { accessToken, refreshToken, userId, email, role };
  }
}
