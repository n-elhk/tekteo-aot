import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const CV_IMPORT_QUEUE = 'cv-import';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
        const parsed = new URL(url);
        return {
          connection: {
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
            password: parsed.password || undefined,
            username: parsed.username || undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: CV_IMPORT_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
