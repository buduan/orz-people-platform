import { resolve } from 'node:path';

import { MiddlewareConsumer, Module } from '@nestjs/common';
import type { NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AccessModule } from './access/access.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { PlatformConfigModule } from './config/platform-config.module';
import { validateEnvironment } from './config/environment';
import { DeliveryModule } from './delivery/delivery.module';
import { FormsModule } from './forms/forms.module';
import { HealthModule } from './health/health.module';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { ApiSuccessInterceptor } from './http/api-success.interceptor';
import { RequestContextMiddleware } from './http/request-context.middleware';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      expandVariables: true,
      isGlobal: true,
      // Commands run from app/backend, while containers keep a conventional /app/.env.
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
      validate: validateEnvironment,
    }),
    ObservabilityModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    WorkspacesModule,
    AccessModule,
    FormsModule,
    SubmissionsModule,
    WorkflowsModule,
    DeliveryModule,
    PlatformConfigModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RequestContextMiddleware,
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiSuccessInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
