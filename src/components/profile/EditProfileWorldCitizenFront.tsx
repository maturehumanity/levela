import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EditProfileWorldCitizenFrontDetails } from './EditProfileWorldCitizenFrontDetails';
import { EditProfileWorldCitizenFrontHeader } from './EditProfileWorldCitizenFrontHeader';
import type { WorldCitizenCardProps } from './edit-profile-card-types';

type EditProfileWorldCitizenFrontProps = Pick<
  WorldCitizenCardProps,
  | 'avatarAlt'
  | 'avatarInitials'
  | 'cardCategories'
  | 'cardCategoryCode'
  | 'categoryPickerOpen'
  | 'categoryPopoverMetrics'
  | 'categoryTriggerRef'
  | 'citizenStatusPrefix'
  | 'countryOptions'
  | 'dateOfBirth'
  | 'dateOfBirthLabel'
  | 'displayedPlaceOfBirth'
  | 'editingDateOfBirth'
  | 'editingName'
  | 'editingSex'
  | 'expiryLabel'
  | 'fullName'
  | 'fullNameChangeState'
  | 'givenName'
  | 'handleAvatarUploadClick'
  | 'handleCategorySelect'
  | 'isBuildModeActive'
  | 'memberSinceLabel'
  | 'officialIdDisplay'
  | 'openCategoryPicker'
  | 'openPlaceOfBirthPicker'
  | 'placeOfBirthPickerOpen'
  | 'profile'
  | 'renderLayoutRegion'
  | 'scheduleCategoryPickerClose'
  | 'schedulePlaceOfBirthPickerClose'
  | 'selectedCardCategory'
  | 'setCategoryPickerOpen'
  | 'setDateOfBirth'
  | 'setEditingDateOfBirth'
  | 'setEditingName'
  | 'setEditingSex'
  | 'setFullName'
  | 'setPlaceOfBirth'
  | 'setPlaceOfBirthPickerOpen'
  | 'setSex'
  | 'setShowOfficialId'
  | 'sex'
  | 'sexLabel'
  | 'showOfficialId'
  | 'surname'
  | 't'
  | 'uploadingAvatar'
  | 'worldCitizenCardSide'
  | 'worldCitizenFrontCardRef'
>;

export function EditProfileWorldCitizenFront(props: EditProfileWorldCitizenFrontProps) {
  const { renderLayoutRegion, t, worldCitizenCardSide, worldCitizenFrontCardRef } = props;

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(69,213,204,0.22),transparent_38%),linear-gradient(160deg,#0d1d22,#16333a_56%,#10262c)] p-3 shadow-[0_18px_48px_rgba(4,10,12,0.28)]"
      data-build-ignore={worldCitizenCardSide !== 'front' ? 'true' : undefined}
      data-build-key="editProfileWorldCitizenFront"
      data-build-label="Card Background (Front Page)"
      ref={worldCitizenFrontCardRef}
      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      <div className="flex h-full flex-col">
        <EditProfileWorldCitizenFrontHeader {...props} />
        <EditProfileWorldCitizenFrontDetails {...props} />
        {renderLayoutRegion(
          'wcFrontFooterArrows',
          <div className="mt-auto flex items-end justify-end gap-1 pt-3 text-cyan-50/45">
            <span data-build-key="wcFrontFooterLeftChevron" data-build-label="ID front footer left chevron">
              <ChevronLeft className="h-4 w-4" />
            </span>
            <span data-build-key="wcFrontFooterRightChevron" data-build-label="ID front footer right chevron">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>,
          { roundedClassName: 'rounded-xl' },
        )}
      </div>
    </div>
  );
}
