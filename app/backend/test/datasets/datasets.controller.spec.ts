import {
  describe, expect, it, vi,
} from 'vitest';

import type { AuthenticatedActor } from '@weave/types';

import { DatasetsController } from '../../src/datasets/datasets.controller';

const actor: AuthenticatedActor = {
  userId: 'user-1',
  workspaceId: 7,
  sessionId: 'session-1',
  permissions: ['dataset.manage_all'],
  isSystemAdmin: false,
  isWorkspaceAdmin: false,
};

describe('DatasetsController forwarding', () => {
  it('forwards the actor and Workspace to row-window queries', async () => {
    const request = {
      query: { filters: [], sorts: [], group: null },
      window: { offset: 100, limit: 50 },
    };
    const queryWindow = vi.fn().mockResolvedValue({ items: [] });
    const controller = new DatasetsController(
      {} as never,
      { queryWindow } as never,
    );

    await expect(controller.queryRows(7, 'dataset-1', request as never, actor))
      .resolves.toEqual({ items: [] });
    expect(queryWindow).toHaveBeenCalledOnce();
    expect(queryWindow).toHaveBeenCalledWith(7, 'dataset-1', request, actor);
  });

  it('returns one accepted response after forwarding a row deletion', async () => {
    const softDelete = vi.fn().mockResolvedValue(undefined);
    const controller = new DatasetsController(
      {} as never,
      { softDelete } as never,
    );

    await expect(controller.deleteRow(
      7,
      'dataset-1',
      'row-1',
      { expectedRevision: 4 },
      actor,
    )).resolves.toEqual({ accepted: true });
    expect(softDelete).toHaveBeenCalledWith(7, 'dataset-1', 'row-1', 4, actor);
  });
});
