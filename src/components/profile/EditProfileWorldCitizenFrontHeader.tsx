import { Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getWorldCitizenStatusLabel } from '@/lib/world-citizen-id';
import type { WorldCitizenCardProps } from './edit-profile-card-types';

type EditProfileWorldCitizenFrontHeaderProps = Pick<
  WorldCitizenCardProps,
  | 'cardCategories'
  | 'cardCategoryCode'
  | 'categoryPickerOpen'
  | 'categoryPopoverMetrics'
  | 'categoryTriggerRef'
  | 'citizenStatusPrefix'
  | 'editingName'
  | 'fullName'
  | 'fullNameChangeState'
  | 'givenName'
  | 'handleCategorySelect'
  | 'isBuildModeActive'
  | 'openCategoryPicker'
  | 'profile'
  | 'renderLayoutRegion'
  | 'scheduleCategoryPickerClose'
  | 'selectedCardCategory'
  | 'setCategoryPickerOpen'
  | 'setEditingName'
  | 'setFullName'
  | 'surname'
  | 't'
>;

export function EditProfileWorldCitizenFrontHeader({
  cardCategories,
  cardCategoryCode,
  categoryPickerOpen,
  categoryPopoverMetrics,
  categoryTriggerRef,
  citizenStatusPrefix,
  editingName,
  fullName,
  fullNameChangeState,
  givenName,
  handleCategorySelect,
  isBuildModeActive,
  openCategoryPicker,
  profile,
  renderLayoutRegion,
  scheduleCategoryPickerClose,
  selectedCardCategory,
  setCategoryPickerOpen,
  setEditingName,
  setFullName,
  surname,
  t,
}: EditProfileWorldCitizenFrontHeaderProps) {
  return (
    <div
      className="flex items-start justify-between gap-2"
      data-build-key="wcFrontHeaderGroup"
      data-build-label="World Citizen ID Header"
    >
      {renderLayoutRegion(
        'wcFrontTitle',
        <div className="min-w-0 space-y-0.5">
          <p className="whitespace-nowrap text-[9px] uppercase tracking-[0.14em] leading-none text-cyan-50/85">
            {t('editProfile.worldCitizenId')} • {getWorldCitizenStatusLabel(profile?.role, citizenStatusPrefix, t).toUpperCase()}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {renderLayoutRegion(
              'wcFrontSurnameBlock',
              <div className="rounded-[16px] bg-black/8 px-2 py-1">
                <p className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62" data-build-key="wcFrontSurnameLabel" data-build-label="Surname Label">
                  {t('editProfile.surname')}
                </p>
                <p className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white" data-build-key="wcFrontSurnameValue" data-build-label="Surname Value">
                  {surname || '—'}
                </p>
              </div>,
              { roundedClassName: 'rounded-[16px]' },
            )}

            {renderLayoutRegion(
              'wcFrontGivenNameBlock',
              <div className="rounded-[16px] bg-black/8 px-2 py-1">
                <p className="text-[8px] uppercase tracking-[0.14em] text-cyan-50/62" data-build-key="wcFrontGivenNameLabel" data-build-label="Given Name Label">
                  {t('editProfile.givenName')}
                </p>
                {editingName ? (
                  <Input
                    value={fullName}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setFullName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        setEditingName(false);
                      }
                    }}
                    onBlur={() => setEditingName(false)}
                    autoFocus
                    className="mt-0.5 h-7 border-cyan-50/15 bg-white/10 px-2 text-[12px] text-white placeholder:text-cyan-50/45 focus-visible:ring-cyan-300"
                  />
                ) : (
                  <p
                    className="mt-0.5 truncate text-[0.9rem] leading-none font-display font-semibold text-white"
                    data-build-key="wcFrontGivenNameValue"
                    data-build-label="Given Name Value"
                    onClick={(event) => {
                      if (!fullNameChangeState.canEdit) return;
                      event.stopPropagation();
                      setEditingName(true);
                    }}
                  >
                    {givenName || '—'}
                  </p>
                )}
              </div>,
              { roundedClassName: 'rounded-[16px]' },
            )}
          </div>
        </div>,
        { className: 'min-w-0 flex-1', roundedClassName: 'rounded-[18px]' },
      )}
      {renderLayoutRegion(
        'wcFrontCategoryBadge',
        <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
          <div className="group/category mt-[30px] shrink-0" onMouseEnter={openCategoryPicker} onMouseLeave={scheduleCategoryPickerClose}>
            <PopoverTrigger asChild>
              {renderLayoutRegion(
                'wcFrontCategoryButton',
                <button
                  ref={categoryTriggerRef}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isBuildModeActive()) return;
                    if (!fullNameChangeState.canEdit) return;
                    setCategoryPickerOpen((current) => !current);
                  }}
                  className="flex h-7 min-w-[112px] items-center justify-center gap-1 rounded-full border border-cyan-50/15 bg-white/8 px-2 text-[10px] uppercase tracking-[0.12em] text-cyan-50 transition-colors hover:bg-white/12"
                >
                  <span className="text-cyan-50/70" data-build-key="wcFrontCategoryLabel" data-build-label="Category Label">
                    {t('editProfile.categoryShort')}
                  </span>
                  <span className="font-display text-sm font-semibold tracking-normal text-white" data-build-key="wcFrontCategoryValue" data-build-label="Category Type">
                    {selectedCardCategory.code}
                  </span>
                  {fullNameChangeState.canEdit ? <ChevronsUpDown className="h-3 w-3 text-cyan-50/70" /> : null}
                </button>,
                { roundedClassName: 'rounded-full' },
              )}
            </PopoverTrigger>
            <PopoverContent
              className="max-w-[calc(100vw-2rem)] p-0"
              align="start"
              alignOffset={categoryPopoverMetrics.alignOffset}
              sideOffset={4}
              style={categoryPopoverMetrics.width ? { width: `${categoryPopoverMetrics.width}px` } : undefined}
              onMouseEnter={openCategoryPicker}
              onMouseLeave={scheduleCategoryPickerClose}
              onClick={(event) => event.stopPropagation()}
            >
              <Command>
                <CommandInput placeholder={t('editProfile.searchCategoryPlaceholder')} />
                <CommandList>
                  <CommandEmpty>{t('editProfile.categoryNotFound')}</CommandEmpty>
                  <CommandGroup className="px-0.5 py-1">
                    {cardCategories.map((category) => (
                      <CommandItem
                        key={category.code}
                        value={`${category.code} ${category.label}`}
                        onSelect={() => handleCategorySelect(category.code)}
                        className="grid grid-cols-[2.35rem_0.75rem_minmax(0,1fr)] items-center gap-x-0.5 px-1"
                      >
                        <span className="w-full font-mono text-xs uppercase tabular-nums text-muted-foreground">{category.code}</span>
                        <Check className={cn('h-4 w-4', cardCategoryCode === category.code ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{category.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </div>
        </Popover>,
        { roundedClassName: 'rounded-full' },
      )}
    </div>
  );
}
