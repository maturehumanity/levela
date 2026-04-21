import { describe, expect, it } from 'vitest';

import { APP_PERMISSIONS, FOUNDER_BASE_PERMISSIONS, rolePermissionMap } from '@/lib/access-control';

describe('access control', () => {
  it('keeps founder permissions explicit and non-superuser by default', () => {
    const founderPermissions = rolePermissionMap.founder;

    expect(founderPermissions).toEqual(FOUNDER_BASE_PERMISSIONS);
    expect(founderPermissions).not.toContain('role.assign');
    expect(founderPermissions).not.toContain('settings.manage');
    expect(founderPermissions).not.toContain('profile.update_any');
    expect(founderPermissions).not.toContain('market.manage');
    expect(founderPermissions).toContain('build.use');
    expect(founderPermissions).toContain('content.moderate');
  });

  it('keeps admin as the full application-superuser role', () => {
    expect(rolePermissionMap.admin).toEqual(APP_PERMISSIONS);
    expect(rolePermissionMap.system).toEqual(APP_PERMISSIONS);
  });
});
