import { BadRequestException } from '@nestjs/common';
import { DatasetFieldKind } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { DatasetSchemaService } from '../../src/datasets/dataset-schema.service';

function field(overrides: Record<string, unknown> = {}) {
  return {
    id: 'field-1',
    workspaceId: 1,
    datasetId: 'dataset-1',
    key: 'name',
    name: 'Name',
    description: null,
    kind: DatasetFieldKind.text,
    valueSchema: { type: 'string', maxLength: 4 },
    config: {},
    required: true,
    isSystemManaged: false,
    systemKey: null,
    relationTargetDatasetId: null,
    relationCardinality: null,
    position: 0,
    revision: 1,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Dataset row Schema validation', () => {
  const service = new DatasetSchemaService();

  it('rejects unknown and protected fields', () => {
    expect(() => service.validateRow([field() as never], {
      values: { unknown: 'value' },
      relations: {},
    })).toThrow(BadRequestException);
    expect(() => service.validateRow([
      field({ isSystemManaged: true }) as never,
    ], {
      values: { 'field-1': 'value' },
      relations: {},
    })).toThrow('System-managed field is not writable');
  });

  it('uses the standard JSON Schema constraints on field values', () => {
    expect(() => service.validateRow([field() as never], {
      values: { 'field-1': 'too long' },
      relations: {},
    })).toThrow('Invalid value for Dataset field');
    expect(service.validateRow([field() as never], {
      values: { 'field-1': 'Orz' },
      relations: {},
    }).values).toEqual({ 'field-1': 'Orz' });
  });
});
