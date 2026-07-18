import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setOpenAPIVersion('3.1.0')
    .setTitle('Orz People Platform API')
    .setDescription('HTTP API for the Orz People Platform.')
    .setVersion('0.1.0')
    .build();

  return SwaggerModule.createDocument(app, configuration);
}

export function mountOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
    customSiteTitle: 'Orz People Platform API Docs',
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
  });
}
