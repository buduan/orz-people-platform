import { ConflictException } from '@nestjs/common';
import {
  DatasetStatus,
  DatasetSubjectMode,
  DatasetType,
  FormStatus,
  FormSubmissionAccess,
  FormVersionState,
  FormWriteMode,
} from '@prisma/client';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AuthenticatedActor } from '@orz-people-platform/types';

import { FormsService } from '../../src/forms/forms.service';

const actor: AuthenticatedActor = {
  userId: 'admin-1',
  workspaceId: 1,
  sessionId: 'session-1',
  permissions: [],
  isSystemAdmin: false,
  isWorkspaceAdmin: true,
};

describe('Form publication', () => {
  it('does not replace the active version when draft CAS fails', async () => {
    const form = {
      id: 'form-1',
      workspaceId: 1,
      datasetId: 'dataset-1',
      status: FormStatus.active,
      activeVersionId: 'published-1',
    };
    const tx = {
      dataset: { findMany: vi.fn().mockResolvedValue([]) },
      datasetField: { findMany: vi.fn().mockResolvedValue([]) },
      form: { update: vi.fn() },
      formVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'draft-2',
          formId: 'form-1',
          state: FormVersionState.draft,
          version: 2,
          revision: 2,
          defaultLocale: 'en',
          nameI18n: { en: 'Form' },
          descriptionI18n: null,
          closingMessageI18n: null,
          opensAt: null,
          closesAt: null,
          submissionAccess: FormSubmissionAccess.anonymous_allowed,
          writeMode: FormWriteMode.create_row,
          schema: {},
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      form: { findUnique: vi.fn().mockResolvedValue(form) },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const datasets = {
      assertCanManage: vi.fn().mockResolvedValue({
        id: 'dataset-1',
        status: DatasetStatus.active,
        subjectMode: DatasetSubjectMode.none,
        type: DatasetType.standard,
      }),
    };
    const service = new FormsService(
      prisma as never,
      datasets as never,
      { validate: vi.fn() } as never,
      {} as never,
    );

    await expect(service.publish(1, 'form-1', 1, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.form.update).not.toHaveBeenCalled();
  });
});
