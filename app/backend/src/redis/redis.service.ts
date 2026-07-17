import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  public constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    super(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.connect();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
