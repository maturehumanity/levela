import type { AppPermission } from '@/lib/access-control';
import { permissionListHasAny } from '@/lib/access-control';
import type { LucideIcon } from 'lucide-react';
import { Award, BookOpen, Landmark, LayoutGrid } from 'lucide-react';
import { pageRegistry } from '@/lib/feature-registry';

export type NavigablePageId =
  | 'home'
  | 'study'
  | 'downloads'
  | 'law'
  | 'terms'
  | 'contribute'
  | 'market'
  | 'search'
  | 'endorse'
  | 'profile'
  | 'editProfile'
  | 'professions'
  | 'settings'
  | 'pillars'
  | 'adminRoles'
  | 'adminUsers'
  | 'adminPermissions'
  | 'adminGovernance'
  | 'adminModules';

export type AppPageLink = {
  id: NavigablePageId;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  requiredPermissions?: AppPermission[];
};

export const appPageLinks: AppPageLink[] = [
  { id: 'home', path: '/', labelKey: pageRegistry.home.labelKey, icon: pageRegistry.home.icon },
  { id: 'study', path: '/study', labelKey: 'common.study', icon: BookOpen },
  { id: 'downloads', path: '/download', labelKey: pageRegistry.downloads.labelKey, icon: pageRegistry.downloads.icon },
  {
    id: 'law',
    path: '/law',
    labelKey: pageRegistry.law.labelKey,
    icon: pageRegistry.law.icon,
    requiredPermissions: ['law.read'],
  },
  { id: 'terms', path: '/terms', labelKey: pageRegistry.terms.labelKey, icon: pageRegistry.terms.icon },
  { id: 'contribute', path: '/contribute', labelKey: pageRegistry.contribute.labelKey, icon: pageRegistry.contribute.icon },
  { id: 'market', path: '/market', labelKey: pageRegistry.market.labelKey, icon: pageRegistry.market.icon },
  {
    id: 'search',
    path: '/search',
    labelKey: pageRegistry.search.labelKey,
    icon: pageRegistry.search.icon,
    requiredPermissions: ['profile.read'],
  },
  {
    id: 'endorse',
    path: '/endorse',
    labelKey: pageRegistry.endorse.labelKey,
    icon: pageRegistry.endorse.icon,
    requiredPermissions: ['endorsement.create'],
  },
  {
    id: 'profile',
    path: '/profile',
    labelKey: pageRegistry.profile.labelKey,
    icon: pageRegistry.profile.icon,
    requiredPermissions: ['profile.read'],
  },
  {
    id: 'editProfile',
    path: '/settings/profile',
    labelKey: pageRegistry.editProfile.labelKey,
    icon: pageRegistry.editProfile.icon,
    requiredPermissions: ['profile.update_self'],
  },
  {
    id: 'professions',
    path: '/settings/professions',
    labelKey: 'settings.professions',
    icon: Award,
  },
  {
    id: 'settings',
    path: '/settings',
    labelKey: pageRegistry.settings.labelKey,
    icon: pageRegistry.settings.icon,
  },
  {
    id: 'pillars',
    path: '/settings/pillars',
    labelKey: pageRegistry.pillars.labelKey,
    icon: pageRegistry.pillars.icon,
    requiredPermissions: ['profile.update_self'],
  },
  {
    id: 'adminRoles',
    path: '/settings/admin/roles',
    labelKey: pageRegistry.adminRoles.labelKey,
    icon: pageRegistry.adminRoles.icon,
    requiredPermissions: ['role.assign', 'settings.manage'],
  },
  {
    id: 'adminUsers',
    path: '/settings/admin/users',
    labelKey: pageRegistry.adminUsers.labelKey,
    icon: pageRegistry.adminUsers.icon,
    requiredPermissions: ['role.assign', 'settings.manage'],
  },
  {
    id: 'adminPermissions',
    path: '/settings/admin/permissions',
    labelKey: pageRegistry.adminPermissions.labelKey,
    icon: pageRegistry.adminPermissions.icon,
    requiredPermissions: ['role.assign', 'settings.manage'],
  },
  {
    id: 'adminGovernance',
    path: '/settings/admin/governance',
    labelKey: 'settings.adminGovernance',
    icon: Landmark,
    requiredPermissions: ['role.assign', 'settings.manage'],
  },
  {
    id: 'adminModules',
    path: '/settings/admin/modules',
    labelKey: 'settings.adminModules',
    icon: LayoutGrid,
    requiredPermissions: ['role.assign', 'settings.manage'],
  },
];

export function getAccessiblePageLinks(effectivePermissions: AppPermission[] = []) {
  return appPageLinks.filter(
    (page) => !page.requiredPermissions || permissionListHasAny(effectivePermissions, page.requiredPermissions),
  );
}
