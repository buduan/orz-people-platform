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
          { id: 'f-user', systemKey: 'user_id' },
          { id: 'f-name', systemKey: 'name' },
          { id: 'f-email', systemKey: 'email' },
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
});
