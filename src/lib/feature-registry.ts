import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookOpen,
  Compass,
  Edit3,
  FileText,
  Globe,
  GraduationCap,
  Scale,
  LayoutGrid,
  MessageSquareText,
  PlusCircle,
  Settings2,
  Shield,
  KeyRound,
  ShoppingBag,
  Store,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';

/**
 * Canonical feature registry.
 *
 * Rule: whenever a new feature, workflow, page behavior, or notable asset behavior is added,
 * update this registry and the matching keys in `src/lib/i18n.base.ts`.
 *
 * The Features page renders from this file so both users and AI agents can refer to the same
 * source of truth for sections, pages, workflows, and detailed functionality.
 */

export type SectionId =
  | 'administration'
  | 'home'
  | 'discovery'
  | 'knowledge'
  | 'contribution'
  | 'identity'
  | 'marketplace'
  | 'preferences';

export type PageId =
  | 'contribute'
  | 'home'
  | 'features'
  | 'law'
  | 'terms'
  | 'search'
  | 'endorse'
  | 'market'
  | 'profile'
  | 'editProfile'
  | 'settings'
  | 'pillars'
  | 'messaging'
  | 'adminUsers'
  | 'adminPermissions';

export type FeatureId =
  | 'accessControl'
  | 'adminUsers'
  | 'adminPermissions'
  | 'autosaveDefaults'
  | 'countryAutoSave'
  | 'contributionHub'
  | 'trustFeed'
  | 'messaging'
  | 'scoreSnapshot'
  | 'directorySearch'
  | 'publicProfiles'
  | 'endorsements'
  | 'featureExplorer'
  | 'lawLibrary'
  | 'marketPreview'
  | 'profileEditing'
  | 'profilePageMenu'
  | 'photoUpload'
  | 'languageTheme'
  | 'pillarCustomization'
  | 'termsUse';

export type RegistryEntry<T extends string> = {
  id: T;
  icon: LucideIcon;
  labelKey: string;
};

export type FeatureEntry = {
  id: FeatureId;
  icon: LucideIcon;
  titleKey: string;
  summaryKey: string;
  workflowKey: string;
  detailsKey: string;
  section: SectionId;
  page: PageId;
};

export const sectionRegistry: Record<SectionId, RegistryEntry<SectionId>> = {
  administration: { id: 'administration', icon: Shield, labelKey: 'features.sections.administration' },
  home: { id: 'home', icon: LayoutGrid, labelKey: 'features.sections.home' },
  discovery: { id: 'discovery', icon: Compass, labelKey: 'features.sections.discovery' },
  knowledge: { id: 'knowledge', icon: BookOpen, labelKey: 'features.sections.knowledge' },
  contribution: { id: 'contribution', icon: PlusCircle, labelKey: 'features.sections.contribution' },
  identity: { id: 'identity', icon: Shield, labelKey: 'features.sections.identity' },
  marketplace: { id: 'marketplace', icon: ShoppingBag, labelKey: 'features.sections.marketplace' },
  preferences: { id: 'preferences', icon: Settings2, labelKey: 'features.sections.preferences' },
};

export const pageRegistry: Record<PageId, RegistryEntry<PageId>> = {
  contribute: { id: 'contribute', icon: PlusCircle, labelKey: 'features.pages.contribute' },
  home: { id: 'home', icon: LayoutGrid, labelKey: 'features.pages.home' },
  features: { id: 'features', icon: Compass, labelKey: 'features.pages.features' },
  law: { id: 'law', icon: Scale, labelKey: 'features.pages.law' },
  terms: { id: 'terms', icon: FileText, labelKey: 'features.pages.terms' },
  search: { id: 'search', icon: Users, labelKey: 'features.pages.search' },
  endorse: { id: 'endorse', icon: Award, labelKey: 'features.pages.endorse' },
  market: { id: 'market', icon: Store, labelKey: 'features.pages.market' },
  profile: { id: 'profile', icon: Shield, labelKey: 'features.pages.profile' },
  editProfile: { id: 'editProfile', icon: Edit3, labelKey: 'features.pages.editProfile' },
  settings: { id: 'settings', icon: Settings2, labelKey: 'features.pages.settings' },
  pillars: { id: 'pillars', icon: TrendingUp, labelKey: 'features.pages.pillars' },
  messaging: { id: 'messaging', icon: MessageSquareText, labelKey: 'features.pages.messaging' },
  adminUsers: { id: 'adminUsers', icon: Users, labelKey: 'features.pages.adminUsers' },
  adminPermissions: { id: 'adminPermissions', icon: KeyRound, labelKey: 'features.pages.adminPermissions' },
};

export const featureRegistry: FeatureEntry[] = [
  {
    id: 'accessControl',
    icon: Shield,
    titleKey: 'features.catalog.accessControl.title',
    summaryKey: 'features.catalog.accessControl.summary',
    workflowKey: 'features.catalog.accessControl.workflow',
    detailsKey: 'features.catalog.accessControl.details',
    section: 'preferences',
    page: 'settings',
  },
  {
    id: 'adminUsers',
    icon: Users,
    titleKey: 'features.catalog.adminUsers.title',
    summaryKey: 'features.catalog.adminUsers.summary',
    workflowKey: 'features.catalog.adminUsers.workflow',
    detailsKey: 'features.catalog.adminUsers.details',
    section: 'administration',
    page: 'adminUsers',
  },
  {
    id: 'adminPermissions',
    icon: KeyRound,
    titleKey: 'features.catalog.adminPermissions.title',
    summaryKey: 'features.catalog.adminPermissions.summary',
    workflowKey: 'features.catalog.adminPermissions.workflow',
    detailsKey: 'features.catalog.adminPermissions.details',
    section: 'administration',
    page: 'adminPermissions',
  },
  {
    id: 'autosaveDefaults',
    icon: Edit3,
    titleKey: 'features.catalog.autosaveDefaults.title',
    summaryKey: 'features.catalog.autosaveDefaults.summary',
    workflowKey: 'features.catalog.autosaveDefaults.workflow',
    detailsKey: 'features.catalog.autosaveDefaults.details',
    section: 'preferences',
    page: 'settings',
  },
  {
    id: 'contributionHub',
    icon: PlusCircle,
    titleKey: 'features.catalog.contributionHub.title',
    summaryKey: 'features.catalog.contributionHub.summary',
    workflowKey: 'features.catalog.contributionHub.workflow',
    detailsKey: 'features.catalog.contributionHub.details',
    section: 'contribution',
    page: 'contribute',
  },
  {
    id: 'trustFeed',
    icon: LayoutGrid,
    titleKey: 'features.catalog.trustFeed.title',
    summaryKey: 'features.catalog.trustFeed.summary',
    workflowKey: 'features.catalog.trustFeed.workflow',
    detailsKey: 'features.catalog.trustFeed.details',
    section: 'home',
    page: 'home',
  },
  {
    id: 'messaging',
    icon: MessageSquareText,
    titleKey: 'features.catalog.messaging.title',
    summaryKey: 'features.catalog.messaging.summary',
    workflowKey: 'features.catalog.messaging.workflow',
    detailsKey: 'features.catalog.messaging.details',
    section: 'home',
    page: 'messaging',
  },
  {
    id: 'profilePageMenu',
    icon: Compass,
    titleKey: 'features.catalog.profilePageMenu.title',
    summaryKey: 'features.catalog.profilePageMenu.summary',
    workflowKey: 'features.catalog.profilePageMenu.workflow',
    detailsKey: 'features.catalog.profilePageMenu.details',
    section: 'identity',
    page: 'home',
  },
  {
    id: 'scoreSnapshot',
    icon: TrendingUp,
    titleKey: 'features.catalog.scoreSnapshot.title',
    summaryKey: 'features.catalog.scoreSnapshot.summary',
    workflowKey: 'features.catalog.scoreSnapshot.workflow',
    detailsKey: 'features.catalog.scoreSnapshot.details',
    section: 'identity',
    page: 'profile',
  },
  {
    id: 'directorySearch',
    icon: Users,
    titleKey: 'features.catalog.directorySearch.title',
    summaryKey: 'features.catalog.directorySearch.summary',
    workflowKey: 'features.catalog.directorySearch.workflow',
    detailsKey: 'features.catalog.directorySearch.details',
    section: 'discovery',
    page: 'search',
  },
  {
    id: 'publicProfiles',
    icon: Shield,
    titleKey: 'features.catalog.publicProfiles.title',
    summaryKey: 'features.catalog.publicProfiles.summary',
    workflowKey: 'features.catalog.publicProfiles.workflow',
    detailsKey: 'features.catalog.publicProfiles.details',
    section: 'discovery',
    page: 'profile',
  },
  {
    id: 'endorsements',
    icon: Award,
    titleKey: 'features.catalog.endorsements.title',
    summaryKey: 'features.catalog.endorsements.summary',
    workflowKey: 'features.catalog.endorsements.workflow',
    detailsKey: 'features.catalog.endorsements.details',
    section: 'contribution',
    page: 'endorse',
  },
  {
    id: 'featureExplorer',
    icon: Compass,
    titleKey: 'features.catalog.featureExplorer.title',
    summaryKey: 'features.catalog.featureExplorer.summary',
    workflowKey: 'features.catalog.featureExplorer.workflow',
    detailsKey: 'features.catalog.featureExplorer.details',
    section: 'discovery',
    page: 'features',
  },
  {
    id: 'lawLibrary',
    icon: Scale,
    titleKey: 'features.catalog.lawLibrary.title',
    summaryKey: 'features.catalog.lawLibrary.summary',
    workflowKey: 'features.catalog.lawLibrary.workflow',
    detailsKey: 'features.catalog.lawLibrary.details',
    section: 'knowledge',
    page: 'law',
  },
  {
    id: 'termsUse',
    icon: FileText,
    titleKey: 'features.catalog.termsUse.title',
    summaryKey: 'features.catalog.termsUse.summary',
    workflowKey: 'features.catalog.termsUse.workflow',
    detailsKey: 'features.catalog.termsUse.details',
    section: 'preferences',
    page: 'terms',
  },
  {
    id: 'marketPreview',
    icon: ShoppingBag,
    titleKey: 'features.catalog.marketPreview.title',
    summaryKey: 'features.catalog.marketPreview.summary',
    workflowKey: 'features.catalog.marketPreview.workflow',
    detailsKey: 'features.catalog.marketPreview.details',
    section: 'marketplace',
    page: 'market',
  },
  {
    id: 'profileEditing',
    icon: Edit3,
    titleKey: 'features.catalog.profileEditing.title',
    summaryKey: 'features.catalog.profileEditing.summary',
    workflowKey: 'features.catalog.profileEditing.workflow',
    detailsKey: 'features.catalog.profileEditing.details',
    section: 'identity',
    page: 'editProfile',
  },
  {
    id: 'countryAutoSave',
    icon: Globe,
    titleKey: 'features.catalog.countryAutoSave.title',
    summaryKey: 'features.catalog.countryAutoSave.summary',
    workflowKey: 'features.catalog.countryAutoSave.workflow',
    detailsKey: 'features.catalog.countryAutoSave.details',
    section: 'identity',
    page: 'editProfile',
  },
  {
    id: 'photoUpload',
    icon: Upload,
    titleKey: 'features.catalog.photoUpload.title',
    summaryKey: 'features.catalog.photoUpload.summary',
    workflowKey: 'features.catalog.photoUpload.workflow',
    detailsKey: 'features.catalog.photoUpload.details',
    section: 'identity',
    page: 'editProfile',
  },
  {
    id: 'languageTheme',
    icon: Globe,
    titleKey: 'features.catalog.languageTheme.title',
    summaryKey: 'features.catalog.languageTheme.summary',
    workflowKey: 'features.catalog.languageTheme.workflow',
    detailsKey: 'features.catalog.languageTheme.details',
    section: 'preferences',
    page: 'settings',
  },
  {
    id: 'pillarCustomization',
    icon: GraduationCap,
    titleKey: 'features.catalog.pillarCustomization.title',
    summaryKey: 'features.catalog.pillarCustomization.summary',
    workflowKey: 'features.catalog.pillarCustomization.workflow',
    detailsKey: 'features.catalog.pillarCustomization.details',
    section: 'preferences',
    page: 'pillars',
  },
];
