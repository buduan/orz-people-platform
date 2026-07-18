import { resolve } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/environment';
import { DeliveryModule } from './delivery/delivery.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
      validate: validateEnvironment,
    }),
    PrismaModule,
    RedisModule,
    DeliveryModule,
  ],
})
export class WorkerModule {}
