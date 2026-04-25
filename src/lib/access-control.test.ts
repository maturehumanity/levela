import { describe, expect, it } from 'vitest';

import { APP_PERMISSIONS, rolePermissionMap } from '@/lib/access-control';

describe('access control', () => {
  it('keeps founder as full-superuser during bootstrap decentralization stage', () => {
    const founderPermissions = rolePermissionMap.founder;

    expect(founderPermissions).toEqual(APP_PERMISSIONS);
    expect(founderPermissions).toContain('role.assign');
    expect(founderPermissions).toContain('settings.manage');
    expect(founderPermissions).toContain('profile.update_any');
    expect(founderPermissions).toContain('market.manage');
  });

  it('keeps admin as the full application-superuser role', () => {
    expect(rolePermissionMap.admin).toEqual(APP_PERMISSIONS);
    expect(rolePermissionMap.system).toEqual(APP_PERMISSIONS);
  });
});
