import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PhoneCountryOption } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

type PhoneCountryPickerProps = {
  countryOptions: PhoneCountryOption[];
  countryPickerOpen: boolean;
  emptyLabel: string;
  searchPlaceholder: string;
  selectedCountryCode: string;
  selectedPhoneCountry: PhoneCountryOption;
  setCountryPickerOpen: (open: boolean) => void;
  onCountrySelect: (option: PhoneCountryOption) => void;
};

export function PhoneCountryPicker({
  countryOptions,
  countryPickerOpen,
  emptyLabel,
  searchPlaceholder,
  selectedCountryCode,
  selectedPhoneCountry,
  setCountryPickerOpen,
  onCountrySelect,
}: PhoneCountryPickerProps) {
  return (
    <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-w-[122px] justify-between gap-2 px-3"
        >
          <span className="flex items-center gap-2">
            <span className="text-base">{selectedPhoneCountry.flag}</span>
            <span className="text-sm">{selectedPhoneCountry.dialCode}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {countryOptions.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${option.label} ${option.dialCode}`}
                  onSelect={() => onCountrySelect(option)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedCountryCode === option.code ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="mr-2">{option.flag}</span>
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="text-muted-foreground">{option.dialCode}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
