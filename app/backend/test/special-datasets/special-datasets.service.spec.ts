import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  ActivityStatus,
  DatasetStatus,
  DatasetType,
  JoinRequestStatus,
} from '@prisma/client';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AuthenticatedActor } from '@orz-people-platform/types';

import { ActivitiesService } from '../../src/special-datasets/activities.service';
import { JoinRequestsService } from '../../src/special-datasets/join-requests.service';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  workspaceId: 1,
  sessionId: 'session-1',
  permissions: [],
  isSystemAdmin: false,
  isWorkspaceAdmin: false,
};

describe('special Dataset invariants', () => {
  it('allows Join Requests only for guest members', async () => {
    const prisma = {
      dataset: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'dataset-1',
          status: DatasetStatus.active,
          type: DatasetType.join_requests,
        }),
      },
      datasetField: { findMany: vi.fn().mockResolvedValue([]) },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue({
          memberType: { slug: 'member' },
          user: { email: 'member@example.com', name: 'Member' },
        }),
      },
    };
    const service = new JoinRequestsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.submit(1, 'dataset-1', {
      values: {},
      relations: {},
    }, actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a concurrent Join Request decision with stale revision', async () => {
    const tx = {
      joinRequest: {
        findUnique: vi.fn().mockResolvedValue({
          workspaceId: 1,
          status: JoinRequestStatus.submitted,
          row: { subject: { userId: 'user-1' }, sourceRelations: [] },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new JoinRequestsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.reject(1, 'row-1', {
      expectedRevision: 1,
    }, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not bind registrations while an Activity is closed', async () => {
    const service = new ActivitiesService({} as never, {} as never, {} as never);

    await expect(service.bindRegistration({} as never, {
      id: 'activity-1',
      registrationDatasetId: 'dataset-1',
      status: ActivityStatus.closed,
      workspaceId: 1,
    }, 'row-1', null)).rejects.toBeInstanceOf(ConflictException);
  });
});
