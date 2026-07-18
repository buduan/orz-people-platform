export const API_REQUEST_ID_HEADER = 'x-request-id' as const;
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key' as const;
export const REVISION_HEADER = 'if-match' as const;

export type WorkspaceAudience = 'anonymous' | 'authenticated' | 'member' | 'admin';

export interface WorkspaceActor {
  audience: WorkspaceAudience;
  userId?: string;
}

export interface WorkspaceContext {
  actor: WorkspaceActor;
  permissions: readonly string[];
  requestId: string;
  workspaceId: string;
}

export interface CursorPageRequest {
  cursor?: string;
  limit: number;
}

export interface CursorPageInfo {
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface CursorPage<T> {
  items: T[];
  pageInfo: CursorPageInfo;
}

export interface Revisioned {
  revision: number;
}

export interface RevisionPrecondition {
  revision: number;
}

export interface IdempotencyRequest {
  key: string;
  payloadHash: string;
}

export interface IdempotencyResult {
  key: string;
  replayed: boolean;
}
