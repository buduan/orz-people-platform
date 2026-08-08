import { BadRequestException, ConflictException } from '@nestjs/common';
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

import { FormDefinitionValidatorService } from '../../src/forms/form-definition-validator.service';
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
      {
        get: vi.fn().mockResolvedValue(JSON.stringify({
          userId: actor.userId,
          holderName: 'Admin',
          lockedAt: new Date().toISOString(),
          token: 'lock-token',
        })),
      } as never,
    );

    await expect(service.publish(1, 'form-1', 1, actor, 'lock-token')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.form.update).not.toHaveBeenCalled();
  });
});

describe('Form panel projection and edit locks', () => {
  it('filters the main list to visible active/closed Forms and projects draft metadata', async () => {
    const now = new Date('2026-08-08T08:00:00.000Z');
    const prisma = {
      form: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'form-1',
          workspaceId: 1,
          datasetId: 'dataset-1',
          slug: 'employee-form',
          status: FormStatus.active,
          activeVersionId: null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          createdBy: {
            id: 'admin-1',
            name: 'Administrator',
            nickname: 'Admin',
            username: 'admin',
          },
          activeVersion: null,
          versions: [{
            id: 'draft-1',
            formId: 'form-1',
            version: 1,
            state: FormVersionState.draft,
            defaultLocale: 'zh-CN',
            nameI18n: { 'zh-CN': '员工表单' },
            descriptionI18n: null,
            closingMessageI18n: null,
            opensAt: null,
            closesAt: null,
            submissionAccess: FormSubmissionAccess.anonymous_allowed,
            writeMode: FormWriteMode.create_row,
            schema: {},
            schemaChecksum: 'checksum',
            revision: 1,
            createdByUserId: 'admin-1',
            publishedByUserId: null,
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
          }],
        }]),
      },
    };
    const datasets = { list: vi.fn().mockResolvedValue([{ id: 'dataset-1' }]) };
    const service = new FormsService(
      prisma as never,
      datasets as never,
      {} as never,
      {} as never,
      { mget: vi.fn().mockResolvedValue([null]) } as never,
    );

    const result = await service.list(1, actor);

    expect(prisma.form.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        datasetId: { in: ['dataset-1'] },
        status: { in: [FormStatus.active, FormStatus.closed] },
      }),
    }));
    expect(result[0]).toMatchObject({
      title: '员工表单',
      hasDraft: true,
      hasRelease: false,
      creator: { displayName: 'Admin' },
      lock: { locked: false },
    });
  });

  it('reports a safe holder when edit-lock acquisition conflicts', async () => {
    const prisma = {
      form: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'form-1',
          workspaceId: 1,
          datasetId: 'dataset-1',
          status: FormStatus.active,
        }),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ nickname: 'Admin' }) },
    };
    const redis = {
      set: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(JSON.stringify({
        userId: 'other-user',
        holderName: 'Another editor',
        lockedAt: new Date().toISOString(),
        token: 'other-token',
      })),
    };
    const service = new FormsService(
      prisma as never,
      { assertCanManage: vi.fn().mockResolvedValue({ id: 'dataset-1' }) } as never,
      {} as never,
      {} as never,
      redis as never,
    );

    await expect(service.acquireEditLock(1, 'form-1', actor))
      .rejects.toThrow('Form is being edited by Another editor');
  });

  it('rejects an expired lock heartbeat', async () => {
    const service = new FormsService(
      {
        form: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'form-1',
            workspaceId: 1,
            datasetId: 'dataset-1',
            status: FormStatus.active,
          }),
        },
      } as never,
      { assertCanManage: vi.fn().mockResolvedValue({ id: 'dataset-1' }) } as never,
      {} as never,
      {} as never,
      { eval: vi.fn().mockResolvedValue(0) } as never,
    );

    await expect(service.heartbeatEditLock(1, 'form-1', 'expired-token', actor))
      .rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Form definition validation', () => {
  it('rejects an invalid JSON Schema before persistence', () => {
    const validator = new FormDefinitionValidatorService();
    expect(() => validator.validate({ type: 'string' }, {
      dataset: {
        id: 'dataset-1',
        subjectMode: DatasetSubjectMode.none,
        type: DatasetType.standard,
      },
      fields: [],
      targetDatasets: [],
      submissionAccess: FormSubmissionAccess.anonymous_allowed,
      writeMode: FormWriteMode.create_row,
    })).toThrow(BadRequestException);
  });
});
