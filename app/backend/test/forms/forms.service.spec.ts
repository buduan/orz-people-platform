import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DatasetFieldKind,
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

import type { AuthenticatedActor } from '@weave/types';

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
    const datasets = {
      list: vi.fn().mockResolvedValue({
        items: [{ id: 'dataset-1' }],
        canCreate: false,
      }),
    };
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

function publicForm(overrides: Record<string, unknown> = {}) {
  return {
    id: 'form-public',
    workspaceId: 42,
    datasetId: 'dataset-public',
    slug: 'not-used-for-public-lookup',
    status: FormStatus.active,
    dataset: { status: DatasetStatus.active },
    activeVersion: {
      id: 'version-public',
      version: 3,
      state: FormVersionState.published,
      defaultLocale: 'zh-CN',
      nameI18n: { 'zh-CN': '公开表单', en: 'Public Form' },
      descriptionI18n: { 'zh-CN': '说明' },
      closingMessageI18n: null,
      opensAt: null,
      closesAt: null,
      submissionAccess: FormSubmissionAccess.anonymous_allowed,
      writeMode: FormWriteMode.create_row,
      schema: { type: 'object', properties: {} },
      schemaChecksum: 'internal-checksum',
      revision: 9,
    },
    ...overrides,
  };
}

function publicService(prisma: object): FormsService {
  return new FormsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('Published Form filling projection', () => {
  it('loads a published Form by global ID outside Workspace 1 without exposing management data', async () => {
    const prisma = { form: { findUnique: vi.fn().mockResolvedValue(publicForm()) } };

    const result = await publicService(prisma).getPublished('form-public');

    expect(prisma.form.findUnique).toHaveBeenCalledWith({
      where: { id: 'form-public' },
      include: { activeVersion: true, dataset: true },
    });
    expect(result).toMatchObject({
      id: 'form-public',
      version: 3,
      defaultLocale: 'zh-CN',
      acceptingSubmissions: true,
      unavailableReason: null,
      submissionContext: null,
    });
    expect(result).not.toHaveProperty('slug');
    expect(result).not.toHaveProperty('schemaChecksum');
    expect(result).not.toHaveProperty('revision');
  });

  it.each([
    [
      publicForm({
        activeVersion: {
          ...publicForm().activeVersion,
          opensAt: new Date('2999-01-01T00:00:00.000Z'),
        },
      }),
      'not_started',
    ],
    [publicForm({ status: FormStatus.closed }), 'closed'],
    [publicForm({ dataset: { status: DatasetStatus.archived } }), 'inactive'],
  ])('reports unavailable published states without hiding the definition', async (record, reason) => {
    const result = await publicService({
      form: { findUnique: vi.fn().mockResolvedValue(record) },
    }).getPublished('form-public');

    expect(result).toMatchObject({
      acceptingSubmissions: false,
      unavailableReason: reason,
    });
  });

  it('returns not found for archived Forms and missing published releases', async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce(publicForm({ status: FormStatus.archived }))
      .mockResolvedValueOnce(publicForm({ activeVersion: null }));
    const forms = publicService({ form: { findUnique } });

    await expect(forms.getPublished('archived')).rejects.toBeInstanceOf(NotFoundException);
    await expect(forms.getPublished('unpublished')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters relation rows from declared values and returns only opaque IDs/string labels', async () => {
    const countryItemId = 'q_00000000-0000-4000-8000-000000000001';
    const cityItemId = 'q_00000000-0000-4000-8000-000000000002';
    const record = publicForm({
      activeVersion: {
        ...publicForm().activeVersion,
        schema: {
          type: 'object',
          properties: {
            [cityItemId]: {
              type: 'string',
              'x-form': {
                datasetFieldId: 'field-city',
                ui: {
                  widget: 'dataset-select',
                  options: {
                    labelFieldId: 'field-label',
                    filter: {
                      all: [{
                        fieldId: 'field-country',
                        operator: 'equals',
                        valueFrom: countryItemId,
                      }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const prisma = {
      form: { findUnique: vi.fn().mockResolvedValue(record) },
      datasetField: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'field-city',
          datasetId: 'dataset-public',
          archivedAt: null,
          kind: DatasetFieldKind.relation,
          relationTargetDatasetId: 'dataset-cities',
        }),
      },
      datasetRow: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'row-beijing', values: { 'field-country': 'CN', 'field-label': '北京' } },
          { id: 'row-paris', values: { 'field-country': 'FR', 'field-label': 'Paris' } },
        ]),
      },
    };

    const result = await publicService(prisma).relationOptions(
      'form-public',
      cityItemId,
      JSON.stringify({ [countryItemId]: 'CN' }),
      10,
    );

    expect(result).toEqual([{ id: 'row-beijing', label: '北京' }]);
    expect(result[0]).toEqual({ id: 'row-beijing', label: '北京' });
  });
});
