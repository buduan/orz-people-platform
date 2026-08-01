import { ConflictException } from '@nestjs/common';
import {
  describe, expect, it, vi,
} from 'vitest';

import { MembersSyncService } from '../../src/datasets/members-sync.service';

describe('Members Dataset synchronization', () => {
  it('does not create an extension row for a guest member', async () => {
    const tx = {
      membersDatasetBinding: {
        findUnique: vi.fn().mockResolvedValue({ datasetId: 'members-dataset' }),
      },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-1',
          workspaceId: 1,
          userId: 'user-1',
          status: 'active',
          memberType: { slug: 'guest' },
          user: { name: 'Guest', email: 'guest@example.com' },
          memberProfileRow: null,
        }),
      },
      datasetField: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'f-user', systemKey: 'member_user' },
          { id: 'f-name', systemKey: 'member_name' },
          { id: 'f-email', systemKey: 'member_email' },
          { id: 'f-type', systemKey: 'member_type' },
          { id: 'f-status', systemKey: 'member_status' },
        ]),
      },
      datasetRow: { create: vi.fn() },
    };
    const service = new MembersSyncService({ record: vi.fn() } as never);

    await service.synchronize(tx as never, 1, 'member-1', 'admin-1');
    expect(tx.datasetRow.create).not.toHaveBeenCalled();
  });

  it('projects migration-defined system fields for a non-guest member', async () => {
    const tx = {
      membersDatasetBinding: {
        findUnique: vi.fn().mockResolvedValue({ datasetId: 'members-dataset' }),
      },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-1',
          workspaceId: 1,
          userId: 'user-1',
          status: 'active',
          memberType: { slug: 'member' },
          user: { name: 'Member', email: 'member@example.com' },
          memberProfileRow: null,
        }),
      },
      datasetField: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'f-user', systemKey: 'member_user' },
          { id: 'f-name', systemKey: 'member_name' },
          { id: 'f-email', systemKey: 'member_email' },
          { id: 'f-type', systemKey: 'member_type' },
          { id: 'f-status', systemKey: 'member_status' },
        ]),
      },
      datasetRow: { create: vi.fn().mockResolvedValue({ id: 'row-1', revision: 1 }) },
      memberProfileRow: { create: vi.fn() },
      datasetRowSubject: { create: vi.fn() },
      datasetRowVersion: { create: vi.fn() },
    };
    const service = new MembersSyncService({ record: vi.fn() } as never);

    await service.synchronize(tx as never, 1, 'member-1', 'admin-1');

    expect(tx.datasetRow.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        workspaceId: 1,
        datasetId: 'members-dataset',
        values: {
          'f-user': 'user-1',
          'f-name': 'Member',
          'f-email': 'member@example.com',
          'f-type': 'member',
          'f-status': 'active',
        },
        createdByUserId: 'admin-1',
        updatedByUserId: 'admin-1',
      },
    }));
    expect(tx.datasetRowVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rowId: 'row-1',
        valuesSnapshot: {
          'f-user': 'user-1',
          'f-name': 'Member',
          'f-email': 'member@example.com',
          'f-type': 'member',
          'f-status': 'active',
        },
      }),
    }));
  });

  it('rejects a Members Dataset missing a required system field', async () => {
    const tx = {
      membersDatasetBinding: {
        findUnique: vi.fn().mockResolvedValue({ datasetId: 'members-dataset' }),
      },
      workspaceMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'member-1',
          workspaceId: 1,
          userId: 'user-1',
          status: 'active',
          memberType: { slug: 'member' },
          user: { name: 'Member', email: 'member@example.com' },
          memberProfileRow: null,
        }),
      },
      datasetField: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'f-user', systemKey: 'member_user' },
          { id: 'f-name', systemKey: 'member_name' },
          { id: 'f-email', systemKey: 'member_email' },
          { id: 'f-type', systemKey: 'member_type' },
        ]),
      },
    };
    const service = new MembersSyncService({ record: vi.fn() } as never);

    await expect(service.synchronize(tx as never, 1, 'member-1', 'admin-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
