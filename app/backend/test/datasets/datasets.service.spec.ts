import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  DatasetCollaboratorRole,
  DatasetFieldKind,
  DatasetStatus,
  MemberStatus,
} from '@prisma/client';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AuthenticatedActor } from '@orz-people-platform/types';

import { DatasetsService } from '../../src/datasets/datasets.service';

const actor: AuthenticatedActor = {
  userId: 'admin-1',
  workspaceId: 1,
  sessionId: 'session-1',
  permissions: ['dataset.manage_all'],
  isSystemAdmin: false,
  isWorkspaceAdmin: true,
};

function createService(prisma: object): DatasetsService {
  return new DatasetsService(
    prisma as never,
    { record: vi.fn() } as never,
    {} as never,
  );
}

describe('Dataset mutation invariants', () => {
  it('protects the final owner of an active Dataset', async () => {
    const tx = {
      dataset: { findUniqueOrThrow: vi.fn().mockResolvedValue({ status: DatasetStatus.active }) },
      datasetCollaborator: {
        count: vi.fn().mockResolvedValue(0),
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ role: DatasetCollaboratorRole.owner }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      dataset: { findUnique: vi.fn().mockResolvedValue({ id: 'dataset-1', workspaceId: 1 }) },
    };

    await expect(createService(prisma).removeCollaborator(
      1,
      'dataset-1',
      'member-1',
      actor,
    )).rejects.toBeInstanceOf(ConflictException);
    expect(tx.datasetCollaborator.delete).not.toHaveBeenCalled();
  });

  it('rejects a collaborator from another Workspace', async () => {
    const prisma = {
      dataset: { findUnique: vi.fn().mockResolvedValue({ id: 'dataset-1', workspaceId: 1 }) },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-2',
          workspaceId: 2,
          status: MemberStatus.active,
        }),
      },
    };

    await expect(createService(prisma).addCollaborator(1, 'dataset-1', {
      workspaceMemberId: 'member-2',
      role: DatasetCollaboratorRole.maintainer,
    }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stale Dataset metadata revisions before creating history', async () => {
    const tx = {
      dataset: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      dataset: { findUnique: vi.fn().mockResolvedValue({ id: 'dataset-1', workspaceId: 1 }) },
    };

    await expect(createService(prisma).update(1, 'dataset-1', {
      expectedRevision: 1,
      name: 'New name',
    }, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects field creation by a non-manager', async () => {
    const restrictedActor: AuthenticatedActor = {
      ...actor,
      isWorkspaceAdmin: false,
      permissions: [],
    };
    const prisma = {
      dataset: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'dataset-1',
          workspaceId: 1,
          status: DatasetStatus.active,
        }),
      },
      workspaceMember: { findUnique: vi.fn().mockResolvedValue({ id: 'member-1' }) },
      datasetCollaborator: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    await expect(createService(prisma).createField(1, 'dataset-1', {
      key: 'nickname',
      name: 'Nickname',
      kind: DatasetFieldKind.text,
      valueSchema: { type: 'string' },
      config: {},
      required: false,
    }, restrictedActor)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
