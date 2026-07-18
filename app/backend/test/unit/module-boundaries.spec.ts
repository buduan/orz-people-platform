import { MODULE_METADATA } from '@nestjs/common/constants';
import type { Type } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AccessModule } from '../../src/access/access.module';
import { AuditModule } from '../../src/audit/audit.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PlatformConfigModule } from '../../src/config/platform-config.module';
import { DeliveryModule } from '../../src/delivery/delivery.module';
import { FormsModule } from '../../src/forms/forms.module';
import { SubmissionsModule } from '../../src/submissions/submissions.module';
import { WorkflowsModule } from '../../src/workflows/workflows.module';
import { WorkspacesModule } from '../../src/workspaces/workspaces.module';

const ALLOWED_IMPORTS = new Map<Type, ReadonlySet<Type>>([
  [AuthModule, new Set()],
  [WorkspacesModule, new Set()],
  [AccessModule, new Set([AuthModule, WorkspacesModule])],
  [FormsModule, new Set([AccessModule, WorkspacesModule])],
  [SubmissionsModule, new Set([AccessModule, FormsModule])],
  [WorkflowsModule, new Set([AccessModule, SubmissionsModule])],
  [DeliveryModule, new Set()],
  [PlatformConfigModule, new Set()],
  [AuditModule, new Set([WorkspacesModule])],
]);

function imports(module: Type): Type[] {
  return Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) as Type[] | undefined ?? [];
}

describe('feature module boundaries', () => {
  it('only imports explicitly allowed feature modules', () => {
    [...ALLOWED_IMPORTS].forEach(([module, allowed]) => {
      expect(imports(module).every((dependency) => allowed.has(dependency))).toBe(true);
    });
  });

  it('contains no circular feature module dependency', () => {
    const visiting = new Set<Type>();
    const visited = new Set<Type>();

    const visit = (module: Type): void => {
      if (visiting.has(module)) {
        throw new Error(`Circular dependency detected at ${module.name}.`);
      }

      if (visited.has(module)) {
        return;
      }

      visiting.add(module);
      imports(module).filter((dependency) => ALLOWED_IMPORTS.has(dependency)).forEach(visit);
      visiting.delete(module);
      visited.add(module);
    };

    ALLOWED_IMPORTS.forEach((_allowed, module) => visit(module));
    expect(visited.size).toBe(ALLOWED_IMPORTS.size);
  });
});
