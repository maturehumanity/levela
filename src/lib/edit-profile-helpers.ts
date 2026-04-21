export type ProfileDraft = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  sex: string | null;
  country: string | null;
  country_code: string | null;
};

export const LAYOUT_REGION_LABELS = {
  editProfilePage: 'Edit Profile Page',
  editProfileBackGroup: 'Return Layer',
  editProfileBackIcon: 'Icon "Return"',
  editProfileBackText: 'Text "Back"',
  editProfileTitleGroup: 'Title Layer',
  editProfileTitle: 'Edit Profile',
  editProfileCardsGroup: 'Cards Layer',
  editProfileWorldCitizenCard: 'Layer - ID Card',
  editProfileWorldCitizenFront: 'Card Background (Front Page)',
  editProfileWorldCitizenBack: 'Card Background (Back Page)',
  editProfileSocialCard: 'Layer - Social Card',
  editProfileSocialFront: 'Social Card Background (Front Page)',
  editProfileSocialBack: 'Card Background (Back Page)',
  editProfileCarouselDots: 'Card Carousel Dots',
  editProfileUsernameGroup: 'Username',
  editProfileCountryGroup: 'Country',
  editProfileBioGroup: 'Bio',
  editProfileAutosaveGroup: 'Autosave Status',
  wcFrontHeaderGroup: 'World Citizen ID Header',
  wcFrontTitle: 'World Citizen ID [Role]',
  wcFrontCategoryBadge: 'Category Badge',
  wcFrontCategoryButton: 'Category',
  wcFrontCategoryLabel: 'Category Label',
  wcFrontCategoryValue: 'Category Type',
  wcFrontPhotoLayer: 'Photo Layer',
  wcFrontPhoto: 'Photo',
  wcFrontInfoCompactGroup: 'User Details Layer',
  wcFrontIdRow: 'Identity Row',
  wcFrontSurnameBlock: 'Surname',
  wcFrontSurnameLabel: 'Surname Label',
  wcFrontSurnameValue: 'Surname Value',
  wcFrontGivenNameLabel: 'Given Name Label',
  wcFrontGivenNameValue: 'Given Name Value',
  wcFrontGivenNameBlock: 'Given Name',
  wcFrontIdLineCompact: 'ID Number',
  wcFrontIdLineCompactLabel: 'ID Label',
  wcFrontIdLineCompactValue: 'ID Value',
  wcFrontIdLineCompactToggle: 'ID Visibility Toggle',
  wcFrontBirthPlaceCompact: 'Place of Birth',
  wcFrontBirthPlaceCompactLabel: 'Place of Birth Label',
  wcFrontBirthPlaceCompactValue: 'Place of Birth Value',
  wcFrontDobCompact: 'Date of Birth Card',
  wcFrontDobCompactLabel: 'Date of Birth Label',
  wcFrontDobCompactValue: 'Date of Birth Value',
  wcFrontSexCompact: 'Sex Card',
  wcFrontSexCompactLabel: 'Sex Label',
  wcFrontSexCompactValue: 'Sex Value',
  wcFrontExpiresCompact: 'Card Expires',
  wcFrontExpiresCompactLabel: 'Card Expires Label',
  wcFrontExpiresCompactValue: 'Card Expires Date',
  wcFrontMemberSinceCompact: 'Member Since',
  wcFrontMemberSinceCompactLabel: 'Member Since Label',
  wcFrontMemberSinceCompactValue: 'Member Since Date',
  wcFrontFooterLeftChevron: 'ID front footer left chevron',
  wcFrontFooterRightChevron: 'ID front footer right chevron',
  wcFrontEditWindowCompact: 'ID front edit window compact',
  wcFrontSurnameField: 'ID front surname',
  wcFrontGivenNameField: 'ID front given name',
  wcFrontBirthPlaceField: 'ID front place of birth',
  wcFrontBirthDateField: 'ID front date of birth',
  wcFrontSexField: 'ID front sex',
  wcFrontDatesBand: 'ID front dates band',
  wcFrontDob: 'ID front date of birth',
  wcFrontPlaceOfBirth: 'ID front place of birth',
  wcFrontCardExpires: 'ID front card expires',
  wcFrontMemberSinceLine: 'ID front identity meta',
  wcFrontSex: 'ID front sex',
  wcFrontEditWindow: 'ID front footer text',
  wcFrontFooterArrows: 'ID front footer arrows',
  wcBackNames: 'ID back names',
  wcBackGivenNameLabel: 'Back Given Name Label',
  wcBackGivenNameValue: 'Back Given Name Value',
  wcBackSurnameLabel: 'Back Surname Label',
  wcBackSurnameValue: 'Back Surname Value',
  wcBackIssuer: 'ID back issuer',
  wcBackIssuerLabel: 'Back Issuer Label',
  wcBackIssuerValue: 'Back Issuer Value',
  wcBackDid: 'ID back DID',
  wcBackDidLabel: 'Back DID Label',
  wcBackDidValue: 'Back DID Value',
  wcBackMrz: 'ID back MRZ',
  wcBackMrzLine1: 'Back MRZ Line 1',
  wcBackMrzLine2: 'Back MRZ Line 2',
  wcBackMrzLine3: 'Back MRZ Line 3',
  socialFrontTitle: 'Social front title',
  socialFrontBadge: 'Social front badge',
  socialFrontIdentifier: 'Social front identifier',
  socialFrontVerification: 'Social front verification',
  socialFrontRegistry: 'Social front registry',
  socialFrontFooter: 'Social front footer',
  socialBackTitle: 'Social back title',
  socialBackBadge: 'Social back badge',
  socialBackVerification: 'Social back verification',
  socialBackQr: 'Social back QR',
  socialBackLegacy: 'Social back legacy',
  socialBackDid: 'Social back DID',
} as const;

export const LEGACY_LAYOUT_STORAGE_PREFIX = 'levela-edit-profile-layout-v1';
export const EDIT_PROFILE_LAYOUT_SCHEMA_VERSION = 3;
export const EDIT_PROFILE_LAYOUT_SCHEMA_KEY_PREFIX = 'levela-edit-profile-layout-schema-v1';
export const BUILD_STORAGE_EVENT = 'levela-build-storage-updated';

const BUILD_STORAGE_KEYS = [
  'levela-global-build-v1',
  'levela-global-build-groups-v1',
  'levela-global-build-parents-v1',
  'levela-global-build-orders-v1',
] as const;

export function normalizeProfileDraft(values: {
  fullName: string;
  username: string;
  bio: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: string;
  country: string;
  countryCode: string;
}): ProfileDraft {
  return {
    full_name: values.fullName.trim() || null,
    username: values.username.trim() || null,
    bio: values.bio.trim() || null,
    date_of_birth: values.dateOfBirth || null,
    place_of_birth: values.placeOfBirth.trim() || null,
    sex: values.sex.trim() || null,
    country: values.country.trim() || null,
    country_code: values.countryCode.trim() || null,
  };
}

export function areDraftsEqual(a: ProfileDraft | null, b: ProfileDraft | null) {
  if (!a || !b) return false;
  return (
    a.full_name === b.full_name &&
    a.username === b.username &&
    a.bio === b.bio &&
    a.date_of_birth === b.date_of_birth &&
    a.place_of_birth === b.place_of_birth &&
    a.sex === b.sex &&
    a.country === b.country &&
    a.country_code === b.country_code
  );
}

function clearBuildStoragePath(storageKey: string, pathname: string) {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) return false;

  try {
    const parsedStorage = JSON.parse(rawStorage) as Record<string, unknown>;
    if (!parsedStorage || typeof parsedStorage !== 'object') {
      window.localStorage.removeItem(storageKey);
      return true;
    }

    if (!(pathname in parsedStorage)) return false;

    delete parsedStorage[pathname];
    if (Object.keys(parsedStorage).length === 0) {
      window.localStorage.removeItem(storageKey);
      return true;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(parsedStorage));
    return true;
  } catch {
    window.localStorage.removeItem(storageKey);
    return true;
  }
}

export function resetEditProfileBuildStorage(pathname: string) {
  let didChange = false;

  BUILD_STORAGE_KEYS.forEach((storageKey) => {
    if (clearBuildStoragePath(storageKey, pathname)) {
      didChange = true;
    }
  });

  return didChange;
}

export function getUsernameChangeState(profile?: {
  created_at: string;
  username_last_changed_at?: string | null;
}) {
  if (!profile) {
    return { canEdit: false, key: 'editProfile.usernameChangeUnavailable', vars: {} as Record<string, string> };
  }

  const createdAt = new Date(profile.created_at);
  const now = new Date();
  const firstWindowEndsAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  if (now <= firstWindowEndsAt) {
    return {
      canEdit: true,
      key: 'editProfile.usernameChangeWindow',
      vars: { date: firstWindowEndsAt.toLocaleString() },
    };
  }

  if (!profile.username_last_changed_at) {
    return {
      canEdit: true,
      key: 'editProfile.usernameChangeAvailable',
      vars: {},
    };
  }

  const nextAvailableAt = new Date(new Date(profile.username_last_changed_at).getTime() + 365 * 24 * 60 * 60 * 1000);
  if (now >= nextAvailableAt) {
    return {
      canEdit: true,
      key: 'editProfile.usernameChangeYearlyAvailable',
      vars: {},
    };
  }

  return {
    canEdit: false,
    key: 'editProfile.usernameChangeNextDate',
    vars: { date: nextAvailableAt.toLocaleDateString() },
  };
}

export function getFullNameChangeState(profile?: {
  created_at: string;
  full_name_change_count?: number | null;
}) {
  if (!profile) {
    return {
      canEdit: false,
      deadline: null as Date | null,
      key: 'editProfile.nameChangeUnavailable',
      vars: {} as Record<string, string>,
    };
  }

  const createdAt = new Date(profile.created_at);
  const deadline = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > deadline) {
    return {
      canEdit: false,
      deadline,
      key: 'editProfile.nameChangeEnded',
      vars: { date: deadline.toLocaleDateString() },
    };
  }

  return {
    canEdit: true,
    deadline,
    key: 'editProfile.nameChangeAvailable',
    vars: { date: deadline.toLocaleDateString() },
  };
}
