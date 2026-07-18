import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

// First release runs a single default workspace resolved entirely server-side.
// Clients never assert a workspace id (design §1.1). The id is cached because it
// is stable for the process lifetime once bootstrap has created it.
@Injectable()
export class WorkspaceService {
  private defaultWorkspaceId?: string;

  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async requireDefaultWorkspaceId(): Promise<string> {
    if (this.defaultWorkspaceId) {
      return this.defaultWorkspaceId;
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });

    if (!workspace) {
      throw new Error('Default workspace has not been provisioned. Run bootstrap first.');
    }

    this.defaultWorkspaceId = workspace.id;

    return workspace.id;
  }
}
