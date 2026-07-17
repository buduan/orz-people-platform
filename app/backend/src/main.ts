import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  const openApiConfig = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Orz People Platform API')
    .setDescription('HTTP API for the Orz People Platform.')
    .setVersion('0.1.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);

  SwaggerModule.setup('docs', app, openApiDocument, {
    customSiteTitle: 'Orz People Platform API Docs',
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
  });

  app.enableShutdownHooks();
  await app.listen(port);
  Logger.log(`Backend listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger UI available at http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, 'Bootstrap');
});
