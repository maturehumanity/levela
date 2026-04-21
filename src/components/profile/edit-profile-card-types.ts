import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import type { CountryOption } from '@/lib/countries';
import { LAYOUT_REGION_LABELS } from '@/lib/edit-profile-helpers';
import type { CardCategory } from '@/lib/taxonomy';

export type ProfileSnapshot = {
  avatar_url?: string | null;
  full_name?: string | null;
  is_verified?: boolean | null;
  role?: string | null;
};

export type FullNameChangeState = {
  canEdit: boolean;
};

export type WorldCitizenIdDisplay = {
  leading: string;
  trailing: string;
};

export type CategoryPopoverMetrics = {
  width: number;
  alignOffset: number;
};

export type RenderLayoutRegion = (
  key: keyof typeof LAYOUT_REGION_LABELS,
  children: ReactNode,
  options?: {
    className?: string;
    roundedClassName?: string;
  },
) => ReactNode;

export type WorldCitizenCardProps = {
  avatarAlt: string;
  avatarInitials: string;
  cardCategories: CardCategory[];
  cardCategoryCode: string;
  categoryPickerOpen: boolean;
  categoryPopoverMetrics: CategoryPopoverMetrics;
  categoryTriggerRef: RefObject<HTMLButtonElement | null>;
  citizenStatusPrefix: string;
  countryOptions: CountryOption[];
  dateOfBirth: string;
  dateOfBirthLabel: string;
  didDisplay: string | null;
  displayedPlaceOfBirth: string;
  editingDateOfBirth: boolean;
  editingName: boolean;
  editingSex: boolean;
  expiryLabel: string;
  fullName: string;
  fullNameChangeState: FullNameChangeState;
  givenName: string;
  handleAvatarUploadClick: () => void;
  handleCategorySelect: (code: string) => void;
  isBuildModeActive: () => boolean;
  memberSinceLabel: string;
  mrzLines: string[];
  officialIdDisplay: WorldCitizenIdDisplay | null;
  openCategoryPicker: () => void;
  openPlaceOfBirthPicker: () => void;
  placeOfBirthPickerOpen: boolean;
  profile: ProfileSnapshot | null;
  renderLayoutRegion: RenderLayoutRegion;
  scheduleCategoryPickerClose: () => void;
  schedulePlaceOfBirthPickerClose: () => void;
  selectedCardCategory: CardCategory;
  setCategoryPickerOpen: Dispatch<SetStateAction<boolean>>;
  setDateOfBirth: (value: string) => void;
  setEditingDateOfBirth: (value: boolean) => void;
  setEditingName: (value: boolean) => void;
  setEditingSex: (value: boolean) => void;
  setFullName: (value: string) => void;
  setPlaceOfBirth: (value: string) => void;
  setPlaceOfBirthPickerOpen: Dispatch<SetStateAction<boolean>>;
  setSex: (value: string) => void;
  setShowOfficialId: Dispatch<SetStateAction<boolean>>;
  sex: string;
  sexLabel: string;
  showOfficialId: boolean;
  surname: string;
  t: (key: string) => string;
  toggleWorldCitizenCardSide: () => void;
  uploadingAvatar: boolean;
  worldCitizenCardSide: 'front' | 'back';
  worldCitizenFrontCardRef: RefObject<HTMLDivElement | null>;
};
