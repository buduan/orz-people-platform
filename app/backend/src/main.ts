import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ApiResponseInterceptor } from './api-response.interceptor';
import { isCorsOriginAllowed } from './cors';
import { HttpExceptionFilter } from './http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') ?? 3000);
  const apiOrigin = config.get<string>('API_ORIGIN') || `http://localhost:${port}`;
  const appOrigin = config.get<string>('APP_ORIGIN');
  const isDevelopment = (config.get<string>('NODE_ENV') || 'development') === 'development';
  const corsOrigin: CustomOrigin = (origin, callback) => {
    callback(null, isCorsOriginAllowed(origin, appOrigin, isDevelopment));
  };

  app.enableCors({
    origin: corsOrigin,
  });

  const openApiConfig = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Orz People Platform API')
    .setDescription('HTTP API for the Orz People Platform.')
    .setVersion('0.1.0')
    .addServer(apiOrigin)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup('docs', app, openApiDocument, {
    customSiteTitle: 'Orz People Platform API Docs',
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
  });

  app.useGlobalPipes(new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }));
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(port);
  Logger.log(`Backend listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger UI available at ${apiOrigin.replace(/\/$/, '')}/docs`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Bootstrap');
});
