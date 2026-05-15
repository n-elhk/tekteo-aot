import { registerAs } from '@nestjs/config';
import type { StringValue } from 'ms';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenTtl: (process.env.JWT_ACCESS_TTL ?? '15m') as StringValue,
  refreshTokenTtl: (process.env.JWT_REFRESH_TTL ?? '7d') as StringValue,
}));
