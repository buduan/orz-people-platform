import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DatasetStatus,
  DatasetType,
  FormStatus,
  FormSubmissionAccess,
  FormSubmissionOperation,
  FormWriteMode,
} from '@prisma/client';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { checksumJson } from '@orz-people-platform/utils';

import { FormSubmissionsService } from '../../src/form-submissions/form-submissions.service';

const itemA = 'q_11111111-1111-4111-8111-111111111111';
const itemB = 'q_22222222-2222-4222-8222-222222222222';

function schema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      [itemA]: {
        type: 'string',
        enum: ['yes', 'no'],
        'x-form': { datasetFieldId: 'field-a' },
      },
      [itemB]: {
        type: 'string',
        'x-form': { datasetFieldId: 'field-b' },
      },
    },
    required: [itemA],
    if: { properties: { [itemA]: { const: 'yes' } }, required: [itemA] },
    then: { required: [itemB] },
    'x-form': {
      version: 1, datasetId: 'dataset-1', capture: {},
    },
  };
}

function form(access = FormSubmissionAccess.anonymous_allowed) {
  return {
    id: 'form-1',
    workspaceId: 1,
    datasetId: 'dataset-1',
    status: FormStatus.active,
    dataset: { status: DatasetStatus.active, type: DatasetType.standard },
    activeVersion: {
      id: 'version-1',
      opensAt: null,
      closesAt: null,
      submissionAccess: access,
      writeMode: FormWriteMode.create_row,
      schema: schema(),
    },
  };
}

function service(prisma: object) {
  return new FormSubmissionsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('Form submission validation and idempotency', () => {
  it('rejects anonymous access before processing answers when authentication is required', async () => {
    const prisma = {
      form: {
        findUnique: vi.fn().mockResolvedValue(
          form(FormSubmissionAccess.authentication_required),
        ),
      },
    };

    await expect(service(prisma).submitBySlug('form', { answers: {} }, undefined, null, {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces conditional required fields and rejects unknown properties', async () => {
    const prisma = {
      form: { findUnique: vi.fn().mockResolvedValue(form()) },
    };
    const submissions = service(prisma);

    await expect(submissions.submitBySlug('form', {
      answers: { [itemA]: 'yes' },
    }, undefined, null, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(submissions.submitBySlug('form', {
      answers: { [itemA]: 'no', unknown: true },
    }, undefined, null, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an identical idempotent result and conflicts on a changed payload', async () => {
    const payloadChecksum = await checksumJson({
      answers: { [itemA]: 'no' },
      expectedRevision: null,
    });
    const existing = {
      id: 'submission-1',
      formId: 'form-1',
      formVersionId: 'version-1',
      datasetId: 'dataset-1',
      rowId: 'row-1',
      rowVersionId: 'row-version-1',
      submitterUserId: null,
      operation: FormSubmissionOperation.created,
      payloadChecksum,
      submittedAt: new Date(),
    };
    const prisma = {
      form: { findUnique: vi.fn().mockResolvedValue(form()) },
      formSubmission: { findUnique: vi.fn().mockResolvedValue(existing) },
    };
    const submissions = service(prisma);

    await expect(submissions.submitBySlug('form', {
      answers: { [itemA]: 'no' },
    }, 'retry-1', null, {})).resolves.toMatchObject({ id: 'submission-1' });
    await expect(submissions.submitBySlug('form', {
      answers: { [itemA]: 'yes', [itemB]: 'changed' },
    }, 'retry-1', null, {})).rejects.toBeInstanceOf(ConflictException);
  });
});
